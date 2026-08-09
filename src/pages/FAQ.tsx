import { Helmet } from "react-helmet-async";
import { FileQuestion } from "lucide-react";
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

const FAQ = () => {
  return (
    <>
      <Helmet>
        <title>Construction Estimating FAQ | Metricore</title>
        <meta name="description" content="Common questions about PDF takeoff, construction cost estimating, NCC compliance, and billing. Built for Australian builders, subcontractors and estimators." />
        <link rel="canonical" href="https://metricore.com.au/faq" />
        <meta property="og:title" content="Construction Estimating FAQ | Metricore" />
        <meta property="og:description" content="Common questions about PDF takeoff, construction cost estimating, NCC compliance, and billing. Built for Australian builders, subcontractors and estimators." />
        <meta property="og:url" content="https://metricore.com.au/faq" />
        <script type="application/ld+json">{JSON.stringify(faqPageSchema)}</script>
      </Helmet>
      <div className="min-h-screen">
        <Navigation />
        <main className="container mx-auto px-6 py-16 max-w-4xl">

          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <FileQuestion className="h-8 w-8 text-primary" />
              <h1 className="font-display text-4xl font-bold">Construction Estimating FAQ</h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Common questions from builders, subcontractors and estimators using Metricore.
            </p>
          </div>

          <div className="space-y-8">
            {faqs.map((section) => (
              <div key={section.category}>
                <h2 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
                  {section.category}
                </h2>
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

          <div className="mt-16 rounded-xl border border-border bg-card p-8 text-center">
            <h2 className="font-display text-xl font-bold mb-2">Need more help?</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Visit the Support Centre for contact details, billing questions, and response times.
            </p>
            <a
              href="/support"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Support Centre
            </a>
          </div>

        </main>
        <SectionDivider />
        <Footer />
      </div>
    </>
  );
};

export default FAQ;
