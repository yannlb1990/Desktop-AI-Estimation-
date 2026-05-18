import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getLocalUser, isSignedIn, getUserStorageKey } from "@/lib/localAuth";
import { getSubscriptionStatus, PLAN_NAMES, loadSubscription } from "@/lib/subscription";
import { supabase } from "@/integrations/supabase/client";
import { syncSubscriptionFromDB } from "@/lib/stripeCheckout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, DollarSign, MapPin, Bell, Save, Loader2,
  CreditCard, Users, Download, Lock, CheckCircle, XCircle, Clock,
  Mail, Trash2, UserPlus, Palette, Package, Hash, Calendar, Upload, Plus, FileText,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface LabourPreset { id: string; name: string; rate: string }
interface Supplier { id: string; name: string; contact: string; phone: string; account: string; notes: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

async function callFunction(name: string, body?: object) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

const formatABN = (val: string) => {
  const d = val.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
};

const LOAD_BRAND = () => { try { return JSON.parse(localStorage.getItem("quote_brand") || "{}") } catch { return {} } };

// ── Toggle ────────────────────────────────────────────────────────────────────

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!value)}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${value ? "bg-primary" : "bg-muted"}`}
  >
    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${value ? "translate-x-5" : "translate-x-0"}`} />
  </button>
);

// ── Settings page ─────────────────────────────────────────────────────────────

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const localUser = getLocalUser();
  const { isTrialing, isTrialExpired, daysLeftInTrial, subscription } = getSubscriptionStatus();
  const isBusinessPlan = subscription?.activePlan === "business";
  const isPaidPlan = subscription?.activePlan !== "trial" && !!subscription?.subscribedAt;

  // ── Company Profile ─────────────────────────────────────────────────────────
  const [companyName, setCompanyName] = useState("");
  const [abn, setAbn]                 = useState("");
  const [phone, setPhone]             = useState("");
  const [address, setAddress]         = useState("");
  const [city, setCity]               = useState("");
  const [state, setState]             = useState("");
  const [postcode, setPostcode]       = useState("");

  // ── Branding ─────────────────────────────────────────────────────────────────
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [brandColor, setBrandColor]   = useState("#0f4c81");

  // ── Default Rates ───────────────────────────────────────────────────────────
  const [overheadPercentage, setOverheadPercentage] = useState("15");
  const [marginPercentage, setMarginPercentage]     = useState("18");
  const [gstPercentage]                             = useState("10");
  const [materialMarkup, setMaterialMarkup]         = useState("15");
  const [labourRate, setLabourRate]                 = useState("90");

  // ── Labour Presets ──────────────────────────────────────────────────────────
  const [labourPresets, setLabourPresets]   = useState<LabourPreset[]>([]);
  const [newPresetName, setNewPresetName]   = useState("");
  const [newPresetRate, setNewPresetRate]   = useState("");

  // ── Preferred Suppliers ─────────────────────────────────────────────────────
  const [suppliers, setSuppliers]         = useState<Supplier[]>([]);
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [newSupplier, setNewSupplier]     = useState<Omit<Supplier, "id">>({ name: "", contact: "", phone: "", account: "", notes: "" });

  // ── Quote Settings ──────────────────────────────────────────────────────────
  const [quotePrefix, setQuotePrefix]         = useState("QTE");
  const [quoteValidityDays, setQuoteValidityDays] = useState("30");
  const [pdfTemplate, setPdfTemplate]         = useState<"simple" | "detailed">("detailed");

  // ── Notifications ───────────────────────────────────────────────────────────
  const loadNotifPrefs = () => { try { return JSON.parse(localStorage.getItem(getUserStorageKey("notif_prefs")) || "{}") } catch { return {} } };
  const [notifDueDate, setNotifDueDate]             = useState(() => loadNotifPrefs().dueDate ?? true);
  const [notifDaysBeforeStr, setNotifDaysBeforeStr] = useState(() => loadNotifPrefs().daysBefore ?? "3");
  const [notifProjectUpdate, setNotifProjectUpdate] = useState(() => loadNotifPrefs().projectUpdate ?? false);
  const [notifWeeklyDigest, setNotifWeeklyDigest]   = useState(() => loadNotifPrefs().weeklyDigest ?? false);
  const [notifEmail, setNotifEmail]                 = useState(() => loadNotifPrefs().notifEmail ?? "");

  // ── Password ────────────────────────────────────────────────────────────────
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving]   = useState(false);

  // ── Team ────────────────────────────────────────────────────────────────────
  const [teamMembers, setTeamMembers]   = useState<any[]>([]);
  const [teamLoading, setTeamLoading]   = useState(false);
  const [inviteEmail, setInviteEmail]   = useState("");
  const [inviting, setInviting]         = useState(false);
  const [removingId, setRemovingId]     = useState<string | null>(null);

  // ── Load ─────────────────────────────────────────────────────────────────────

  const PROFILE_KEY = () => getUserStorageKey("estimate_profile");
  const PRESETS_KEY = () => getUserStorageKey("labour_presets");
  const SUPPLIERS_KEY = () => getUserStorageKey("preferred_suppliers");
  const QUOTE_KEY = () => getUserStorageKey("quote_settings");

  const loadProfile = useCallback(() => {
    if (!isSignedIn()) { navigate("/auth"); return; }
    const saved = localStorage.getItem(PROFILE_KEY());
    const data = saved ? JSON.parse(saved) : {};
    setCompanyName(data.company_name || localUser?.displayName || "");
    setAbn(data.abn || "");
    setPhone(data.phone || "");
    setAddress(data.address || "");
    setCity(data.city || "");
    setState(data.state || localUser?.state || "");
    setPostcode(data.postcode || "");
  }, []);

  const loadBranding = useCallback(() => {
    const brand = LOAD_BRAND();
    setLogoDataUrl(brand.logo || "");
    setBrandColor(brand.primary || "#0f4c81");
  }, []);

  const loadRates = useCallback(() => {
    const saved = localStorage.getItem(getUserStorageKey("default_rates"));
    if (!saved) return;
    const r = JSON.parse(saved);
    setOverheadPercentage(r.overhead || "15");
    setMarginPercentage(r.margin || "18");
    setMaterialMarkup(r.materialMarkup || "15");
    setLabourRate(r.labourRate || "90");
  }, []);

  const loadLabourPresets = useCallback(() => {
    try {
      const saved = localStorage.getItem(PRESETS_KEY());
      setLabourPresets(saved ? JSON.parse(saved) : []);
    } catch { setLabourPresets([]); }
  }, []);

  const loadSuppliers = useCallback(() => {
    try {
      const saved = localStorage.getItem(SUPPLIERS_KEY());
      setSuppliers(saved ? JSON.parse(saved) : []);
    } catch { setSuppliers([]); }
  }, []);

  const loadQuoteSettings = useCallback(() => {
    try {
      const saved = localStorage.getItem(QUOTE_KEY());
      if (!saved) return;
      const q = JSON.parse(saved);
      setQuotePrefix(q.prefix || "QTE");
      setQuoteValidityDays(q.validityDays || "30");
      setPdfTemplate(q.pdfTemplate || "detailed");
    } catch {}
  }, []);

  const loadTeamMembers = useCallback(async () => {
    if (!isBusinessPlan) return;
    setTeamLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("team_members")
        .select("id, email, role, status, invited_at, joined_at")
        .order("invited_at", { ascending: true });
      if (!error && data) setTeamMembers(data);
    } catch { }
    finally { setTeamLoading(false); }
  }, [isBusinessPlan]);

  useEffect(() => {
    loadProfile();
    loadBranding();
    loadRates();
    loadLabourPresets();
    loadSuppliers();
    loadQuoteSettings();
    setLoading(false);
    loadTeamMembers();
    syncSubscriptionFromDB();
  }, []);

  // ── Logo upload ───────────────────────────────────────────────────────────────

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2MB"); return; }
    const reader = new FileReader();
    reader.onload = ev => setLogoDataUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Save handlers ─────────────────────────────────────────────────────────────

  const handleSaveProfile = () => {
    setSaving(true);
    try {
      localStorage.setItem(PROFILE_KEY(), JSON.stringify({
        company_name: companyName, abn, phone, address, city, state, postcode,
        updated_at: new Date().toISOString(),
      }));
      toast.success("Profile updated");
    } catch { toast.error("Failed to save profile"); }
    finally { setSaving(false); }
  };

  const handleSaveBranding = () => {
    const existing = LOAD_BRAND();
    localStorage.setItem("quote_brand", JSON.stringify({ ...existing, logo: logoDataUrl, primary: brandColor }));
    toast.success("Branding saved — applied to all future quotes");
  };

  const handleSaveRates = () => {
    setSaving(true);
    try {
      localStorage.setItem(getUserStorageKey("default_rates"), JSON.stringify({
        overhead: overheadPercentage, margin: marginPercentage,
        gst: gstPercentage, materialMarkup, labourRate,
      }));
      toast.success("Default rates saved");
    } catch { toast.error("Failed to save rates"); }
    finally { setSaving(false); }
  };

  const addLabourPreset = () => {
    if (!newPresetName || !newPresetRate) { toast.error("Enter both a name and rate"); return; }
    const updated = [...labourPresets, { id: crypto.randomUUID(), name: newPresetName, rate: newPresetRate }];
    setLabourPresets(updated);
    localStorage.setItem(PRESETS_KEY(), JSON.stringify(updated));
    setNewPresetName(""); setNewPresetRate("");
    toast.success("Preset added");
  };

  const removeLabourPreset = (id: string) => {
    const updated = labourPresets.filter(p => p.id !== id);
    setLabourPresets(updated);
    localStorage.setItem(PRESETS_KEY(), JSON.stringify(updated));
  };

  const addSupplier = () => {
    if (!newSupplier.name) { toast.error("Supplier name is required"); return; }
    const updated = [...suppliers, { id: crypto.randomUUID(), ...newSupplier }];
    setSuppliers(updated);
    localStorage.setItem(SUPPLIERS_KEY(), JSON.stringify(updated));
    setNewSupplier({ name: "", contact: "", phone: "", account: "", notes: "" });
    setAddingSupplier(false);
    toast.success("Supplier added");
  };

  const removeSupplier = (id: string) => {
    const updated = suppliers.filter(s => s.id !== id);
    setSuppliers(updated);
    localStorage.setItem(SUPPLIERS_KEY(), JSON.stringify(updated));
  };

  const saveNotifPrefs = () => {
    localStorage.setItem(getUserStorageKey("notif_prefs"), JSON.stringify({
      dueDate: notifDueDate, daysBefore: notifDaysBeforeStr,
      projectUpdate: notifProjectUpdate, weeklyDigest: notifWeeklyDigest,
      notifEmail,
    }));
    toast.success("Notification preferences saved");
  };

  const handleSaveQuoteSettings = () => {
    localStorage.setItem(QUOTE_KEY(), JSON.stringify({
      prefix: quotePrefix, validityDays: quoteValidityDays, pdfTemplate,
    }));
    toast.success("Quote settings saved");
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error(error.message);
    else { toast.success("Password updated successfully"); setNewPassword(""); setConfirmPassword(""); }
    setPasswordSaving(false);
  };

  const handleExportData = () => {
    const projects = JSON.parse(localStorage.getItem(getUserStorageKey("local_projects")) || "[]");
    const clients  = JSON.parse(localStorage.getItem(getUserStorageKey("local_clients"))  || "[]");
    const profile  = JSON.parse(localStorage.getItem(PROFILE_KEY())                       || "{}");
    const blob = new Blob([JSON.stringify({ projects, clients, profile, exported_at: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metricore-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported successfully");
  };

  const handleInvite = async () => {
    if (!inviteEmail) { toast.error("Enter an email address"); return; }
    setInviting(true);
    try {
      const result = await callFunction("team-invite", { email: inviteEmail });
      toast.success(`Invite sent to ${inviteEmail} (${result.seats_used}/${result.seats_total} seats used)`);
      setInviteEmail("");
      await loadTeamMembers();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send invite");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string, email: string) => {
    setRemovingId(memberId);
    try {
      await (supabase as any).from("team_members").update({ status: "removed" }).eq("id", memberId);
      toast.success(`${email} removed from the team`);
      await loadTeamMembers();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to remove member");
    } finally {
      setRemovingId(null);
    }
  };

  // ── Subscription status helpers ───────────────────────────────────────────────

  const planLabel = () => {
    const sub = loadSubscription();
    if (!sub) return "No subscription";
    if (sub.activePlan === "trial") return `Free Trial (${daysLeftInTrial} days left)`;
    return PLAN_NAMES[sub.activePlan as keyof typeof PLAN_NAMES] ?? sub.activePlan;
  };

  const statusBadge = () => {
    if (isTrialExpired) return <Badge variant="destructive">Trial Expired</Badge>;
    if (isTrialing) return <Badge className="bg-blue-500 text-white">Trial Active</Badge>;
    if (isPaidPlan) return <Badge className="bg-green-500 text-white">Active</Badge>;
    return <Badge variant="outline">Unknown</Badge>;
  };

  const activeMembers = teamMembers.filter(m => m.status === "active");
  const pendingMembers = teamMembers.filter(m => m.status === "pending");
  const seatsUsed = activeMembers.length + 1;

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const tabCount = isBusinessPlan ? 9 : 8;

  return (
    <div className="min-h-screen bg-muted/30">
      <nav className="border-b border-border bg-background">
        <div className="container mx-auto px-6 py-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back to Dashboard
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your account, subscription, and preferences</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <div className="overflow-x-auto">
            <TabsList className={`grid w-full min-w-max`} style={{ gridTemplateColumns: `repeat(${tabCount}, minmax(0, 1fr))` }}>
              <TabsTrigger value="profile"><Building2 className="h-4 w-4 mr-1.5 hidden sm:inline" />Profile</TabsTrigger>
              <TabsTrigger value="branding"><Palette className="h-4 w-4 mr-1.5 hidden sm:inline" />Branding</TabsTrigger>
              <TabsTrigger value="rates"><DollarSign className="h-4 w-4 mr-1.5 hidden sm:inline" />Rates</TabsTrigger>
              <TabsTrigger value="suppliers"><Package className="h-4 w-4 mr-1.5 hidden sm:inline" />Suppliers</TabsTrigger>
              <TabsTrigger value="quotes"><FileText className="h-4 w-4 mr-1.5 hidden sm:inline" />Quotes</TabsTrigger>
              <TabsTrigger value="regional"><MapPin className="h-4 w-4 mr-1.5 hidden sm:inline" />Regional</TabsTrigger>
              <TabsTrigger value="notifications"><Bell className="h-4 w-4 mr-1.5 hidden sm:inline" />Alerts</TabsTrigger>
              <TabsTrigger value="billing"><CreditCard className="h-4 w-4 mr-1.5 hidden sm:inline" />Billing</TabsTrigger>
              {isBusinessPlan && (
                <TabsTrigger value="team"><Users className="h-4 w-4 mr-1.5 hidden sm:inline" />Team</TabsTrigger>
              )}
            </TabsList>
          </div>

          {/* ── Company Profile ─────────────────────────────────────────────── */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="p-6">
              <h3 className="font-display text-xl font-bold mb-6">Company Information</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input id="companyName" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your Company Pty Ltd" />
                  </div>
                  <div>
                    <Label htmlFor="abn">ABN</Label>
                    <Input
                      id="abn"
                      value={abn}
                      onChange={e => setAbn(formatABN(e.target.value))}
                      placeholder="12 345 678 901"
                      maxLength={14}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(02) 1234 5678" />
                </div>
                <div>
                  <Label htmlFor="address">Street Address</Label>
                  <Input id="address" value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Builder Street" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="city">City/Suburb</Label>
                    <Input id="city" value={city} onChange={e => setCity(e.target.value)} placeholder="Sydney" />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Select value={state} onValueChange={setState}>
                      <SelectTrigger id="state"><SelectValue placeholder="Select state" /></SelectTrigger>
                      <SelectContent>
                        {["NSW","VIC","QLD","WA","SA","TAS","NT","ACT"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="postcode">Postcode</Label>
                    <Input id="postcode" value={postcode} onChange={e => setPostcode(e.target.value)} placeholder="2000" maxLength={4} />
                  </div>
                </div>
                <Button onClick={handleSaveProfile} className="bg-primary text-primary-foreground" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Profile
                </Button>
              </div>
            </Card>

            {/* Change Password */}
            <Card className="p-6">
              <h3 className="font-display text-xl font-bold mb-1 flex items-center gap-2">
                <Lock className="h-5 w-5" />Change Password
              </h3>
              <p className="text-sm text-muted-foreground mb-4">Update your login password</p>
              <div className="space-y-3 max-w-sm">
                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input id="newPassword" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 6 characters" />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat new password" />
                </div>
                <Button onClick={handleChangePassword} variant="outline" disabled={passwordSaving}>
                  {passwordSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                  Update Password
                </Button>
              </div>
            </Card>

            {/* Export Data */}
            <Card className="p-6">
              <h3 className="font-display text-xl font-bold mb-1 flex items-center gap-2">
                <Download className="h-5 w-5" />Export Your Data
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Download all your projects, clients, and profile as a JSON file.
              </p>
              <Button onClick={handleExportData} variant="outline">
                <Download className="mr-2 h-4 w-4" />Download My Data
              </Button>
            </Card>
          </TabsContent>

          {/* ── Branding ─────────────────────────────────────────────────────── */}
          <TabsContent value="branding" className="space-y-6">
            <Card className="p-6">
              <h3 className="font-display text-xl font-bold mb-1 flex items-center gap-2">
                <Palette className="h-5 w-5" />Quote & Proposal Branding
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Your logo and brand colour appear on every quote and tender document.
              </p>

              <div className="space-y-6">
                {/* Logo upload */}
                <div>
                  <Label className="mb-2 block">Company Logo</Label>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  <div
                    className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary transition-colors max-w-sm"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {logoDataUrl ? (
                      <img src={logoDataUrl} alt="Logo" className="max-h-20 mx-auto object-contain" />
                    ) : (
                      <>
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Click to upload logo</p>
                        <p className="text-xs text-muted-foreground mt-1">PNG or JPG · Max 2MB</p>
                      </>
                    )}
                  </div>
                  {logoDataUrl && (
                    <Button variant="ghost" size="sm" className="mt-2 text-destructive" onClick={() => setLogoDataUrl("")}>
                      Remove logo
                    </Button>
                  )}
                </div>

                {/* Brand colour */}
                <div>
                  <Label className="mb-2 block">Brand Colour</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={brandColor}
                      onChange={e => setBrandColor(e.target.value)}
                      className="h-10 w-16 rounded cursor-pointer border border-border"
                    />
                    <Input
                      value={brandColor}
                      onChange={e => setBrandColor(e.target.value)}
                      placeholder="#0f4c81"
                      className="max-w-[120px] font-mono text-sm"
                    />
                    <div className="text-sm text-muted-foreground">Used as the header colour on all documents</div>
                  </div>
                  {/* Preview swatch */}
                  <div className="mt-3 rounded-lg p-4 text-white text-sm font-medium max-w-sm" style={{ background: brandColor }}>
                    Preview — {companyName || "Your Company"}
                  </div>
                </div>

                <Button onClick={handleSaveBranding} className="bg-primary text-primary-foreground">
                  <Save className="mr-2 h-4 w-4" />Save Branding
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* ── Default Rates ─────────────────────────────────────────────────── */}
          <TabsContent value="rates" className="space-y-6">
            <Card className="p-6">
              <h3 className="font-display text-xl font-bold mb-6">Default Rates & Margins</h3>
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-4">Pricing Percentages</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { id: "overhead", label: "Overhead (%)", value: overheadPercentage, setter: setOverheadPercentage, hint: "Office, insurance, vehicles (15-20%)" },
                      { id: "margin",   label: "Margin (%)",   value: marginPercentage,   setter: setMarginPercentage,   hint: "Your profit margin (15-25%)" },
                      { id: "gst",      label: "GST (%)",      value: gstPercentage,      setter: () => {},              hint: "Fixed at 10% for Australian GST", disabled: true },
                      { id: "markup",   label: "Material Markup (%)", value: materialMarkup, setter: setMaterialMarkup,  hint: "Markup on material costs (10-20%)" },
                    ].map(f => (
                      <div key={f.id}>
                        <Label htmlFor={f.id}>{f.label}</Label>
                        <Input id={f.id} type="number" value={f.value} onChange={e => f.setter(e.target.value)} disabled={(f as any).disabled} min="0" max="100" step="0.5" />
                        <p className="text-xs text-muted-foreground mt-1">{f.hint}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-4">Default Labour Rate</h4>
                  <div className="max-w-xs">
                    <Label htmlFor="labourRate">Rate ($/hr)</Label>
                    <Input id="labourRate" type="number" value={labourRate} onChange={e => setLabourRate(e.target.value)} min="0" step="5" />
                    <p className="text-xs text-muted-foreground mt-1">NSW average: $85–$110/hr</p>
                  </div>
                </div>
                <Button onClick={handleSaveRates} disabled={saving} className="bg-primary text-primary-foreground">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Default Rates
                </Button>
              </div>
            </Card>

            {/* Labour Rate Presets */}
            <Card className="p-6">
              <h3 className="font-display text-xl font-bold mb-1 flex items-center gap-2">
                <DollarSign className="h-5 w-5" />Labour Rate Presets
              </h3>
              <p className="text-sm text-muted-foreground mb-5">
                Save named rates per trade to quickly apply when building estimates.
              </p>

              <div className="space-y-2 mb-4">
                {labourPresets.length === 0 && (
                  <p className="text-sm text-muted-foreground py-3 text-center">No presets yet.</p>
                )}
                {labourPresets.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="text-xs text-muted-foreground">${p.rate}/hr</div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => removeLabourPreset(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label htmlFor="presetName" className="text-xs">Trade / Role</Label>
                  <Input id="presetName" placeholder="e.g. Carpenter" value={newPresetName} onChange={e => setNewPresetName(e.target.value)} onKeyDown={e => e.key === "Enter" && addLabourPreset()} />
                </div>
                <div className="w-28">
                  <Label htmlFor="presetRate" className="text-xs">$/hr</Label>
                  <Input id="presetRate" type="number" placeholder="110" value={newPresetRate} onChange={e => setNewPresetRate(e.target.value)} onKeyDown={e => e.key === "Enter" && addLabourPreset()} />
                </div>
                <Button onClick={addLabourPreset} variant="outline">
                  <Plus className="h-4 w-4 mr-1" />Add
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* ── Preferred Suppliers ───────────────────────────────────────────── */}
          <TabsContent value="suppliers">
            <Card className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="font-display text-xl font-bold flex items-center gap-2">
                    <Package className="h-5 w-5" />Preferred Suppliers
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Save supplier contacts and account numbers for quick reference when ordering materials.
                  </p>
                </div>
                <Button onClick={() => setAddingSupplier(true)} disabled={addingSupplier}>
                  <Plus className="h-4 w-4 mr-2" />Add Supplier
                </Button>
              </div>

              {/* Add supplier form */}
              {addingSupplier && (
                <div className="border border-primary/30 bg-primary/5 rounded-xl p-4 mb-6 space-y-3">
                  <h4 className="font-semibold text-sm">New Supplier</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Supplier Name *</Label>
                      <Input placeholder="Bunnings Trade" value={newSupplier.name} onChange={e => setNewSupplier(s => ({ ...s, name: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Contact Name</Label>
                      <Input placeholder="John Smith" value={newSupplier.contact} onChange={e => setNewSupplier(s => ({ ...s, contact: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Phone</Label>
                      <Input placeholder="1800 000 000" value={newSupplier.phone} onChange={e => setNewSupplier(s => ({ ...s, phone: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Account Number</Label>
                      <Input placeholder="TRD-12345" value={newSupplier.account} onChange={e => setNewSupplier(s => ({ ...s, account: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Textarea placeholder="Trade discount, delivery details, etc." value={newSupplier.notes} onChange={e => setNewSupplier(s => ({ ...s, notes: e.target.value }))} rows={2} />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addSupplier} className="bg-primary text-primary-foreground"><Save className="h-4 w-4 mr-2" />Save</Button>
                    <Button variant="ghost" onClick={() => { setAddingSupplier(false); setNewSupplier({ name: "", contact: "", phone: "", account: "", notes: "" }); }}>Cancel</Button>
                  </div>
                </div>
              )}

              {suppliers.length === 0 && !addingSupplier && (
                <div className="text-center py-10 text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No suppliers saved yet.</p>
                  <p className="text-xs mt-1">Add your preferred trade suppliers to have their details on hand.</p>
                </div>
              )}

              <div className="space-y-3">
                {suppliers.map(s => (
                  <div key={s.id} className="border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold">{s.name}</div>
                        <div className="text-sm text-muted-foreground mt-0.5 space-y-0.5">
                          {s.contact && <div>Contact: {s.contact}</div>}
                          {s.phone && <div>Phone: {s.phone}</div>}
                          {s.account && <div>Account: <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{s.account}</span></div>}
                          {s.notes && <div className="italic text-xs mt-1">{s.notes}</div>}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 shrink-0" onClick={() => removeSupplier(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* ── Quote Settings ────────────────────────────────────────────────── */}
          <TabsContent value="quotes" className="space-y-6">
            <Card className="p-6">
              <h3 className="font-display text-xl font-bold mb-1 flex items-center gap-2">
                <Hash className="h-5 w-5" />Estimate Numbering
              </h3>
              <p className="text-sm text-muted-foreground mb-5">
                Set the prefix for quote and tender numbers. Applied to all newly generated documents.
              </p>
              <div className="flex items-end gap-3 max-w-sm">
                <div className="flex-1">
                  <Label htmlFor="quotePrefix">Prefix</Label>
                  <Input
                    id="quotePrefix"
                    value={quotePrefix}
                    onChange={e => setQuotePrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 8))}
                    placeholder="QTE"
                    className="font-mono"
                  />
                </div>
                <div className="pb-1 text-muted-foreground text-sm font-mono">
                  → {quotePrefix || "QTE"}-001, {quotePrefix || "QTE"}-002…
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-display text-xl font-bold mb-1 flex items-center gap-2">
                <Calendar className="h-5 w-5" />Default Quote Validity
              </h3>
              <p className="text-sm text-muted-foreground mb-5">
                Pre-fills the "valid until" date on every new quote.
              </p>
              <div className="flex items-end gap-3 max-w-xs">
                <div className="flex-1">
                  <Label htmlFor="validityDays">Valid for (days)</Label>
                  <Input
                    id="validityDays"
                    type="number"
                    min="1"
                    max="365"
                    value={quoteValidityDays}
                    onChange={e => setQuoteValidityDays(e.target.value)}
                  />
                </div>
                <div className="pb-1 text-sm text-muted-foreground">
                  {quoteValidityDays} days from issue date
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-display text-xl font-bold mb-1 flex items-center gap-2">
                <FileText className="h-5 w-5" />PDF Export Template
              </h3>
              <p className="text-sm text-muted-foreground mb-5">
                Choose the default layout for generated quote PDFs.
              </p>
              <div className="grid grid-cols-2 gap-4 max-w-lg">
                {(["simple", "detailed"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setPdfTemplate(t)}
                    className={`border-2 rounded-xl p-4 text-left transition-all ${pdfTemplate === t ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"}`}
                  >
                    <div className="font-semibold capitalize mb-1">{t}</div>
                    <div className="text-xs text-muted-foreground">
                      {t === "simple"
                        ? "Prices only — no payment schedule or terms. Best for quick residential quotes."
                        : "Full breakdown — includes payment schedule, inclusions, exclusions, and terms. Best for commercial work."}
                    </div>
                    {pdfTemplate === t && <CheckCircle className="h-4 w-4 text-primary mt-2" />}
                  </button>
                ))}
              </div>
            </Card>

            <Button onClick={handleSaveQuoteSettings} className="bg-primary text-primary-foreground">
              <Save className="mr-2 h-4 w-4" />Save Quote Settings
            </Button>
          </TabsContent>

          {/* ── Regional Settings ──────────────────────────────────────────────── */}
          <TabsContent value="regional">
            <Card className="p-6">
              <h3 className="font-display text-xl font-bold mb-6">Regional Pricing Settings</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="primaryState">Primary Operating State</Label>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger id="primaryState"><SelectValue placeholder="Select your primary state" /></SelectTrigger>
                    <SelectContent>
                      {["NSW","VIC","QLD","WA","SA","TAS","NT","ACT"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Affects default pricing and material costs</p>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Regional Cost Modifiers</h4>
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>• NSW Metro: Baseline (1.00x)</p>
                    <p>• VIC Metro: -5% (0.95x)</p>
                    <p>• QLD Metro: -3% (0.97x)</p>
                    <p>• WA: +8% (1.08x)</p>
                    <p>• Regional areas: -8 to -12% typically</p>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* ── Notifications ─────────────────────────────────────────────────── */}
          <TabsContent value="notifications">
            <Card className="p-6">
              <h3 className="font-display text-xl font-bold mb-6">Notification Preferences</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="notifEmail">Notification Email</Label>
                  <Input
                    id="notifEmail"
                    type="email"
                    placeholder="admin@yourcompany.com.au (leave blank to use your login email)"
                    value={notifEmail}
                    onChange={e => setNotifEmail(e.target.value)}
                    className="max-w-md"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Route alerts to your admin or bookkeeper instead of your login email.</p>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  {[
                    {
                      label: "Due Date Reminders",
                      desc: "Alert when an estimate due date is approaching",
                      value: notifDueDate, setter: setNotifDueDate,
                      extra: notifDueDate && (
                        <div className="flex items-center gap-2 mt-2">
                          <Label className="text-xs text-muted-foreground">Days before</Label>
                          <Input type="number" value={notifDaysBeforeStr} onChange={e => setNotifDaysBeforeStr(e.target.value)} className="h-7 w-16 text-sm" min="1" max="30" />
                        </div>
                      ),
                    },
                    { label: "Project Update Alerts", desc: "Notify when a project status changes", value: notifProjectUpdate, setter: setNotifProjectUpdate },
                    { label: "Weekly Summary Digest", desc: "Weekly overview of active projects and deadlines", value: notifWeeklyDigest, setter: setNotifWeeklyDigest },
                  ].map(n => (
                    <div key={n.label} className="flex items-start justify-between gap-4 p-4 border border-border rounded-lg">
                      <div>
                        <div className="font-medium">{n.label}</div>
                        <p className="text-sm text-muted-foreground mt-0.5">{n.desc}</p>
                        {n.extra}
                      </div>
                      <Toggle value={n.value} onChange={n.setter} />
                    </div>
                  ))}
                </div>

                <Button onClick={saveNotifPrefs} className="bg-primary text-primary-foreground">
                  <Save className="h-4 w-4 mr-2" />Save Preferences
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* ── Subscription & Billing ─────────────────────────────────────────── */}
          <TabsContent value="billing" className="space-y-6">
            <Card className="p-6">
              <h3 className="font-display text-xl font-bold mb-6 flex items-center gap-2">
                <CreditCard className="h-5 w-5" />Subscription & Billing
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border">
                  <div>
                    <div className="text-sm text-muted-foreground mb-0.5">Current Plan</div>
                    <div className="font-bold text-lg">{planLabel()}</div>
                  </div>
                  {statusBadge()}
                </div>

                {isTrialing && (
                  <div className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl text-sm text-blue-700 dark:text-blue-400">
                    <Clock className="h-4 w-4 shrink-0" />
                    Your trial ends in <strong>{daysLeftInTrial} day{daysLeftInTrial !== 1 ? "s" : ""}</strong>. Subscribe from the <button className="underline font-medium" onClick={() => navigate("/pricing")}>Pricing page</button>.
                  </div>
                )}

                {isTrialExpired && (
                  <Button className="bg-primary text-primary-foreground" onClick={() => navigate("/pricing")}>
                    Subscribe Now
                  </Button>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-2">Need help with billing?</h3>
              <p className="text-sm text-muted-foreground mb-3">
                For invoice copies, payment issues, or plan changes contact us at <strong>support@metricore.com.au</strong>
              </p>
              <p className="text-xs text-muted-foreground">All payments are final · Contact us for any billing questions</p>
            </Card>
          </TabsContent>

          {/* ── Team Management (Business only) ──────────────────────────────── */}
          {isBusinessPlan && (
            <TabsContent value="team" className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-display text-xl font-bold flex items-center gap-2">
                      <Users className="h-5 w-5" />Team Management
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">Business plan · Up to 5 seats</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{seatsUsed}<span className="text-muted-foreground text-base font-normal">/5</span></div>
                    <div className="text-xs text-muted-foreground">seats used</div>
                  </div>
                </div>

                <div className="flex gap-1.5 mb-6">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={`h-2 flex-1 rounded-full ${i < seatsUsed ? "bg-primary" : "bg-muted"}`} />
                  ))}
                </div>

                {seatsUsed < 5 && (
                  <div className="flex gap-3 mb-6">
                    <Input
                      placeholder="colleague@company.com.au"
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleInvite()}
                    />
                    <Button onClick={handleInvite} disabled={inviting} className="bg-primary text-primary-foreground shrink-0">
                      {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
                      {!inviting && "Send Invite"}
                    </Button>
                  </div>
                )}

                {teamLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />Loading team…
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                          {localUser?.email?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{localUser?.email}</div>
                          <div className="text-xs text-muted-foreground">Account owner</div>
                        </div>
                      </div>
                      <Badge className="bg-primary/10 text-primary border-primary/20">Owner</Badge>
                    </div>

                    {activeMembers.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-xs font-bold text-green-600">
                            {m.email[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{m.email}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                              Joined {new Date(m.joined_at).toLocaleDateString("en-AU")}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" disabled={removingId === m.id} onClick={() => handleRemoveMember(m.id, m.email)}>
                          {removingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    ))}

                    {pendingMembers.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-dashed border-border opacity-70">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="text-sm font-medium">{m.email}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Invite sent {new Date(m.invited_at).toLocaleDateString("en-AU")} · Pending
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" disabled={removingId === m.id} onClick={() => handleRemoveMember(m.id, m.email)}>
                          {removingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                        </Button>
                      </div>
                    ))}

                    {activeMembers.length === 0 && pendingMembers.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">No team members yet. Invite up to 4 colleagues above.</p>
                    )}
                  </div>
                )}
              </Card>

              <Card className="p-5 bg-muted/30">
                <h4 className="font-semibold text-sm mb-1">How team invites work</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Enter a colleague's email and click Send Invite</li>
                  <li>• They receive an email with a sign-up link</li>
                  <li>• Once they accept they get their own dashboard with Business plan access</li>
                  <li>• Each member has separate projects and data — no shared workspace</li>
                  <li>• Remove a member any time to free up a seat</li>
                </ul>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
