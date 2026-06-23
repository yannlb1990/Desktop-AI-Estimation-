// panel.jsx — live plan-tab panel, upload zone, tender button + doc, app assembly.

function money(n) { return '$' + Math.round(n).toLocaleString('en-AU'); }

// ── Live takeoff panel (Plan tab, right side) ───────────────────────────────
const LIVE = [
  { trade: 'Flooring',          qty: '42.3 m²', val: 3890,  from: T.mAreaVal,  color: TRADE.flooring },
  { trade: 'Brickwork',         qty: '38.6 m',  val: 8240,  from: T.mWallVal,  color: TRADE.brickwork },
  { trade: 'Roofing',           qty: '94.1 m²', val: 14620, from: 16.2,        color: TRADE.roofing },
  { trade: 'Carpentry · Doors', qty: '6 items', val: 2940,  from: T.mCountVal, color: TRADE.carpentry },
];
function LiveRow({ r, t }) {
  const p = clamp((t - r.from) / 0.5, 0, 1);
  const e = Easing.easeOutCubic(p);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 4px',
      borderBottom: `1px solid ${C.line}`, opacity: e, transform: `translateX(${(1 - e) * 26}px)` }}>
      <span style={{ width: 6, height: 34, borderRadius: 3, background: r.color, flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: C.white }}>{r.trade}</span>
        <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.ink3 }}>{r.qty}</span>
      </div>
      <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 18, fontWeight: 700, color: C.white }}>{money(r.val)}</span>
    </div>
  );
}
function LivePanel() {
  const t = useTime();
  const sub = LIVE.reduce((a, r) => a + (t >= r.from ? r.val : 0), 0);
  return (
    <div style={{ position: 'absolute', right: 0, top: 66, width: 440, height: 1014,
      background: C.navy800, borderLeft: `1px solid ${C.line}`, zIndex: 20,
      padding: '22px 24px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: FONT, fontSize: 20, fontWeight: 800, color: C.white, letterSpacing: '-0.01em' }}>Live takeoff</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.cyan, border: `1px solid ${C.cyanLine}`,
          borderRadius: 12, padding: '3px 9px', letterSpacing: '0.04em' }}>AUTO-PRICED</span>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 12, color: C.ink3, marginBottom: 14 }}>Sorted by trade · QLD rates · live</span>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {LIVE.map((r, i) => <LiveRow key={i} r={r} t={t} />)}
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 4px' }}>
        <span style={{ fontFamily: FONT, fontSize: 14, color: C.ink3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Subtotal</span>
        <span style={{ fontFamily: MONO, fontSize: 30, fontWeight: 800, color: C.cyan }}>{money(sub)}</span>
      </div>
    </div>
  );
}

// ── Upload dropzone ─────────────────────────────────────────────────────────
function UploadZone() {
  const t = useTime();
  if (t < T.appIn || t > T.planIn + 0.4) return null;
  const inP = Easing.easeOutCubic(clamp((t - T.appIn) / 0.4, 0, 1));
  const out = Easing.easeInCubic(clamp((t - (T.planIn - 0.1)) / 0.4, 0, 1));
  const over = clamp((t - 4.5) / 0.6, 0, 1);
  const prog = clamp((t - 4.9) / 0.5, 0, 1);
  return (
    <div style={{ position: 'absolute', left: 470, top: 340, width: 620, height: 460,
      opacity: inP * (1 - out), transform: `scale(${0.98 + 0.02 * inP})`,
      border: `2.5px dashed ${over > 0.2 ? C.cyan : C.wall2}`, borderRadius: 18,
      background: over > 0.2 ? C.cyanSoft : 'rgba(255,255,255,0.5)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18,
      transition: 'background 250ms, border-color 250ms' }}>
      <svg width="66" height="66" viewBox="0 0 24 24" fill="none"
        stroke={over > 0.2 ? C.cyan : C.ink2} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
        <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
      </svg>
      <div style={{ fontFamily: FONT, fontSize: 24, fontWeight: 700, color: C.ink }}>Drop your PDF plan here</div>
      <div style={{ fontFamily: MONO, fontSize: 14, color: C.ink3, letterSpacing: '0.04em' }}>PDF · up to A1 · 1 file</div>
      {prog > 0 && (
        <div style={{ width: 300, height: 6, borderRadius: 3, background: 'rgba(31,182,201,0.18)', marginTop: 4 }}>
          <div style={{ width: `${prog * 100}%`, height: '100%', borderRadius: 3, background: C.cyan }} />
        </div>
      )}
    </div>
  );
}

// ── Generate-tender button (top bar, from Estimate tab onward) ───────────────
function TenderButton() {
  const t = useTime();
  if (t < T.tabEstimate - 0.2) return null;
  const armed = t >= T.tender - 0.5;
  const press = t >= T.tender && t < T.tender + 0.3;
  const pulse = armed ? 1 + 0.04 * Math.sin((t - T.tender) * 6) : 1;
  return (
    <div style={{ position: 'absolute', left: 1486, top: 16, height: 34, zIndex: 31,
      display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderRadius: 9,
      background: armed ? C.cyan : C.navy700, color: armed ? C.navy900 : 'rgba(243,247,249,0.85)',
      fontFamily: FONT, fontWeight: 700, fontSize: 14,
      transform: `scale(${press ? 0.96 : pulse})`, transition: 'background 250ms',
      boxShadow: armed ? '0 6px 18px rgba(31,182,201,0.4)' : 'none' }}>
      Generate tender →
    </div>
  );
}

// ── Tender document + scrim ─────────────────────────────────────────────────
function TenderScrim() {
  const t = useTime();
  if (t < T.tender + 0.3) return null;
  const op = Easing.easeOutCubic(clamp((t - (T.tender + 0.3)) / 0.5, 0, 1)) * 0.66;
  return <div style={{ position: 'absolute', inset: 0, background: C.navy900, opacity: op, zIndex: 38 }} />;
}
function TenderDoc() {
  const t = useTime();
  if (t < T.tenderDoc - 0.1) return null;
  const p = Easing.easeOutCubic(clamp((t - T.tenderDoc) / 0.5, 0, 1));
  const items = [
    ['01', 'Roof & Cladding, Colorbond', '94.1 m²', '$14,620'],
    ['02', 'External Walls, brickwork', '38.6 m', '$8,240'],
    ['03', 'Windows & Doors, carpentry', '6 no', '$2,940'],
    ['04', 'Tiling / Flooring', '42.3 m²', '$3,890'],
  ];
  return (
    <div style={{ position: 'absolute', left: 960, top: 540, zIndex: 40,
      transform: `translate(-50%, ${(1 - p) * 60 - 50}%) scale(${0.9 + 0.1 * p})`,
      opacity: p, width: 640, background: C.paper, borderRadius: 10,
      boxShadow: '0 40px 100px rgba(8,21,33,0.5)', overflow: 'hidden' }}>
      <div style={{ background: C.navy800, padding: '20px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size={26} />
          <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 19, color: C.white }}>Metricore</span>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.cyan, letterSpacing: '0.12em' }}>TENDER · BOQ</span>
      </div>
      <div style={{ padding: '22px 26px' }}>
        <div style={{ fontFamily: FONT, fontSize: 19, fontWeight: 800, color: C.ink }}>Johnson Residence</div>
        <div style={{ fontFamily: MONO, fontSize: 12.5, color: C.ink3, marginBottom: 16 }}>Toowoomba QLD · 23 Jun 2026</div>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0',
            borderBottom: `1px solid ${C.canvas2}`, opacity: clamp((p - 0.3) * 3 - i * 0.15, 0, 1) }}>
            <span style={{ fontFamily: MONO, fontSize: 12, color: C.ink3 }}>{it[0]}</span>
            <span style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: C.ink, flex: 1 }}>{it[1]}</span>
            <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.ink2 }}>{it[2]}</span>
            <span style={{ fontFamily: MONO, fontSize: 14.5, fontWeight: 700, color: C.ink, width: 82, textAlign: 'right' }}>{it[3]}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <span style={{ fontFamily: FONT, fontSize: 14, color: C.ink2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total ex GST</span>
          <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 800, color: C.navy800 }}>$29,690</span>
        </div>
      </div>
      <div style={{ background: C.green, padding: '12px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: '#fff' }}>Ready to send to client</span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>PDF · XLSX</span>
      </div>
    </div>
  );
}

// ── App assembly (NO camera; camera wraps this in movie) ─────────────────────
function MetricoreApp() {
  const t = useTime();
  const planVisible = t < T.tabTakeoff + 0.45;
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.navy900 }}>
      {planVisible && (
        <React.Fragment>
          <div style={{ position: 'absolute', left: 84, top: 66, width: 1396, height: 1014,
            background: `linear-gradient(160deg, ${C.canvas} 0%, ${C.canvas2} 100%)` }} />
          <UploadZone />
          <FloorPlan />
          <ScaleBadge />
          <Toolbar />
          <LivePanel />
        </React.Fragment>
      )}
      <TakeoffView />
      <EstimateView />
      <ScheduleView />
      <TopBar />
      <TenderButton />
      <TenderScrim />
      <TenderDoc />
    </div>
  );
}

Object.assign(window, { LivePanel, UploadZone, TenderButton, TenderScrim, TenderDoc, MetricoreApp, money });
