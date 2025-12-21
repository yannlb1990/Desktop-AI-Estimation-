import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import DashboardPreview from "@/components/DashboardPreview";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import TakeoffVisual from "@/components/TakeoffVisual";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <Hero />
      <Features />
      <TakeoffVisual />
      <DashboardPreview />
      <CTA />
      <Footer />
    </div>
  );
};

export default Index;
