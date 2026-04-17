import React, { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Loader2, CheckCircle2, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showBanner } from "@/components/DiagnosticBanner";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      showBanner("Passwords do not match", "error");
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err: any) {
      showBanner(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#07090D] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-muted/10 border-white/5 backdrop-blur-xl p-8 text-center">
          <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-2">Password Updated</h1>
          <p className="text-muted-foreground mb-6">Your tactical credentials have been reset. Redirecting to login...</p>
          <Button onClick={() => router.push("/login")} className="w-full bg-primary">GO TO LOGIN</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090D] flex items-center justify-center p-4 relative overflow-hidden">
      <Head>
        <title>Reset Password | DribbleStats AI Elite</title>
      </Head>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-10 space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 p-[1px]">
            <div className="w-full h-full bg-[#07090D] rounded-2xl flex items-center justify-center">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase italic">
            Secure <span className="text-primary">Reset</span>
          </h1>
        </div>

        <Card className="bg-muted/10 border-white/5 backdrop-blur-xl shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="space-y-1 pt-8 px-8">
            <CardTitle className="text-xl font-bold text-white tracking-tight">New Password</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Initialize new secure credentials for your scout ID</CardDescription>
          </CardHeader>
          <form onSubmit={handleReset}>
            <CardContent className="space-y-4 px-8 pt-4 pb-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="password" 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-black/40 border-white/10 pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="password" 
                    required 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-black/40 border-white/10 pl-10"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="px-8 pb-8">
              <Button type="submit" disabled={loading} className="w-full bg-primary h-12 rounded-xl font-black text-xs tracking-widest uppercase">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "UPDATE CREDENTIALS"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}