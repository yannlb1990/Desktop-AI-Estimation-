import { MetricoreLogoMark } from "@/components/MetricoreLogoMark";

const Footer = () => {
  return (
    <footer className="border-t border-border bg-background py-12">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <MetricoreLogoMark height={28} />
              <span className="font-display text-xl font-bold">Metricore</span>
            </div>
            <p className="text-sm text-muted-foreground">
              AI-powered estimation for Australian builders.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-display font-bold mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/#features" className="hover:text-foreground transition-smooth">Features</a></li>
              <li><a href="/pricing" className="hover:text-foreground transition-smooth">Pricing</a></li>
              <li><a href="/#insights" className="hover:text-foreground transition-smooth">Market Insights</a></li>
              <li><a href="/insights" className="hover:text-foreground transition-smooth">Rate Database</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-display font-bold mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/materials" className="hover:text-foreground transition-smooth">Materials Library</a></li>
              <li><a href="/dashboard" className="hover:text-foreground transition-smooth">Dashboard</a></li>
              <li><a href="mailto:admin@metricore.com.au" className="hover:text-foreground transition-smooth">Support</a></li>
              <li><a href="/#features" className="hover:text-foreground transition-smooth">NCC Compliance</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-display font-bold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/#features" className="hover:text-foreground transition-smooth">About</a></li>
              <li><a href="mailto:admin@metricore.com.au" className="hover:text-foreground transition-smooth">Contact</a></li>
              <li><span className="cursor-default text-muted-foreground/50">Privacy Policy</span></li>
              <li><span className="cursor-default text-muted-foreground/50">Terms of Service</span></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>© 2026 Metricore. All rights reserved. Built for Australian builders.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
