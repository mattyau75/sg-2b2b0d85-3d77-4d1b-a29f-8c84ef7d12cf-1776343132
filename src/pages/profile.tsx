import React, { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { profileService } from "@/services/profileService";
import { showBanner } from "@/components/DiagnosticBanner";
import { User, Shield, Mail, Save, Loader2 } from "lucide-react";

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await profileService.getProfile();
      setProfile(data);
      setFullName(data?.full_name || "");
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await profileService.updateProfile({ full_name: fullName });
      showBanner("Profile updated successfully", "success");
      // Refresh to update header badge
      window.location.reload();
    } catch (error: any) {
      showBanner(error.message || "Failed to update profile", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard>
      <Layout>
        <div className="max-w-2xl mx-auto space-y-8 py-10 px-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">
              Scout Identity
            </h1>
            <p className="text-muted-foreground font-mono text-xs uppercase tracking-[0.2em]">
              Manage your tactical credentials
            </p>
          </div>

          <Card className="bg-[#0B0E14] border-white/5 shadow-2xl overflow-hidden">
            <CardHeader className="border-b border-white/5 bg-white/[0.02]">
              <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Personal Details
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Your name will be visible on generated scouting reports.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Full Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="bg-muted/10 border-white/10 pl-10 h-12 text-white focus:ring-primary/20"
                      placeholder="Enter your full name..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Email Address (Account ID)
                  </Label>
                  <div className="relative opacity-50">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      value={profile?.email || ""}
                      disabled
                      className="bg-muted/10 border-white/10 pl-10 h-12 text-white cursor-not-allowed"
                    />
                  </div>
                  <p className="text-[9px] text-muted-foreground italic">
                    Account ID is managed by the central authentication bridge.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button 
                  onClick={handleSave}
                  disabled={saving || loading}
                  className="bg-primary hover:bg-primary/90 text-black font-black uppercase tracking-widest text-xs h-12 px-8 rounded-xl shadow-lg shadow-primary/20"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0B0E14] border-white/5 shadow-2xl overflow-hidden border-l-4 border-l-primary/30">
            <CardHeader className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-white uppercase italic">Access Level</CardTitle>
                  <CardDescription className="text-primary/70 font-mono text-[10px] uppercase">Authorized Elite Scout</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    </AuthGuard>
  );
}