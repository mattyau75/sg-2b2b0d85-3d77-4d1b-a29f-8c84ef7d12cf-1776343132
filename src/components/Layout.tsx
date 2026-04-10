import React from "react";
import { SEO } from "@/components/SEO";
import Link from "next/link";
import { Trophy, Users, LayoutDashboard, BarChart3, Settings, Activity, History, PlayCircle, Menu, Bell, HelpCircle, ListOrdered, TrendingUp, Film } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function Layout({ children, title, description }: LayoutProps) {
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
              { icon: Activity, label: "Processing Queue", href: "/analysis-queue" },
              { icon: Users, label: "Roster", href: "/roster" },
              { icon: History, label: "Games", href: "/games" },
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

          <div className="mt-auto pt-6 border-t border-border">
            <Link
              href="/settings"
              className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-muted/50 transition-all group w-full text-left"
            >
              <Settings className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="hidden md:block font-medium text-muted-foreground group-hover:text-foreground">Settings</span>
            </Link>
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
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-tighter">APP BRIDGING STATUS</p>
              <p className="text-xs text-accent font-mono">A100-CONNECTED</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-muted border border-border overflow-hidden" />
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