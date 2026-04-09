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
  Download,
  ListTodo,
  Video,
  History,
  Trophy,
  ChevronRight,
  Youtube,
  FileVideo
} from "lucide-react";
import { ShotChart as ShotChartComponent, type Shot } from "@/components/ShotChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { NewGameModal } from "@/components/NewGameModal";
import { supabase } from "@/integrations/supabase/client";
import { useRouter } from "next/router";

const STATUS_PROGRESS: Record<string, number> = {
  'queued': 15,
  'processing': 35,
  'analyzing': 65,
  'finalizing': 90,
  'completed': 100,
  'error': 0
};

export default function Home() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [recentGames, setRecentGames] = useState<any[]>([]);
  const [statsSummary, setStatsSummary] = useState({
    totalClips: 0,
    activeModels: 3, // YOLOv11m, Jersey Number, Rim Detection
    accuracy: "98.4%",
    speed: "0.4s/f"
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Fetch recent games
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
          
          // Identify active processing jobs from the database
          const active = games
            .filter(g => g.status !== 'completed' && g.status !== 'scheduled')
            .map(g => ({
              id: g.id,
              name: `${g.home_team?.name || 'Home'} vs ${g.away_team?.name || 'Away'}`,
              status: g.status,
              progress: STATUS_PROGRESS[g.status as string] || 10
            }));
          setActiveJobs(active);
        }

        // Fetch total video clips (Play-by-Play events with video URLs)
        const { count, error: countError } = await supabase
          .from("play_by_play")
          .select('id', { count: 'exact', head: true })
          .not("video_url", "is", null);

        if (!countError) {
          setStatsSummary(prev => ({
            ...prev,
            totalClips: count || 0
          }));
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    // Subscribe to Realtime Game Status Updates
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games' },
        (payload) => {
          const updatedGame = payload.new as any;
          
          if (updatedGame.status === 'completed') {
            setActiveJobs(prev => prev.filter(j => j.id !== updatedGame.id));
            fetchDashboardData(); // Refresh recent games list
          } else if (updatedGame.status !== 'scheduled') {
            setActiveJobs(prev => {
              const existing = prev.find(j => j.id === updatedGame.id);
              if (existing) {
                return prev.map(j => j.id === updatedGame.id ? {
                  ...j,
                  status: updatedGame.status,
                  progress: STATUS_PROGRESS[updatedGame.status] || j.progress
                } : j);
              } else {
                return [{
                  id: updatedGame.id,
                  name: "Analysis in Progress",
                  status: updatedGame.status,
                  progress: STATUS_PROGRESS[updatedGame.status] || 10
                }, ...prev];
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleNewJob = (jobId: string) => {
    // Note: The realtime subscription will now handle the status updates automatically
    // once the database record is created/updated by the Modal bridge.
  };

  return (
    <Layout title="Dashboard | DribbleStats AI Elite">
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-accent/50 text-accent font-mono text-[10px] uppercase tracking-widest px-2">
                System Status: Ready
              </Badge>
              <Badge variant="outline" className="border-primary/50 text-primary font-mono text-[10px] uppercase tracking-widest px-2">
                YOLOv11m Optimized
              </Badge>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">Game Analysis</h1>
            <p className="text-muted-foreground max-w-xl">
              Advanced tactical scouting powered by computer vision. Define teams and jersey colors for accurate player attribution.
            </p>
          </div>
          <Button 
            onClick={() => setIsModalOpen(true)}
            className="h-14 px-8 rounded-xl bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 transition-all font-bold text-lg"
          >
            <Video className="mr-2 h-6 w-6" />
            Analyze New Game
          </Button>
        </div>

        <NewGameModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
        />

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Active Models", value: statsSummary.activeModels.toString(), icon: Cpu, color: "text-accent" },
            { label: "Total Clips", value: statsSummary.totalClips.toLocaleString(), icon: Play, color: "text-primary" },
            { label: "Tracking Accuracy", value: statsSummary.accuracy, icon: Target, color: "text-emerald-400" },
            { label: "Processing Speed", value: statsSummary.speed, icon: TrendingUp, color: "text-blue-400" },
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

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card/50 border-border">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" /> Recent Analysis
                </CardTitle>
                <Button 
                  variant="ghost" 
                  className="text-xs text-muted-foreground hover:text-primary"
                  onClick={() => router.push('/games')}
                >
                  View All
                </Button>
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
                            <p className="text-xs text-muted-foreground">
                              {new Date(game.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-mono font-bold">Live</p>
                            <p className="text-[10px] text-accent uppercase tracking-tighter">{game.status}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center space-y-4">
                      <div className="h-16 w-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto">
                        <History className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">No recent analysis found</p>
                        <p className="text-xs text-muted-foreground/70">Start by analyzing a new game video</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setIsModalOpen(true)}>
                        Analyze First Game
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="boxscore" className="w-full">
              <TabsList className="bg-card/50 border border-white/5 p-1 rounded-xl mb-6">
                <TabsTrigger value="boxscore" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
                  Boxscore
                </TabsTrigger>
                <TabsTrigger value="pbp" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
                  Play-by-Play
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="boxscore">
                <Card className="glass-card border-none overflow-hidden min-h-[200px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground font-mono">No game stats available. Please select or analyze a game.</p>
                </Card>
              </TabsContent>

              <TabsContent value="pbp">
                <Card className="glass-card border-none p-8 text-center space-y-4">
                  <Target className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm text-muted-foreground font-mono">Select a game to view chronological event logs.</p>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-8">
            <Card className="glass-card border-none">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-accent" />
                  Shot Chart
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                 <div className="h-32 w-full border border-dashed border-border/50 rounded-lg flex items-center justify-center bg-muted/10">
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">No Shot Data</p>
                 </div>
                 <p className="text-xs text-muted-foreground max-w-[180px]">Visualization will appear here once game processing is complete.</p>
              </CardContent>
            </Card>

            <Card className="glass-card border-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ListTodo className="h-4 w-4 text-primary" />
                  Processing Queue
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeJobs.length > 0 ? (
                  activeJobs.map((job, i) => (
                    <div key={i} className="space-y-2 group">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-muted-foreground uppercase truncate w-32 group-hover:text-foreground transition-colors">{job.name}</span>
                        <span className={cn(
                          "uppercase tracking-tighter font-bold",
                          job.status === "error" ? "text-destructive" : 
                          job.status === "finalizing" ? "text-accent" : "text-primary"
                        )}>
                          {job.status}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className={cn(
                            "h-full transition-all duration-1000",
                            job.status === "error" ? "bg-destructive" :
                            job.status === "finalizing" ? "bg-accent" : "bg-primary"
                          )}
                          style={{ width: `${job.progress}%` }} 
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-4 text-center">
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">No active processing</p>
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