import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  LogOut, Plus, FileText, DollarSign, TrendingUp, BarChart3,
  Upload, Zap, Settings
} from "lucide-react";
import { Loader2 } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      } else {
        loadProjects();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadProjects = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("projects")
      .select(`
        *,
        estimates!left(total_inc_gst),
        overhead_items!left(amount)
      `)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(5);

    if (error) {
      toast.error("Failed to load projects");
    } else {
      setProjects(data || []);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to sign out");
    } else {
      toast.success("Signed out successfully");
      navigate("/auth");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top Navigation */}
      <nav className="border-b border-border bg-background">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-accent rounded-lg flex items-center justify-center">
                <span className="font-display font-bold text-primary">E</span>
              </div>
              <span className="font-display text-xl font-bold">Esti-mate</span>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold mb-2">
            Welcome back, {user?.user_metadata?.company_name || "Builder"}!
          </h1>
          <p className="text-muted-foreground">
            Manage your estimation projects and tenders
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 bg-background border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-secondary/10 rounded-lg">
                <FileText className="h-5 w-5 text-secondary" />
              </div>
              <span className="text-sm text-muted-foreground">Active Projects</span>
            </div>
            <div className="font-mono text-3xl font-bold">{projects.length}</div>
          </Card>

          <Card className="p-6 bg-background border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-accent/20 rounded-lg">
                <DollarSign className="h-5 w-5 text-accent" />
              </div>
              <span className="text-sm text-muted-foreground">Total Value</span>
            </div>
            <div className="font-mono text-3xl font-bold">
              ${projects.reduce((sum, p) => {
                const estimateTotal = p.estimates?.[0]?.total_inc_gst || 0;
                return sum + parseFloat(estimateTotal);
              }, 0).toFixed(2)}
            </div>
          </Card>

          <Card className="p-6 bg-background border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-secondary/10 rounded-lg">
                <BarChart3 className="h-5 w-5 text-secondary" />
              </div>
              <span className="text-sm text-muted-foreground">Avg. Margin</span>
            </div>
            <div className="font-mono text-3xl font-bold">18.5%</div>
          </Card>

          <Card className="p-6 bg-background border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-accent/20 rounded-lg">
                <TrendingUp className="h-5 w-5 text-accent" />
              </div>
              <span className="text-sm text-muted-foreground">Win Rate</span>
            </div>
            <div className="font-mono text-3xl font-bold">--</div>
          </Card>
        </div>

          {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card 
            onClick={() => navigate("/project/new")}
            className="p-6 bg-gradient-primary text-primary-foreground hover:shadow-lg transition-smooth cursor-pointer group"
          >
            <div className="mb-4">
              <Upload className="h-10 w-10 text-accent group-hover:scale-110 transition-smooth" />
            </div>
            <h3 className="font-display text-xl font-bold mb-2">Upload Plans</h3>
            <p className="text-primary-foreground/80 mb-4">
              Upload PDF or DWG files for AI-powered takeoff
            </p>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </Card>

          <Card 
            onClick={() => navigate("/project/new?mode=manual")}
            className="p-6 bg-background border-border hover:shadow-lg transition-smooth cursor-pointer"
          >
            <div className="mb-4">
              <Zap className="h-10 w-10 text-secondary" />
            </div>
            <h3 className="font-display text-xl font-bold mb-2">Quick Estimate</h3>
            <p className="text-muted-foreground mb-4">
              Create a manual estimate without plan upload
            </p>
            <Button variant="outline">
              Start Estimating
            </Button>
          </Card>

          <Card 
            onClick={() => navigate("/insights")}
            className="p-6 bg-background border-border hover:shadow-lg transition-smooth cursor-pointer"
          >
            <div className="mb-4">
              <BarChart3 className="h-10 w-10 text-accent" />
            </div>
            <h3 className="font-display text-xl font-bold mb-2">Market Insights</h3>
            <p className="text-muted-foreground mb-4">
              View current Australian construction costs
            </p>
            <Button variant="outline">
              View Insights
            </Button>
          </Card>
        </div>

        {/* Recent Projects */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl font-bold">Recent Projects</h2>
            <Button variant="ghost">View All</Button>
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-display text-xl font-bold mb-2">No projects yet</h3>
              <p className="text-muted-foreground mb-6">
                Get started by uploading your first plan
              </p>
              <Button 
                onClick={() => navigate("/project/new")}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Project
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="flex items-center justify-between py-4 border-b border-border last:border-0 hover:bg-muted/50 rounded px-4 transition-smooth cursor-pointer"
                >
                  <div className="flex-1">
                    <div className="font-medium">{project.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {project.client_name || "No client"} • {new Date(project.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      project.status === "complete"
                        ? "bg-accent/20 text-accent-foreground"
                        : "bg-secondary/10 text-secondary"
                    }`}>
                      {project.status}
                    </div>
                    <Button size="sm" variant="ghost">View</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
