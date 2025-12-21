import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Plus, Search, Mail, Phone, Building2, Loader2, Edit, Trash2 } from "lucide-react";
import { ClientDialog } from "@/components/ClientDialog";

interface Client {
  id: string;
  company_name: string | null;
  contact_name: string;
  email: string;
  phone: string | null;
  mobile: string | null;
  city: string | null;
  state: string | null;
  client_type: string | null;
  created_at: string;
}

const Clients = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("clients" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setClients((data as any[]) || []);
    } catch (error) {
      console.error("Error loading clients:", error);
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (clientId: string) => {
    if (!confirm("Are you sure you want to delete this client?")) return;

    try {
      const { error } = await supabase
        .from("clients" as any)
        .delete()
        .eq("id", clientId);

      if (error) throw error;

      toast.success("Client deleted successfully");
      loadClients();
    } catch (error) {
      console.error("Error deleting client:", error);
      toast.error("Failed to delete client");
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingClient(null);
    loadClients();
  };

  const filteredClients = clients.filter(client =>
    client.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.company_name && client.company_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <nav className="border-b border-border bg-background">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold mb-2">Clients</h1>
          <p className="text-muted-foreground">
            Manage your client contacts and relationships
          </p>
        </div>

        <Card className="p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients by name, company, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}
            </div>
          </div>
        </Card>

        {filteredClients.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-display text-xl font-bold mb-2">
                {searchTerm ? "No clients found" : "No clients yet"}
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchTerm
                  ? "Try adjusting your search"
                  : "Add your first client to get started"}
              </p>
              {!searchTerm && (
                <Button
                  onClick={() => setDialogOpen(true)}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Client
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map((client) => (
              <Card key={client.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-display font-bold mb-1">
                      {client.contact_name}
                    </h3>
                    {client.company_name && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {client.company_name}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(client)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(client.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <a href={`mailto:${client.email}`} className="hover:text-foreground">
                      {client.email}
                    </a>
                  </div>
                  {(client.phone || client.mobile) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <a
                        href={`tel:${client.mobile || client.phone}`}
                        className="hover:text-foreground"
                      >
                        {client.mobile || client.phone}
                      </a>
                    </div>
                  )}
                  {client.city && client.state && (
                    <div className="text-muted-foreground">
                      {client.city}, {client.state}
                    </div>
                  )}
                  {client.client_type && (
                    <div className="mt-3">
                      <span className="inline-block px-2 py-1 bg-secondary/10 text-secondary rounded text-xs font-medium capitalize">
                        {client.client_type}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ClientDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        editingClient={editingClient}
      />
    </div>
  );
};

export default Clients;
