import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Building2, DollarSign, MapPin, Bell, Save, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  // Company Profile
  const [companyName, setCompanyName] = useState("");
  const [abn, setAbn] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");

  // Default Rates
  const [overheadPercentage, setOverheadPercentage] = useState("15");
  const [marginPercentage, setMarginPercentage] = useState("18");
  const [gstPercentage, setGstPercentage] = useState("10");
  const [materialMarkup, setMaterialMarkup] = useState("15");
  const [labourRate, setLabourRate] = useState("90");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setProfile(data);
        setCompanyName(data.company_name || "");
        setAbn(data.abn || "");
        setPhone(data.phone || "");
        setAddress(data.address || "");
        setCity(data.city || "");
        setState(data.state || "");
        setPostcode(data.postcode || "");
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          company_name: companyName,
          abn,
          phone,
          address,
          city,
          state,
          postcode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Profile updated successfully");
      loadProfile();
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
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
      <nav className="border-b border-border bg-background">
        <div className="container mx-auto px-6 py-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Manage your company profile, default rates, and preferences
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">
              <Building2 className="h-4 w-4 mr-2" />
              Company Profile
            </TabsTrigger>
            <TabsTrigger value="rates">
              <DollarSign className="h-4 w-4 mr-2" />
              Default Rates
            </TabsTrigger>
            <TabsTrigger value="regional">
              <MapPin className="h-4 w-4 mr-2" />
              Regional Settings
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card className="p-6">
              <h3 className="font-display text-xl font-bold mb-6">Company Information</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Your Company Pty Ltd"
                    />
                  </div>
                  <div>
                    <Label htmlFor="abn">ABN</Label>
                    <Input
                      id="abn"
                      value={abn}
                      onChange={(e) => setAbn(e.target.value)}
                      placeholder="12 345 678 901"
                      maxLength={14}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(02) 1234 5678"
                  />
                </div>

                <div>
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Builder Street"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="city">City/Suburb</Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Sydney"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Select value={state} onValueChange={setState}>
                      <SelectTrigger id="state">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NSW">NSW</SelectItem>
                        <SelectItem value="VIC">VIC</SelectItem>
                        <SelectItem value="QLD">QLD</SelectItem>
                        <SelectItem value="WA">WA</SelectItem>
                        <SelectItem value="SA">SA</SelectItem>
                        <SelectItem value="TAS">TAS</SelectItem>
                        <SelectItem value="NT">NT</SelectItem>
                        <SelectItem value="ACT">ACT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="postcode">Postcode</Label>
                    <Input
                      id="postcode"
                      value={postcode}
                      onChange={(e) => setPostcode(e.target.value)}
                      placeholder="2000"
                      maxLength={4}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSaveProfile}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Profile
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="rates">
            <Card className="p-6">
              <h3 className="font-display text-xl font-bold mb-6">Default Rates & Margins</h3>
              
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-4">Pricing Percentages</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="overhead">Overhead Percentage (%)</Label>
                      <Input
                        id="overhead"
                        type="number"
                        value={overheadPercentage}
                        onChange={(e) => setOverheadPercentage(e.target.value)}
                        min="0"
                        max="100"
                        step="0.5"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Covers office, insurance, vehicles, admin (Industry: 15-20%)
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="margin">Margin Percentage (%)</Label>
                      <Input
                        id="margin"
                        type="number"
                        value={marginPercentage}
                        onChange={(e) => setMarginPercentage(e.target.value)}
                        min="0"
                        max="100"
                        step="0.5"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Your profit margin (Industry: 15-25%)
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="gst">GST Percentage (%)</Label>
                      <Input
                        id="gst"
                        type="number"
                        value={gstPercentage}
                        onChange={(e) => setGstPercentage(e.target.value)}
                        min="0"
                        max="100"
                        step="0.5"
                        disabled
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Fixed at 10% for Australian GST
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="materialMarkup">Material Markup (%)</Label>
                      <Input
                        id="materialMarkup"
                        type="number"
                        value={materialMarkup}
                        onChange={(e) => setMaterialMarkup(e.target.value)}
                        min="0"
                        max="100"
                        step="0.5"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Markup on material costs (Industry: 10-20%)
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-4">Labour Rates</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="labourRate">Default Labour Rate ($/hr)</Label>
                      <Input
                        id="labourRate"
                        type="number"
                        value={labourRate}
                        onChange={(e) => setLabourRate(e.target.value)}
                        min="0"
                        step="5"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Average hourly rate for trades (NSW: $85-$110/hr)
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Default Rates
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="regional">
            <Card className="p-6">
              <h3 className="font-display text-xl font-bold mb-6">Regional Pricing Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="primaryState">Primary Operating State</Label>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger id="primaryState">
                      <SelectValue placeholder="Select your primary state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NSW">NSW</SelectItem>
                      <SelectItem value="VIC">VIC</SelectItem>
                      <SelectItem value="QLD">QLD</SelectItem>
                      <SelectItem value="WA">WA</SelectItem>
                      <SelectItem value="SA">SA</SelectItem>
                      <SelectItem value="TAS">TAS</SelectItem>
                      <SelectItem value="NT">NT</SelectItem>
                      <SelectItem value="ACT">ACT</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    This affects default pricing and material costs
                  </p>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Regional Cost Modifiers</h4>
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>• NSW Metro: Baseline (1.00x)</p>
                    <p>• VIC Metro: -5% (0.95x)</p>
                    <p>• QLD Metro: -3% (0.97x)</p>
                    <p>• WA: +8% (1.08x)</p>
                    <p>• Regional areas: -8 to -12% typically</p>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card className="p-6">
              <h3 className="font-display text-xl font-bold mb-6">Notification Preferences</h3>
              
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg text-center">
                  <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Notification settings coming soon
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
