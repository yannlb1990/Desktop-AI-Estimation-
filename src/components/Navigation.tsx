import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

const Navigation = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Market Insights", href: "#insights" },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-accent rounded-lg flex items-center justify-center">
              <span className="font-display font-bold text-primary-foreground">B</span>
            </div>
            <span className="font-display text-xl font-bold text-foreground">Buildamax</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {links.map(l => (
              <a key={l.label} href={l.href} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth">
                {l.label}
              </a>
            ))}
            <Button variant="ghost" size="sm" onClick={() => window.location.href = "/dashboard"}>Sign In</Button>
            <Button size="sm" onClick={() => window.location.href = "/dashboard"} className="bg-accent text-accent-foreground hover:bg-accent/90">
              Start Free Trial
            </Button>
          </div>

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(v => !v)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-border mt-4 pt-4 pb-2 space-y-1">
            {links.map(l => (
              <a key={l.label} href={l.href} onClick={() => setMobileOpen(false)}
                className="block px-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-smooth">
                {l.label}
              </a>
            ))}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => window.location.href = "/dashboard"}>Sign In</Button>
              <Button size="sm" className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => window.location.href = "/dashboard"}>
                Start Free Trial
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
