import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, DollarSign, FileText, TrendingUp } from "lucide-react";

const DashboardPreview = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
            Your Command Center for
            <span className="block mt-2 text-secondary">Construction Estimates</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            A modern dashboard that gives you complete visibility and control over all your projects.
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          {/* Dashboard Mock */}
          <Card className="p-8 shadow-lg border-border bg-gradient-to-br from-card to-muted/20">
            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card className="p-6 bg-background border-border">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-secondary/10 rounded-lg">
                    <FileText className="h-5 w-5 text-secondary" />
                  </div>
                  <span className="text-sm text-muted-foreground">Active Projects</span>
                </div>
                <div className="font-mono text-3xl font-bold text-foreground">24</div>
              </Card>

              <Card className="p-6 bg-background border-border">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-accent/20 rounded-lg">
                    <DollarSign className="h-5 w-5 text-accent" />
                  </div>
                  <span className="text-sm text-muted-foreground">Total Value</span>
                </div>
                <div className="font-mono text-3xl font-bold text-foreground">$4.2M</div>
              </Card>

              <Card className="p-6 bg-background border-border">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-secondary/10 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-secondary" />
                  </div>
                  <span className="text-sm text-muted-foreground">Avg. Margin</span>
                </div>
                <div className="font-mono text-3xl font-bold text-foreground">18.5%</div>
              </Card>

              <Card className="p-6 bg-background border-border">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-accent/20 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-accent" />
                  </div>
                  <span className="text-sm text-muted-foreground">Win Rate</span>
                </div>
                <div className="font-mono text-3xl font-bold text-foreground">67%</div>
              </Card>
            </div>

            {/* Recent Projects Table */}
            <Card className="p-6 bg-background border-border">
              <h3 className="font-display text-lg font-bold mb-4 text-foreground">Recent Estimates</h3>
              <div className="space-y-3">
                {[
                  { name: "Duplex Build - Gold Coast", value: "$485,000", status: "Complete", date: "2 days ago" },
                  { name: "Renovation - Brisbane North", value: "$125,000", status: "In Progress", date: "5 days ago" },
                  { name: "Extension - Sunshine Coast", value: "$215,000", status: "Complete", date: "1 week ago" }
                ].map((project, index) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{project.name}</div>
                      <div className="text-sm text-muted-foreground">{project.date}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="font-mono font-semibold text-foreground">{project.value}</div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        project.status === "Complete" 
                          ? "bg-accent/20 text-accent-foreground" 
                          : "bg-secondary/10 text-secondary"
                      }`}>
                        {project.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="w-full mt-6 bg-secondary text-secondary-foreground hover:bg-secondary/90">
                View All Projects
              </Button>
            </Card>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default DashboardPreview;
