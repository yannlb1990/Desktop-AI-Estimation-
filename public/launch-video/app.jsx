// app.jsx — Metricore chrome: top bar + tabs, authentic toolbar (+wall panel),
// floor plan with trade-coloured measurement overlays. Plan box at app (260,220).

const PLAN = { x: 260, y: 220, w: 1040, h: 700 };

function Logo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="2" y="2" width="28" height="28" rx="8" fill={C.cyan} />
      <path d="M9 22 V11 L16 18 L23 11 V22" stroke={C.navy900} strokeWidth="2.6"
        strokeLinejoin="round" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// ── Tabs (Plan · Takeoff · Estimate · Schedule) ─────────────────────────────
function Tabs() {
  const t = useTime();
  const active = viewAt(t);
  return (
    <React.Fragment>
      {TABS.map(tab => {
        const on = tab.id === active;
        return (
          <div key={tab.id} style={{
            position: 'absolute', left: TAB_X[tab.id], top: 33, transform: 'translate(-50%,-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
          }}>
            <span style={{ fontFamily: FONT, fontSize: 16, fontWeight: on ? 700 : 600,
              color: on ? C.white : C.ink3, letterSpacing: '-0.01em', whiteSpace: 'nowrap',
              transition: 'color 200ms' }}>{tab.label}</span>
            <span style={{ width: on ? 26 : 0, height: 3, borderRadius: 2, background: C.cyan,
              transition: 'width 220ms' }} />
          </div>
        );
      })}
    </React.Fragment>
  );
}

function TopBar() {
  return (
    <div style={{
      position: 'absolute', left: 0, top: 0, width: 1920, height: 66,
      background: C.navy800, borderBottom: `1px solid ${C.line}`, zIndex: 30,
      display: 'flex', alignItems: 'center', padding: '0 22px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <Logo size={30} />
        <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 21, color: C.white, letterSpacing: '-0.02em' }}>Metricore</span>
      </div>
      <div style={{ marginLeft: 22, paddingLeft: 22, borderLeft: `1px solid ${C.line}`,
        display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: 'rgba(243,247,249,0.92)' }}>Johnson Residence</span>
        <span style={{ fontFamily: FONT, fontSize: 15, color: C.ink3 }}>· Toowoomba QLD</span>
      </div>
      <Tabs />
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontFamily: MONO, fontSize: 13, color: C.ink3, letterSpacing: '0.04em' }}>AUD · QLD rates</span>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: C.navy600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: FONT, fontWeight: 700, fontSize: 14, color: C.white }}>JD</div>
      </div>
    </div>
  );
}

// ── Left toolbar (drawing tools — Plan tab only) ────────────────────────────
const TOOLS = [
  { id: 'select', label: 'Select' },
  { id: 'scale',  label: 'Scale'  },
  { id: 'area',   label: 'Area'   },
  { id: 'wall',   label: 'Wall'   },
  { id: 'length', label: 'Length' },
  { id: 'count',  label: 'Count'  },
  { id: 'erase',  label: 'Erase'  },
];
function ToolIcon({ id, active }) {
  const col = active ? C.navy900 : C.white;
  const s = { stroke: col, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (id) {
    case 'select': return <svg width="22" height="22" viewBox="0 0 24 24"><path d="M5 3l6 16 2-6 6-2L5 3z" {...s}/></svg>;
    case 'scale':  return <svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 21L21 3M7 9l2 2M11 7l2 2M9 13l2 2M13 11l2 2" {...s}/></svg>;
    case 'area':   return <svg width="22" height="22" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="1" {...s}/><path d="M4 9h16M9 4v16" {...s} strokeWidth="1.2"/></svg>;
    case 'wall':   return <svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 18h18M3 18V9l9-5 9 5v9" {...s}/></svg>;
    case 'length': return <svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 12h16M4 9v6M20 9v6" {...s}/></svg>;
    case 'count':  return <svg width="22" height="22" viewBox="0 0 24 24"><circle cx="7" cy="7" r="2.4" {...s}/><circle cx="17" cy="7" r="2.4" {...s}/><circle cx="7" cy="17" r="2.4" {...s}/><circle cx="17" cy="17" r="2.4" {...s}/></svg>;
    case 'erase':  return <svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 15l7-7 6 6-5 5H8l-4-4z" {...s}/><path d="M9 20h11" {...s}/></svg>;
    default: return null;
  }
}
function Toolbar() {
  const t = useTime();
  let active = 'select';
  if (t >= T.scale && t < T.measure) active = 'scale';
  else if (t >= T.mArea && t < T.mWall) active = 'area';
  else if (t >= T.mWall && t < T.mCount) active = 'wall';
  else if (t >= T.mCount && t < T.tabTakeoff) active = 'count';
  return (
    <div style={{
      position: 'absolute', left: 0, top: 66, width: 84, height: 1014,
      background: C.navy850, borderRight: `1px solid ${C.line}`, zIndex: 20,
      display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 14, gap: 6,
    }}>
      {TOOLS.map(tool => {
        const on = tool.id === active;
        return (
          <div key={tool.id} style={{
            width: 56, height: 54, borderRadius: 12,
            background: on ? C.cyan : 'transparent',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
            transition: 'background 200ms',
          }}>
            <ToolIcon id={tool.id} active={on} />
            <span style={{ fontFamily: FONT, fontSize: 9.5, fontWeight: 600,
              color: on ? C.navy900 : C.ink3 }}>{tool.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Wall tool contextual panel (screen-space; rendered outside camera) ───────
function WallSwatch({ kind, active }) {
  const grads = {
    masonry: 'repeating-linear-gradient(45deg,#9fb2bf 0,#9fb2bf 1.5px,#1e293b 1.5px,#1e293b 5px)',
    plaster: 'repeating-linear-gradient(0deg,#9fb2bf 0,#9fb2bf 1px,#1e293b 1px,#1e293b 6px)',
    cladding:'repeating-linear-gradient(90deg,#9fb2bf 0,#9fb2bf 1.5px,#1e293b 1.5px,#1e293b 6px)',
  };
  const labels = { masonry: 'Masonry', plaster: 'Plasterboard', cladding: 'Cladding' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 34, height: 34, borderRadius: 7, background: grads[kind],
        border: `2px solid ${active ? C.cyan : 'rgba(255,255,255,0.14)'}` }} />
      <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600,
        color: active ? C.white : C.ink3 }}>{labels[kind]}</span>
    </div>
  );
}
function WallToolPanel() {
  const t = useTime();
  if (t < T.mWall - 0.15 || t > T.mCount - 0.1) return null;
  const p = viewFade(t, T.mWall - 0.15, T.mCount - 0.1, 0.3);
  const sect = { display: 'flex', flexDirection: 'column', gap: 8 };
  const lab = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink3 };
  return (
    <div style={{
      position: 'absolute', left: '50%', top: 86, transform: `translate(-50%, ${(1 - p) * -10}px)`,
      opacity: p, zIndex: 70, display: 'flex', alignItems: 'center', gap: 22,
      background: 'rgba(12,29,46,0.94)', border: `1px solid ${C.cyanLine}`, borderRadius: 14,
      padding: '12px 20px', boxShadow: '0 16px 40px rgba(8,21,33,0.5)', backdropFilter: 'blur(8px)',
    }}>
      <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: C.cyan }}>Wall</span>
      <div style={{ ...sect }}>
        <span style={lab}>Fill</span>
        <div style={{ display: 'flex', gap: 14 }}>
          <WallSwatch kind="masonry" active={true} />
          <WallSwatch kind="plaster" active={false} />
          <WallSwatch kind="cladding" active={false} />
        </div>
      </div>
      <div style={{ width: 1, height: 56, background: C.line }} />
      <div style={{ ...sect }}>
        <span style={lab}>Thickness</span>
        <div style={{ border: `1.5px solid ${C.cyan}`, borderRadius: 8, padding: '7px 12px',
          fontFamily: MONO, fontSize: 15, fontWeight: 700, color: C.white, background: C.navy850 }}>110 mm</div>
      </div>
      <div style={{ width: 1, height: 56, background: C.line }} />
      <div style={{ ...sect }}>
        <span style={lab}>Face</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {['L1', 'Core', 'L2'].map((f, i) => (
            <div key={f} style={{ borderRadius: 7, padding: '7px 11px', fontFamily: MONO, fontSize: 13, fontWeight: 600,
              background: i === 1 ? C.cyan : C.navy700, color: i === 1 ? C.navy900 : C.ink3 }}>{f}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Floor plan + trade-coloured overlays ───────────────────────────────────
function dash(progress, len) { return { strokeDasharray: len, strokeDashoffset: len * (1 - progress) }; }

function FloorPlan() {
  const t = useTime();
  const planVis = clamp((t - T.planIn) / 0.7, 0, 1);
  const scaleP = clamp((t - T.scaleLine) / 1.1, 0, 1);
  const scaleDlg = t >= T.scaleDlg && t < T.scaleBadge + 0.1;

  const areaPts = [[78,366],[606,366],[606,604],[78,604]];
  const areaP = clamp((t - T.mArea) / 1.3, 0, 1);
  const areaFill = clamp((t - (T.mArea + 0.9)) / 0.5, 0, 1);
  const areaLabel = t >= T.mAreaVal - 0.1;

  const wallLen = 2 * ((980 - 60) + (620 - 60));
  const wallP = clamp((t - T.mWall) / 1.3, 0, 1);
  const wallLabel = t >= T.mWallVal - 0.1;

  const doors = [[300,60],[60,470],[540,210],[620,470],[820,350],[300,350]];
  const countActive = t >= T.mCount;

  return (
    <div style={{ position: 'absolute', left: PLAN.x, top: PLAN.y, width: PLAN.w, height: PLAN.h,
      opacity: planVis, transform: `scale(${0.985 + 0.015 * planVis})`, transformOrigin: 'center' }}>
      <div style={{ position: 'absolute', inset: -28, background: C.paper, borderRadius: 6,
        boxShadow: '0 18px 50px rgba(8,21,33,0.18)', border: `1px solid ${C.canvas2}` }} />
      <svg width={PLAN.w} height={PLAN.h} viewBox={`0 0 ${PLAN.w} ${PLAN.h}`} style={{ position: 'relative' }}>
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="#eef2f5" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="-28" y="-28" width={PLAN.w + 56} height={PLAN.h + 56} fill="url(#grid)" />
        <rect x="60" y="60" width="920" height="560" fill="#fbfcfd" />
        <g stroke={C.wall} strokeWidth="9" strokeLinecap="square">
          <line x1="60" y1="350" x2="980" y2="350" />
          <line x1="540" y1="60" x2="540" y2="350" />
          <line x1="620" y1="350" x2="620" y2="620" />
        </g>
        <rect x="60" y="60" width="920" height="560" fill="none" stroke={C.wall} strokeWidth="14" strokeLinejoin="miter" />
        <g stroke={C.wall2} strokeWidth="2" fill="none">
          <path d="M300 60 a40 40 0 0 1 40 40" />
          <path d="M60 470 a40 40 0 0 0 40 40" />
          <path d="M540 210 a38 38 0 0 1 38 -38" />
          <path d="M620 470 a40 40 0 0 1 40 40" />
          <path d="M820 350 a38 38 0 0 0 -38 38" />
          <path d="M300 350 a40 40 0 0 1 40 -40" />
        </g>
        <g fontFamily={FONT} fill={C.ink2} textAnchor="middle">
          <text x="300" y="210" fontSize="22" fontWeight="700">KITCHEN</text>
          <text x="300" y="234" fontSize="13" fill={C.ink3} fontFamily={MONO}>14.2 m²</text>
          <text x="760" y="200" fontSize="22" fontWeight="700">BEDROOM</text>
          <text x="760" y="224" fontSize="13" fill={C.ink3} fontFamily={MONO}>16.8 m²</text>
          <text x="335" y="486" fontSize="24" fontWeight="700">LIVING</text>
          <text x="800" y="486" fontSize="18" fontWeight="700">BATH</text>
        </g>
        <g stroke={C.wall2} strokeWidth="1.6" fontFamily={MONO}>
          <line x1="60" y1="662" x2="620" y2="662" />
          <line x1="60" y1="654" x2="60" y2="670" />
          <line x1="620" y1="654" x2="620" y2="670" />
          <text x="340" y="684" fontSize="15" fill={C.ink2} textAnchor="middle" stroke="none">8400</text>
        </g>
        <g fontFamily={MONO} fill={C.ink3}>
          <text x="700" y="600" fontSize="12">SCALE 1:100 @ A3</text>
          <text x="700" y="616" fontSize="12">REV. C · 2026</text>
        </g>

        {/* scale line */}
        {scaleP > 0 && (
          <g>
            <line x1="60" y1="662" x2={60 + 560 * scaleP} y2="662" stroke={C.cyan} strokeWidth="5" strokeLinecap="round" />
            <circle cx="60" cy="662" r="6" fill={C.cyan} />
            {scaleP >= 1 && <circle cx="620" cy="662" r="6" fill={C.cyan} />}
          </g>
        )}
        {/* area (Flooring · cyan) */}
        {areaP > 0 && (
          <g>
            <polygon points={areaPts.map(p => p.join(',')).join(' ')} fill={TRADE.flooring} fillOpacity={areaFill * 0.16}
              stroke={TRADE.flooring} strokeWidth="3" {...dash(Math.min(areaP, 1), 4 * (606 - 78))} strokeLinejoin="round" />
            {areaPts.map((p, i) => areaP > i / 4 && <circle key={i} cx={p[0]} cy={p[1]} r="5.5" fill={TRADE.flooring} />)}
          </g>
        )}
        {/* wall (Brickwork · amber) */}
        {wallP > 0 && (
          <rect x="60" y="60" width="920" height="560" fill="none" stroke={TRADE.brickwork} strokeWidth="5"
            strokeLinecap="round" {...dash(wallP, wallLen)} />
        )}
        {/* count (Carpentry · violet) */}
        {countActive && doors.map((d, i) => {
          const appear = clamp((t - (T.mCount + 0.15 + i * 0.26)) / 0.25, 0, 1);
          if (appear <= 0) return null;
          return (
            <g key={i} opacity={appear} transform={`translate(${d[0]} ${d[1]}) scale(${0.5 + 0.5 * appear})`}>
              <circle r="15" fill={TRADE.carpentry} stroke="#fff" strokeWidth="2.5" />
              <text textAnchor="middle" dy="5.5" fontFamily={FONT} fontWeight="800" fontSize="16" fill="#fff">{i + 1}</text>
            </g>
          );
        })}
      </svg>

      {areaLabel && <PlanChip x={342} y={420} title="Living Room" trade="Flooring" value="42.3 m²" t={t} from={T.mAreaVal} color={TRADE.flooring} hideAt={18.2} />}
      {wallLabel && <PlanChip x={520} y={300} title="External Walls" trade="Brickwork" value="38.6 m" t={t} from={T.mWallVal} color={TRADE.brickwork} hideAt={18.2} />}
      {t >= T.mCountVal - 0.1 && t < 18.6 && <PlanChip x={760} y={180} title="Doors" trade="Carpentry" value="6 items" t={t} from={T.mCountVal} color={TRADE.carpentry} hideAt={18.2} />}
      {scaleDlg && <ScaleDialog t={t} />}
    </div>
  );
}

function PlanChip({ x, y, title, trade, value, t, from, color, hideAt = Infinity }) {
  const p = Easing.easeOutBack(clamp((t - from) / 0.4, 0, 1));
  const out = Easing.easeInCubic(clamp((t - hideAt) / 0.4, 0, 1));
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity: 1 - out,
      transform: `translate(-50%,-50%) scale(${p})`,
      background: C.navy800, borderRadius: 10, padding: '8px 12px', zIndex: 8,
      boxShadow: '0 8px 24px rgba(8,21,33,0.32)', border: `1px solid ${color}`,
      display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: C.white }}>{title}</span>
        <span style={{ fontFamily: MONO, fontSize: 10.5, color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{trade}</span>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: C.white,
        paddingLeft: 10, borderLeft: `1px solid ${C.line}` }}>{value}</span>
    </div>
  );
}

function ScaleDialog({ t }) {
  const p = Easing.easeOutBack(clamp((t - T.scaleDlg) / 0.35, 0, 1));
  const confirmed = t >= T.scaleBadge - 0.2;
  return (
    <div style={{ position: 'absolute', left: 360, top: 540, transform: `scale(${p})`, transformOrigin: 'top center', zIndex: 9,
      background: C.paper, borderRadius: 12, padding: 16, width: 230,
      boxShadow: '0 16px 40px rgba(8,21,33,0.28)', border: `1px solid ${C.canvas2}` }}>
      <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 10 }}>Set known length</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, border: `1.5px solid ${C.cyan}`, borderRadius: 8, padding: '8px 10px',
          fontFamily: MONO, fontSize: 18, fontWeight: 700, color: C.ink, background: '#fff' }}>8.4</div>
        <div style={{ border: `1px solid ${C.canvas2}`, borderRadius: 8, padding: '8px 10px',
          fontFamily: FONT, fontSize: 13, color: C.ink2, display: 'flex', alignItems: 'center' }}>metres</div>
      </div>
      <div style={{ marginTop: 10, borderRadius: 8, padding: '9px 0', textAlign: 'center',
        background: confirmed ? C.green : C.cyan, color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 13,
        transition: 'background 200ms' }}>{confirmed ? '✓ Calibrated' : 'Confirm scale'}</div>
    </div>
  );
}

function ScaleBadge() {
  const t = useTime();
  if (t < T.scaleBadge || t >= T.tabTakeoff) return null;
  const p = Easing.easeOutBack(clamp((t - T.scaleBadge) / 0.4, 0, 1));
  return (
    <div style={{ position: 'absolute', left: 1190, top: 92, transform: `scale(${p})`, transformOrigin: 'right top', zIndex: 22,
      background: 'rgba(54,192,138,0.14)', border: `1px solid ${C.green}`, borderRadius: 20,
      padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: C.green, fontWeight: 800, fontFamily: FONT, fontSize: 15 }}>✓</span>
      <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: '#1f5c44', letterSpacing: '0.02em' }}>Scale 1:100</span>
    </div>
  );
}

Object.assign(window, { PLAN, Logo, TopBar, Tabs, Toolbar, WallToolPanel, FloorPlan, ScaleBadge });
