import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const TermsOfService = () => {
  return (
    <>
      <Helmet>
        <title>Terms of Service | Metricore</title>
        <meta name="description" content="Metricore Terms of Service — AI-powered construction estimation platform operated by Buildamax Pty Ltd." />
        <link rel="canonical" href="https://metricore.com.au/terms" />
      </Helmet>
      <div className="min-h-screen">
        <Navigation />
        <main className="container mx-auto px-6 py-16 max-w-3xl">
          <h1 className="font-display text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-muted-foreground mb-10">Last updated: 11 June 2026</p>

          <section className="space-y-8 text-sm leading-7 text-muted-foreground">

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">1. Parties and Agreement</h2>
              <p>
                These Terms of Service ("Terms") constitute a legally binding agreement between you ("User",
                "you") and <strong className="text-foreground">Buildamax Pty Ltd (ABN [INSERT ABN])</strong>,
                trading as <strong className="text-foreground">Metricore</strong> ("we", "us", "our"),
                operating the platform at metricore.com.au ("the Service").
              </p>
              <p className="mt-3">
                By creating an account, accepting an invitation, or otherwise accessing the Service, you
                confirm that you have read, understood, and agreed to these Terms. If you do not agree,
                you must not use the Service.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">2. Description of Service</h2>
              <p>
                Metricore provides cloud-based construction estimation software including, without
                limitation: PDF plan upload and measurement takeoff, cost estimation, Bill of Quantities
                (BOQ) generation, Scope of Works (SOW) document creation, NCC compliance checklisting,
                project scheduling, job cost tracking, and variation logging ("the Platform").
              </p>
              <p className="mt-3">
                The Platform incorporates artificial intelligence features including AI-assisted dimension
                extraction, fixture detection, and scope suggestions. These features are processing aids
                only. All AI-generated output must be independently verified by a qualified professional
                before reliance or use.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">3. Eligibility</h2>
              <p>
                You must be at least 18 years of age and legally authorised to enter contracts in
                Australia. By using the Service you represent that you meet these requirements. The
                Platform is designed for use by construction professionals, builders, estimators, and
                quantity surveyors operating in Australia.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">4. Account Registration</h2>
              <p>
                Accounts are created via invitation. You must provide accurate, current, and complete
                information and keep it updated. You are solely responsible for maintaining the
                confidentiality of your login credentials and for all activity that occurs under your
                account. Notify us immediately at{" "}
                <a href="mailto:admin@metricore.com.au" className="text-primary hover:underline">
                  admin@metricore.com.au
                </a>{" "}
                if you suspect unauthorised access. We are not liable for losses resulting from
                unauthorised account access where you have failed to notify us promptly.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">5. Subscriptions and Billing</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Paid subscriptions are billed in Australian Dollars (AUD) on a monthly or annual cycle via Stripe.</li>
                <li>All prices include GST where applicable under the <em>A New Tax System (Goods and Services Tax) Act 1999</em>.</li>
                <li>Subscriptions renew automatically at the end of each billing period unless cancelled prior to the renewal date.</li>
                <li>You may request a refund within 14 days of a charge by contacting admin@metricore.com.au. Refunds are assessed on a case-by-case basis. We are not obligated to provide refunds outside this window except as required by Australian Consumer Law.</li>
                <li>Trial periods are offered at our discretion. At the end of a trial, your account will automatically transition to the selected paid plan unless cancelled.</li>
                <li>We reserve the right to change pricing with 30 days' written notice. Continued use after price changes constitutes acceptance.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">6. Your Data and Intellectual Property</h2>
              <p>
                You retain all intellectual property rights in the project data, plans, documents, and
                content you upload to the Platform ("Your Content"). By uploading Your Content, you
                grant Buildamax Pty Ltd a non-exclusive, worldwide, royalty-free licence to host,
                process, and transmit Your Content solely to provide the Service to you.
              </p>
              <p className="mt-3">
                We do not claim ownership of Your Content. We do not use Your Content to train AI
                models. We do not sell or share Your Content with third parties except as necessary to
                operate the Platform (see our Privacy Policy for details).
              </p>
              <p className="mt-3">
                The Metricore platform, including its software, design, rate databases, scope libraries,
                trademarks, and AI models, is the intellectual property of Buildamax Pty Ltd. Nothing
                in these Terms transfers any ownership of Platform IP to you.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">7. Accuracy of Estimates and AI Output</h2>
              <p className="mb-3 font-medium text-foreground">
                This is the most important clause. Please read it carefully.
              </p>
              <p>
                All cost estimates, quantities, measurements, rate calculations, BOQ outputs, and
                AI-generated content produced by the Platform are <strong className="text-foreground">indicative tools
                to assist professional judgement only</strong>. They are not:
              </p>
              <ul className="list-disc pl-6 mt-3 space-y-1">
                <li>A substitute for a certified quantity surveyor's report</li>
                <li>Professional construction or engineering advice</li>
                <li>A guarantee of project cost or scope</li>
                <li>Warranted to be accurate, complete, or current</li>
              </ul>
              <p className="mt-3">
                Rate data is periodically updated but may not reflect current market conditions in your
                specific region or project type. AI dimension extraction and fixture detection may
                produce errors, omissions, or misidentifications.
              </p>
              <p className="mt-3">
                <strong className="text-foreground">You are solely responsible</strong> for independently
                verifying all Platform outputs before submitting tenders, signing contracts, commencing
                work, or making any business decision based on them. Buildamax Pty Ltd accepts no
                liability for any loss, damage, cost overrun, contract dispute, or business consequence
                arising from reliance on Platform outputs without independent professional verification.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">8. NCC Compliance Checklist</h2>
              <p>
                The NCC Compliance features are provided for <strong className="text-foreground">guidance
                purposes only</strong>. They do not constitute compliance advice, building certification,
                or a professional determination of compliance with the National Construction Code, any
                Australian Standard, or state and territory building regulations.
              </p>
              <p className="mt-3">
                Always engage a registered building surveyor, certifier, or other qualified professional
                to make binding compliance determinations for your project. Building codes are subject
                to amendment; always verify the current applicable version with your local authority.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">9. Acceptable Use</h2>
              <p className="mb-3">You agree not to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Use the Service for any unlawful purpose under Australian law</li>
                <li>Reverse engineer, decompile, copy, or create derivative works from the Platform</li>
                <li>Upload files containing malware, viruses, or content that infringes third-party intellectual property rights</li>
                <li>Share account credentials with additional users on a single-seat plan</li>
                <li>Attempt to circumvent payment, access controls, or usage limits</li>
                <li>Use automated tools (bots, scrapers) to access the Platform without written consent</li>
                <li>Resell or sublicense access to the Platform without written authorisation</li>
              </ul>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">10. Third-Party Services</h2>
              <p>
                The Platform integrates third-party services including Stripe (payments), Supabase
                (database), Vercel (hosting), Resend (email), and Google Gemini (AI processing). Your
                use of these integrations is also subject to the respective provider's terms of service.
                We are not responsible for any failure, interruption, or change in third-party services.
              </p>
              <p className="mt-3">
                When you use AI-powered features, your uploaded plan data may be transmitted to
                Google's AI services for processing. See our Privacy Policy for details.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">11. Limitation of Liability</h2>
              <p>
                Nothing in these Terms excludes, restricts, or modifies any right or remedy, or any
                guarantee, warranty, or other term or condition, implied or imposed by the Australian
                Consumer Law that cannot lawfully be excluded or limited.
              </p>
              <p className="mt-3">
                Subject to the above, to the maximum extent permitted by law, Buildamax Pty Ltd's
                total aggregate liability to you for any claim arising from or in connection with the
                Service is limited to the total fees paid by you to Buildamax Pty Ltd in the
                <strong className="text-foreground"> three (3) months immediately preceding the event giving rise to the claim</strong>.
              </p>
              <p className="mt-3">
                To the maximum extent permitted by law, Buildamax Pty Ltd is not liable for any:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Indirect, consequential, special, or incidental loss or damage</li>
                <li>Loss of profits, revenue, contracts, or anticipated savings</li>
                <li>Loss arising from project cost overruns, tender errors, or construction disputes</li>
                <li>Loss arising from inaccurate AI outputs or rate data</li>
                <li>Data loss caused by user error or third-party service outages</li>
              </ul>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">12. Termination</h2>
              <p>
                You may cancel your subscription at any time through account settings or by contacting
                us. Cancellation takes effect at the end of the current billing period.
              </p>
              <p className="mt-3">
                We may suspend or terminate your account without notice if you materially breach these
                Terms, fail to pay subscription fees, or if continued access poses a legal, security,
                or operational risk. On termination, your access ceases immediately. We will retain
                your data for 90 days after termination, during which you may request an export, after
                which it will be permanently deleted.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">13. Dispute Resolution</h2>
              <p>
                If you have a dispute with us, please contact{" "}
                <a href="mailto:admin@metricore.com.au" className="text-primary hover:underline">
                  admin@metricore.com.au
                </a>{" "}
                first. We will endeavour to resolve disputes informally within 30 days. If not
                resolved, disputes are subject to the courts of Queensland, Australia.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">14. Governing Law</h2>
              <p>
                These Terms are governed by the laws of Queensland, Australia. Each party submits to
                the non-exclusive jurisdiction of the courts of Queensland.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">15. Changes to These Terms</h2>
              <p>
                We may update these Terms at any time. We will provide at least 14 days' notice of
                material changes by email or via a prominent notice on the Platform. Continued use after
                the effective date constitutes acceptance of the updated Terms.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">16. Contact</h2>
              <p>
                <strong className="text-foreground">Buildamax Pty Ltd</strong> trading as Metricore<br />
                ABN: [INSERT ABN]<br />
                Email:{" "}
                <a href="mailto:admin@metricore.com.au" className="text-primary hover:underline">
                  admin@metricore.com.au
                </a>
              </p>
            </div>

          </section>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default TermsOfService;
