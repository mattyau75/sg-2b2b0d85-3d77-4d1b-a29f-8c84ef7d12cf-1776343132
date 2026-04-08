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
  HardDrive
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { toast } = useToast();
  const [clearing, setClearing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleClearCache = () => {
    setClearing(true);
    // In a real app, this would clear local storage/session storage and force a refresh
    setTimeout(() => {
      localStorage.clear();
      window.location.reload();
      toast({
        title: "Cache Cleared",
        description: "The application has been refreshed with the latest database state.",
      });
      setClearing(false);
    }, 1000);
  };

  const handleResetPlatform = async () => {
    if (!confirm("🚨 WARNING: This will permanently delete ALL teams, players, and games. This cannot be undone. Proceed?")) {
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch("/api/reset-platform", { method: "POST" });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Reset failed");

      localStorage.clear();
      toast({
        title: "Platform Reset",
        description: "All data has been purged successfully.",
      });
      
      // Force reload to reflect empty state
      setTimeout(() => window.location.href = "/", 1500);
    } catch (error: any) {
      toast({
        title: "Reset Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Layout title="Settings | CourtVision Elite">
      <div className="space-y-8 max-w-4xl">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <SettingsIcon className="h-8 w-8 text-primary" /> Settings
          </h1>
          <p className="text-muted-foreground">Manage your scouting preferences and system configuration.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Navigation Sidebar (Local) */}
          <div className="space-y-2">
            {[
              { label: "Account", icon: User, active: true },
              { label: "Notifications", icon: Bell },
              { label: "Data Management", icon: Database },
              { label: "Security", icon: Shield },
            ].map((item) => (
              <Button
                key={item.label}
                variant={item.active ? "secondary" : "ghost"}
                className="w-full justify-start gap-3 rounded-lg"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Button>
            ))}
          </div>

          {/* Settings Content */}
          <div className="md:col-span-2 space-y-6">
            <Card className="bg-card/50 border-border">
              <CardHeader>
                <CardTitle className="text-lg">System Performance</CardTitle>
                <CardDescription>Optimize your AI processing and data synchronization.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>High Precision Mode</Label>
                    <p className="text-xs text-muted-foreground">Use 1280px resolution for YOLOv11m inference (GPU Intensive).</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator className="bg-border/50" />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Real-time PBP Updates</Label>
                    <p className="text-xs text-muted-foreground">Subscribe to live events as they are processed by the GPU.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border border-destructive/20">
              <CardHeader>
                <CardTitle className="text-lg text-destructive flex items-center gap-2">
                  <Database className="h-5 w-5" /> Data Management
                </CardTitle>
                <CardDescription>Tools to manage your local state and sync with Supabase.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Application Cache</Label>
                    <p className="text-xs text-muted-foreground">If you see old data, force a refresh of the local state.</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleClearCache}
                    disabled={clearing}
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${clearing ? 'animate-spin' : ''}`} />
                    Refresh State
                  </Button>
                </div>
                <Separator className="bg-border/50" />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-destructive">Factory Reset</Label>
                    <p className="text-xs text-muted-foreground">Permanently delete all rosters and game stats from the database.</p>
                  </div>
                  <Button variant="destructive" size="sm" className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Reset Platform
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}