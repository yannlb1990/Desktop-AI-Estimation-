const Footer = () => {
  return (
    <footer className="border-t border-border bg-background py-12">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-accent rounded-lg flex items-center justify-center">
                <span className="font-display font-bold text-primary">B</span>
              </div>
              <span className="font-display text-xl font-bold">Buildamax</span>
            </div>
            <p className="text-sm text-muted-foreground">
              AI-powered estimation for Australian builders.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-display font-bold mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-smooth">Features</a></li>
              <li><a href="#" className="hover:text-foreground transition-smooth">Pricing</a></li>
              <li><a href="#" className="hover:text-foreground transition-smooth">Market Insights</a></li>
              <li><a href="#" className="hover:text-foreground transition-smooth">Integrations</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-display font-bold mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-smooth">Documentation</a></li>
              <li><a href="#" className="hover:text-foreground transition-smooth">API Reference</a></li>
              <li><a href="#" className="hover:text-foreground transition-smooth">Support</a></li>
              <li><a href="#" className="hover:text-foreground transition-smooth">Compliance</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-display font-bold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-smooth">About</a></li>
              <li><a href="#" className="hover:text-foreground transition-smooth">Contact</a></li>
              <li><a href="#" className="hover:text-foreground transition-smooth">Privacy</a></li>
              <li><a href="#" className="hover:text-foreground transition-smooth">Terms</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>© 2025 Buildamax Estimation AI. All rights reserved. QBCC & NCC Compliant.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
