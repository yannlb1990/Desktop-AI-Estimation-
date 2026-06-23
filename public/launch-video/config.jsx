// config.jsx — Metricore launch video: palette, timeline, camera, cursor, captions, tabs
// Loaded after animations.jsx. Exports to window. Palette: navy + cyan (kept by request).

const C = {
  navy900: '#081521',
  navy850: '#0c1d2e',
  navy800: '#0f2436',
  navy750: '#12293c',
  navy700: '#163349',
  navy600: '#1f4763',
  line:    'rgba(255,255,255,0.10)',
  line2:   'rgba(255,255,255,0.06)',
  canvas:  '#eef2f5',
  canvas2: '#e4e9ee',
  paper:   '#ffffff',
  ink:     '#0f2436',
  ink2:    '#46606f',
  ink3:    '#8197a5',
  cyan:    '#1fb6c9',
  cyanSoft:'rgba(31,182,201,0.16)',
  cyanLine:'rgba(31,182,201,0.85)',
  green:   '#36c08a',
  amber:   '#e8a13a',
  violet:  '#9b8cf0',
  white:   '#f3f7f9',
  wall:    '#243b4d',
  wall2:   '#9fb2bf',
};
// trade colour-coding for measurements + bars
const TRADE = {
  flooring:  C.cyan,
  brickwork: C.amber,
  carpentry: C.violet,
  roofing:   C.green,
};

const FONT = "'Manrope', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

// ── Master timeline (seconds) ───────────────────────────────────────────────
const T = {
  hookIn:   0.0,
  hookOut:  2.6,
  appIn:    2.8,

  upload:   3.1,
  planIn:   5.3,

  scale:    6.4,
  scaleLine:6.8,
  scaleDlg: 8.2,
  scaleBadge:9.4,

  measure:  10.6,
  mArea:    11.0,
  mAreaVal: 12.6,
  mWall:    13.6,
  mWallVal: 15.2,
  mCount:   16.0,
  mCountVal:17.8,

  tabTakeoff: 18.8,
  takeoffRows:19.4,

  tabEstimate:24.0,
  total:      24.9,
  margin:     26.4,

  tabSchedule:28.6,
  ganttStart: 29.4,

  tender:    34.4,
  tenderDoc: 35.2,

  endIn:     37.4,
  end:       41.0,
};

// active tab by time
function viewAt(t) {
  if (t < T.tabTakeoff)  return 'plan';
  if (t < T.tabEstimate) return 'takeoff';
  if (t < T.tabSchedule) return 'estimate';
  return 'schedule';
}
const TABS = [
  { id: 'plan',     label: 'Plan' },
  { id: 'takeoff',  label: 'Takeoff' },
  { id: 'estimate', label: 'Estimate' },
  { id: 'schedule', label: 'Schedule' },
];
// app-space tab centre x (topbar), for cursor targeting
const TAB_X = { plan: 792, takeoff: 920, estimate: 1048, schedule: 1176 };

// fade helper for view crossfades
function viewFade(t, start, end, dur = 0.4) {
  const inP = Easing.easeOutCubic(clamp((t - start) / dur, 0, 1));
  const outP = end == null ? 0 : Easing.easeInCubic(clamp((t - (end - dur)) / dur, 0, 1));
  return inP * (1 - outP);
}

// ── Camera (zoom only during the Plan/measure beats) ────────────────────────
const CAM = [
  [T.appIn,    960, 540, 1.00],
  [T.upload,   820, 600, 1.06],
  [T.planIn,   820, 580, 1.05],
  [T.scale,    560, 815, 1.46],
  [T.scaleDlg, 560, 770, 1.50],
  [T.scaleBadge,720, 560, 1.10],
  [T.measure,  860, 560, 1.04],
  [T.mArea,    560, 600, 1.22],
  [T.mAreaVal, 760, 560, 1.06],
  [T.mWall,    760, 470, 1.16],
  [T.mWallVal, 880, 540, 1.05],
  [T.mCount,   760, 470, 1.18],
  [T.mCountVal,900, 540, 1.04],
  [T.tabTakeoff, 960, 540, 1.00],
];
function camAt(t) {
  const xs = CAM.map(k => k[0]);
  const fx = interpolate(xs, CAM.map(k => k[1]), Easing.easeInOutCubic)(t);
  const fy = interpolate(xs, CAM.map(k => k[2]), Easing.easeInOutCubic)(t);
  const s  = interpolate(xs, CAM.map(k => k[3]), Easing.easeInOutCubic)(t);
  return { fx, fy, s };
}
function Camera({ children }) {
  const t = useTime();
  const { fx, fy, s } = camAt(t);
  const tx = 960 - fx * s;
  const ty = 540 - fy * s;
  return (
    <div style={{
      position: 'absolute', inset: 0,
      transform: `translate(${tx}px, ${ty}px) scale(${s})`,
      transformOrigin: '0 0', willChange: 'transform',
    }}>
      {children}
    </div>
  );
}

// ── Cursor ──────────────────────────────────────────────────────────────────
function Cursor({ path, clicks = [], hideBefore = 0, hideAfter = Infinity }) {
  const t = useTime();
  if (t < hideBefore || t > hideAfter) return null;
  const xs = path.map(p => p[0]);
  const x = interpolate(xs, path.map(p => p[1]), Easing.easeInOutCubic)(t);
  const y = interpolate(xs, path.map(p => p[2]), Easing.easeInOutCubic)(t);
  let press = 0;
  for (const ct of clicks) {
    const d = t - ct;
    if (d >= 0 && d < 0.32) press = Math.max(press, Math.sin((d / 0.32) * Math.PI));
  }
  const ring = clicks.map((ct, i) => {
    const d = t - ct;
    if (d < 0 || d > 0.5) return null;
    const p = d / 0.5;
    return (
      <span key={i} style={{
        position: 'absolute', left: 2, top: 2, width: 18, height: 18, marginLeft: -9, marginTop: -9,
        borderRadius: '50%', border: `2px solid ${C.cyan}`,
        transform: `scale(${0.4 + p * 2.2})`, opacity: 0.6 * (1 - p),
      }} />
    );
  });
  return (
    <div style={{
      position: 'absolute', left: x, top: y, zIndex: 60,
      transform: `scale(${1 - press * 0.14})`, transformOrigin: '2px 2px',
      filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))', pointerEvents: 'none',
    }}>
      {ring}
      <svg width="30" height="40" viewBox="0 0 30 40" fill="none">
        <path d="M3 2 L3 30 L10.5 23 L15.5 35.5 L20 33.5 L15 21.5 L25 21 Z"
          fill="#fff" stroke={C.navy900} strokeWidth="2.2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ── Caption (lower-third) ─────────────────────────────────────────────────
function Caption({ start, end, kicker, text }) {
  const t = useTime();
  if (t < start || t > end) return null;
  const inT = Easing.easeOutCubic(clamp((t - start) / 0.45, 0, 1));
  const outT = Easing.easeInCubic(clamp((t - (end - 0.4)) / 0.4, 0, 1));
  const op = inT * (1 - outT);
  const ty = (1 - inT) * 22 + outT * -12;
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 70, zIndex: 80,
      transform: `translate(-50%, ${ty}px)`, opacity: op,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      textAlign: 'center', willChange: 'transform, opacity',
    }}>
      {kicker && (
        <div style={{
          fontFamily: MONO, fontSize: 15, letterSpacing: '0.22em',
          textTransform: 'uppercase', color: C.cyan, fontWeight: 600,
        }}>{kicker}</div>
      )}
      <div style={{
        fontFamily: FONT, fontSize: 38, fontWeight: 700, color: C.white,
        letterSpacing: '-0.02em', textShadow: '0 2px 24px rgba(0,0,0,0.55)',
      }}>{text}</div>
    </div>
  );
}

Object.assign(window, { C, TRADE, FONT, MONO, T, TABS, TAB_X, viewAt, viewFade, CAM, camAt, Camera, Cursor, Caption });
