import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle2, 
  Zap, 
  ChevronRight, 
  RefreshCw, 
  ShieldCheck,
  HardDrive,
  Terminal,
  Wifi,
  WifiOff,
  Calendar,
  MapPin,
  Trophy,
  Activity,
  Cpu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { storageService } from "@/services/storageService";
import { MappingDashboard } from "@/components/MappingDashboard";
import { showBanner } from "@/components/DiagnosticBanner";
import { workflowService } from "@/services/workflowService";

const STATUS_CONFIG: Record<string, { label: string; color: string; desc: string }> = {
  'pending': { label: 'Queued', color: 'text-zinc-400', desc: 'Awaiting cluster provisioning.' },
  'ignited': { label: 'Ignited', color: 'text-blue-400', desc: 'GPU Handshake verified. Streaming...' },
  'analyzing': { label: 'Processing', color: 'text-orange-400', desc: 'AI discovery swarm active.' },
  'completed': { label: 'Locked', color: 'text-emerald-400', desc: 'Analysis data finalized.' },
  'error': { label: 'Stall', color: 'text-red-400', desc: 'Handshake timeout. Check Modal.' }
};

export default function GameDetailPage() {
  const router = useRouter();
  const { id: rawId } = router.query;
  const gameId = Array.isArray(rawId) ? rawId[0] : rawId;
  
  const [game, setGame] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("m1");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [aiMappings, setAiMappings] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchGameData = useCallback(async () => {
    if (!gameId) return;
    
    try {
      const { data: gameData, error } = await supabase
        .from("games")
        .select(`*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*), venue:venues(*)`)
        .eq("id", gameId)
        .single();

      if (error) throw error;
      setGame(gameData);
      
      const { data: mappings } = await supabase
        .from('ai_player_mappings')
        .select('*, player:players(*)')
        .eq('game_id', gameId);
      
      setAiMappings(mappings || []);

      if (gameData?.video_path && !videoUrl) {
        const url = await storageService.getSignedUrl(gameData.video_path);
        setVideoUrl(url);
      }
    } catch (err) {
      console.error("Error fetching game:", err);
    } finally {
      setLoading(false);
    }
  }, [gameId, videoUrl]);

  const handleInitiatePhase = async (phase: string) => {
    if (!gameId) return;
    setIsProcessing(true);
    try {
      showBanner(`Initiating Phase ${phase}...`, "info", "SYSTEM HANDSHAKE");
      
      if (phase === "m2") {
        // Explicit manual trigger for GPU ignition
        await axios.post('/api/process-game', { gameId });
        await workflowService.advanceModule(gameId as string, 'ignited');
        showBanner("GPU Cluster Ignited. Streaming active.", "success", "PHASE 02 START");
      }
      
      await fetchGameData();
    } catch (err: any) {
      showBanner(err.message || "Phase Initiation Failed", "error", "HARD STALL");
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    fetchGameData();

    if (!gameId) return;

    const channel = supabase
      .channel(`tactical_pulse_${gameId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'games',
        filter: `id=eq.${gameId}` 
      }, (payload) => {
        setGame(payload.new as any);
      })
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED');
      });

    return () => { supabase.removeChannel(channel); };
  }, [gameId, fetchGameData]);

  if (loading) return <Layout><div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div></Layout>;

  const config = STATUS_CONFIG[game?.status] || STATUS_CONFIG.pending;

  return (
    <Layout title={`${game?.home_team?.name || 'Game'} vs ${game?.away_team?.name || 'Game'}`}>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        
        {/* Elite Tactical Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 rounded-3xl bg-card/50 border border-primary/20 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black tracking-widest border transition-all",
              isRealtimeActive ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
            )}>
              {isRealtimeActive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isRealtimeActive ? "SYNCED" : "RECONNECTING"}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black tracking-widest py-1 px-3">ELITE ANALYTICS ACTIVE</Badge>
              {game?.status === 'analyzing' && <Activity className="h-4 w-4 text-primary animate-pulse" />}
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic">
              {game?.home_team?.name || "Home"} <span className="text-primary not-italic">vs</span> {game?.away_team?.name || "Away"}
            </h1>
            <div className="flex items-center gap-6 text-xs text-muted-foreground font-mono font-bold uppercase tracking-widest">
              <span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> {game?.date ? new Date(game.date).toLocaleDateString() : 'TBD'}</span>
              <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-accent" /> {game?.venue?.name || 'GENERIC STADIUM'}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="text-right">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-1">Scouting Status</p>
              <p className={cn("text-2xl font-black uppercase tracking-tighter", config.color)}>{config.label}</p>
            </div>
            <Button variant="outline" className="h-12 px-6 border-white/10 hover:bg-white/5 font-bold uppercase tracking-widest text-[10px]">
              <Trophy className="h-4 w-4 mr-2 text-primary" /> Recalibrate Roster
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-card/40 border border-white/5 p-1 h-auto grid grid-cols-1 md:grid-cols-3 gap-2 mb-8">
            <TabsTrigger value="m1" className="data-[state=active]:bg-primary h-14 font-black uppercase tracking-widest text-[10px]">
              <ShieldCheck className="h-4 w-4 mr-2" /> 01: Calibration
            </TabsTrigger>
            <TabsTrigger value="m2" className="data-[state=active]:bg-primary h-14 font-black uppercase tracking-widest text-[10px]">
              <Zap className="h-4 w-4 mr-2" /> 02: GPU Swarm
            </TabsTrigger>
            <TabsTrigger value="m3" className="data-[state=active]:bg-primary h-14 font-black uppercase tracking-widest text-[10px]">
              <Terminal className="h-4 w-4 mr-2" /> 03: Mapping
            </TabsTrigger>
          </TabsList>

          <TabsContent value="m1" className="space-y-6">
             <Card className="bg-card/40 border-white/5 p-12 text-center space-y-6">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                <h3 className="text-2xl font-black uppercase tracking-tighter text-white">Baseline Verified</h3>
                <p className="text-sm text-muted-foreground font-mono max-w-md mx-auto">Ready for GPU Cluster Injection. No auto-triggering active.</p>
                <Button 
                  onClick={() => handleInitiatePhase("m2")} 
                  disabled={isProcessing || game?.status === 'analyzing' || game?.status === 'completed'}
                  className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest italic h-14 px-8 rounded-xl"
                >
                  {isProcessing ? "Igniting..." : "Initiate GPU Swarm (Module 02)"}
                </Button>
             </Card>
          </TabsContent>

          <TabsContent value="m2">
            <Card className="bg-card/40 border-white/5 p-8 space-y-8 overflow-hidden relative">
              <div className="flex items-center justify-between relative z-10">
                <div className="space-y-1">
                  <h3 className="text-xl font-black uppercase tracking-tighter text-white flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-primary" /> GPU Swarm Monitor
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">{config.desc}</p>
                </div>
                <div className="text-right">
                  <span className="text-4xl font-black text-primary italic leading-none">{game?.progress_percentage || 0}%</span>
                </div>
              </div>

              <div className="space-y-4 relative z-10">
                <Progress value={game?.progress_percentage || 0} className="h-2 bg-white/5" />
                <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                  <span>Inference Active: A10G INFUSION</span>
                  <span>{game?.progress_percentage < 100 ? "Analyzing Stream..." : "Data Locked"}</span>
                </div>
              </div>

              <div className="p-6 rounded-2xl border border-white/5 bg-black/40 space-y-4 relative z-10">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-b border-white/5 pb-4">
                  <Terminal className="h-4 w-4" /> Technical Trace
                </div>
                <div className="h-48 overflow-y-auto font-mono text-[11px] space-y-2 custom-scrollbar">
                  {game?.status === 'ignited' && <div className="text-blue-400">📡 SYSTEM: Handshake Verified. GPU cluster ignited.</div>}
                  {game?.status === 'analyzing' && <div className="text-orange-400 animate-pulse">🛰️ STREAM: Streaming 8GB source... Pulse 1 active.</div>}
                  {game?.status === 'completed' && <div className="text-emerald-400 font-bold">✅ SUCCESS: Scouting swarm complete. Data normalized.</div>}
                  {!game?.status && <div className="text-muted-foreground/30 italic">Awaiting handshake pulse...</div>}
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="m3">
            {game?.status !== 'completed' && (
              <div className="p-12 text-center space-y-4 border border-dashed border-white/10 rounded-3xl">
                <Activity className="h-12 w-12 text-muted-foreground/20 mx-auto" />
                <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest">Awaiting Data Lock</p>
              </div>
            )}
            {game?.status === 'completed' && gameId && (
              <MappingDashboard 
                gameId={gameId as string} 
                aiMappings={aiMappings} 
                homeRoster={[]} 
                awayRoster={[]} 
                homeColor={game.home_team_color}
                awayColor={game.away_team_color}
                onRefresh={fetchGameData} 
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}