import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="text-center space-y-4">
        <div className="font-mono text-8xl font-bold text-muted-foreground/30">404</div>
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="text-muted-foreground">The page <span className="font-mono text-sm">{location.pathname}</span> doesn't exist.</p>
        <div className="flex gap-3 justify-center pt-2">
          <Button onClick={() => navigate(-1)} variant="outline">Go Back</Button>
          <Button onClick={() => navigate("/")} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">Return Home</Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
