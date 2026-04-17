import React, { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Trophy, ShieldCheck, Mail, Lock, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showBanner } from "@/components/DiagnosticBanner";

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Diagnostic check
  React.useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    console.log("Supabase URL Check:", url ? "Loaded" : "MISSING");
    if (!url && typeof window !== "undefined") {
      console.error("CRITICAL: NEXT_PUBLIC_SUPABASE_URL is missing on client-side");
    }
  }, []);

  const handleResetPassword = async () => {
    if (!email) {
      showBanner("Please enter your email in the box first", "error");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      showBanner("Password reset email sent! Check your inbox.", "success");
    } catch (err: any) {
      showBanner(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = isLogin 
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ 
            email, 
            password,
            options: { emailRedirectTo: window.location.origin }
          });

      if (error) throw error;

      if (!isLogin) {
        showBanner("Verification email sent! Check your inbox.", "success");
      } else {
        router.push("/");
      }
    } catch (err: any) {
      showBanner(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090D] flex items-center justify-center p-4 relative overflow-hidden">
      <Head>
        <title>Login | DribbleStats AI Elite</title>
      </Head>

      {/* Atmospheric Background Components */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-accent/5 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=2090')] bg-cover bg-center opacity-[0.03] grayscale" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-10 space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 p-[1px] shadow-2xl shadow-primary/20">
            <div className="w-full h-full bg-[#07090D] rounded-2xl flex items-center justify-center">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black tracking-tight text-white uppercase italic">
              DribbleStats <span className="text-primary">AI</span> Elite
            </h1>
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground mt-1">
              Tactical Personnel Intelligence
            </p>
          </div>
        </div>

        <Card className="bg-muted/10 border-white/5 backdrop-blur-xl shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="space-y-1 pt-8 px-8">
            <CardTitle className="text-xl font-bold text-white tracking-tight">
              {isLogin ? "Welcome Back, Scout" : "Create Scout Account"}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {isLogin ? "Enter your credentials to access the Command Center" : "Initialize your credentials for the AI Mapping Engine"}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleAuth}>
            <CardContent className="space-y-4 px-8 pt-4 pb-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Professional Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="scout@elite.team" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-black/40 border-white/10 pl-10 h-11 focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Password</Label>
                  {isLogin && (
                    <button 
                      type="button" 
                      onClick={handleResetPassword}
                      className="text-[10px] text-primary hover:underline font-bold uppercase"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type="password" 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-black/40 border-white/10 pl-10 h-11 focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 px-8 pb-8">
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 h-12 rounded-xl font-black text-xs tracking-widest uppercase shadow-xl shadow-primary/20"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : (
                  <>{isLogin ? "INITIATE SESSION" : "CREATE ACCOUNT"} <ArrowRight className="ml-2 h-4 w-4" /></>
                )}
              </Button>
              <button 
                type="button" 
                onClick={() => setIsLogin(!isLogin)}
                className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-2 justify-center"
              >
                {isLogin ? "Need access? Request credentials" : "Already have a tactical ID? Sign in"}
              </button>
            </CardFooter>
          </form>
        </Card>

        <div className="mt-8 grid grid-cols-3 gap-4">
          {[
            { label: "GPU ACCEL", icon: Sparkles },
            { label: "R2 SECURE", icon: ShieldCheck },
            { label: "ELITE AI", icon: Trophy }
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center">
                <item.icon className="h-3.5 w-3.5 text-muted-foreground/50" />
              </div>
              <span className="text-[8px] font-black tracking-tighter text-muted-foreground/40 uppercase">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}