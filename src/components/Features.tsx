import { Card } from "@/components/ui/card";
import { Upload, Calculator, FileText, TrendingUp, Layers, Shield } from "lucide-react";

const features = [
  {
    icon: Upload,
    title: "AI Plan Upload",
    description: "Upload PDF, DWG, or IFC files. AI automatically detects elements, scales, and compliance requirements.",
    color: "text-secondary"
  },
  {
    icon: Layers,
    title: "Smart Takeoffs",
    description: "Auto-generate quantities by trade with 98% accuracy. Review and adjust with visual overlays.",
    color: "text-accent"
  },
  {
    icon: Calculator,
    title: "Live Pricing",
    description: "Real-time material and labour costs from Australian suppliers, updated fortnightly.",
    color: "text-secondary"
  },
  {
    icon: FileText,
    title: "Instant Tenders",
    description: "Generate professional tenders and BOQs in Excel or PDF format with one click.",
    color: "text-accent"
  },
  {
    icon: TrendingUp,
    title: "Market Insights",
    description: "Premium dashboard with regional price trends, trade availability, and cost forecasts.",
    color: "text-secondary"
  },
  {
    icon: Shield,
    title: "NCC Compliance",
    description: "Automatic compliance checking against BCA and Australian Standards with flagged issues.",
    color: "text-accent"
  }
];

const Features = () => {
  return (
    <section id="features" className="py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
            Everything You Need for
            <span className="block mt-2 text-secondary">Accurate Estimates</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            From plan upload to tender generation, Buildamax streamlines your entire estimation workflow with AI precision.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="p-8 bg-card hover:shadow-lg transition-smooth border-border hover:border-secondary/30 group"
            >
              <div className="mb-4">
                <feature.icon className={`h-10 w-10 ${feature.color} group-hover:scale-110 transition-smooth`} />
              </div>
              <h3 className="font-display text-xl font-bold mb-3 text-card-foreground">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
