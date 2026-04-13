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
  Plus,
  RefreshCw,
  LayoutDashboard,
  Zap
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { NewGameModal } from "@/components/NewGameModal";
import { supabase } from "@/integrations/supabase/client";
import { useRouter } from "next/router";
import { showBanner } from "@/components/DiagnosticBanner";
import { useToast } from "@/hooks/use-toast";

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
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);

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
      
      if (!gamesError && games) {
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
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    const channel = supabase
      .channel('dashboard-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games' },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUploadSuccess = (gameId: string) => {
    setIsNewGameModalOpen(false);
    showBanner("Atomic Handshake Initialized. GPU ignition sequence started.", "success", "Swarm Launched");
    router.push(`/games/${gameId}`);
  };

  return (
    <Layout title="Dashboard | DribbleStats AI Elite">
      <div className="space-y-8">
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
              size="icon" 
              className="bg-muted/10 border-white/5"
              onClick={fetchDashboardData}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <Button 
              className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
              onClick={() => setIsNewGameModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              ANALYZE NEW GAME
            </Button>
          </div>
        </div>

        <NewGameModal />

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
                    <div className="py-12 text-center text-muted-foreground text-sm font-mono">
                      No analyzed games found. Ignite your first swarm.
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
                          <Badge variant="outline" className={cn("text-[8px] uppercase tracking-tighter", config.color)}>
                            {config.label}
                          </Badge>
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
      </div>
    </Layout>
  );
}