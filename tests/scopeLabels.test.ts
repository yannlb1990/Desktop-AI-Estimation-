import { isGenericScope } from '../src/lib/takeoff/scopeLabels';
let failed = 0;
const eq = (n: string, g: unknown, w: unknown) => { const ok = g === w; if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`); };
for (const s of ['Wall', 'Floor - Kitchen', 'Measured area', '', 'Custom Item', '18.0 m']) eq(`generic: "${s}"`, isGenericScope(s), true);
for (const s of ['Wall framing', 'Plasterboard lining', 'Floor tiling', 'Skirting 92mm pine']) eq(`real scope: "${s}"`, isGenericScope(s), false);
if (failed) { console.log(`${failed} FAILED`); process.exit(1); }
console.log('all scope label tests passed');
