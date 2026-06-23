// views.jsx — full-screen tab views: Takeoff (BOQ table), Estimate, Schedule (Gantt).
// Each is app-space full-frame (0,66)..(1920,1080), opaque dark bg, gated by tab window.

function NCCBadge({ small }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: small ? 11 : 12.5, color: C.green,
      border: `1px solid rgba(54,192,138,0.5)`, borderRadius: 14, padding: small ? '4px 10px' : '6px 14px',
      letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>NCC REFERENCED</span>
  );
}

// ── Takeoff (quantity takeoff / BOQ) ────────────────────────────────────────
const BOQ = [
  { item: '01', desc: 'Roof & Cladding', sub: 'Colorbond sheet', qty: '94.1', unit: 'm²', lab: 5850, mat: 8770, total: 14620, color: TRADE.roofing },
  { item: '02', desc: 'External Walls',  sub: 'Brickwork, face', qty: '38.6', unit: 'm',  lab: 3710, mat: 4530, total: 8240,  color: TRADE.brickwork },
  { item: '03', desc: 'Windows & Doors', sub: 'Carpentry, doors',qty: '6',    unit: 'no', lab: 1290, mat: 1650, total: 2940,  color: TRADE.carpentry },
  { item: '04', desc: 'Tiling / Flooring', sub: 'Supply & lay',  qty: '42.3', unit: 'm²', lab: 1560, mat: 2330, total: 3890,  color: TRADE.flooring },
];
const GRID = '64px 1fr 92px 60px 150px 150px 156px';

function TakeoffView() {
  const t = useTime();
  const vis = viewFade(t, T.tabTakeoff, T.tabEstimate);
  if (vis <= 0) return null;
  const drift = interpolate([T.tabTakeoff, T.tabEstimate], [0, -14], Easing.linear)(t);
  const cell = { fontFamily: MONO, fontSize: 17, color: C.white, display: 'flex', alignItems: 'center' };
  const head = { fontFamily: MONO, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.ink3 };
  return (
    <div style={{ position: 'absolute', inset: 0, top: 66, background: C.navy900, opacity: vis, zIndex: 25,
      padding: '46px 110px' }}>
      <div style={{ transform: `translateY(${drift}px)` }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 34, fontWeight: 800, color: C.white, letterSpacing: '-0.02em' }}>Quantity Takeoff</div>
            <div style={{ fontFamily: MONO, fontSize: 14, color: C.ink3, marginTop: 6 }}>Sorted by trade, construction sequence · QLD rates</div>
          </div>
          <NCCBadge />
        </div>

        <div style={{ background: C.navy850, border: `1px solid ${C.line}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 18, padding: '16px 28px',
            borderBottom: `1px solid ${C.line}`, background: C.navy800 }}>
            <span style={head}>Item</span><span style={head}>Description</span>
            <span style={{ ...head, justifySelf: 'end' }}>Qty</span><span style={head}>Unit</span>
            <span style={{ ...head, justifySelf: 'end' }}>Labour</span>
            <span style={{ ...head, justifySelf: 'end' }}>Materials</span>
            <span style={{ ...head, justifySelf: 'end' }}>Total</span>
          </div>
          {BOQ.map((r, i) => {
            const rp = Easing.easeOutCubic(clamp((t - (T.takeoffRows + i * 0.42)) / 0.5, 0, 1));
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 18, padding: '20px 28px',
                borderBottom: `1px solid ${C.line2}`, alignItems: 'center',
                opacity: rp, transform: `translateX(${(1 - rp) * 30}px)` }}>
                <span style={{ ...cell, color: C.ink3, fontSize: 14 }}>{r.item}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ width: 6, height: 38, borderRadius: 3, background: r.color }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: C.white }}>{r.desc}</span>
                    <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.ink3 }}>{r.sub}</span>
                  </div>
                </div>
                <span style={{ ...cell, justifySelf: 'end' }}>{r.qty}</span>
                <span style={{ ...cell, color: C.ink3 }}>{r.unit}</span>
                <span style={{ ...cell, justifySelf: 'end', color: C.ink2 }}>{money(r.lab)}</span>
                <span style={{ ...cell, justifySelf: 'end', color: C.ink2 }}>{money(r.mat)}</span>
                <span style={{ ...cell, justifySelf: 'end', fontWeight: 700 }}>{money(r.total)}</span>
              </div>
            );
          })}
          {/* totals */}
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 18, padding: '22px 28px',
            background: C.navy800, opacity: clamp((t - (T.takeoffRows + 1.9)) / 0.5, 0, 1) }}>
            <span></span>
            <span style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: C.ink3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total ex GST</span>
            <span></span><span></span>
            <span style={{ ...cell, justifySelf: 'end', color: C.ink2, fontSize: 15 }}>{money(12410)}</span>
            <span style={{ ...cell, justifySelf: 'end', color: C.ink2, fontSize: 15 }}>{money(17280)}</span>
            <span style={{ ...cell, justifySelf: 'end', fontWeight: 800, fontSize: 22, color: C.cyan }}>{money(29690)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Estimate ────────────────────────────────────────────────────────────────
const EST = [
  { name: 'Roofing',           val: 14620, color: TRADE.roofing },
  { name: 'Brickwork',         val: 8240,  color: TRADE.brickwork },
  { name: 'Flooring',          val: 3890,  color: TRADE.flooring },
  { name: 'Carpentry · Doors', val: 2940,  color: TRADE.carpentry },
];
function EstimateView() {
  const t = useTime();
  const vis = viewFade(t, T.tabEstimate, T.tabSchedule);
  if (vis <= 0) return null;
  const maxV = 14620;
  const totalP = clamp((t - T.total) / 1.1, 0, 1);
  const shown = Easing.easeOutCubic(totalP) * 29690;
  const mP = clamp((t - T.margin) / 0.5, 0, 1);
  const sell = 40082, gst = 44090;
  return (
    <div style={{ position: 'absolute', inset: 0, top: 66, background: C.navy900, opacity: vis, zIndex: 25,
      padding: '52px 120px', display: 'flex', gap: 64 }}>
      {/* left: trade breakdown */}
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT, fontSize: 34, fontWeight: 800, color: C.white, letterSpacing: '-0.02em' }}>Estimate</div>
        <div style={{ fontFamily: MONO, fontSize: 14, color: C.ink3, marginTop: 6, marginBottom: 40 }}>Cost by trade · materials, labour, margin</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          {EST.map((r, i) => {
            const bp = Easing.easeOutCubic(clamp((t - (T.tabEstimate + 0.3 + i * 0.18)) / 0.6, 0, 1));
            return (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontFamily: FONT, fontSize: 19, fontWeight: 600, color: C.white }}>{r.name}</span>
                  <span style={{ fontFamily: MONO, fontSize: 19, fontWeight: 700, color: C.white }}>{money(r.val)}</span>
                </div>
                <div style={{ height: 14, borderRadius: 7, background: C.navy750, overflow: 'hidden' }}>
                  <div style={{ width: `${(r.val / maxV) * 100 * bp}%`, height: '100%', borderRadius: 7, background: r.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* right: total + margin card */}
      <div style={{ width: 520, background: C.navy850, border: `1px solid ${C.line}`, borderRadius: 20,
        padding: '34px 36px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 }}>
          <span style={{ fontFamily: FONT, fontSize: 15, color: C.ink3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Subtotal</span>
          <NCCBadge small />
        </div>
        <div style={{ fontFamily: MONO, fontSize: 56, fontWeight: 800, color: C.cyan, letterSpacing: '-0.02em' }}>{money(shown)}</div>

        <div style={{ marginTop: 30, paddingTop: 26, borderTop: `1px solid ${C.line}`, opacity: mP }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
            <span style={{ fontFamily: FONT, fontSize: 17, color: 'rgba(243,247,249,0.85)' }}>Margin</span>
            <div style={{ border: `1.5px solid ${C.cyan}`, borderRadius: 8, padding: '7px 14px',
              fontFamily: MONO, fontSize: 18, fontWeight: 700, color: C.white, background: C.navy800 }}>35%</div>
            <div style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 13, color: C.ink3 }}>+ GST 10%</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ fontFamily: FONT, fontSize: 16, color: C.ink2 }}>Quote ex GST</span>
            <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 800, color: C.green }}>{money(sell)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: FONT, fontSize: 16, color: C.ink2 }}>Incl. GST</span>
            <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: C.white }}>{money(gst)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Schedule (Gantt programme) ──────────────────────────────────────────────
const TASKS = [
  { name: 'Site setup & Preliminaries', s: 0,    d: 1,   c: C.ink3 },
  { name: 'Footings & Slab',            s: 1,    d: 1.5, c: C.ink3 },
  { name: 'Frame',                      s: 2,    d: 2,   c: C.cyanLine },
  { name: 'Roof & Cladding',            s: 4,    d: 1.5, c: TRADE.roofing },
  { name: 'External Walls · Brickwork', s: 4,    d: 2,   c: TRADE.brickwork },
  { name: 'Windows & Doors',            s: 6,    d: 1,   c: TRADE.carpentry },
  { name: 'Services rough-in',          s: 6,    d: 2.5, c: C.ink3 },
  { name: 'Plasterboard & Linings',     s: 7.5,  d: 1.5, c: C.cyanLine },
  { name: 'Flooring & Tiling',          s: 8.5,  d: 1.5, c: TRADE.flooring },
  { name: 'Fit-out & Joinery',          s: 9.5,  d: 1.5, c: C.cyanLine },
  { name: 'Painting',                   s: 10.5, d: 1,   c: C.ink3 },
  { name: 'Handover',                   s: 11.5, d: 0.5, c: C.green },
];
function ScheduleView() {
  const t = useTime();
  const vis = viewFade(t, T.tabSchedule, null);
  if (vis <= 0) return null;
  const WEEKS = 12;
  const gridL = 90, labelW = 350, gridR = 1830;
  const trackL = gridL + labelW + 20;       // 460
  const weekW = (gridR - trackL) / WEEKS;    // ~114
  const rowTop = 268, rowH = 56;
  return (
    <div style={{ position: 'absolute', inset: 0, top: 66, background: C.navy900, opacity: vis, zIndex: 25,
      padding: '46px 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 110px', marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: FONT, fontSize: 34, fontWeight: 800, color: C.white, letterSpacing: '-0.02em' }}>Programme</div>
          <div style={{ fontFamily: MONO, fontSize: 14, color: C.ink3, marginTop: 6 }}>Indicative build sequence · 12 weeks</div>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 13, color: C.ink3, letterSpacing: '0.05em' }}>EST. 12 WEEKS · 4 KEY TRADES PRICED</span>
      </div>

      <svg width="1920" height="900" style={{ position: 'absolute', left: 0, top: 150 }}>
        {/* week gridlines + labels */}
        {Array.from({ length: WEEKS + 1 }).map((_, w) => {
          const x = trackL + w * weekW;
          return (
            <g key={w}>
              <line x1={x} y1={92} x2={x} y2={rowTop - 150 + rowH * TASKS.length + 16} stroke={C.line2} strokeWidth="1" />
              {w < WEEKS && <text x={x + 6} y={86} fontFamily={MONO} fontSize="12" fill={C.ink3}>W{w + 1}</text>}
            </g>
          );
        })}
        {/* task rows */}
        {TASKS.map((task, i) => {
          const y = rowTop - 150 + i * rowH;
          const bp = Easing.easeOutCubic(clamp((t - (T.ganttStart + i * 0.26)) / 0.55, 0, 1));
          const bx = trackL + task.s * weekW;
          const bw = task.d * weekW * bp;
          return (
            <g key={i}>
              <text x={gridL} y={y + 28} fontFamily={FONT} fontSize="16" fontWeight="600" fill="rgba(243,247,249,0.9)">{task.name}</text>
              <rect x={bx} y={y + 12} width={task.d * weekW} height="30" rx="7" fill="rgba(255,255,255,0.04)" />
              <rect x={bx} y={y + 12} width={Math.max(bw, 0.001)} height="30" rx="7" fill={task.c} opacity={bp > 0 ? 1 : 0} />
              {bp > 0.6 && (
                <text x={bx + 12} y={y + 32} fontFamily={MONO} fontSize="12" fontWeight="700"
                  fill={task.c === C.ink3 ? C.white : C.navy900} opacity={(bp - 0.6) / 0.4}>{task.d}w</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

Object.assign(window, { NCCBadge, TakeoffView, EstimateView, ScheduleView });
