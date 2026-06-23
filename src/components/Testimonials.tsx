const testimonials = [
  {
    quote:
      "I used to spend a Sunday night every weekend just putting together quotes. With Metricore I do it in 20 minutes on my phone between jobs. Won three tenders last month I wouldn't have had time to price before.",
    name: "Brett Callahan",
    role: "Builder",
    location: "Gold Coast, QLD",
    initials: "BC",
  },
  {
    quote:
      "The scale calibration and trade breakdown is exactly how I think about a job. Flooring goes to one subbie, brickwork to another. It just comes out sorted and priced, ready to send.",
    name: "Danielle Truong",
    role: "Estimator",
    location: "Parramatta, NSW",
    initials: "DT",
  },
];

const Testimonials = () => {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center mb-10 md:mb-14">
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            What builders are saying
          </h2>
          <p className="text-base md:text-lg text-muted-foreground">
            From sole traders to multi-trade builders across Australia.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="flex flex-col gap-5 p-6 md:p-8 rounded-2xl border border-border bg-card"
            >
              {/* Quote mark */}
              <div className="text-4xl md:text-5xl font-serif text-primary/30 leading-none select-none">"</div>

              <p className="text-card-foreground leading-relaxed text-sm md:text-[1.05rem] flex-1">{t.quote}</p>

              <div className="flex items-center gap-3 mt-auto pt-4 border-t border-border">
                <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                  {t.initials}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-card-foreground text-sm truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {t.role} · {t.location}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
