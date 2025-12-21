import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Circle,
  Compass,
  Download,
  Layers,
  MousePointer2,
  PenLine,
  Ruler,
  Square
} from "lucide-react";

const toolbarItems = [
  { icon: MousePointer2, label: "Select" },
  { icon: Ruler, label: "Line" },
  { icon: Square, label: "Area" },
  { icon: Circle, label: "Circle" },
  { icon: PenLine, label: "Polyline" },
  { icon: Compass, label: "Calibrate" }
];

const measurementCards = [
  {
    title: "Wall Run",
    value: "18.4 LM",
    detail: "Internal walls",
    color: "text-secondary"
  },
  {
    title: "Living Room",
    value: "42.8 m²",
    detail: "Tiles + plaster",
    color: "text-foreground"
  },
  {
    title: "Slab Depth",
    value: "0.45 m",
    detail: "With mesh",
    color: "text-foreground"
  }
];

export const TakeoffVisual = () => {
  return (
    <section className="py-24 bg-muted/40">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <Badge variant="secondary" className="uppercase tracking-wide text-xs">
              Visual Walkthrough
            </Badge>
            <h2 className="font-display text-4xl md:text-5xl font-bold leading-tight text-foreground">
              See the PDF takeoff workspace in action
            </h2>
            <p className="text-lg text-muted-foreground">
              Upload a plan, calibrate scale, and start drawing measurements that stay aligned as you
              pan and zoom. Link quantities to cost items, export them, and keep every room organized by
              scope.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              {["Multi-page PDFs", "World-space storage", "CSV / JSON export", "Cost-linked items"].map(
                (item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 shadow-sm"
                  >
                    <div className="h-2 w-2 rounded-full bg-secondary" />
                    <span className="text-sm font-medium text-foreground">{item}</span>
                  </div>
                )
              )}
            </div>

            <div className="flex gap-3">
              <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                Start a takeoff
              </Button>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Export preview
              </Button>
            </div>
          </div>

          <Card className="p-6 bg-background shadow-xl border-border">
            <div className="flex gap-4 h-full">
              <div className="w-16 rounded-xl bg-muted/50 border border-border p-2 flex flex-col gap-2">
                {toolbarItems.map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col items-center justify-center gap-1 rounded-lg bg-background border border-border p-2 text-center"
                  >
                    <item.icon className="h-5 w-5 text-foreground" />
                    <span className="text-[10px] text-muted-foreground leading-tight">{item.label}</span>
                  </div>
                ))}
              </div>

              <div className="flex-1 space-y-4">
                <div className="relative h-[420px] rounded-xl border border-border bg-gradient-to-br from-background via-muted/60 to-background overflow-hidden">
                  <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_25%_20%,hsl(var(--primary)/0.12),transparent_25%),radial-gradient(circle_at_80%_10%,hsl(var(--secondary)/0.12),transparent_30%),radial-gradient(circle_at_30%_80%,hsl(var(--accent)/0.12),transparent_28%)]" />

                  <div className="absolute inset-6 rounded-lg border border-dashed border-border/80 bg-card/60 backdrop-blur">
                    <div className="absolute top-4 left-4 bg-background/80 px-3 py-2 rounded-md shadow-sm border border-border">
                      <div className="text-xs uppercase text-muted-foreground tracking-wider">Scale</div>
                      <div className="font-semibold text-foreground">1:100 | Metric</div>
                    </div>

                    <div className="absolute bottom-4 left-4 flex gap-2">
                      {["Walls", "Areas", "Openings"].map((layer) => (
                        <Badge key={layer} variant="outline" className="bg-background/80">
                          {layer}
                        </Badge>
                      ))}
                    </div>

                    <div className="absolute top-16 right-6 space-y-3">
                      {measurementCards.map((card, index) => (
                        <div
                          key={card.title}
                          className={`rounded-lg border border-border bg-background/90 px-4 py-3 shadow-sm ${
                            index === 0 ? "ring-2 ring-secondary/40" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xs uppercase text-muted-foreground tracking-wide">{card.title}</div>
                              <div className={`font-semibold text-lg ${card.color}`}>{card.value}</div>
                            </div>
                            <Badge variant="secondary" className="text-[10px]">
                              Cost linked
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">{card.detail}</div>
                        </div>
                      ))}
                    </div>

                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute left-16 top-24 h-40 w-48 rounded-xl border-2 border-secondary/80 bg-secondary/10 shadow-lg" />
                      <div className="absolute left-40 top-36 h-24 w-20 rounded-xl border-2 border-accent/80 bg-accent/10 rotate-3 shadow-lg" />
                      <div className="absolute right-16 bottom-20 h-28 w-28 rounded-full border-2 border-foreground/70 bg-foreground/5 shadow-lg" />
                      <div className="absolute left-10 bottom-16 h-12 w-24 rounded-full bg-secondary/80 text-secondary-foreground text-xs font-semibold flex items-center justify-center shadow-md">
                        Snap enabled
                      </div>
                      <div className="absolute right-10 top-24 flex items-center gap-3 bg-background/90 border border-border px-3 py-2 rounded-md shadow-sm">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-[11px] uppercase text-muted-foreground tracking-wide">View</div>
                          <div className="text-sm font-semibold text-foreground">PDF + Wireframe</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-secondary" /> Measurements stay in world space
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-accent" /> Exportable as CSV / JSON / XLSX
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default TakeoffVisual;
