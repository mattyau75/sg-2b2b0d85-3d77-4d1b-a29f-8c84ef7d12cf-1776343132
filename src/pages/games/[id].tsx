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
  Users,
  Sparkles,
  Wifi,
  WifiOff,
  Trophy
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { storageService } from "@/services/storageService";
import { WorkerLogs, type LogEntry } from "@/components/WorkerLogs";
import { EditGameTeamsModal } from "@/components/EditGameTeamsModal";
import axios from "axios";
import { MappingDashboard } from "@/components/MappingDashboard";

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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("recognition");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [homeRoster, setHomeRoster] = useState<any[]>([]);
  const [awayRoster, setAwayRoster] = useState<any[]>([]);
  const [aiMappings, setAiMappings] = useState<any[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [workerLogs, setWorkerLogs] = useState<LogEntry[]>([]);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);

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
        .select(`*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)`)
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;
      setGame(gameData);
      
      const metadata = gameData.processing_metadata as any;
      setWorkerLogs(metadata?.worker_logs || []);

      const { data: mappingsData } = await supabase
        .from('ai_player_mappings')
        .select('*, player:players(*)')
        .eq('game_id', gameId);
      
      setAiMappings(mappingsData || []);

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

  useEffect(() => {
    if (!gameId || !isValidUUID(gameId)) return;

    const channel = supabase
      .channel(`game-analysis-${gameId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
        const newGameData = payload.new;
        setGame(prev => ({ ...prev, ...newGameData }));
        const metadata = newGameData.processing_metadata as any;
        if (metadata?.worker_logs) setWorkerLogs(metadata.worker_logs);
        if (newGameData.status === 'completed' || newGameData.status === 'error') fetchGameData(false);
      })
      .subscribe((status) => setIsRealtimeActive(status === 'SUBSCRIBED'));

    return () => { supabase.removeChannel(channel); };
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
      await fetchGameData(true);
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
      await supabase.from('games').update({ status: null, progress_percentage: 0, last_error: null, ignition_status: null }).eq('id', gameId);
      toast({ title: "Analysis Cancelled", description: "GPU Swarm halted." });
      await fetchGameData(true);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Reset Failed", description: error.message });
    } finally {
      setResetting(false);
    }
  };

  if (loading) return <Layout><div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div></Layout>;

  return (
    <Layout title={`${game?.home_team?.name || 'Game'} vs ${game?.away_team?.name || 'Game'}`}>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-2xl bg-card/50 border border-primary/20 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2">
            <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-mono border", isRealtimeActive ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20")}>
              {isRealtimeActive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isRealtimeActive ? "LIVE SYNC" : "CONNECTING..."}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 uppercase font-mono text-[10px]">ELITE DISCOVERY ACTIVE</Badge>
              <h1 className="text-4xl font-extrabold tracking-tighter text-white">{game?.home_team?.name || "Home"} <span className="text-primary italic">vs</span> {game?.away_team?.name || "Away"}</h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
              <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-primary" /> {game?.date ? new Date(game.date).toLocaleDateString() : 'Date'}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-accent" /> {game?.venue || 'Stadium'}</span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="bg-background border-primary/20" onClick={() => setIsEditModalOpen(true)}><Settings2 className="h-4 w-4 mr-2 text-primary" /> EDIT SETUP</Button>
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
                <h3 className="text-lg font-bold flex items-center gap-2 font-mono"><Trophy className="h-5 w-5 text-primary" /> SCOUTING CORE</h3>
              </div>
              <CardContent className="p-8 flex flex-col justify-center items-center h-[calc(100%-70px)] text-center">
                <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Elite Discovery Engine</div>
                <div className="text-xs text-muted-foreground max-w-[200px]">Perform deep roster mapping and personnel analysis using GPU-accelerated vision.</div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-card/40 border border-white/5 p-1 h-auto grid grid-cols-1 gap-2 mb-8">
            <TabsTrigger value="recognition" className="data-[state=active]:bg-primary h-12 font-bold"><Users className="h-4 w-4 mr-2" /> Identity Mapping</TabsTrigger>
          </TabsList>

          <TabsContent value="recognition">
            <Card className="bg-card/40 border-white/5 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> AI Identity Mapping</h3>
                  <p className="text-sm text-muted-foreground">Module 2: Verify and map identities to rostered players.</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={handleStartMapping} disabled={analyzing || (isCurrentlyProcessing && !game.last_error) || !isRosterPrepopulated} className={cn("font-bold h-10 px-8 uppercase tracking-tighter", isRosterPrepopulated ? "bg-primary" : "bg-muted")}>
                    {(analyzing || (isCurrentlyProcessing && !game.last_error)) ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    {(analyzing || (isCurrentlyProcessing && !game.last_error)) ? "ANALYSIS ACTIVE" : "ANALYZE GAME"}
                  </Button>
                  {isCurrentlyProcessing && !game.last_error && <Button variant="outline" onClick={handleResetAnalysis} disabled={resetting} className="text-destructive h-10 font-bold uppercase tracking-tighter">CANCEL</Button>}
                </div>
              </div>

              {(isCurrentlyProcessing || game?.status === 'error') && (
                <div className="space-y-4 p-6 rounded-xl bg-primary/5 border border-primary/10">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="flex items-center gap-2 text-primary font-bold uppercase">{game?.status === 'error' ? 'HALTED' : 'GPU ACTIVE'}</span>
                    <span className="flex items-center gap-2">{game?.progress_percentage || 0}% COMPLETE</span>
                  </div>
                  <Progress value={game?.progress_percentage || 0} className="h-2" />
                  <div className="pt-4"><WorkerLogs logs={workerLogs} /></div>
                </div>
              )}

              {!isRosterPrepopulated ? (
                <div className="p-12 text-center rounded-xl border border-dashed border-white/10">
                  <p className="text-sm text-muted-foreground mb-4">Module 1 Setup Required: Please save Team Metadata first.</p>
                  <Button variant="outline" onClick={() => setIsEditModalOpen(true)}><Settings2 className="h-4 w-4 mr-2" /> OPEN SETUP</Button>
                </div>
              ) : (
                <MappingDashboard gameId={game.id} aiMappings={aiMappings} homeRoster={homeRoster} awayRoster={awayRoster} onRefresh={() => fetchGameData(true)} />
              )}
            </Card>
          </TabsContent>
        </Tabs>

        {game && <EditGameTeamsModal game={game} isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onUpdated={fetchGameData} />}
      </div>
    </Layout>
  );
}