import { MetricoreLogoMark } from "@/components/MetricoreLogoMark";

const Footer = () => {
  return (
    <footer className="bg-background py-12">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <MetricoreLogoMark height={28} />
              <span className="font-display text-xl font-bold">Metricore</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Estimation software for trades, builders and construction projects of every size.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-display font-bold mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/#features" className="hover:text-foreground transition-colors">Features</a></li>
              <li><a href="/pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
              <li><a href="/#insights" className="hover:text-foreground transition-colors">Market Insights</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-display font-bold mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/support" className="hover:text-foreground transition-colors">Support & FAQ</a></li>
              <li><a href="/about" className="hover:text-foreground transition-colors">About</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-display font-bold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
              <li><a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
          <p>© 2026 Metricore. All rights reserved.</p>
          <a href="mailto:admin@metricore.com.au" className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors">
            admin@metricore.com.au
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
