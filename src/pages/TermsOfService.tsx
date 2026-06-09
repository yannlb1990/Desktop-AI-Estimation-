import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const TermsOfService = () => {
  return (
    <>
      <Helmet>
        <title>Terms of Service | Metricore</title>
        <meta name="description" content="Metricore Terms of Service covering subscriptions, data ownership, acceptable use, and liability for our Australian construction estimation platform." />
        <link rel="canonical" href="https://metricore.com.au/terms" />
      </Helmet>
      <div className="min-h-screen">
        <Navigation />
        <main className="container mx-auto px-6 py-16 max-w-3xl">
          <h1 className="font-display text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-muted-foreground mb-10">Last updated: 1 June 2026</p>

          <section className="space-y-8 text-sm leading-7 text-muted-foreground">
            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">1. Acceptance</h2>
              <p>
                By accessing or using Metricore ("the Service"), you agree to be bound by these Terms
                of Service. If you do not agree, do not use the Service. These terms are governed by
                the laws of Queensland, Australia.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">2. Description of Service</h2>
              <p>
                Metricore provides AI-powered construction estimation software, including plan upload,
                automated takeoff measurement, quantity generation, and tender document creation.
                The Service is intended for use by construction professionals in Australia.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">3. Account Registration</h2>
              <p>
                You must provide accurate information when creating an account. You are responsible
                for maintaining the confidentiality of your credentials and for all activity under
                your account. Notify us immediately of any unauthorised access at{" "}
                <a href="mailto:admin@metricore.com.au" className="text-primary hover:underline">
                  admin@metricore.com.au
                </a>
                .
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">4. Subscriptions and Billing</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Paid subscriptions are billed in AUD on a monthly or annual basis via Stripe.</li>
                <li>All prices include GST where applicable.</li>
                <li>Subscriptions auto-renew unless cancelled before the renewal date.</li>
                <li>Refunds are considered on a case-by-case basis. Contact us within 14 days of a charge.</li>
                <li>Free trial periods are available as described on the pricing page.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">5. Acceptable Use</h2>
              <p className="mb-3">You agree not to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Use the Service for any unlawful purpose.</li>
                <li>Attempt to reverse engineer, decompile, or extract the Service's source code.</li>
                <li>Upload malicious files or content that infringes third-party rights.</li>
                <li>Share account credentials with multiple users on single-seat plans.</li>
                <li>Use the Service to generate estimates for projects outside Australia without authorisation.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">6. Your Data</h2>
              <p>
                You retain ownership of all project data, plans, and documents you upload. You grant
                Metricore a limited licence to process this data solely to provide the Service.
                We do not use your project data to train AI models or share it with third parties
                beyond what is necessary to operate the platform.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">7. Accuracy of Estimates</h2>
              <p>
                Metricore's AI-generated estimates are tools to assist professional judgement. They
                are not a substitute for qualified quantity surveying or engineering advice. You are
                solely responsible for verifying all outputs before submitting tenders or commencing
                work. Metricore shall not be liable for losses arising from reliance on AI-generated
                figures without independent verification.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">8. Intellectual Property</h2>
              <p>
                The Metricore platform, including its software, design, trademarks, and AI models,
                is the intellectual property of Metricore. Nothing in these Terms grants you any
                ownership rights in the platform itself.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">9. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by Australian Consumer Law, Metricore's total liability
                for any claim arising from use of the Service is limited to the fees paid by you in
                the 3 months prior to the claim. We are not liable for indirect, consequential, or
                incidental damages.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">10. Termination</h2>
              <p>
                Either party may terminate at any time. On termination, your access ceases and your
                data will be retained for 90 days before deletion, during which you may request an
                export. We may suspend accounts that violate these Terms without notice.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">11. Changes to Terms</h2>
              <p>
                We may update these Terms periodically. We will notify you of material changes by
                email at least 14 days before they take effect. Continued use constitutes acceptance.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">12. Contact</h2>
              <p>
                Questions about these Terms:{" "}
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
