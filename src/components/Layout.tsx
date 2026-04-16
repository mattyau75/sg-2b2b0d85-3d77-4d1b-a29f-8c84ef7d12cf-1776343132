import React from "react";
import { SEO } from "@/components/SEO";
import Link from "next/link";
import { Trophy, Users, LayoutDashboard, BarChart3, Settings, Activity, History, PlayCircle, Menu, Bell, HelpCircle, ListOrdered, TrendingUp, Film, Fingerprint, Plus, LogOut, User } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { supabase } from "@/integrations/supabase/client";
import { useRouter } from "next/router";
import { profileService } from "@/services/profileService";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function Layout({ children, title, description }: LayoutProps) {
  const router = useRouter();
  const [profile, setProfile] = React.useState<any>(null);

  React.useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await profileService.getProfile();
      setProfile(data);
    } catch (error) {
      console.error("Layout profile load error:", error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const scoutName = profile?.full_name?.split(" ")[0] || "Elite";

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 selection:text-primary">
      <SEO title={title} description={description} />
      
      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 h-full w-20 md:w-64 border-r border-border bg-card/50 backdrop-blur-xl z-50">
        <div className="flex h-full flex-col p-4 md:p-6">
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <Trophy className="text-white h-6 w-6" />
            </div>
            <span className="hidden md:block font-serif text-xl font-bold tracking-tight">DribbleStats AI</span>
          </div>

          <nav className="flex-1 space-y-2">
            {[
              { icon: LayoutDashboard, label: "Dashboard", href: "/" },
              { icon: User, label: "My Profile", href: "/profile" },
              { icon: Users, label: "Roster", href: "/roster" },
              { icon: History, label: "Games", href: "/games" },
              { icon: Activity, label: "Processing Queue", href: "/analysis-queue" },
              { icon: BarChart3, label: "Analytics", href: "/analytics" },
              { icon: PlayCircle, label: "Highlights", href: "/highlights" },
              { icon: HelpCircle, label: "Help & Tips", href: "/help" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-muted/50 transition-all group"
              >
                <item.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="hidden md:block font-medium text-muted-foreground group-hover:text-foreground">
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-border space-y-2">
            <Link
              href="/settings"
              className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-muted/50 transition-all group w-full text-left"
            >
              <Settings className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="hidden md:block font-medium text-muted-foreground group-hover:text-foreground">Settings</span>
            </Link>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all group w-full text-left"
            >
              <LogOut className="h-5 w-5 group-hover:text-destructive transition-colors" />
              <span className="hidden md:block font-medium group-hover:text-destructive">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="pl-20 md:pl-64 min-h-screen">
        <header className="h-16 border-b border-border flex items-center justify-between px-6 md:px-10 sticky top-0 bg-background/80 backdrop-blur-md z-40">
          <div className="flex items-center gap-4">
            <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            <span className="text-sm font-mono text-muted-foreground uppercase tracking-widest">Live Analysis Active</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-muted/20 px-4 py-1.5 rounded-full border border-white/5">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Authorized Scout</p>
                <p className="text-xs text-white font-black uppercase italic tracking-wider">Welcome, {scoutName}</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center overflow-hidden">
                <User className="h-4 w-4 text-primary" />
              </div>
            </div>
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleLogout}
              className="h-10 w-10 rounded-xl hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
              title="Tactical Logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <div className="p-6 md:p-10 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  );
}