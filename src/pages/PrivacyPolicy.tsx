import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const PrivacyPolicy = () => {
  return (
    <>
      <Helmet>
        <title>Privacy Policy | Metricore</title>
        <meta name="description" content="Read Metricore's Privacy Policy to learn how we collect, store, and protect your personal information under Australian privacy law and the Privacy Act 1988." />
        <link rel="canonical" href="https://metricore.com.au/privacy" />
      </Helmet>
      <div className="min-h-screen">
        <Navigation />
        <main className="container mx-auto px-6 py-16 max-w-3xl">
          <h1 className="font-display text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-10">Last updated: 1 June 2026</p>

          <section className="space-y-8 text-sm leading-7 text-muted-foreground">
            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">1. About This Policy</h2>
              <p>
                Metricore ("we", "us", "our") is an Australian software company providing AI-powered
                construction estimation tools. This Privacy Policy explains how we handle personal
                information in accordance with the <em>Privacy Act 1988</em> (Cth) and the Australian
                Privacy Principles (APPs).
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">2. Information We Collect</h2>
              <p className="mb-3">We collect information you provide directly, including:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Account registration details (name, email address, password)</li>
                <li>Billing information (processed securely by Stripe — we do not store card details)</li>
                <li>Project data you upload (plans, measurements, tender documents)</li>
                <li>Communications you send us (support requests, feedback)</li>
              </ul>
              <p className="mt-3">
                We also automatically collect usage data such as browser type, IP address, pages visited,
                and feature usage to improve our service.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">3. How We Use Your Information</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>To provide and improve the Metricore platform</li>
                <li>To process payments and manage your subscription</li>
                <li>To send transactional emails (receipts, password resets)</li>
                <li>To respond to support requests</li>
                <li>To comply with legal obligations</li>
              </ul>
              <p className="mt-3">We do not sell your personal information to third parties.</p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">4. Data Storage and Security</h2>
              <p>
                Your data is stored on secure cloud infrastructure (Supabase/AWS) with encryption at
                rest and in transit. We apply industry-standard security practices including access
                controls, audit logging, and regular security reviews.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">5. Third-Party Services</h2>
              <p className="mb-3">We use the following third-party services:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Stripe</strong> — payment processing</li>
                <li><strong>Supabase</strong> — database and authentication</li>
                <li><strong>Resend</strong> — transactional email delivery</li>
                <li><strong>Vercel</strong> — hosting and delivery</li>
              </ul>
              <p className="mt-3">Each provider operates under their own privacy policy and data processing terms.</p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">6. Your Rights</h2>
              <p>Under the Australian Privacy Principles, you have the right to:</p>
              <ul className="list-disc pl-6 mt-3 space-y-1">
                <li>Access the personal information we hold about you</li>
                <li>Request correction of inaccurate information</li>
                <li>Request deletion of your account and associated data</li>
                <li>Opt out of marketing communications</li>
              </ul>
              <p className="mt-3">
                To exercise these rights, email us at{" "}
                <a href="mailto:admin@metricore.com.au" className="text-primary hover:underline">
                  admin@metricore.com.au
                </a>
                .
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">7. Cookies</h2>
              <p>
                We use essential cookies required for authentication and session management.
                We do not use advertising or tracking cookies.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">8. Changes to This Policy</h2>
              <p>
                We may update this policy periodically. Material changes will be notified via email or
                a prominent notice on the platform. Continued use after changes constitutes acceptance.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">9. Contact</h2>
              <p>
                For privacy-related enquiries or complaints, contact us at{" "}
                <a href="mailto:admin@metricore.com.au" className="text-primary hover:underline">
                  admin@metricore.com.au
                </a>
                . We will respond within 30 days. You also have the right to lodge a complaint with the
                Office of the Australian Information Commissioner (OAIC) at{" "}
                <a
                  href="https://www.oaic.gov.au"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  oaic.gov.au
                </a>
                .
              </p>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default PrivacyPolicy;
