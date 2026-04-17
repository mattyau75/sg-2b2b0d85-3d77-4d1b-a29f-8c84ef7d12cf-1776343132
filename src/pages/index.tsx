// Deployment Heartbeat: 2026-04-16T11:12:04Z
import React, { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Play, 
  Target, 
  Activity, 
  TrendingUp,
  Cpu,
  History,
  Trophy,
  ChevronRight,
  RefreshCw,
  Zap,
  Rocket,
  LogOut,
  AlertTriangle
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { showBanner } from "@/components/DiagnosticBanner";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useRouter } from "next/router";
import { useToast } from "@/hooks/use-toast";
import { ErrorMonitor } from "@/components/ErrorMonitor";
import { useErrorMonitor } from "@/hooks/useErrorMonitor";
import axios from "axios";

const STATUS_CONFIG: Record<string, { label: string; color: string; progress: number }> = {
  'pending': { label: 'Queued', color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/50', progress: 10 },
  'ignited': { label: 'GPU Warming', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50', progress: 20 },
  'analyzing': { label: 'Streaming', color: 'bg-orange-500/20 text-orange-400 border-orange-500/50 animate-pulse', progress: 65 },
  'completed': { label: 'Ready', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50', progress: 100 },
  'error': { label: 'Stall', color: 'bg-red-500/20 text-red-400 border-red-500/50', progress: 0 }
};

export default function Dashboard() {
  const { toast } = useToast();
  const router = useRouter();
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [recentGames, setRecentGames] = useState<any[]>([]);
  const [statsSummary, setStatsSummary] = useState({
    totalClips: 0,
    activeModels: 3, 
    accuracy: "98.4%",
    speed: "0.4s/f"
  });
  const [loading, setLoading] = useState(true);
  const [isErrorMonitorOpen, setIsErrorMonitorOpen] = useState(false);
  const { errors, logError, dismissError, dismissAll } = useErrorMonitor();

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data: games, error: gamesError } = await supabase
        .from("games")
        .select(`
          *,
          home_team:teams!games_home_team_id_fkey(name),
          away_team:teams!games_away_team_id_fkey(name)
        `)
        .order("created_at", { ascending: false });
      
      if (gamesError) {
        logError("/api/games", 500, gamesError.message, gamesError);
        throw gamesError;
      }

      if (games) {
        setRecentGames(games.filter(g => g.status === 'completed').slice(0, 3));
        
        const active = games
          .filter(g => g.status !== 'completed' && g.status !== 'scheduled')
          .map(g => ({
            id: g.id,
            name: `${g.home_team?.name || 'Home'} vs ${g.away_team?.name || 'Away'}`,
            status: g.status,
            progress: g.progress_percentage || STATUS_CONFIG[g.status]?.progress || 10
          }));
        setActiveJobs(active);
      }

      const { count } = await supabase
        .from("play_by_play")
        .select('id', { count: 'exact', head: true });

      setStatsSummary(prev => ({
        ...prev,
        totalClips: count || 0
      }));
    } catch (err: any) {
      logger.error("Dashboard fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Real-time listener for game status changes
    const channel = supabase
      .channel('dashboard_updates')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'games' 
      }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleForceDeploy = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token 
        ? { Authorization: `Bearer ${session.access_token}` } 
        : {};

      const res = await axios.post('/api/deploy-modal-direct', {}, { headers });
      toast({
        title: "Deployment Triggered",
        description: res.data.message,
      });
      showBanner("GPU Deployment Sequence Initiated Successfully", "success", "DEPLOYMENT OK");
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message;
      logError("/api/deploy-modal-direct", err.response?.status || 500, errorMsg, err.response?.data);
      showBanner(`Deployment Critical Failure: ${errorMsg}`, "error", "DEPLOYMENT 401/500");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleStartAnalysis = async (gameId: string) => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token 
        ? { Authorization: `Bearer ${session.access_token}` } 
        : {};

      await axios.post('/api/process-game', { gameId }, { headers });
      
      toast({
        title: "Analysis Initiated",
        description: "The GPU cluster is waking up. Check the game detail for the live trace.",
      });
      fetchDashboardData();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message;
      toast({
        title: "Analysis Failed",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Dashboard | DribbleStats AI Elite">
      <div className="space-y-8 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              Dashboard Overview
            </h1>
            <p className="text-muted-foreground">Elite Performance Snapshot • Automated Scouting Intelligence</p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm"
              className={cn(
                "gap-2 border-destructive/50 text-destructive hover:bg-destructive/10",
                errors.length > 0 && "animate-pulse border-destructive"
              )}
              onClick={() => setIsErrorMonitorOpen(true)}
            >
              <AlertTriangle className="h-4 w-4" />
              Logs ({errors.length})
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="bg-muted/10 border-white/5"
              onClick={fetchDashboardData}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="bg-muted/10 border-white/5 hover:text-destructive transition-colors"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "AI Cluster", value: "A10G Swarm", icon: Cpu, color: "text-accent" },
            { label: "Total Clips", value: statsSummary.totalClips.toLocaleString(), icon: Play, color: "text-primary" },
            { label: "Accuracy", value: statsSummary.accuracy, icon: Target, color: "text-emerald-400" },
            { label: "Efficiency", value: statsSummary.speed, icon: TrendingUp, color: "text-blue-400" },
          ].map((stat, i) => (
            <Card key={i} className="glass-card border-none overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                    <p className="text-2xl font-mono font-bold">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-lg bg-white/5 ${stat.color} group-hover:scale-110 transition-transform`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card/50 border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" /> Recent Intelligence
                </CardTitle>
                <Button variant="ghost" className="text-xs" onClick={() => router.push('/games')}>View All</Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentGames.length > 0 ? (
                    recentGames.map((game) => (
                      <div 
                        key={game.id} 
                        onClick={() => router.push(`/games/${game.id}`)}
                        className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                            <Trophy className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-bold group-hover:text-primary transition-colors">
                              {game.home_team?.name} vs {game.away_team?.name}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {new Date(game.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 px-4 border-2 border-dashed border-white/5 rounded-3xl bg-muted/5">
                      <div className="h-16 w-16 bg-muted/10 rounded-full flex items-center justify-center mb-6">
                        <Activity className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                      <h3 className="text-xl font-bold uppercase tracking-tight mb-2">No Active Intelligence</h3>
                      <p className="text-muted-foreground text-sm max-w-xs text-center font-medium">
                        Your scouting queue is currently empty. Visit the games archive to initiate new analysis.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="bg-card/50 border border-white/5 p-1 rounded-xl">
                <TabsTrigger value="overview">Scouting Pulse</TabsTrigger>
                <TabsTrigger value="models">Model Health</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <Card className="glass-card border-none min-h-[200px] flex items-center justify-center p-8 text-center">
                  <p className="text-sm text-muted-foreground font-mono">Chronological event stream will appear here during active analysis pulses.</p>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-6">
            <Card className="glass-card border-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-widest font-black">
                  <Zap className="h-4 w-4 text-primary" /> Live GPU Cluster
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeJobs.length > 0 ? (
                  activeJobs.map((job, i) => {
                    const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
                    return (
                      <div key={i} className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-mono font-bold uppercase truncate w-32">{job.name}</span>
                          <div className="flex gap-2">
                            {job.status === 'pending' && (
                              <Button 
                                size="sm" 
                                className="h-6 text-[8px] bg-primary hover:bg-primary/80"
                                onClick={() => handleStartAnalysis(job.id)}
                              >
                                Run AI Analysis
                              </Button>
                            )}
                            <Badge variant="outline" className={cn("text-[8px] uppercase tracking-tighter", config.color)}>
                              {config.label}
                            </Badge>
                          </div>
                        </div>
                        <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-1000"
                            style={{ width: `${job.progress}%` }} 
                          />
                        </div>
                        <div className="flex justify-between text-[8px] font-mono text-muted-foreground">
                          <span>A10G INFUSION</span>
                          <span>{job.progress}%</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">No Active GPU Pulsing</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-12 p-6 border border-primary/20 bg-primary/5 rounded-xl flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary" />
              GPU Worker Recovery
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Bypass GitHub run limits and deploy the AI scouting worker directly to Modal.
            </p>
          </div>
          <Button onClick={handleForceDeploy} variant="outline" className="gap-2 border-primary/50 hover:bg-primary/10">
            <Rocket className="w-4 h-4" />
            Force Deploy to Modal
          </Button>
        </div>
      </div>
      
      <ErrorMonitor 
        errors={errors} 
        onDismiss={dismissError} 
        onDismissAll={dismissAll} 
        isOpen={isErrorMonitorOpen}
        onToggle={() => setIsErrorMonitorOpen(!isErrorMonitorOpen)}
        forceVisible={true}
      />
    </Layout>
  );
}