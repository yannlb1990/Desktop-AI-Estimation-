import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { isSignedIn, localSignOut } from "@/lib/localAuth";

const Navigation = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const signedIn = isSignedIn();

  const handleSignOut = () => {
    localSignOut();
    navigate("/");
  };

  const links = [
    { label: "Features",        href: "#features",  internal: false },
    { label: "Pricing",         href: "/pricing",   internal: true  },
    { label: "Market Insights", href: "#insights",  internal: false },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-accent rounded-lg flex items-center justify-center">
              <span className="font-display font-bold text-primary-foreground text-sm">E</span>
            </div>
            <span className="font-display text-xl font-bold text-foreground">Esti-mate</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {links.map(l =>
              l.internal ? (
                <Link
                  key={l.label}
                  to={l.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth"
                >
                  {l.label}
                </Link>
              ) : (
                <a
                  key={l.label}
                  href={l.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth"
                >
                  {l.label}
                </a>
              )
            )}
            {signedIn ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                  Dashboard
                </Button>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
                  Sign In
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate("/auth?plan=pro&mode=signup")}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  Start Free Trial
                </Button>
              </>
            )}
          </div>

          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(v => !v)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-border mt-4 pt-4 pb-2 space-y-1">
            {links.map(l =>
              l.internal ? (
                <Link
                  key={l.label}
                  to={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-smooth"
                >
                  {l.label}
                </Link>
              ) : (
                <a
                  key={l.label}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-smooth"
                >
                  {l.label}
                </a>
              )
            )}
            <div className="flex gap-2 pt-2">
              {signedIn ? (
                <>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate("/dashboard")}>
                    Dashboard
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1" onClick={handleSignOut}>
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate("/auth")}>
                    Sign In
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={() => navigate("/auth?plan=pro&mode=signup")}
                  >
                    Start Free Trial
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
