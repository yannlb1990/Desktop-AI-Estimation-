/**
 * Home warranty insurance (the statutory cover a builder must arrange on residential work
 * over a set value), worked out from the contract price for the project's state. It sits
 * after the contract total: the builder collects it for the owner and passes it to the
 * insurer, so it is shown apart and can be added to the quote or left out.
 *
 * Queensland's premium is the QBCC's published table (exact). Elsewhere the insurer sets
 * the premium for each builder, so a typical rate is used until the builder enters the
 * figure from their own quote or certificate.
 */
import { QBCC_NEW_HOME_DELTAS, QBCC_ALTERATIONS_DELTAS } from '@/data/qbccPremiums';

export type HwWork = 'new' | 'renovation';

export interface HwRule {
  state: string;
  scheme: string;
  /** required when the contract price (incl GST) is over this */
  thresholdIncGst: number;
  /** typical premium as % of the contract price, where no published table is used */
  typicalPct?: number;
  note: string;
}

export const HW_RULES: Record<string, HwRule> = {
  QLD: { state: 'QLD', scheme: 'QBCC Home Warranty Scheme', thresholdIncGst: 3300, note: 'QBCC premium table. Collected for the owner and paid to QBCC: no GST is added by the builder.' },
  NSW: { state: 'NSW', scheme: 'Home Building Compensation Fund (icare HBCF)', thresholdIncGst: 20000, typicalPct: 1.1, note: 'Premium set by icare for each builder: enter the figure from your HBCF quote.' },
  VIC: { state: 'VIC', scheme: 'Domestic building insurance (VMIA)', thresholdIncGst: 20000, typicalPct: 0.9, note: 'Over $16,000 for contracts signed before 1 July 2026. Premium set by VMIA: enter your quoted figure.' },
  WA: { state: 'WA', scheme: 'Home Indemnity Insurance', thresholdIncGst: 20000, typicalPct: 0.8, note: 'Premium set by the insurer: enter your quoted figure.' },
  SA: { state: 'SA', scheme: 'Building Indemnity Insurance', thresholdIncGst: 20000, typicalPct: 1.0, note: 'Over $12,000 for contracts before 10 November 2025. Premium set by the insurer: enter your quoted figure.' },
  ACT: { state: 'ACT', scheme: 'Residential Building Insurance', thresholdIncGst: 12000, typicalPct: 1.0, note: 'Premium set by the insurer: enter your quoted figure.' },
  NT: { state: 'NT', scheme: 'Residential building cover (Fidelity Fund)', thresholdIncGst: 12000, typicalPct: 1.0, note: 'Additions that add floor area: over $25,000 from 30 March 2026. Premium set by the insurer: enter your quoted figure.' },
  TAS: { state: 'TAS', scheme: 'No home warranty scheme', thresholdIncGst: Infinity, note: 'Tasmania has no mandatory home warranty insurance.' },
};

const decode = (deltas: string): number[] => {
  let c = 0;
  return deltas.split(',').map(d => (c += Number(d)) / 100);
};
let tables: Record<HwWork, number[]> | null = null;
const qbccTable = (work: HwWork) => {
  tables ??= { new: decode(QBCC_NEW_HOME_DELTAS), renovation: decode(QBCC_ALTERATIONS_DELTAS) };
  return tables[work];
};

/** QBCC premium (GST inclusive) for an insurable value (the contract price incl GST). */
export function qbccPremium(insurableValue: number, work: HwWork): number {
  const t = qbccTable(work);
  if (!(insurableValue > 0)) return 0;
  if (insurableValue <= 3300) return t[0];
  if (insurableValue <= 3_000_000) return t[Math.ceil((insurableValue - 3000) / 1000)];
  // any amount over a $1,000 step pays the next step
  return Math.round((t[t.length - 1] + 3.2 * Math.ceil((insurableValue - 3_000_000) / 1000)) * 100) / 100;
}

export interface HwSettings {
  /** add the premium to the quote's total */
  include: boolean;
  work: HwWork;
  /** the premium from the builder's own quote or certificate, which wins over any estimate */
  amount?: number | null;
  /** the builder's own rate %, used where there is no table and no amount */
  ratePct?: number | null;
}

export interface HwResult {
  rule: HwRule;
  required: boolean;
  premium: number;
  basis: 'table' | 'rate' | 'amount' | 'none';
}

export function homeWarranty(state: string | null | undefined, contractIncGst: number, s: Partial<HwSettings> = {}): HwResult {
  const rule = HW_RULES[(state || 'NSW').toUpperCase()] ?? HW_RULES.NSW;
  const required = contractIncGst > rule.thresholdIncGst;
  if (s.amount != null && s.amount >= 0) return { rule, required, premium: Math.round(s.amount * 100) / 100, basis: 'amount' };
  if (!required) return { rule, required, premium: 0, basis: 'none' };
  if (rule.state === 'QLD') return { rule, required, premium: qbccPremium(contractIncGst, s.work ?? 'new'), basis: 'table' };
  const pct = s.ratePct ?? rule.typicalPct ?? 0;
  return { rule, required, premium: Math.round(contractIncGst * pct) / 100, basis: 'rate' };
}
