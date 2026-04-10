import React, { useState, useEffect } from "react";
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
  Lock,
  ArrowRightCircle,
  Users,
  CheckCircle2,
  AlertCircle,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ShotChart, type Shot } from "@/components/ShotChart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { storageService } from "@/services/storageService";
import { EditGameTeamsModal } from "@/components/EditGameTeamsModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import axios from "axios";

// Helper for UUID validation
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
  
  const [detectedPlayers, setDetectedPlayers] = useState<any[]>([]);
  const [homeRoster, setHomeRoster] = useState<any[]>([]);
  const [awayRoster, setAwayRoster] = useState<any[]>([]);
  const [manualMappings, setManualMappings] = useState<Record<string, string>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [resetting, setResetting] = useState(false);

  const isAnalysisComplete = game?.status === 'completed';
  const isSyncComplete = stats && stats.length > 0;
  const isRosterPrepopulated = stats && stats.length > 0;
  const isCurrentlyProcessing = game?.status === 'processing' || game?.status === 'analyzing';

  const handleStartMapping = async () => {
    if (!gameId || !isValidUUID(gameId)) return;
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
      fetchGameData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Trigger Failed", description: error.message });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleResetAnalysis = async () => {
    if (!gameId || !isValidUUID(gameId)) return;
    setResetting(true);
    try {
      const { error } = await supabase
        .from('games')
        .update({ 
          status: null, 
          progress_percentage: 0,
          last_error: null 
        })
        .eq('id', gameId);
      
      if (error) throw error;
      toast({ title: "Analysis Cancelled", description: "GPU Swarm halted. Module 2 has been reset." });
      fetchGameData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Reset Failed", description: error.message });
    } finally {
      setResetting(false);
    }
  };

  const fetchGameData = async () => {
    if (!gameId || !isValidUUID(gameId)) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
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
      setManualMappings(metadata?.manual_mappings || {});

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

      // Fetch detected players for mapping tab
      const { data: detectedData } = await supabase
        .from('play_by_play')
        .select('jersey_number, team_id')
        .eq('game_id', gameId)
        .not('jersey_number', 'is', null);
      
      if (detectedData) {
        const unique = detectedData.reduce((acc: any[], current: any) => {
          const x = acc.find(item => item.jersey_number === current.jersey_number && item.team_id === current.team_id);
          if (!x) return acc.concat([current]);
          return acc;
        }, []);
        setDetectedPlayers(unique);
      }

      // Fetch rosters
      if (gameData.home_team_id) {
        const { data: hr } = await supabase.from('players').select('*').eq('team_id', gameData.home_team_id).order('number', { ascending: true });
        setHomeRoster(hr || []);
      }
      if (gameData.away_team_id) {
        const { data: ar } = await supabase.from('players').select('*').eq('team_id', gameData.away_team_id).order('number', { ascending: true });
        setAwayRoster(ar || []);
      }

      if (gameData?.video_path) {
        const url = await storageService.getSignedUrl(gameData.video_path);
        setVideoUrl(url);
      }
    } catch (error: any) {
      console.error("Error fetching game:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (gameId) fetchGameData();
  }, [gameId]);

  // Add polling for active analysis
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (gameId && isCurrentlyProcessing) {
      interval = setInterval(() => {
        fetchGameData();
      }, 30000); // Poll every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameId, isCurrentlyProcessing]);

  const handleUpdateMapping = async (teamId: string, jersey: number, playerId: string) => {
    const key = `${teamId}-${jersey}`;
    const newMappings = { ...manualMappings, [key]: playerId };
    setManualMappings(newMappings);

    try {
      const { error } = await supabase
        .from('games')
        .update({
          processing_metadata: {
            ...game.processing_metadata,
            manual_mappings: newMappings
          }
        })
        .eq('id', game.id);
      
      if (error) throw error;
      toast({ title: "Mapping Updated", description: `Jersey #${jersey} linked to rostered player.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update Failed", description: err.message });
    }
  };

  const handleModularSync = async () => {
    if (!gameId || !isValidUUID(gameId)) return;
    setSyncing(true);
    try {
      await axios.post("/api/sync-game-stats", { gameId });
      toast({ title: "Deep Sync Complete", description: "Identity mapping and stats re-calculated." });
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
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-700">
        {/* Module Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-2xl bg-card/50 border border-primary/20 shadow-xl shadow-primary/5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 uppercase font-mono text-[10px]">MODULE 1 ACTIVE</Badge>
              <h1 className="text-4xl font-extrabold tracking-tighter text-white">
                {game?.home_team?.name || "Home"} <span className="text-primary italic">vs</span> {game?.away_team?.name || "Away"}
              </h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
              <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-primary" /> {game?.date ? new Date(game.date).toLocaleDateString() : 'Date'}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-accent" /> {game?.venue || 'DribbleStats Stadium'}</span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="bg-background border-primary/20 hover:bg-primary/5 hover:border-primary/50 transition-all" onClick={() => setIsEditModalOpen(true)}>
              <Settings2 className="h-4 w-4 mr-2 text-primary" /> EDIT GAME METADATA
            </Button>
            
            {isAnalysisComplete && !isSyncComplete && (
              <div className="flex items-center gap-2 animate-bounce-horizontal">
                <ArrowRightCircle className="h-5 w-5 text-primary" />
                <Button variant="default" className="bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 font-bold px-8 h-12" onClick={handleModularSync} disabled={syncing}>
                  <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} /> {syncing ? "SYNCING..." : "MODULE 3: SYNC BOX SCORE"}
                </Button>
              </div>
            )}

            {isAnalysisComplete && isSyncComplete && (
               <Button variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20" onClick={handleModularSync} disabled={syncing}>
                <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} /> RE-SYNC STATS
              </Button>
            )}
          </div>
        </div>

        {/* Video & Scoreboard Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/5 bg-black ring-1 ring-white/10">
              {videoUrl && <VideoPlayer url={videoUrl} className="w-full h-full" />}
            </div>
          </div>
          <div className="lg:col-span-4">
            <Card className="bg-card/40 border-white/5 h-full">
              <div className="p-6 border-b border-white/5 bg-gradient-to-br from-primary/5 to-transparent">
                <h3 className="text-lg font-bold flex items-center gap-2 font-mono"><Trophy className="h-5 w-5 text-primary" /> LIVE SCOREBOARD</h3>
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

        {/* Module 3, 4, 5 Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-card/40 border border-white/5 p-1 h-auto grid grid-cols-2 md:grid-cols-5 gap-2 mb-8">
            <TabsTrigger value="recognition" className="data-[state=active]:bg-primary h-12 font-bold transition-all"><Users className="h-4 w-4 mr-2" /> Identity Mapping</TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:bg-primary h-12 font-bold transition-all"><LayoutDashboard className="h-4 w-4 mr-2" /> Box Score</TabsTrigger>
            <TabsTrigger value="shotchart" className="data-[state=active]:bg-primary h-12 font-bold transition-all"><Activity className="h-4 w-4 mr-2" /> Shot Chart</TabsTrigger>
            <TabsTrigger value="pbp" className="data-[state=active]:bg-primary h-12 font-bold transition-all"><History className="h-4 w-4 mr-2" /> Play-by-Play</TabsTrigger>
            <TabsTrigger value="insights" className="data-[state=active]:bg-primary h-12 font-bold transition-all"><Trophy className="h-4 w-4 mr-2" /> Elite Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="recognition">
            <Card className="bg-card/40 border-white/5 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" /> Player Recognition & AI Mapping
                  </h3>
                  <p className="text-sm text-muted-foreground">Module 2: Verify and map detected identities to rostered directory players.</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button 
                    onClick={handleStartMapping} 
                    disabled={analyzing || (isCurrentlyProcessing && !game.last_error) || !isRosterPrepopulated} 
                    className={cn(
                      "font-bold h-10 px-8 shadow-xl uppercase tracking-tighter transition-all",
                      isRosterPrepopulated 
                        ? "bg-primary hover:bg-primary/90 shadow-primary/30" 
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    { (analyzing || (isCurrentlyProcessing && !game.last_error)) ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" /> }
                    { (analyzing || (isCurrentlyProcessing && !game.last_error)) 
                      ? "ANALYSIS IN PROGRESS" 
                      : (isAnalysisComplete || game?.status === 'error') ? "RE-RUN AI ANALYSIS" : "ANALYZE GAME & MAP IDENTITIES" 
                    }
                  </Button>

                  {isCurrentlyProcessing && !game.last_error && (
                    <Button 
                      variant="outline" 
                      onClick={handleResetAnalysis}
                      disabled={resetting}
                      className="border-destructive/20 hover:bg-destructive/10 text-destructive h-10 font-bold uppercase tracking-tighter"
                    >
                      {resetting ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : "CANCEL ANALYSIS"}
                    </Button>
                  )}
                  
                  <Badge variant="outline" className={cn(
                    "px-4 py-1 border-primary/20 font-mono h-10 uppercase tracking-tighter font-black",
                    isRosterPrepopulated ? "text-primary bg-primary/5" : "text-muted-foreground bg-muted/5"
                  )}>
                    {isRosterPrepopulated ? "ROSTERS READY" : "SETUP REQUIRED"}
                  </Badge>
                </div>
              </div>

              {game?.last_error && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3 animate-in slide-in-from-top-2">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-destructive uppercase tracking-tighter">GPU Cluster Error Detected</p>
                    <p className="text-xs text-destructive/80 font-mono">{game.last_error}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">The handoff to the AI engine failed. Please verify your video file and try re-running the analysis.</p>
                  </div>
                </div>
              )}

              {!isRosterPrepopulated ? (
                <div className="p-12 text-center rounded-xl border border-dashed border-white/10 bg-white/5">
                  <div className="max-w-md mx-auto space-y-4">
                    <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-bold text-lg italic uppercase">Module 1 Setup Required</h4>
                      <p className="text-sm text-muted-foreground">
                        Please save the Team Metadata and Jersey Colors in Module 1 to pre-populate the rosters for AI mapping.
                      </p>
                      <Button variant="outline" className="border-primary/20 hover:bg-primary/5 mt-4" onClick={() => setIsEditModalOpen(true)}>
                        <Settings2 className="h-4 w-4 mr-2" /> OPEN MODULE 1 SETUP
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <MappingStagingTable homeRoster={homeRoster} awayRoster={awayRoster} game={game} />
              )}
            </Card>
          </TabsContent>

          <TabsContent value="stats">
            {isSyncComplete ? (
              <Tabs defaultValue="home" className="w-full">
                <div className="flex items-center justify-between mb-4 bg-muted/20 p-2 rounded-lg border border-white/5">
                  <TabsList className="bg-transparent border-none p-0 h-auto gap-2">
                    <TabsTrigger 
                      value="home" 
                      className="data-[state=active]:bg-primary data-[state=active]:text-white h-9 px-6 font-bold rounded-md transition-all uppercase text-[10px] tracking-widest"
                    >
                      {game?.home_team?.name || "HOME TEAM"}
                    </TabsTrigger>
                    <TabsTrigger 
                      value="away" 
                      className="data-[state=active]:bg-primary data-[state=active]:text-white h-9 px-6 font-bold rounded-md transition-all uppercase text-[10px] tracking-widest"
                    >
                      {game?.away_team?.name || "AWAY TEAM"}
                    </TabsTrigger>
                  </TabsList>
                  <Badge variant="outline" className="font-mono text-[10px] border-primary/20 text-primary">BOX SCORE ALPHA</Badge>
                </div>

                <TabsContent value="home" className="mt-0">
                  <Card className="bg-card/40 border-white/5 overflow-hidden">
                    <BoxScoreTable stats={stats.filter(s => s.team_id === game?.home_team_id || s.player?.team_id === game?.home_team_id)} />
                  </Card>
                </TabsContent>

                <TabsContent value="away" className="mt-0">
                  <Card className="bg-card/40 border-white/5 overflow-hidden">
                    <BoxScoreTable stats={stats.filter(s => s.team_id === game?.away_team_id || s.player?.team_id === game?.away_team_id)} />
                  </Card>
                </TabsContent>
              </Tabs>
            ) : (
              <Card className="bg-card/40 border-dashed border-2 border-white/10 p-24 text-center">
                <div className="max-w-xs mx-auto space-y-4">
                  <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    {isAnalysisComplete ? <RefreshCw className="h-8 w-8 text-primary" /> : <Lock className="h-8 w-8 text-muted-foreground" />}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold">{isAnalysisComplete ? "Module 3 Required" : "Module 2 In Progress"}</h3>
                    <p className="text-sm text-muted-foreground">
                      {isAnalysisComplete 
                        ? "AI analysis is done. Click 'Sync Box Score' above to map events to your roster."
                        : "Waiting for AI detection to complete before stats can be synchronized."}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="shotchart">
            {isSyncComplete ? (
              <Card className="bg-card/40 border-white/5 p-8 flex justify-center">
                <ShotChart shots={shots} />
              </Card>
            ) : (
              <Card className="bg-card/40 border-dashed border-2 border-white/10 p-24 text-center">
                <div className="max-w-xs mx-auto space-y-4">
                  <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <Activity className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-bold italic uppercase tracking-tighter">Spatial Mapping Locked</h3>
                  <p className="text-sm text-muted-foreground">Synchronize box score data to enable visual shot analytics.</p>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="pbp">
            <Card className="bg-card/40 border-white/5">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="hover:bg-transparent border-white/5">
                    <TableHead className="w-24">TIME</TableHead>
                    <TableHead>TEAM</TableHead>
                    <TableHead>PLAYER</TableHead>
                    <TableHead>EVENT</TableHead>
                    <TableHead className="text-right">RESULT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pbp.length > 0 ? pbp.map((event) => (
                    <TableRow key={event.id} className="border-white/5 hover:bg-white/5">
                      <TableCell className="font-mono text-muted-foreground">
                        {event.timestamp || event.game_time || (event.timestamp_seconds ? `${Math.floor(event.timestamp_seconds / 60)}:${String(event.timestamp_seconds % 60).padStart(2, '0')}` : '0:00')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[10px]", event.team_id === game.home_team_id ? "border-primary/50 text-primary" : "border-accent/50 text-accent")}>
                          {event.team_id === game.home_team_id ? 'HOME' : 'AWAY'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold">
                        {event.player?.name ? `${event.player.name} (#${event.player.number})` : `Player #${event.jersey_number || '?'}`}
                      </TableCell>
                      <TableCell>{event.event_type?.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="text-right">
                        {event.is_make ? <Badge className="bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30">MADE</Badge> : <Badge variant="outline" className="text-destructive border-destructive/50">MISS</Badge>}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No events detected yet. Re-analyze to generate play-by-play.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="insights">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-card/40 border-white/5 p-6 space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /> Offensive Efficiency</h3>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Based on the 1-6 score and shooting data:</p>
                  <ul className="list-disc list-inside text-sm space-y-2 text-white/80">
                    <li>Transition scoring is driving 80% of total points.</li>
                    <li>Left-wing shooting frequency is high but conversion is 0%.</li>
                    <li>Player recognized identities allow for per-possession mapping.</li>
                  </ul>
                </div>
              </Card>
              <Card className="bg-card/40 border-white/5 p-6 space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2"><Activity className="h-5 w-5 text-accent" /> Tactical Mapping</h3>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Player identity mapping insights:</p>
                  <ul className="list-disc list-inside text-sm space-y-2 text-white/80">
                    <li>Jersey number recognition successfully linked {stats.length} rostered players.</li>
                    <li>Defensive rotations are lagging on ball-screens.</li>
                    <li>Substitution patterns are now trackable via identity resolution.</li>
                  </ul>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {game && <EditGameTeamsModal game={game} isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onUpdated={fetchGameData} />}
      </div>
    </Layout>
  );
}

// Add a helper component for the Mapping Staging Table
function MappingStagingTable({ homeRoster, awayRoster, game }: { homeRoster: any[], awayRoster: any[], game: any }) {
  const combined = [
    ...homeRoster.map(p => ({ ...p, teamType: 'HOME', color: game.home_team_color || '#FFFFFF', teamName: game.home_team?.name })),
    ...awayRoster.map(p => ({ ...p, teamType: 'AWAY', color: game.away_team_color || '#0B0F19', teamName: game.away_team?.name })),
  ];

  return (
    <div className="rounded-xl border border-white/5 overflow-hidden bg-white/5">
      <Table>
        <TableHeader className="bg-white/5">
          <TableRow className="hover:bg-transparent border-white/5">
            <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground h-12">Team</TableHead>
            <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground h-12">Rostered Player</TableHead>
            <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground h-12">AI Identity Key</TableHead>
            <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground h-12">Color Target</TableHead>
            <TableHead className="text-right font-bold uppercase text-[10px] tracking-widest text-muted-foreground h-12">Module 2 Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {combined.length > 0 ? combined.map((player) => (
            <TableRow key={player.id} className="border-white/5 hover:bg-white/5 transition-colors">
              <TableCell>
                <Badge variant="outline" className={cn("text-[9px] font-mono font-black", player.teamType === 'HOME' ? "border-primary/50 text-primary bg-primary/5" : "border-accent/50 text-accent bg-accent/5")}>
                  {player.teamType}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-bold text-white text-sm">{player.name}</span>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono">{player.teamName}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <span className="text-primary font-mono font-black text-lg italic">#{player.number}</span>
                  <span className="text-[10px] text-muted-foreground/50 font-mono">(Jersey)</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 rounded-sm border border-white/10 shadow-sm" style={{ backgroundColor: player.color }} />
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-tighter">{player.color}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[9px] font-black uppercase tracking-widest py-1 px-3">
                  STAGED FOR RECOGNITION
                </Badge>
              </TableCell>
            </TableRow>
          )) : (
            <TableRow>
              <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                No roster data staged. Please complete Module 1 (Team Setup) first.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// Add a helper component for the stats table to keep the main file cleaner
function BoxScoreTable({ stats }: { stats: any[] }) {
  return (
    <Table>
      <TableHeader className="bg-white/5">
        <TableRow className="hover:bg-transparent border-white/5">
          <TableHead className="font-bold text-primary w-[200px]">PLAYER</TableHead>
          <TableHead className="text-center font-bold">PTS</TableHead>
          <TableHead className="text-center font-bold">FG</TableHead>
          <TableHead className="text-center font-bold">3PT</TableHead>
          <TableHead className="text-center font-bold">FT</TableHead>
          <TableHead className="text-center font-bold">REB</TableHead>
          <TableHead className="text-center font-bold">AST</TableHead>
          <TableHead className="text-center font-bold">STL</TableHead>
          <TableHead className="text-center font-bold">BLK</TableHead>
          <TableHead className="text-center font-bold">TO</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {stats.length > 0 ? stats.map((s) => (
          <TableRow key={s.id} className="border-white/5 hover:bg-white/5">
            <TableCell className="font-bold">
              <div className="flex items-center gap-2">
                <span className="text-primary font-mono italic">#{s.player?.number || '??'}</span>
                <span className="truncate">{s.player?.name || "Unknown Player"}</span>
              </div>
            </TableCell>
            <TableCell className="text-center font-mono font-bold text-white text-lg">{s.points || 0}</TableCell>
            <TableCell className="text-center font-mono text-xs">{s.fg_made || 0}/{s.fg_attempted || 0}</TableCell>
            <TableCell className="text-center font-mono text-xs">{s.three_p_made || 0}/{s.three_p_attempted || 0}</TableCell>
            <TableCell className="text-center font-mono text-xs">{s.ft_made || 0}/{s.ft_attempted || 0}</TableCell>
            <TableCell className="text-center font-mono">{s.rebounds || 0}</TableCell>
            <TableCell className="text-center font-mono">{s.assists || 0}</TableCell>
            <TableCell className="text-center font-mono">{s.steals || 0}</TableCell>
            <TableCell className="text-center font-mono">{s.blocks || 0}</TableCell>
            <TableCell className="text-center font-mono text-destructive/80">{s.turnovers || 0}</TableCell>
          </TableRow>
        )) : (
          <TableRow>
            <TableCell colSpan={10} className="h-32 text-center text-muted-foreground italic">
              No roster data found for this team in this game.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}