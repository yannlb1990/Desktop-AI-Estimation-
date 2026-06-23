import { FileSearch, BadgeDollarSign, FileOutput } from "lucide-react";

const features = [
  {
    icon: FileSearch,
    title: "Measure from any PDF plan",
    description:
      "Drop in any PDF or DXF plan. Draw areas, walls, and counts directly on the canvas. Quantities sort themselves by trade automatically.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: BadgeDollarSign,
    title: "Auto-priced by trade at Australian rates",
    description:
      "Every measurement links to current QLD, NSW, and VIC labour and material rates. No spreadsheets, no manual rate lookups.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: FileOutput,
    title: "One-click tender, ready to send",
    description:
      "Generate a professional BOQ and tender document in PDF or Excel. Your logo, your margin, your client's name. One click.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
];

const Features = () => {
  return (
    <section id="features" className="py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-5">
            Three steps.
            <span className="block mt-2 text-primary">That's the whole workflow.</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Measure, price, and send. Most builders go from PDF to tender in under 30 minutes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="relative flex flex-col gap-5 p-8 rounded-2xl border border-border bg-card hover:border-primary/30 transition-colors group"
            >
              <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center`}>
                <feature.icon className={`h-6 w-6 ${feature.color}`} />
              </div>
              <div className="absolute top-8 right-8 font-mono text-5xl font-bold text-muted/20 select-none">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div>
                <h3 className="font-display text-xl font-bold mb-3 text-card-foreground">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
