import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

/**
 * Xero for Metricore: each builder connects their own Xero organisation, and approved work
 * (deposit, progress claims) goes in as DRAFT sales invoices. Nothing is approved or sent
 * to a client from here: the builder checks the draft in Xero first.
 * Actions (POST JSON { action, ... }):
 *   start      -> { url }               Xero sign-in link (state is signed, 15 minutes)
 *   callback   { code, state }          exchange the code, keep the tokens (server only)
 *   status     -> { connected, tenantName, accountCode, accountCodes, brandingThemeId, dueDays }
 *   options    -> { accounts[], brandingThemes[] }   from their Xero, to pick from
 *   settings   { accountCode, accountCodes{deposit,work,variation,retention}, brandingThemeId, dueDays }
 *   disconnect
 *   invoice    { projectId, sourceId, contact, reference, date, lines[] } -> { number, url, updated }
 * Secrets: XERO_CLIENT_ID, XERO_CLIENT_SECRET.
 */

const ALLOWED_ORIGINS = ["https://www.metricore.com.au", "https://metricore.com.au", "http://localhost:8080"];
const SCOPES = "offline_access accounting.invoices accounting.contacts accounting.settings.read";

const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

class UserError extends Error {}
class NotFound extends Error {}

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const headers = { ...cors(origin), "content-type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

  try {
    const clientId = Deno.env.get("XERO_CLIENT_ID");
    const clientSecret = Deno.env.get("XERO_CLIENT_SECRET");
    if (!clientId || !clientSecret) throw new UserError("Xero is not set up on Metricore yet");

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return reply({ error: "Sign in again" }, 401);

    const body = await req.json();
    const action = String(body.action ?? "");
    // the redirect must be one of ours, and the same at start and callback
    const redirectUri = `${ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]}/xero/callback`;

    const basic = "Basic " + btoa(`${clientId}:${clientSecret}`);
    const tokenCall = async (params: Record<string, string>) => {
      const r = await fetch("https://identity.xero.com/connect/token", {
        method: "POST",
        headers: { authorization: basic, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new UserError(j.error === "invalid_grant" ? "Xero needs connecting again (Settings > Xero)" : "Xero sign-in failed: try again");
      return j as { access_token: string; refresh_token: string; expires_in: number };
    };

    if (action === "start") {
      const payload = `${user.id}.${Date.now() + 15 * 60_000}`;
      const state = `${payload}.${await hmac(clientSecret, payload)}`;
      const url = "https://login.xero.com/identity/connect/authorize?" + new URLSearchParams({
        response_type: "code", client_id: clientId, redirect_uri: redirectUri, scope: SCOPES, state,
      });
      return reply({ url });
    }

    if (action === "callback") {
      const [uid, exp, sig] = String(body.state ?? "").split(".");
      if (uid !== user.id || Number(exp) < Date.now() || sig !== await hmac(clientSecret, `${uid}.${exp}`)) {
        throw new UserError("That Xero link expired or belongs to another sign-in: connect again");
      }
      const t = await tokenCall({ grant_type: "authorization_code", code: String(body.code ?? ""), redirect_uri: redirectUri });
      const conns = await fetch("https://api.xero.com/connections", { headers: { authorization: `Bearer ${t.access_token}` } }).then(r => r.json());
      // the organisation picked in THIS sign-in: its connection carries this sign-in's event id
      let eventId = "";
      try { eventId = JSON.parse(atob(t.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).authentication_event_id ?? ""; } catch { /* use the newest */ }
      const orgs = (Array.isArray(conns) ? conns : []).filter((c: any) => c.tenantType === "ORGANISATION");
      const org = orgs.find((c: any) => eventId && c.authEventId === eventId)
        ?? orgs.sort((a: any, b: any) => String(b.updatedDateUtc ?? b.createdDateUtc).localeCompare(String(a.updatedDateUtc ?? a.createdDateUtc)))[0];
      if (!org) throw new UserError("No Xero organisation was chosen: connect again and pick one");
      const { data: prev } = await db.from("xero_connections").select("account_code, due_days, connection_id, tenant_id").eq("user_id", user.id).maybeSingle();
      // switched organisation: drop the old connection so it is not left behind in Xero
      if (prev?.connection_id && prev.tenant_id !== org.tenantId) {
        await fetch(`https://api.xero.com/connections/${prev.connection_id}`, { method: "DELETE", headers: { authorization: `Bearer ${t.access_token}` } }).catch(() => {});
      }
      const shortCode = await fetch("https://api.xero.com/api.xro/2.0/Organisation", {
        headers: { authorization: `Bearer ${t.access_token}`, "xero-tenant-id": org.tenantId, accept: "application/json" },
      }).then(r => r.json()).then(j => j?.Organisations?.[0]?.ShortCode ?? null).catch(() => null);
      const { error } = await db.from("xero_connections").upsert({
        user_id: user.id, tenant_id: org.tenantId, tenant_name: org.tenantName, connection_id: org.id,
        access_token: t.access_token, refresh_token: t.refresh_token,
        expires_at: new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString(),
        account_code: prev?.account_code ?? "200", due_days: prev?.due_days ?? 10, short_code: shortCode,
        connected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return reply({ connected: true, tenantName: org.tenantName });
    }

    const { data: conn } = await db.from("xero_connections").select("*").eq("user_id", user.id).maybeSingle();

    if (action === "status") {
      return reply(conn
        ? { connected: true, tenantName: conn.tenant_name, accountCode: conn.account_code, accountCodes: conn.account_codes ?? {}, brandingThemeId: conn.branding_theme_id ?? null, dueDays: conn.due_days }
        : { connected: false });
    }
    if (!conn) throw new UserError("Connect Xero first (Settings > Xero)");

    // a fresh access token (they last 30 minutes; the refresh token rotates on every use)
    const freshAccess = async (): Promise<string> => {
      if (new Date(conn.expires_at).getTime() > Date.now()) return conn.access_token;
      let t;
      try { t = await tokenCall({ grant_type: "refresh_token", refresh_token: conn.refresh_token }); }
      catch (e) {
        // another request may have just refreshed: use what it saved
        const { data: again } = await db.from("xero_connections").select("access_token, refresh_token, expires_at").eq("user_id", user.id).maybeSingle();
        if (again && again.refresh_token !== conn.refresh_token && new Date(again.expires_at).getTime() > Date.now()) return again.access_token;
        // the connection is dead (unused 60 days, or removed in Xero): forget it so Settings shows Connect
        if (e instanceof UserError && /connecting again/.test(e.message)) await db.from("xero_connections").delete().eq("user_id", user.id).eq("refresh_token", conn.refresh_token);
        throw e;
      }
      // save only if nobody else saved newer tokens meanwhile
      const { data: saved } = await db.from("xero_connections").update({
        access_token: t.access_token, refresh_token: t.refresh_token,
        expires_at: new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString(), updated_at: new Date().toISOString(),
      }).eq("user_id", user.id).eq("refresh_token", conn.refresh_token).select("user_id");
      if (!saved?.length) {
        const { data: again } = await db.from("xero_connections").select("access_token").eq("user_id", user.id).maybeSingle();
        if (again?.access_token) return again.access_token;
      }
      return t.access_token;
    };

    const xeroGet = async (path: string) => {
      const access0 = await freshAccess();
      const r = await fetch(`https://api.xero.com/api.xro/2.0/${path}`, {
        headers: { authorization: `Bearer ${access0}`, "xero-tenant-id": conn.tenant_id, accept: "application/json" },
      });
      if (r.status === 401 || r.status === 403) throw new UserError("Xero refused: connect Xero again (Settings > Xero)");
      return r.ok ? r.json() : null;
    };

    if (action === "options") {
      const [acc, themes] = await Promise.all([xeroGet("Accounts"), xeroGet("BrandingThemes")]);
      const accounts = (acc?.Accounts ?? [])
        .filter((a: any) => a.Status === "ACTIVE" && a.Code && (a.Class === "REVENUE" || a.Class === "LIABILITY"))
        .map((a: any) => ({ code: a.Code, name: a.Name, class: a.Class, taxType: a.TaxType }))
        .sort((x: any, y: any) => (x.class === y.class ? String(x.code).localeCompare(String(y.code), undefined, { numeric: true }) : x.class === "REVENUE" ? -1 : 1));
      const brandingThemes = (themes?.BrandingThemes ?? [])
        .map((t: any) => ({ id: t.BrandingThemeID, name: t.Name, sortOrder: t.SortOrder }))
        .sort((x: any, y: any) => (x.sortOrder ?? 0) - (y.sortOrder ?? 0));
      return reply({ accounts, brandingThemes });
    }

    if (action === "settings") {
      const codeOk = (c: unknown) => typeof c === "string" && /^[A-Za-z0-9.\-]{1,10}$/.test(c.trim());
      const accountCode = String(body.accountCode ?? "").trim();
      const dueDays = Math.round(Number(body.dueDays));
      if (!codeOk(accountCode)) throw new UserError("Choose the income account for invoices");
      if (!(dueDays >= 0 && dueDays <= 120)) throw new UserError("Days to pay must be 0 to 120");
      const kinds = ["deposit", "work", "variation", "retention"];
      const accountCodes: Record<string, string> = {};
      for (const k of kinds) {
        const c = body.accountCodes?.[k];
        if (c == null || c === "") continue;
        if (!codeOk(c)) throw new UserError(`The ${k} account code is not valid`);
        accountCodes[k] = String(c).trim();
      }
      // every code used must be an active account in their chart
      const acc = await xeroGet("Accounts");
      if (acc) {
        const active = new Set((acc.Accounts ?? []).filter((a: any) => a.Status === "ACTIVE").map((a: any) => a.Code));
        for (const c of [accountCode, ...Object.values(accountCodes)]) {
          if (!active.has(c)) throw new UserError(`There is no active account ${c} in your Xero chart of accounts`);
        }
      }
      const brandingThemeId = typeof body.brandingThemeId === "string" && /^[0-9a-f-]{36}$/i.test(body.brandingThemeId) ? body.brandingThemeId : null;
      await db.from("xero_connections").update({
        account_code: accountCode, account_codes: accountCodes, branding_theme_id: brandingThemeId,
        due_days: dueDays, updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);
      return reply({ ok: true });
    }

    if (action === "disconnect") {
      // works even when the connection is already dead
      try {
        const access = await freshAccess();
        if (conn.connection_id) await fetch(`https://api.xero.com/connections/${conn.connection_id}`, { method: "DELETE", headers: { authorization: `Bearer ${access}` } });
      } catch { /* forget it here anyway */ }
      await db.from("xero_connections").delete().eq("user_id", user.id);
      return reply({ ok: true });
    }
    const access = await freshAccess();

    const xero = async (path: string, init: RequestInit = {}) => {
      const r = await fetch(`https://api.xero.com/api.xro/2.0/${path}`, {
        ...init,
        headers: { authorization: `Bearer ${access}`, "xero-tenant-id": conn.tenant_id, accept: "application/json", "content-type": "application/json", ...(init.headers ?? {}) },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.error("[xero]", path, r.status, j?.Type ?? j?.Title ?? ""); // no body: it can hold client details
        const msg = j?.Elements?.[0]?.ValidationErrors?.map((v: any) => v.Message).join("; ") || j?.Detail || j?.Message;
        if (r.status === 404) throw new NotFound();
        if (r.status === 401 || r.status === 403) throw new UserError("Xero refused: connect Xero again (Settings > Xero)");
        if (r.status === 429) throw new UserError("Xero is busy: try again in a minute");
        throw new UserError(msg ? `Xero: ${msg}` : "Xero could not take the invoice: try again");
      }
      return j;
    };

    if (action === "invoice") {
      const { projectId, sourceId, contact, reference, date } = body as {
        projectId: string; sourceId: string; contact: { name: string; email?: string }; reference: string; date: string;
      };
      const lines = (Array.isArray(body.lines) ? body.lines : []) as { description: string; amount: number; accountCode?: string; kind?: string }[];
      if (!projectId || !sourceId) throw new UserError("Missing project or claim");
      if (!contact?.name?.trim()) throw new UserError("Add the client's name to the project first");
      if (!lines.length || lines.some(l => !String(l.description ?? "").trim() || !Number.isFinite(Number(l.amount)))) throw new UserError("The invoice has no lines");

      // the client as a Xero contact: found by name, or added
      const name = contact.name.trim().slice(0, 255);
      const found = await xero(`Contacts?where=${encodeURIComponent(`Name=="${name.replace(/"/g, '\\"')}" AND ContactStatus=="ACTIVE"`)}&summaryOnly=true`);
      let contactId = found?.Contacts?.[0]?.ContactID as string | undefined;
      if (!contactId) {
        const made = await xero("Contacts", { method: "POST", body: JSON.stringify({ Contacts: [{ Name: name, ...(contact.email ? { EmailAddress: contact.email } : {}) }] }) });
        contactId = made?.Contacts?.[0]?.ContactID;
      }
      if (!contactId) throw new UserError("Could not add the client in Xero");

      // GST as Metricore works it out (10% of the total, rounded once), shared over the lines,
      // so Xero's total is the claim's to the cent (Xero would otherwise round each line)
      const cents = (n: number) => Math.round(n * 100);
      const amounts = lines.map(l => cents(Number(l.amount)));
      const gstTotal = Math.round(amounts.reduce((a, b) => a + b, 0) * 0.1);
      const lineGstCents = amounts.map(a => Math.round(a * 0.1));
      const diff = gstTotal - lineGstCents.reduce((a, b) => a + b, 0);
      if (diff !== 0) {
        const biggest = amounts.reduce((bi, a, k) => (Math.abs(a) > Math.abs(amounts[bi]) ? k : bi), 0);
        lineGstCents[biggest] += diff;
      }
      const lineGst = lineGstCents.map(c => c / 100);

      const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
      const due = new Date(`${day}T00:00:00Z`);
      due.setUTCDate(due.getUTCDate() + Number(conn.due_days ?? 10));
      const invoice: Record<string, unknown> = {
        Type: "ACCREC",
        Status: "DRAFT",
        Contact: { ContactID: contactId },
        Date: day,
        DueDate: due.toISOString().slice(0, 10),
        Reference: String(reference ?? "").slice(0, 255),
        LineAmountTypes: "Exclusive",
        ...(conn.branding_theme_id ? { BrandingThemeID: conn.branding_theme_id } : {}),
        LineItems: lines.map((l, i) => {
          // the line's own code, else the default for its kind, else the main income account
          const pick = [l.accountCode, l.kind ? (conn.account_codes ?? {})[l.kind] : undefined, conn.account_code]
            .find(c => typeof c === "string" && /^[A-Za-z0-9.\-]{1,10}$/.test(c));
          return {
            Description: String(l.description).slice(0, 4000),
            Quantity: 1,
            UnitAmount: Math.round(Number(l.amount) * 100) / 100,
            AccountCode: pick,
            TaxType: "OUTPUT", // GST on Income (Australia)
            TaxAmount: lineGst[i],
          };
        }),
      };

      // sent before: update that draft instead of adding another invoice
      const { data: sent } = await db.from("xero_invoices").select("*")
        .eq("user_id", user.id).eq("source_id", sourceId).eq("tenant_id", conn.tenant_id).maybeSingle();
      let updated = false;
      if (sent) {
        // only "it is gone" lets us make a new one; any other failure stops here (no duplicate)
        let existing: any = null;
        try { existing = await xero(`Invoices/${sent.xero_invoice_id}`); }
        catch (e) { if (!(e instanceof NotFound)) throw e; }
        const status = existing?.Invoices?.[0]?.Status;
        if (status && status !== "DRAFT" && status !== "DELETED" && status !== "VOIDED") {
          throw new UserError(`Invoice ${sent.invoice_number ?? ""} is already ${status.toLowerCase()} in Xero, so it was not changed. Edit it in Xero, or raise a credit note there.`);
        }
        if (status === "DRAFT") { invoice.InvoiceID = sent.xero_invoice_id; updated = true; }
      }
      // same claim and same lines sent twice at once (two tabs, a retry): Xero keeps one
      const key = `${sourceId}-${await hmac(clientSecret, JSON.stringify(invoice))}`.slice(0, 128);
      const res = await xero("Invoices", { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify({ Invoices: [invoice] }) });
      const inv = res?.Invoices?.[0];
      if (!inv?.InvoiceID) throw new UserError("Xero did not return the invoice");
      await db.from("xero_invoices").upsert({
        user_id: user.id, project_id: projectId, source_id: sourceId, tenant_id: conn.tenant_id,
        xero_invoice_id: inv.InvoiceID, invoice_number: inv.InvoiceNumber ?? null, total: inv.Total ?? null,
        status: inv.Status ?? "DRAFT", sent_at: new Date().toISOString(),
      }, { onConflict: "user_id,source_id,tenant_id" });
      return reply({
        invoiceId: inv.InvoiceID, number: inv.InvoiceNumber, total: inv.Total, updated,
        url: conn.short_code
          ? `https://go.xero.com/organisationlogin/default.aspx?shortcode=${conn.short_code}&redirecturl=${encodeURIComponent(`/AccountsReceivable/Edit.aspx?InvoiceID=${inv.InvoiceID}`)}`
          : `https://go.xero.com/AccountsReceivable/Edit.aspx?InvoiceID=${inv.InvoiceID}`,
      });
    }

    throw new UserError("Unknown action");
  } catch (err) {
    const known = err instanceof UserError;
    console.error("[xero]", err instanceof Error ? err.message : String(err));
    return reply({ error: known ? (err as Error).message : "Xero did not respond: try again" }, known ? 400 : 500);
  }
});
