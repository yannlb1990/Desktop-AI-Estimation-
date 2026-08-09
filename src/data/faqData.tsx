import type { ReactNode } from "react";

export const faqs: { category: string; items: { q: string; a: ReactNode }[] }[] = [
  {
    category: "Getting Started",
    items: [
      {
        q: "How do I create my first project?",
        a: (
          <>
            After signing in, click <strong>New Project</strong> from your dashboard. Give the project a name, assign a client,
            then upload your construction PDF plans. Metricore will process the plans so you can start taking
            measurements immediately in the interactive canvas.
          </>
        ),
      },
      {
        q: "What file types can I upload?",
        a: "Metricore accepts PDF plans. For best results, use vector PDFs exported directly from CAD or drafting software rather than scanned images. Multi-page PDFs are supported. You can work across all pages within a single project.",
      },
      {
        q: "How does the AI takeoff work?",
        a: (
          <>
            You draw measurements directly on the uploaded plan using Metricore's interactive canvas. The platform
            provides precision drawing tools (line, area, count, wall) calibrated to your plan's scale.
            Once measurements are captured, Metricore applies current Australian material rates and labour costs
            to generate an itemised estimate automatically.
          </>
        ),
      },
      {
        q: "Do I need to set the plan scale?",
        a: "Yes. Before taking measurements, use the Scale Calibration tool to define the plan scale. Draw a line over a known dimension (e.g., a wall with a printed length) and enter the real-world value. Metricore will calibrate all subsequent measurements to match.",
      },
    ],
  },
  {
    category: "Measurements & Takeoff",
    items: [
      {
        q: "What measurement tools are available?",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Line</strong> — linear measurements (pipe runs, wall lengths)</li>
            <li><strong>Area</strong> — polygon areas (slabs, flooring, roofing)</li>
            <li><strong>Wall</strong> — wall elements with height and material assignment</li>
            <li><strong>Count</strong> — point items (fixtures, fittings, doors)</li>
          </ul>
        ),
      },
      {
        q: "Can I edit or delete a measurement after drawing it?",
        a: "Yes. Select any measurement in the canvas or the measurements panel on the right to edit its label, dimensions, or material assignment. To delete, use the trash icon in the panel or press Delete after selecting the shape on the canvas.",
      },
      {
        q: "How do I assign a material or trade to a measurement?",
        a: "When you complete a measurement, a popup lets you name it and assign a trade category. You can also update this afterwards by clicking the measurement in the panel. Material rates are sourced from the Metricore rate database and applied automatically.",
      },
      {
        q: "Can I work across multiple pages of the same plan set?",
        a: "Yes. Use the page navigator at the top of the canvas to switch between PDF pages. Measurements on each page are stored independently and combined in the overall project estimate.",
      },
    ],
  },
  {
    category: "NCC Compliance",
    items: [
      {
        q: "What does 'NCC Compliant' mean in Metricore?",
        a: "Metricore's rate database includes references to National Construction Code (NCC) requirements for relevant trade categories. Estimates flag where NCC minimums apply, for example insulation R-values, structural framing spacing, and waterproofing coverage areas, so you can be confident your quotes meet code.",
      },
      {
        q: "Does Metricore cover all Australian states?",
        a: "Yes. The rate database includes regional pricing variations for all states and territories. Material and labour costs reflect local market conditions for QLD, NSW, VIC, SA, WA, TAS, ACT, and NT.",
      },
      {
        q: "Is Metricore a substitute for a licensed quantity surveyor?",
        a: "No. Metricore is a productivity tool to assist professional judgement. It is not a replacement for a qualified quantity surveyor or structural engineer. All AI-generated figures should be verified before submitting formal tenders or commencing work.",
      },
    ],
  },
  {
    category: "Plans & Billing",
    items: [
      {
        q: "How does the free trial work?",
        a: "Your free trial gives you full access to all Metricore features for a limited period, no credit card required. At the end of the trial you will be prompted to choose a paid plan to continue.",
      },
      {
        q: "Can I upgrade or downgrade my plan?",
        a: (
          <>
            To change your plan, contact us at{" "}
            <a href="mailto:admin@metricore.com.au" className="text-primary hover:underline">
              admin@metricore.com.au
            </a>{" "}
            and we'll process the change on your next billing cycle.
          </>
        ),
      },
      {
        q: "Can I cancel at any time?",
        a: "Yes. Cancel any time from your account settings or by emailing us. Your access continues until the end of your current billing period. We don't charge cancellation fees.",
      },
      {
        q: "What payment methods do you accept?",
        a: "We accept all major credit and debit cards (Visa, Mastercard, Amex) processed securely through Stripe. All prices are in AUD and include GST.",
      },
      {
        q: "Do you offer refunds?",
        a: (
          <>
            Refund requests within 14 days of a charge are considered on a case-by-case basis. Email{" "}
            <a href="mailto:admin@metricore.com.au" className="text-primary hover:underline">
              admin@metricore.com.au
            </a>{" "}
            with your account details and we'll respond within 2 business days.
          </>
        ),
      },
    ],
  },
  {
    category: "Data & Security",
    items: [
      {
        q: "Where is my data stored?",
        a: "All project data is stored on encrypted cloud infrastructure (Supabase/AWS) in secure Australian or US-East data centres. Data is encrypted at rest and in transit using industry-standard TLS and AES-256 encryption.",
      },
      {
        q: "Can other users see my projects?",
        a: "No. Projects are private to your account. If you're on a team plan, only users you explicitly invite can access shared projects.",
      },
      {
        q: "What happens to my data if I cancel?",
        a: "Your data is retained for 90 days after cancellation, during which you can request an export. After 90 days, project data is permanently deleted from our systems.",
      },
    ],
  },
];

// Plain-text version for JSON-LD FAQPage schema (no JSX)
const faqSchemaItems = [
  { q: "How do I create my first project?", a: "After signing in, click New Project from your dashboard. Give the project a name, assign a client, then upload your construction PDF plans. Metricore will process the plans so you can start taking measurements immediately in the interactive canvas." },
  { q: "What file types can I upload?", a: "Metricore accepts PDF plans. For best results, use vector PDFs exported directly from CAD or drafting software rather than scanned images. Multi-page PDFs are supported. You can work across all pages within a single project." },
  { q: "How does the AI takeoff work?", a: "You draw measurements directly on the uploaded plan using Metricore's interactive canvas. The platform provides precision drawing tools (line, area, count, wall) calibrated to your plan's scale. Once measurements are captured, Metricore applies current Australian material rates and labour costs to generate an itemised estimate automatically." },
  { q: "Do I need to set the plan scale?", a: "Yes. Before taking measurements, use the Scale Calibration tool to define the plan scale. Draw a line over a known dimension (for example, a wall with a printed length) and enter the real-world value. Metricore will calibrate all subsequent measurements to match." },
  { q: "What measurement tools are available?", a: "Line — linear measurements (pipe runs, wall lengths). Area — polygon areas (slabs, flooring, roofing). Wall — wall elements with height and material assignment. Count — point items (fixtures, fittings, doors)." },
  { q: "Can I edit or delete a measurement after drawing it?", a: "Yes. Select any measurement in the canvas or the measurements panel on the right to edit its label, dimensions, or material assignment. To delete, use the trash icon in the panel or press Delete after selecting the shape on the canvas." },
  { q: "How do I assign a material or trade to a measurement?", a: "When you complete a measurement, a popup lets you name it and assign a trade category. You can also update this afterwards by clicking the measurement in the panel. Material rates are sourced from the Metricore rate database and applied automatically." },
  { q: "Can I work across multiple pages of the same plan set?", a: "Yes. Use the page navigator at the top of the canvas to switch between PDF pages. Measurements on each page are stored independently and combined in the overall project estimate." },
  { q: "What does 'NCC Compliant' mean in Metricore?", a: "Metricore's rate database includes references to National Construction Code (NCC) requirements for relevant trade categories. Estimates flag where NCC minimums apply, for example insulation R-values, structural framing spacing, and waterproofing coverage areas, so you can be confident your quotes meet code." },
  { q: "Does Metricore cover all Australian states?", a: "Yes. The rate database includes regional pricing variations for all states and territories. Material and labour costs reflect local market conditions for QLD, NSW, VIC, SA, WA, TAS, ACT, and NT." },
  { q: "Is Metricore a substitute for a licensed quantity surveyor?", a: "No. Metricore is a productivity tool to assist professional judgement. It is not a replacement for a qualified quantity surveyor or structural engineer. All AI-generated figures should be verified before submitting formal tenders or commencing work." },
  { q: "How does the free trial work?", a: "Your free trial gives you full access to all Metricore features for a limited period, no credit card required. At the end of the trial you will be prompted to choose a paid plan to continue." },
  { q: "Can I upgrade or downgrade my plan?", a: "To change your plan, contact us at admin@metricore.com.au and we will process the change on your next billing cycle." },
  { q: "Can I cancel at any time?", a: "Yes. Cancel any time from your account settings or by emailing us. Your access continues until the end of your current billing period. We do not charge cancellation fees." },
  { q: "What payment methods do you accept?", a: "We accept all major credit and debit cards (Visa, Mastercard, Amex) processed securely through Stripe. All prices are in AUD and include GST." },
  { q: "Do you offer refunds?", a: "Refund requests within 14 days of a charge are considered on a case-by-case basis. Email admin@metricore.com.au with your account details and we will respond within 2 business days." },
  { q: "Where is my data stored?", a: "All project data is stored on encrypted cloud infrastructure (Supabase/AWS) in secure Australian or US-East data centres. Data is encrypted at rest and in transit using industry-standard TLS and AES-256 encryption." },
  { q: "Can other users see my projects?", a: "No. Projects are private to your account. If you are on a team plan, only users you explicitly invite can access shared projects." },
  { q: "What happens to my data if I cancel?", a: "Your data is retained for 90 days after cancellation, during which you can request an export. After 90 days, project data is permanently deleted from our systems." },
];

export const faqPageSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqSchemaItems.map(item => ({
    "@type": "Question",
    "name": item.q,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": item.a,
    },
  })),
};
