import React, { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  Settings as SettingsIcon, 
  User, 
  Bell, 
  Database, 
  Shield, 
  RefreshCw,
  Trash2,
  HardDrive,
  CheckCircle2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type SettingsSection = "account" | "notifications" | "data" | "security";

export default function SettingsPage() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<SettingsSection>("account");
  const [clearing, setClearing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleClearCache = () => {
    setClearing(true);
    // Simulate cache clearing and refresh local state
    setTimeout(() => {
      localStorage.clear();
      toast({
        title: "System Cache Cleared",
        description: "Local data store has been refreshed.",
      });
      setClearing(false);
    }, 800);
  };

  const handleResetPlatform = async () => {
    if (!confirm("🚨 WARNING: This will permanently delete ALL teams, players, and games. This action is irreversible. Proceed?")) {
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch("/api/reset-platform", { method: "POST" });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Reset failed");

      localStorage.clear();
      toast({
        title: "Platform Factory Reset",
        description: "All database records have been purged successfully.",
      });
      
      setTimeout(() => window.location.href = "/", 1000);
    } catch (error: any) {
      toast({
        title: "Reset Operation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const sections = [
    { id: "account", label: "Account", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "data", label: "Data Management", icon: Database },
    { id: "security", label: "Security", icon: Shield },
  ];

  return (
    <Layout title="Settings | CourtVision Elite">
      <div className="space-y-8 max-w-5xl">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <SettingsIcon className="h-8 w-8 text-primary" /> System Settings
          </h1>
          <p className="text-muted-foreground">Manage your scouting preferences, performance tuning, and data safety.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Navigation Sidebar */}
          <div className="space-y-1">
            {sections.map((item) => (
              <Button
                key={item.id}
                variant={activeSection === item.id ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 rounded-lg h-11 transition-all",
                  activeSection === item.id ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setActiveSection(item.id as SettingsSection)}
              >
                <item.icon className={cn("h-4 w-4", activeSection === item.id ? "text-primary" : "text-muted-foreground")} />
                {item.label}
              </Button>
            ))}
          </div>

          {/* Settings Content */}
          <div className="md:col-span-3 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {activeSection === "account" && (
              <Card className="bg-card/30 backdrop-blur-sm border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Scouting Profile</CardTitle>
                  <CardDescription>Personalize your tactical dashboard experience.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Analytic Density</Label>
                      <p className="text-xs text-muted-foreground">Show detailed advanced metrics in game views by default.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <Separator className="bg-border/20" />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto-Play Highlights</Label>
                      <p className="text-xs text-muted-foreground">Automatically start video clips when opening the highlights hub.</p>
                    </div>
                    <Switch />
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === "data" && (
              <div className="space-y-6">
                <Card className="bg-card/30 backdrop-blur-sm border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">GPU Processing Configuration</CardTitle>
                    <CardDescription>Optimize your AI processing and data synchronization.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>High Precision Inference</Label>
                        <p className="text-xs text-muted-foreground">Use 1280px resolution for YOLOv11m detection (A100 Intensive).</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <Separator className="bg-border/20" />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Real-time PBP Stream</Label>
                        <p className="text-xs text-muted-foreground">Subscribe to live event updates as they are processed by the GPU.</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/30 backdrop-blur-sm border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">Maintenance & Cache</CardTitle>
                    <CardDescription>Refresh your local data environment.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border">
                      <div className="space-y-1">
                        <p className="text-sm font-bold">Clear System Cache</p>
                        <p className="text-xs text-muted-foreground">Wipe local storage and refresh connection state.</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleClearCache}
                        disabled={clearing}
                        className="gap-2"
                      >
                        {clearing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <HardDrive className="h-4 w-4" />}
                        {clearing ? "Clearing..." : "Clear Cache"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/30 backdrop-blur-sm border-destructive/20">
                  <CardHeader>
                    <CardTitle className="text-lg text-destructive flex items-center gap-2">
                      <Trash2 className="h-5 w-5" /> Danger Zone
                    </CardTitle>
                    <CardDescription>Permanently delete all platform data. This cannot be undone.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-destructive">Factory Reset Platform</p>
                        <p className="text-xs text-muted-foreground">Wipe all teams, players, and games from the cloud database.</p>
                      </div>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={handleResetPlatform}
                        disabled={isResetting}
                        className="gap-2 font-bold"
                      >
                        {isResetting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        {isResetting ? "Purging Data..." : "Reset Platform"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {(activeSection === "notifications" || activeSection === "security") && (
              <Card className="bg-card/30 backdrop-blur-sm border-border py-20">
                <CardContent className="flex flex-col items-center justify-center text-center space-y-4">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold">Section Optimized</p>
                    <p className="text-sm text-muted-foreground">Settings in this category are automatically managed by the system.</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}