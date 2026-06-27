import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SectionDivider from "@/components/SectionDivider";
import { MetricoreLogoMark } from "@/components/MetricoreLogoMark";

const About = () => {
  return (
    <>
      <Helmet>
        <title>About Metricore | AI Construction Estimation for Australia</title>
        <meta name="description" content="Australian AI platform for construction estimation. We help builders and contractors generate accurate takeoffs and professional tenders from uploaded plans." />
        <link rel="canonical" href="https://metricore.com.au/about" />
      </Helmet>
      <div className="min-h-screen">
        <Navigation />
        <main className="container mx-auto px-6 py-16 max-w-3xl">
          <div className="flex items-center gap-3 mb-8">
            <MetricoreLogoMark height={40} />
            <h1 className="font-display text-4xl font-bold">About Metricore</h1>
          </div>

          <div className="space-y-8 text-muted-foreground leading-7">
            <p className="text-lg text-foreground">
              Metricore is an AI-powered construction estimation platform built specifically for
              Australian builders, contractors, and quantity surveyors.
            </p>

            <div>
              <h2 className="text-foreground font-semibold text-xl mb-3">The Problem We Solve</h2>
              <p>
                Producing an accurate construction estimate is one of the most time-intensive tasks
                in the building industry. Builders typically spend 10–20 hours manually measuring
                plans, cross-referencing NCC requirements, sourcing material rates, and compiling
                tender documents, all before winning a single contract.
              </p>
              <p className="mt-3">
                Metricore reduces that to minutes. Upload your plans, and the platform automatically
                generates a complete takeoff, applies current Australian material rates, and produces
                a professional tender-ready document.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-xl mb-3">Built for Australia</h2>
              <p>
                Our rate database is calibrated to Australian conditions, covering 26 trades with
                regional pricing variations and NCC compliance references built in. We understand
                that a concrete slab in Brisbane has different material and labour costs than one
                in Hobart, and our estimates reflect that.
              </p>
            </div>

            <div>
              <h2 className="text-foreground font-semibold text-xl mb-3">Our Mission</h2>
              <p>
                We believe every builder, from sole traders to mid-size contractors, deserves
                access to the same quality of estimation tools that large construction firms have.
                Metricore levels the playing field with enterprise-grade AI at an accessible price.
              </p>
            </div>

            <div className="pt-4 border-t border-border">
              <h2 className="text-foreground font-semibold text-xl mb-4">Get in Touch</h2>
              <p>
                Questions, feedback, or partnership enquiries? We'd love to hear from you.
              </p>
              <a
                href="mailto:admin@metricore.com.au"
                className="inline-block mt-4 text-primary hover:underline font-medium"
              >
                admin@metricore.com.au
              </a>
            </div>
          </div>
        </main>
        <SectionDivider />
        <Footer />
      </div>
    </>
  );
};

export default About;
