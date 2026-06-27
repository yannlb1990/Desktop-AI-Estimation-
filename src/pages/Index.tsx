import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import LaunchVideoSection from "@/components/LaunchVideoSection";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import DashboardPreview from "@/components/DashboardPreview";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import TakeoffVisual from "@/components/TakeoffVisual";
import TradeMarquee from "@/components/TradeMarquee";
import SectionDivider from "@/components/SectionDivider";

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Construction Estimation AI for Australian Builders | Metricore</title>
        <meta name="description" content="AI construction estimation for Australian builders. Upload your plans, generate accurate takeoffs and produce professional tenders in minutes." />
        <link rel="canonical" href="https://metricore.com.au/" />
        <meta property="og:url" content="https://metricore.com.au/" />
      </Helmet>
    <div className="min-h-screen">
      <Navigation />
      <Hero />
      <TradeMarquee />
      <LaunchVideoSection />
      <SectionDivider />
      <Features />
      <SectionDivider />
      <HowItWorks />
      <SectionDivider />
      <TakeoffVisual />
      <SectionDivider />
      <DashboardPreview />
      <SectionDivider />
      <CTA />
      <SectionDivider />
      <Footer />
    </div>
    </>
  );
};

export default Index;
