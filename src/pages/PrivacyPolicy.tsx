import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SectionDivider from "@/components/SectionDivider";

const PrivacyPolicy = () => {
  return (
    <>
      <Helmet>
        <title>Privacy Policy | Metricore</title>
        <meta name="description" content="Metricore Privacy Policy — how Buildamax Pty Ltd collects, stores, and protects your personal information under the Australian Privacy Act 1988." />
        <link rel="canonical" href="https://metricore.com.au/privacy" />
      </Helmet>
      <div className="min-h-screen">
        <Navigation />
        <main className="container mx-auto px-6 py-16 max-w-3xl">
          <h1 className="font-display text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-10">Last updated: 11 June 2026</p>

          <section className="space-y-8 text-sm leading-7 text-muted-foreground">

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">1. About This Policy</h2>
              <p>
                This Privacy Policy describes how <strong className="text-foreground">Buildamax Pty Ltd
                (ABN 42 674 304 726)</strong>, trading as <strong className="text-foreground">Metricore</strong>
                ("we", "us", "our"), collects, uses, discloses, and protects personal information
                through the Metricore platform at metricore.com.au.
              </p>
              <p className="mt-3">
                We are bound by the <em>Privacy Act 1988</em> (Cth) and the Australian Privacy
                Principles (APPs). This policy explains your rights and our obligations under that
                framework.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">2. Information We Collect</h2>
              <p className="mb-3 font-medium text-foreground">Account and identity information:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Full name</li>
                <li>Email address</li>
                <li>Phone number</li>
                <li>Company or trading name</li>
                <li>Project type (commercial / residential) provided at signup</li>
                <li>Password (stored as a one-way cryptographic hash — we cannot read it)</li>
              </ul>

              <p className="mt-4 mb-3 font-medium text-foreground">Project and business data:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Architectural plans and PDF documents you upload</li>
                <li>Measurement takeoff data, cost estimates, and BOQ items</li>
                <li>Project names, addresses, and descriptions</li>
                <li>Client names, email addresses, and contact details you enter</li>
                <li>Scope of Works, variation logs, and tender documents you create</li>
                <li>Schedule and job cost records</li>
              </ul>

              <p className="mt-4 mb-3 font-medium text-foreground">Technical and usage data:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>IP address and browser type</li>
                <li>Pages visited and features used within the platform</li>
                <li>Session timestamps and duration</li>
                <li>Error and diagnostic logs</li>
              </ul>

              <p className="mt-4 mb-3 font-medium text-foreground">Payment information:</p>
              <p>
                Payment card details are collected and processed directly by Stripe. We do not receive,
                store, or have access to your card number, CVV, or full payment details. We retain only
                transaction records (amount, date, plan type) for accounting purposes.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">3. How We Use Your Information</h2>
              <p className="mb-3">We use personal information to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Create and manage your account</li>
                <li>Deliver and improve the Metricore platform and its features</li>
                <li>Process subscription payments and issue receipts</li>
                <li>Send transactional emails (account activation, password reset, billing notifications)</li>
                <li>Respond to support requests and enquiries</li>
                <li>Detect fraud, abuse, or security incidents</li>
                <li>Comply with legal obligations under Australian law</li>
                <li>Send product updates and service announcements (you may opt out at any time)</li>
              </ul>
              <p className="mt-3">
                We do not use your project data or client data to train AI models. We do not sell
                personal information to third parties.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">4. AI Processing — Important Disclosure</h2>
              <p>
                Metricore uses Google's Gemini AI to power features including plan dimension extraction,
                window and door detection, and AI-generated scope suggestions. When you use these
                features, the PDF content or plan data you upload is transmitted to Google's AI
                infrastructure for processing.
              </p>
              <p className="mt-3">
                Google processes this data under its own API Terms of Service and Data Processing
                Agreement. Google has committed that API data is not used to train its general AI
                models. However, your uploaded plans may be processed on servers located outside
                Australia.
              </p>
              <p className="mt-3">
                <strong className="text-foreground">Do not upload documents containing sensitive personal
                information</strong> (such as identity documents, financial records, or confidential
                client contracts) when using AI extraction features. Project plans and architectural
                drawings are appropriate for these features.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">5. Third-Party Service Providers</h2>
              <p className="mb-3">
                We share limited personal information with the following service providers, solely
                to operate the platform:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong className="text-foreground">Supabase</strong> — database, authentication, and
                  file storage. Data may be hosted on AWS infrastructure (US East region).
                </li>
                <li>
                  <strong className="text-foreground">Stripe</strong> — payment processing. Subject to
                  Stripe's Privacy Policy and PCI-DSS compliance.
                </li>
                <li>
                  <strong className="text-foreground">Vercel</strong> — application hosting and content
                  delivery. Edge nodes may be located globally.
                </li>
                <li>
                  <strong className="text-foreground">Resend</strong> — transactional email delivery
                  (account invitations, receipts, password resets).
                </li>
                <li>
                  <strong className="text-foreground">Google (Gemini AI)</strong> — AI-powered plan
                  processing features. See Section 4 above.
                </li>
              </ul>
              <p className="mt-3">
                These providers process personal information only as instructed by us and are required
                to protect it in accordance with their respective data processing agreements.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">6. Overseas Disclosure</h2>
              <p>
                Some of our service providers (Supabase/AWS, Vercel, Google, Stripe) operate
                infrastructure outside Australia, including in the United States. By using the Service,
                you consent to your personal information being transferred to and processed in these
                countries. We take reasonable steps to ensure overseas recipients handle your
                information in accordance with the APPs.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">7. Data Storage and Security</h2>
              <p>
                We implement industry-standard security measures including:
              </p>
              <ul className="list-disc pl-6 mt-3 space-y-1">
                <li>TLS encryption for all data in transit</li>
                <li>Encryption at rest for database records</li>
                <li>Row-Level Security (RLS) ensuring users can only access their own data</li>
                <li>Access controls and authentication requirements for platform access</li>
                <li>Regular security reviews</li>
              </ul>
              <p className="mt-3">
                No method of transmission over the internet is 100% secure. While we take reasonable
                steps to protect your information, we cannot guarantee absolute security.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">8. Data Retention</h2>
              <p>
                We retain your personal information and project data for as long as your account is
                active and for a reasonable period thereafter to satisfy legal, accounting, or business
                obligations. On account termination or deletion request:
              </p>
              <ul className="list-disc pl-6 mt-3 space-y-1">
                <li>Active account data is retained for 90 days, during which you may request an export</li>
                <li>After 90 days, personal and project data is permanently deleted from our systems</li>
                <li>Billing records are retained for 7 years as required by Australian tax law</li>
                <li>Anonymised aggregate usage statistics may be retained indefinitely</li>
              </ul>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">9. Cookies and Local Storage</h2>
              <p>
                We use browser cookies and localStorage for:
              </p>
              <ul className="list-disc pl-6 mt-3 space-y-1">
                <li>Authentication session tokens (essential — cannot be disabled)</li>
                <li>Project data caching to improve performance (localStorage)</li>
                <li>User preferences (theme, settings)</li>
              </ul>
              <p className="mt-3">
                We do not use advertising, tracking, or third-party analytics cookies. Essential cookies
                required for authentication cannot be disabled without preventing platform access.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">10. Your Rights Under the APPs</h2>
              <p>Under the Australian Privacy Principles, you have the right to:</p>
              <ul className="list-disc pl-6 mt-3 space-y-1">
                <li><strong className="text-foreground">Access</strong> — request a copy of the personal information we hold about you</li>
                <li><strong className="text-foreground">Correction</strong> — request correction of inaccurate, incomplete, or out-of-date information</li>
                <li><strong className="text-foreground">Deletion</strong> — request deletion of your account and associated personal data</li>
                <li><strong className="text-foreground">Opt-out</strong> — unsubscribe from marketing communications at any time via the unsubscribe link or by emailing us</li>
                <li><strong className="text-foreground">Portability</strong> — request an export of your project data</li>
              </ul>
              <p className="mt-3">
                To exercise any of these rights, email{" "}
                <a href="mailto:admin@metricore.com.au" className="text-primary hover:underline">
                  admin@metricore.com.au
                </a>
                . We will respond within 30 days. Identity verification may be required.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">11. Notifiable Data Breaches</h2>
              <p>
                In the event of an eligible data breach under the{" "}
                <em>Notifiable Data Breaches (NDB) scheme</em> (Part IIIC of the{" "}
                <em>Privacy Act 1988</em>), we will:
              </p>
              <ul className="list-disc pl-6 mt-3 space-y-1">
                <li>Assess the suspected breach as quickly as practicable</li>
                <li>Notify affected individuals whose personal information was involved and who are at real risk of serious harm</li>
                <li>Notify the Office of the Australian Information Commissioner (OAIC) within 30 days of becoming aware of an eligible breach</li>
                <li>Include in that notification: the nature of the breach, the types of information involved, and the steps we are taking in response</li>
              </ul>
              <p className="mt-3">
                If you suspect your account has been compromised, contact us immediately at{" "}
                <a href="mailto:admin@metricore.com.au" className="text-primary hover:underline">
                  admin@metricore.com.au
                </a>
                .
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">12. Third-Party Personal Data You Enter</h2>
              <p>
                The platform allows you to enter personal information belonging to third parties —
                such as your clients' names, email addresses, phone numbers, and project addresses —
                for the purpose of generating quotes, Scope of Works documents, and tender packages.
              </p>
              <p className="mt-3">
                By entering third-party personal information into the platform, you represent and
                warrant that:
              </p>
              <ul className="list-disc pl-6 mt-3 space-y-1">
                <li>You have the authority or consent of that individual to collect and use their personal information for this purpose</li>
                <li>Your collection and use of that information complies with applicable privacy laws</li>
                <li>You will not enter sensitive personal information (such as government identifiers, health information, or financial account details) beyond what is necessary to generate construction documents</li>
              </ul>
              <p className="mt-3">
                Buildamax Pty Ltd processes third-party personal information you enter solely to
                provide the Service to you. We do not use it for any other purpose and do not contact
                those individuals directly.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">13. Children's Privacy</h2>
              <p>
                The Service is not directed to persons under 18 years of age. We do not knowingly
                collect personal information from children. If you believe we have inadvertently
                collected information from a minor, please contact us immediately.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">15. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. Material changes will be
                communicated by email or via a notice on the platform before they take effect.
                Continued use of the Service after the effective date constitutes acceptance of the
                updated policy.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">15. Complaints</h2>
              <p>
                If you have a complaint about how we have handled your personal information, please
                contact us first at{" "}
                <a href="mailto:admin@metricore.com.au" className="text-primary hover:underline">
                  admin@metricore.com.au
                </a>
                . We will investigate and respond within 30 days.
              </p>
              <p className="mt-3">
                If you are not satisfied with our response, you may lodge a complaint with the{" "}
                <strong className="text-foreground">Office of the Australian Information Commissioner (OAIC)</strong>{" "}
                at{" "}
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

            <div>
              <h2 className="text-foreground font-semibold text-lg mb-3">16. Contact</h2>
              <p>
                <strong className="text-foreground">Privacy Officer — Buildamax Pty Ltd</strong><br />
                Trading as Metricore<br />
                ABN: 42 674 304 726<br />
                Email:{" "}
                <a href="mailto:admin@metricore.com.au" className="text-primary hover:underline">
                  admin@metricore.com.au
                </a>
              </p>
            </div>

          </section>
        </main>
        <SectionDivider />
        <Footer />
      </div>
    </>
  );
};

export default PrivacyPolicy;
