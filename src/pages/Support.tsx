import { Helmet } from "react-helmet-async";
import { Mail, MessageSquare, Clock, FileQuestion } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SectionDivider from "@/components/SectionDivider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqs, faqPageSchema } from "@/data/faqData";

const Support = () => {
  return (
    <>
      <Helmet>
        <title>Support and FAQ | Metricore Construction Estimation</title>
        <meta name="description" content="Metricore help centre. Frequently asked questions, getting started guides, and contact details for Australian construction estimation software." />
        <link rel="canonical" href="https://metricore.com.au/support" />
        <script type="application/ld+json">{JSON.stringify(faqPageSchema)}</script>
      </Helmet>
      <div className="min-h-screen">
        <Navigation />
        <main className="container mx-auto px-6 py-16 max-w-4xl">

          {/* Header */}
          <div className="mb-12">
            <h1 className="font-display text-4xl font-bold mb-3">Support Centre</h1>
            <p className="text-muted-foreground text-lg">
              Everything you need to get the most out of Metricore.
            </p>
          </div>

          {/* Contact cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
            <a
              href="mailto:admin@metricore.com.au"
              className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <span className="font-semibold text-sm">Email Support</span>
              </div>
              <p className="text-sm text-muted-foreground">
                admin@metricore.com.au
              </p>
              <p className="text-xs text-muted-foreground/70 mt-auto">
                We reply within 1 business day
              </p>
            </a>

            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <span className="font-semibold text-sm">Support Hours</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Mon – Fri, 8 am – 6 pm AEST
              </p>
              <p className="text-xs text-muted-foreground/70 mt-auto">
                Excluding Queensland public holidays
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <span className="font-semibold text-sm">Billing & Account</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Plan changes, invoices, refunds
              </p>
              <p className="text-xs text-muted-foreground/70 mt-auto">
                <a href="mailto:admin@metricore.com.au" className="text-primary hover:underline">
                  admin@metricore.com.au
                </a>
              </p>
            </div>
          </div>

          {/* FAQ */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <FileQuestion className="h-6 w-6 text-primary" />
              <h2 className="font-display text-2xl font-bold">Frequently Asked Questions</h2>
            </div>

            <div className="space-y-8">
              {faqs.map((section) => (
                <div key={section.category}>
                  <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
                    {section.category}
                  </h3>
                  <Accordion type="single" collapsible className="space-y-1">
                    {section.items.map((item, idx) => (
                      <AccordionItem
                        key={idx}
                        value={`${section.category}-${idx}`}
                        className="border border-border rounded-lg px-4 data-[state=open]:border-primary/30"
                      >
                        <AccordionTrigger className="text-sm font-medium hover:no-underline py-4 text-left">
                          {item.q}
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground leading-7 pb-4">
                          {item.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="mt-16 rounded-xl border border-border bg-card p-8 text-center">
            <h3 className="font-display text-xl font-bold mb-2">Still have a question?</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Our team is happy to help. Send us an email and we'll get back to you within one business day.
            </p>
            <a
              href="mailto:admin@metricore.com.au"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Mail className="h-4 w-4" />
              admin@metricore.com.au
            </a>
          </div>

        </main>
        <SectionDivider />
        <Footer />
      </div>
    </>
  );
};

export default Support;
