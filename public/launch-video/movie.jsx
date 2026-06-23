// movie.jsx — cursor journey (tab clicks), captions, hook/end cards, master Movie.

const TOOL_Y = { scale: 167, area: 227, wall: 287, count: 407 };

const CURSOR_PATH = [
  [3.0, 900, 1010], [3.25, 880, 980], [4.7, 800, 605], [5.3, 782, 560],
  [6.3, 46, TOOL_Y.scale],
  [6.8, 320, 882], [8.0, 880, 882],
  [8.5, 690, 824], [9.4, 690, 818],
  [11.0, 46, TOOL_Y.area],
  [11.4, 338, 586], [11.8, 866, 586], [12.2, 866, 824], [12.6, 338, 824], [12.9, 338, 586],
  [13.6, 46, TOOL_Y.wall],
  [13.95, 320, 280], [14.35, 1240, 280], [14.75, 1240, 840], [15.1, 320, 840],
  [15.95, 46, TOOL_Y.count],
  [16.3, 560, 280], [16.6, 320, 690], [16.9, 800, 430], [17.2, 880, 690], [17.5, 1080, 570], [17.8, 560, 570],
  [18.7, TAB_X.takeoff, 33],
  [23.9, TAB_X.estimate, 33],
  [28.5, TAB_X.schedule, 33],
  [34.3, 1560, 33], [35.0, 1400, 130],
];
const CURSOR_CLICKS = [
  6.3, 9.4, 11.0, 11.4, 11.8, 12.2, 12.6, 12.9,
  13.6, 13.95, 14.35, 14.75, 15.1,
  15.95, 16.3, 16.6, 16.9, 17.2, 17.5, 17.8,
  18.8, 24.0, 28.6, 34.4,
];
function CursorJourney() {
  return <Cursor path={CURSOR_PATH} clicks={CURSOR_CLICKS} hideBefore={2.95} hideAfter={35.2} />;
}

function DraggedFile() {
  const t = useTime();
  if (t < 3.2 || t > 5.35) return null;
  const xs = CURSOR_PATH.map(p => p[0]);
  const x = interpolate(xs, CURSOR_PATH.map(p => p[1]), Easing.easeInOutCubic)(t);
  const y = interpolate(xs, CURSOR_PATH.map(p => p[2]), Easing.easeInOutCubic)(t);
  const drop = Easing.easeInCubic(clamp((t - 5.0) / 0.35, 0, 1));
  return (
    <div style={{ position: 'absolute', left: x + 16, top: y + 18, zIndex: 55,
      transform: `rotate(-5deg) scale(${1 - drop * 0.25})`, opacity: 1 - drop,
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
      background: '#fff', borderRadius: 10, boxShadow: '0 14px 34px rgba(8,21,33,0.32)' }}>
      <div style={{ width: 30, height: 38, borderRadius: 4, background: '#e8533a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: MONO, fontSize: 9, fontWeight: 700, color: '#fff' }}>PDF</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: C.ink }}>Johnson-Plan.pdf</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.ink3 }}>2.4 MB · A3</span>
      </div>
    </div>
  );
}

// ── Decorative scanning grid ────────────────────────────────────────────────
function DriftGrid({ opacity = 0.06 }) {
  const t = useTime();
  const off = (t * 14) % 56;
  return (
    <div style={{ position: 'absolute', inset: -60, opacity,
      backgroundImage: `linear-gradient(${C.cyan} 1px, transparent 1px), linear-gradient(90deg, ${C.cyan} 1px, transparent 1px)`,
      backgroundSize: '56px 56px', transform: `translate(${off}px, ${off * 0.5}px)` }} />
  );
}

// ── Hook ────────────────────────────────────────────────────────────────────
function Hook() {
  const t = useTime();
  if (t > T.hookOut + 0.5) return null;
  const out = Easing.easeInCubic(clamp((t - T.hookOut) / 0.5, 0, 1));
  const w1 = Easing.easeOutCubic(clamp((t - 0.2) / 0.6, 0, 1));
  const w2 = Easing.easeOutCubic(clamp((t - 0.55) / 0.7, 0, 1));
  const lineP = Easing.easeInOutCubic(clamp((t - 1.0) / 1.0, 0, 1));
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.navy900, zIndex: 100,
      opacity: 1 - out, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <DriftGrid opacity={0.05} />
      <div style={{ fontFamily: MONO, fontSize: 17, letterSpacing: '0.34em', color: C.cyan,
        textTransform: 'uppercase', opacity: w1, transform: `translateY(${(1 - w1) * 14}px)`, marginBottom: 30 }}>
        For Australian builders
      </div>
      <div style={{ fontFamily: FONT, fontSize: 78, fontWeight: 800, color: C.white, letterSpacing: '-0.03em',
        textAlign: 'center', lineHeight: 1.06, opacity: w2, transform: `translateY(${(1 - w2) * 22}px)` }}>
        <div>Most builders spend <span style={{ color: C.cyan }}>hours</span></div>
        <div>just to price one job.</div>
      </div>
      <div style={{ position: 'relative', marginTop: 40, width: 520, height: 2 }}>
        <div style={{ position: 'absolute', left: '50%', top: 0, height: 2, width: `${lineP * 100}%`,
          transform: 'translateX(-50%)', background: `linear-gradient(90deg, transparent, ${C.cyan}, transparent)` }} />
      </div>
    </div>
  );
}

// ── End card ────────────────────────────────────────────────────────────────
function EndCard() {
  const t = useTime();
  if (t < T.endIn - 0.05) return null;
  const inP = Easing.easeOutCubic(clamp((t - T.endIn) / 0.6, 0, 1));
  const a = (d) => Easing.easeOutCubic(clamp((t - (T.endIn + d)) / 0.6, 0, 1));
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.navy900, zIndex: 100,
      opacity: inP, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <DriftGrid opacity={0.05} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16,
        opacity: a(0), transform: `translateY(${(1 - a(0)) * 18}px) scale(${0.92 + 0.08 * a(0)})` }}>
        <Logo size={58} />
        <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 60, color: C.white, letterSpacing: '-0.03em' }}>Metricore</span>
      </div>
      <div style={{ fontFamily: FONT, fontSize: 30, fontWeight: 600, color: 'rgba(243,247,249,0.82)', marginTop: 22,
        letterSpacing: '-0.01em', opacity: a(0.25) }}>
        From plans to tender, in minutes.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 34, opacity: a(0.5) }}>
        <span style={{ fontFamily: MONO, fontSize: 16, color: C.cyan, border: `1px solid rgba(31,182,201,0.5)`,
          borderRadius: 22, padding: '9px 18px', letterSpacing: '0.04em' }}>14-day free trial</span>
        <span style={{ fontFamily: MONO, fontSize: 16, color: C.ink3, letterSpacing: '0.04em' }}>No credit card</span>
      </div>
      <div style={{ fontFamily: FONT, fontSize: 26, fontWeight: 700, color: C.cyan, marginTop: 30,
        letterSpacing: '0.01em', opacity: a(0.7) }}>
        metricore.com.au
      </div>
    </div>
  );
}

// ── Captions ────────────────────────────────────────────────────────────────
function Captions() {
  return (
    <React.Fragment>
      <Caption start={3.4}  end={6.1}  kicker="Upload"   text="Drop in any PDF plan" />
      <Caption start={6.7}  end={10.2} kicker="Calibrate" text="Set the scale once, on any known dimension" />
      <Caption start={10.7} end={18.4} kicker="Measure"  text="Area, wall, length and count, by trade" />
      <Caption start={19.0} end={23.6} kicker="Takeoff"  text="Quantities sorted by trade, priced on QLD rates" />
      <Caption start={24.4} end={28.2} kicker="Estimate" text="Live totals, NCC referenced, set your margin" />
      <Caption start={29.0} end={34.0} kicker="Schedule" text="A build programme, sequenced trade by trade" />
      <Caption start={34.6} end={37.0} kicker="Tender"   text="A client-ready tender in one click" />
    </React.Fragment>
  );
}

function RootLabel() {
  const t = useTime();
  const sec = Math.floor(t);
  React.useEffect(() => {
    const el = document.getElementById('video-root');
    if (el) el.setAttribute('data-screen-label', `t=${sec}s`);
  }, [sec]);
  return null;
}

function Movie() {
  return (
    <div id="video-root" style={{ position: 'absolute', inset: 0, background: C.navy900 }}>
      <Camera>
        <MetricoreApp />
        <DraggedFile />
        <CursorJourney />
      </Camera>
      <WallToolPanel />
      <Captions />
      <Hook />
      <EndCard />
      <RootLabel />
    </div>
  );
}

function App() {
  return (
    <Stage width={1920} height={1080} duration={T.end} background={C.navy900} persistKey="metricore-launch">
      <Movie />
    </Stage>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
