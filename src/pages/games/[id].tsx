import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  CheckCircle2, 
  Zap, 
  RefreshCw, 
  ShieldCheck,
  Terminal,
  Wifi,
  WifiOff,
  Calendar,
  MapPin,
  Trophy,
  Activity,
  Cpu,
  Lock,
  ChevronRight,
  HardDrive,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MappingDashboard } from "@/components/MappingDashboard";
import { showBanner } from "@/components/DiagnosticBanner";
import { workflowService } from "@/services/workflowService";
import { WorkerLogs } from "@/components/WorkerLogs";
import axios from "axios";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const MODULES = [
  { id: 'm1', label: 'Calibration', icon: ShieldCheck, desc: 'Asset Verification', key: 'm1_complete' },
  { id: 'm2', label: 'GPU Swarm', icon: Cpu, desc: 'Cluster Ignition', key: 'm2_complete' },
  { id: 'm3', label: 'Analysis', icon: Zap, desc: 'Stream Processing', key: 'm3_complete' },
  { id: 'm4', label: 'Mapping', icon: Terminal, desc: 'Finalization', key: null }
];

export default function GameDetailPage() {
  const router = useRouter();
  const { id: rawId } = router.query;
  const gameId = Array.isArray(rawId) ? rawId[0] : rawId;
  
  const [game, setGame] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("m1");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [aiMappings, setAiMappings] = useState<any[]>([]);
  const [homeRoster, setHomeRoster] = useState<any[]>([]);
  const [awayRoster, setAwayRoster] = useState<any[]>([]);

  const fetchGameData = useCallback(async () => {
    if (!gameId) return;
    try {
      const { data, error } = await supabase
        .from("games")
        .select(`*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*), venue:venues(*)`)
        .eq("id", gameId)
        .single();
      if (error) throw error;
      setGame(data);

      // Fetch AI Mappings for Module 4
      const { data: mappings } = await supabase
        .from('ai_player_mappings')
        .select('*, players(*)')
        .eq('game_id', gameId);
      setAiMappings(mappings || []);

      // Fetch Rosters
      if (data.home_team_id && data.away_team_id) {
        const { data: homePlayers } = await supabase.from('players').select('*').eq('team_id', data.home_team_id);
        const { data: awayPlayers } = await supabase.from('players').select('*').eq('team_id', data.away_team_id);
        setHomeRoster(homePlayers || []);
        setAwayRoster(awayPlayers || []);
      }
    } catch (err) {
      console.error("Error fetching game:", err);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    fetchGameData();
    if (!gameId) return;

    const channel = supabase
      .channel(`tactical_pulse_${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
        setGame(payload.new as any);
      })
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED');
      });

    return () => { supabase.removeChannel(channel); };
  }, [gameId, fetchGameData]);

  const handleInitiatePhase = async (phase: string) => {
    if (!gameId) return;
    setIsProcessing(true);
    try {
      if (phase === "m2") {
        showBanner("Establishing GPU Cluster Handshake...", "info", "IGNITION START");
        await axios.post('/api/process-game', { gameId });
        await workflowService.advanceModule(gameId as string, 'ignited');
        showBanner("GPU Cluster Ignited. 1-Hour Stream Active.", "success", "PHASE 02 COMPLETE");
        setActiveTab("m2");
      }
      if (phase === "m3") {
        await workflowService.advanceModule(gameId as string, 'analyzing');
        setActiveTab("m3");
      }
      if (phase === "m4") {
        setActiveTab("m4");
      }
      await fetchGameData();
    } catch (err: any) {
      showBanner(err.message || "Phase Initiation Failed", "error", "HARD STALL");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyModule = async (moduleId: string, isComplete: boolean) => {
    if (!gameId) return;
    setIsVerifying(true);
    const mod = MODULES.find(m => m.id === moduleId);
    if (!mod || !mod.key) return;

    try {
      const { error } = await supabase
        .from('games')
        .update({ [mod.key]: isComplete })
        .eq('id', gameId);

      if (error) throw error;
      await fetchGameData();
      showBanner(`${mod.label} status updated`, "success");
      
      // Auto-advance to next tab if verified
      if (isComplete) {
        const nextIdx = MODULES.findIndex(m => m.id === moduleId) + 1;
        if (nextIdx < MODULES.length) {
          setActiveTab(MODULES[nextIdx].id);
        }
      }
    } catch (err: any) {
      showBanner("Verification failed", "error");
    } finally {
      setIsVerifying(false);
    }
  };

  const isModuleLocked = (moduleId: string) => {
    const idx = MODULES.findIndex(m => m.id === moduleId);
    if (idx === 0) return false;
    const prevMod = MODULES[idx - 1];
    if (!prevMod.key) return false;
    return !game?.[prevMod.key];
  };

  if (loading) return <Layout><div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div></Layout>;

  return (
    <Layout title={`${game?.home_team?.name || 'Game'} vs ${game?.away_team?.name || 'Game'}`}>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        
        {/* Tactical Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 rounded-3xl bg-card/50 border border-primary/20 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
             <div className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black tracking-widest border transition-all",
              isRealtimeActive ? "bg-accent/10 text-accent border-accent/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
            )}>
              {isRealtimeActive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isRealtimeActive ? "ENCRYPTED CHANNEL" : "RECONNECTING"}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black tracking-widest py-1 px-3 italic uppercase">
                {game?.status || 'SCOUT SESSION PENDING'}
              </Badge>
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
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-1">Pulse Depth</p>
                <p className="text-3xl font-black text-primary italic leading-none">{game?.progress_percentage || 0}%</p>
             </div>
          </div>
        </div>

        {/* Deterministic Pipeline Stepper */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {MODULES.map((mod, idx) => {
            const isActive = activeTab === mod.id;
            const isCompleted = mod.key ? game?.[mod.key] : false;
            const isLocked = isModuleLocked(mod.id);
            
            return (
              <button
                key={mod.id}
                disabled={isLocked}
                onClick={() => setActiveTab(mod.id)}
                className={cn(
                  "p-6 rounded-2xl border transition-all text-left relative overflow-hidden group",
                  isActive ? "bg-primary border-primary shadow-lg shadow-primary/20 scale-105 z-10" : 
                  isCompleted ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                  isLocked ? "bg-white/5 border-white/5 opacity-50 cursor-not-allowed" :
                  "bg-card/40 border-white/5 text-muted-foreground hover:border-white/20"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <mod.icon className={cn("h-5 w-5", isActive ? "text-white" : isCompleted ? "text-emerald-500" : isLocked ? "text-zinc-700" : "text-zinc-500")} />
                  {isCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {isLocked && <Lock className="h-3 w-3 text-zinc-600" />}
                </div>
                <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", isActive ? "text-white/70" : "text-muted-foreground")}>Module 0{idx + 1}</p>
                <p className={cn("text-sm font-black uppercase tracking-tighter italic", isActive ? "text-white" : "text-white")}>{mod.label}</p>
                <p className={cn("text-[10px] font-mono mt-2", isActive ? "text-white/60" : "text-muted-foreground/50")}>{mod.desc}</p>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Module Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card/40 border-white/5 p-8 min-h-[500px] flex flex-col relative overflow-hidden">
              {/* Tactical Progress Guard */}
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                {activeTab === 'm1' && (
                  <div className="space-y-8 animate-in fade-in zoom-in duration-500">
                    <HardDrive className="h-16 w-16 text-primary animate-pulse mx-auto" />
                    <div className="space-y-4">
                      <h3 className="text-2xl font-black uppercase tracking-tighter text-white">Asset Verification & Calibration</h3>
                      <p className="text-sm text-muted-foreground font-mono max-w-md mx-auto">Video payload secured in R2. Verify team identity and color calibration before ignition.</p>
                    </div>
                    <Button 
                      onClick={() => handleInitiatePhase("m2")}
                      disabled={isProcessing || game?.status === 'analyzing' || game?.status === 'completed'}
                      className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest italic h-16 px-12 rounded-2xl shadow-xl shadow-primary/20"
                    >
                      {isProcessing ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : "Ignite AI Analysis"}
                    </Button>
                  </div>
                )}

                {activeTab === 'm2' && (
                  <div className="space-y-8 animate-in fade-in zoom-in duration-500">
                    <Cpu className="h-16 w-16 text-accent animate-spin-slow mx-auto" />
                    <div className="space-y-4">
                      <h3 className="text-2xl font-black uppercase tracking-tighter text-white">GPU Swarm Ignition</h3>
                      <p className="text-sm text-muted-foreground font-mono max-w-md mx-auto">Stateless Handshake Established. Cluster A10G warming up.</p>
                    </div>
                    <Button 
                      onClick={() => handleInitiatePhase("m3")}
                      disabled={isProcessing}
                      className="bg-accent hover:bg-accent/90 text-black font-black uppercase tracking-widest italic h-16 px-12 rounded-2xl"
                    >
                      Start Real-Time Analysis Stream
                    </Button>
                  </div>
                )}

                {activeTab === 'm3' && (
                  <div className="w-full space-y-8 animate-in fade-in zoom-in duration-500">
                     <div className="flex items-center justify-between">
                        <div className="text-left">
                          <h3 className="text-2xl font-black uppercase tracking-tighter text-white italic">Analysis Stream active</h3>
                          <p className="text-xs text-muted-foreground font-mono">Stream-Processing 1-Hour Footage Pulse</p>
                        </div>
                        <Badge className="bg-primary text-white font-black italic">GPU ACTIVE</Badge>
                     </div>
                     <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                          <span className="text-muted-foreground">Pulse Depth</span>
                          <span className="text-primary">{game?.progress_percentage || 0}%</span>
                        </div>
                        <Progress value={game?.progress_percentage || 0} className="h-2 bg-white/5" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/5 text-left">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Detections</p>
                          <p className="text-3xl font-black text-white italic">{game?.total_detections || 0}</p>
                        </div>
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/5 text-left">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Event Density</p>
                          <p className="text-3xl font-black text-accent italic">HIGH</p>
                        </div>
                     </div>
                     <Button 
                      onClick={() => handleInitiatePhase("m4")}
                      className="w-full bg-white text-black font-black uppercase tracking-widest italic h-14 rounded-2xl"
                    >
                      Enter Mapping Engine
                    </Button>
                  </div>
                )}

                {activeTab === 'm4' && (
                  <div className="w-full animate-in fade-in zoom-in duration-500">
                    <MappingDashboard 
                      gameId={gameId as string}
                      aiMappings={aiMappings}
                      homeRoster={homeRoster}
                      awayRoster={awayRoster}
                      homeColor={game?.home_team_color}
                      awayColor={game?.away_team_color}
                      onRefresh={fetchGameData}
                    />
                  </div>
                )}
              </div>

              {/* Verification Footer */}
              {activeTab !== 'm4' && (
                <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Checkbox 
                      id={`verify-${activeTab}`}
                      checked={game?.[MODULES.find(m => m.id === activeTab)?.key || '']}
                      onCheckedChange={(checked) => handleVerifyModule(activeTab, checked as boolean)}
                      disabled={isVerifying}
                      className="h-6 w-6 border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                    />
                    <Label htmlFor={`verify-${activeTab}`} className="text-xs font-black uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-white transition-colors">
                      Verify Module 0{MODULES.findIndex(m => m.id === activeTab) + 1} as Complete
                    </Label>
                  </div>
                  {isVerifying && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                </div>
              )}
            </Card>
          </div>

          {/* Persistent Technical Trace Sidebar */}
          <div className="lg:col-span-1 h-[600px]">
            <WorkerLogs gameId={gameId as string} />
          </div>
        </div>
      </div>
    </Layout>
  );
}