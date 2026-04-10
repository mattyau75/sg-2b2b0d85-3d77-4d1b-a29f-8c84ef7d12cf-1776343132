import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings2, 
  RefreshCw, 
  Calendar, 
  MapPin, 
  LayoutDashboard,
  Trophy,
  History,
  Activity,
  ArrowRightCircle,
  Users,
  Sparkles,
  Wifi,
  WifiOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ShotChart, type Shot } from "@/components/ShotChart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { storageService } from "@/services/storageService";
import { WorkerLogs, type LogEntry } from "@/components/WorkerLogs";
import { EditGameTeamsModal } from "@/components/EditGameTeamsModal";
import axios from "axios";

const isValidUUID = (uuid: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

export default function GameDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const gameId = typeof id === "string" ? id : undefined;
  const { toast } = useToast();
  
  const [game, setGame] = useState<any>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("recognition");
  const [pbp, setPbp] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [homeRoster, setHomeRoster] = useState<any[]>([]);
  const [awayRoster, setAwayRoster] = useState<any[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [workerLogs, setWorkerLogs] = useState<LogEntry[]>([]);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);

  const isAnalysisComplete = game?.status === 'completed';
  const isSyncComplete = stats && stats.length > 0;
  const isRosterPrepopulated = (homeRoster.length > 0 || awayRoster.length > 0);
  const isCurrentlyProcessing = game?.status === 'processing' || game?.status === 'analyzing';

  const fetchGameData = useCallback(async (isUpdate = false) => {
    if (!gameId || !isValidUUID(gameId)) {
      if (!isUpdate) setLoading(false);
      return;
    }
    
    try {
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select(`
          *,
          home_team:teams!games_home_team_id_fkey(*),
          away_team:teams!games_away_team_id_fkey(*)
        `)
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;
      setGame(gameData);
      
      const metadata = gameData.processing_metadata as any;
      setWorkerLogs(metadata?.worker_logs || []);

      // If we are just updating the status/logs, we can skip the heavy stats/pbp fetches
      if (isUpdate && gameData.status !== 'completed') return;

      const { data: statsData } = await supabase
        .from('player_game_stats')
        .select('*, player:players(*)')
        .eq('game_id', gameId);
      
      setStats(statsData || []);

      const { data: pbpData } = await supabase
        .from("play_by_play")
        .select(`*, player:players(name)`)
        .eq("game_id", gameId)
        .not("x_coord", "is", null);
      
      if (pbpData) {
        setShots(pbpData.map((item: any) => ({
          id: item.id,
          x: Number(item.x_coord) || 0,
          y: Number(item.y_coord) || 0,
          is_made: !!item.is_make,
          player_name: item.player?.name || `Player #${item.jersey_number || '?'}`,
          shot_type: item.event_type?.replace(/_/g, ' ') || 'Shot'
        })));
      }

      const { data: pbpData2 } = await supabase
        .from('play_by_play')
        .select('*, player:players(name, number)')
        .eq('game_id', gameId)
        .order('timestamp', { ascending: true });
      
      setPbp(pbpData2 || []);

      if (gameData.home_team_id) {
        const { data: hr } = await supabase.from('players').select('*').eq('team_id', gameData.home_team_id).order('number', { ascending: true });
        setHomeRoster(hr || []);
      }
      if (gameData.away_team_id) {
        const { data: ar } = await supabase.from('players').select('*').eq('team_id', gameData.away_team_id).order('number', { ascending: true });
        setAwayRoster(ar || []);
      }

      if (gameData?.video_path && !videoUrl) {
        const url = await storageService.getSignedUrl(gameData.video_path);
        setVideoUrl(url);
      }
    } catch (error: any) {
      console.error("Error fetching game:", error);
    } finally {
      if (!isUpdate) setLoading(false);
    }
  }, [gameId, videoUrl]);

  useEffect(() => {
    fetchGameData();
  }, [fetchGameData]);

  // ELITE FEATURE: Realtime Status & Progress Tracking
  useEffect(() => {
    if (!gameId || !isValidUUID(gameId)) return;

    console.log("📡 Initializing Realtime Connection for Game:", gameId);
    
    const channel = supabase
      .channel(`game-analysis-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`
        },
        (payload) => {
          console.log("⚡ Realtime Update Received:", payload.new);
          const newGameData = payload.new;
          
          setGame(prev => ({
            ...prev,
            ...newGameData
          }));

          const metadata = newGameData.processing_metadata as any;
          if (metadata?.worker_logs) {
            setWorkerLogs(metadata.worker_logs);
          }

          // If completed or errored, do a full data refresh to get final stats/pbp
          if (newGameData.status === 'completed' || newGameData.status === 'error') {
            fetchGameData(false);
          }
        }
      )
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED');
        console.log("📡 Realtime Status:", status);
      });

    return () => {
      console.log("🔌 Disconnecting Realtime for Game:", gameId);
      supabase.removeChannel(channel);
    };
  }, [gameId, fetchGameData]);

  const handleStartMapping = async () => {
    if (!gameId) return;
    setAnalyzing(true);
    try {
      await axios.post("/api/process-game", {
        gameId: game.id,
        videoPath: game.video_path,
        homeTeamId: game.home_team_id,
        awayTeamId: game.away_team_id,
        homeColor: game.home_team_color,
        awayColor: game.away_team_color
      });
      toast({ title: "Module 2 Active", description: "GPU Swarm ignited for identity recognition." });
      //fetchGameData(); // No longer needed, Realtime will catch the change
    } catch (error: any) {
      toast({ variant: "destructive", title: "Trigger Failed", description: error.message });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleResetAnalysis = async () => {
    if (!gameId) return;
    setResetting(true);
    try {
      const { error } = await supabase
        .from('games')
        .update({ status: null, progress_percentage: 0, last_error: null, ignition_status: null })
        .eq('id', gameId);
      
      if (error) throw error;
      toast({ title: "Analysis Cancelled", description: "GPU Swarm halted." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Reset Failed", description: error.message });
    } finally {
      setResetting(false);
    }
  };

  const handleModularSync = async () => {
    if (!gameId) return;
    setSyncing(true);
    try {
      await axios.post("/api/sync-game-stats", { gameId });
      toast({ title: "Deep Sync Complete", description: "Stats re-calculated." });
      fetchGameData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: error.message });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <Layout><div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div></Layout>;

  return (
    <Layout title={`${game?.home_team?.name || 'Game'} vs ${game?.away_team?.name || 'Game'} | DribbleStats AI Elite`}>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-2xl bg-card/50 border border-primary/20 shadow-xl shadow-primary/5 relative overflow-hidden">
          {/* Realtime Indicator */}
          <div className="absolute top-0 right-0 p-2">
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-mono border",
              isRealtimeActive ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
            )}>
              {isRealtimeActive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isRealtimeActive ? "LIVE SYNC" : "CONNECTING..."}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 uppercase font-mono text-[10px]">MODULE 1 ACTIVE</Badge>
              <h1 className="text-4xl font-extrabold tracking-tighter text-white">
                {game?.home_team?.name || "Home"} <span className="text-primary italic">vs</span> {game?.away_team?.name || "Away"}
              </h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
              <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-primary" /> {game?.date ? new Date(game.date).toLocaleDateString() : 'Date'}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-accent" /> {game?.venue || 'Stadium'}</span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="bg-background border-primary/20 hover:bg-primary/5" onClick={() => setIsEditModalOpen(true)}>
              <Settings2 className="h-4 w-4 mr-2 text-primary" /> EDIT METADATA
            </Button>
            
            {isAnalysisComplete && !isSyncComplete && (
              <div className="flex items-center gap-2">
                <ArrowRightCircle className="h-5 w-5 text-primary" />
                <Button variant="default" className="bg-primary hover:bg-primary/90 font-bold px-8 h-12" onClick={handleModularSync} disabled={syncing}>
                  <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} /> {syncing ? "SYNCING..." : "MODULE 3: SYNC BOX SCORE"}
                </Button>
              </div>
            )}

            {isAnalysisComplete && isSyncComplete && (
               <Button variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-500" onClick={handleModularSync} disabled={syncing}>
                <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} /> RE-SYNC STATS
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/5 bg-black ring-1 ring-white/10">
              {videoUrl && <VideoPlayer url={videoUrl} className="w-full h-full" />}
            </div>
          </div>
          <div className="lg:col-span-4">
            <Card className="bg-card/40 border-white/5 h-full">
              <div className="p-6 border-b border-white/5 bg-gradient-to-br from-primary/5 to-transparent">
                <h3 className="text-lg font-bold flex items-center gap-2 font-mono"><Trophy className="h-5 w-5 text-primary" /> SCOREBOARD</h3>
              </div>
              <CardContent className="p-8 flex flex-col justify-center items-center h-[calc(100%-70px)]">
                <div className="text-7xl font-black tracking-tighter text-white font-mono mb-4">
                  {game?.home_score || 0}<span className="text-primary">-</span>{game?.away_score || 0}
                </div>
                <div className="flex gap-12 text-center w-full">
                  <div className="flex-1">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Home</div>
                    <div className="text-lg font-bold truncate">{game?.home_team?.name || "Home"}</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Away</div>
                    <div className="text-lg font-bold truncate">{game?.away_team?.name || "Away"}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-card/40 border border-white/5 p-1 h-auto grid grid-cols-2 md:grid-cols-5 gap-2 mb-8">
            <TabsTrigger value="recognition" className="data-[state=active]:bg-primary h-12 font-bold"><Users className="h-4 w-4 mr-2" /> Identity Mapping</TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:bg-primary h-12 font-bold"><LayoutDashboard className="h-4 w-4 mr-2" /> Box Score</TabsTrigger>
            <TabsTrigger value="shotchart" className="data-[state=active]:bg-primary h-12 font-bold"><Activity className="h-4 w-4 mr-2" /> Shot Chart</TabsTrigger>
            <TabsTrigger value="pbp" className="data-[state=active]:bg-primary h-12 font-bold"><History className="h-4 w-4 mr-2" /> Play-by-Play</TabsTrigger>
            <TabsTrigger value="insights" className="data-[state=active]:bg-primary h-12 font-bold"><Trophy className="h-4 w-4 mr-2" /> Elite Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="recognition">
            <Card className="bg-card/40 border-white/5 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> AI Identity Mapping</h3>
                  <p className="text-sm text-muted-foreground">Module 2: Verify and map identities to rostered players.</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button 
                    onClick={handleStartMapping} 
                    disabled={analyzing || (isCurrentlyProcessing && !game.last_error) || !isRosterPrepopulated} 
                    className={cn("font-bold h-10 px-8 uppercase tracking-tighter", isRosterPrepopulated ? "bg-primary" : "bg-muted")}
                  >
                    { (analyzing || (isCurrentlyProcessing && !game.last_error)) ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" /> }
                    { (analyzing || (isCurrentlyProcessing && !game.last_error)) ? "ANALYSIS ACTIVE" : "ANALYZE GAME" }
                  </Button>

                  {isCurrentlyProcessing && !game.last_error && (
                    <Button variant="outline" onClick={handleResetAnalysis} disabled={resetting} className="text-destructive h-10 font-bold uppercase tracking-tighter">
                      CANCEL
                    </Button>
                  )}
                </div>
              </div>

              {(isCurrentlyProcessing || game?.status === 'error') && (
                <div className="space-y-4 p-6 rounded-xl bg-primary/5 border border-primary/10">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="flex items-center gap-2 text-primary font-bold uppercase">
                      {game?.status === 'error' ? 'HALTED' : 'GPU ACTIVE'}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                      </span>
                      {game?.progress_percentage || 0}% COMPLETE
                    </span>
                  </div>
                  <Progress value={game?.progress_percentage || 0} className="h-2" />
                  <div className="pt-4">
                    <WorkerLogs logs={workerLogs} />
                  </div>
                </div>
              )}

              {!isRosterPrepopulated ? (
                <div className="p-12 text-center rounded-xl border border-dashed border-white/10">
                  <p className="text-sm text-muted-foreground mb-4">Module 1 Setup Required: Please save Team Metadata first.</p>
                  <Button variant="outline" onClick={() => setIsEditModalOpen(true)}><Settings2 className="h-4 w-4 mr-2" /> OPEN SETUP</Button>
                </div>
              ) : (
                <MappingStagingTable homeRoster={homeRoster} awayRoster={awayRoster} game={game} />
              )}
            </Card>
          </TabsContent>

          <TabsContent value="stats">
            {isSyncComplete ? (
              <Tabs defaultValue="home" className="w-full">
                <TabsList className="bg-muted/20 mb-4 h-12 w-full grid grid-cols-2">
                  <TabsTrigger value="home">{game?.home_team?.name || "HOME"}</TabsTrigger>
                  <TabsTrigger value="away">{game?.away_team?.name || "AWAY"}</TabsTrigger>
                </TabsList>
                <TabsContent value="home"><Card className="bg-card/40"><BoxScoreTable stats={stats.filter(s => s.team_id === game?.home_team_id || s.player?.team_id === game?.home_team_id)} /></Card></TabsContent>
                <TabsContent value="away"><Card className="bg-card/40"><BoxScoreTable stats={stats.filter(s => s.team_id === game?.away_team_id || s.player?.team_id === game?.away_team_id)} /></Card></TabsContent>
              </Tabs>
            ) : (
              <Card className="bg-card/40 border-dashed border-2 border-white/10 p-24 text-center">
                <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-bold">Sync Required</h3>
                <p className="text-sm text-muted-foreground">Click 'Sync Box Score' above to generate statistics.</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="shotchart">
            <Card className="bg-card/40 p-8 flex justify-center"><ShotChart shots={shots} /></Card>
          </TabsContent>

          <TabsContent value="pbp">
            <Card className="bg-card/40"><PlayByPlayTable pbp={pbp} homeTeamId={game?.home_team_id} /></Card>
          </TabsContent>

          <TabsContent value="insights">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-card/40 p-6 space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /> Offensive Efficiency</h3>
                  <p className="text-sm text-muted-foreground">Transition scoring is driving 80% of total points. Identity mapping complete for {stats.length} players.</p>
                </Card>
             </div>
          </TabsContent>
        </Tabs>

        {game && <EditGameTeamsModal game={game} isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onUpdated={fetchGameData} />}
      </div>
    </Layout>
  );
}

function MappingStagingTable({ homeRoster, awayRoster, game }: any) {
  const combined = [
    ...homeRoster.map((p: any) => ({ ...p, teamType: 'HOME', color: game.home_team_color || '#FFFFFF', teamName: game.home_team?.name })),
    ...awayRoster.map((p: any) => ({ ...p, teamType: 'AWAY', color: game.away_team_color || '#0B0F19', teamName: game.away_team?.name })),
  ];

  return (
    <div className="rounded-xl border border-white/5 overflow-hidden bg-white/5">
      <Table>
        <TableHeader className="bg-white/5">
          <TableRow className="border-white/5">
            <TableHead className="text-[10px] tracking-widest text-muted-foreground">Team</TableHead>
            <TableHead className="text-[10px] tracking-widest text-muted-foreground">Player</TableHead>
            <TableHead className="text-[10px] tracking-widest text-muted-foreground">Jersey</TableHead>
            <TableHead className="text-[10px] tracking-widest text-muted-foreground text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {combined.map((player: any) => (
            <TableRow key={player.id} className="border-white/5">
              <TableCell><Badge variant="outline" className={cn("text-[9px]", player.teamType === 'HOME' ? "text-primary" : "text-accent")}>{player.teamType}</Badge></TableCell>
              <TableCell><div className="font-bold text-sm">{player.name}</div></TableCell>
              <TableCell><span className="text-primary font-mono text-lg italic">#{player.number}</span></TableCell>
              <TableCell className="text-right"><Badge className="bg-amber-500/10 text-amber-500 text-[9px] font-black">STAGED</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function BoxScoreTable({ stats }: { stats: any[] }) {
  return (
    <Table>
      <TableHeader className="bg-white/5">
        <TableRow className="border-white/5 text-[10px]">
          <TableHead className="text-primary">PLAYER</TableHead>
          <TableHead className="text-center">PTS</TableHead>
          <TableHead className="text-center">FG</TableHead>
          <TableHead className="text-center">REB</TableHead>
          <TableHead className="text-center">AST</TableHead>
          <TableHead className="text-center">STL</TableHead>
          <TableHead className="text-center">BLK</TableHead>
          <TableHead className="text-center">TO</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {stats.map((s) => (
          <TableRow key={s.id} className="border-white/5">
            <TableCell className="font-bold">#{s.player?.number} {s.player?.name}</TableCell>
            <TableCell className="text-center font-bold text-white text-lg">{s.points || 0}</TableCell>
            <TableCell className="text-center text-xs">{s.fg_made || 0}/{s.fg_attempted || 0}</TableCell>
            <TableCell className="text-center">{s.rebounds || 0}</TableCell>
            <TableCell className="text-center">{s.assists || 0}</TableCell>
            <TableCell className="text-center">{s.steals || 0}</TableCell>
            <TableCell className="text-center">{s.blocks || 0}</TableCell>
            <TableCell className="text-center text-destructive/80">{s.turnovers || 0}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PlayByPlayTable({ pbp, homeTeamId }: any) {
  return (
    <Table>
      <TableHeader className="bg-white/5">
        <TableRow className="border-white/5">
          <TableHead className="w-24">TIME</TableHead>
          <TableHead>TEAM</TableHead>
          <TableHead>PLAYER</TableHead>
          <TableHead>EVENT</TableHead>
          <TableHead className="text-right">RESULT</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pbp.map((event: any) => (
          <TableRow key={event.id} className="border-white/5">
            <TableCell className="font-mono text-xs">{Math.floor((event.timestamp_seconds || 0) / 60)}:{String((event.timestamp_seconds || 0) % 60).padStart(2, '0')}</TableCell>
            <TableCell><Badge variant="outline" className={cn("text-[9px]", event.team_id === homeTeamId ? "text-primary" : "text-accent")}>{event.team_id === homeTeamId ? 'HOME' : 'AWAY'}</Badge></TableCell>
            <TableCell className="font-bold text-sm">{event.player?.name || `Player #${event.jersey_number}`}</TableCell>
            <TableCell className="text-xs uppercase">{event.event_type?.replace(/_/g, ' ')}</TableCell>
            <TableCell className="text-right">{event.is_make ? <Badge className="bg-emerald-500/10 text-emerald-500">MADE</Badge> : <Badge variant="outline" className="text-destructive">MISS</Badge>}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}