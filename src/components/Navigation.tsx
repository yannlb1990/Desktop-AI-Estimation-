import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

const Navigation = () => {
  return (
    <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-accent rounded-lg flex items-center justify-center">
              <span className="font-display font-bold text-primary">B</span>
            </div>
            <span className="font-display text-xl font-bold text-foreground">
              Buildamax
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth">
              Features
            </a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth">
              Pricing
            </a>
            <a href="#insights" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth">
              Market Insights
            </a>
            <Button variant="ghost" size="sm" onClick={() => window.location.href = "/auth"}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => window.location.href = "/auth"} className="bg-accent text-accent-foreground hover:bg-accent/90">
              Start Free Trial
            </Button>
          </div>

          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
