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
  HardDrive
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { storageService } from "@/services/storageService";
import { MappingDashboard } from "@/components/MappingDashboard";
import { showBanner } from "@/components/DiagnosticBanner";
import { workflowService } from "@/services/workflowService";
import { WorkerLogs } from "@/components/WorkerLogs";
import axios from "axios";

const MODULES = [
  { id: 'm1', label: 'Calibration', icon: ShieldCheck, desc: '8GB Payload Verification' },
  { id: 'm2', label: 'GPU Swarm', icon: Cpu, desc: 'Cluster Ignition & Handshake' },
  { id: 'm3', label: 'Analysis', icon: Zap, desc: 'Stream-Processing Stream' },
  { id: 'm4', label: 'Mapping', icon: Terminal, desc: 'Data Finalization & Locking' }
];

export default function GameDetailPage() {
  const router = useRouter();
  const { id: rawId } = router.query;
  const gameId = Array.isArray(rawId) ? rawId[0] : rawId;
  
  const [game, setGame] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("m1");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);

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
      showBanner(`Initiating Phase ${phase}...`, "info", "SYSTEM HANDSHAKE");
      
      if (phase === "m2") {
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
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black tracking-widest py-1 px-3 italic">ELITE SCOUT ANALYTICS ACTIVE</Badge>
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
            const isCompleted = idx < MODULES.findIndex(m => m.id === activeTab);
            return (
              <button
                key={mod.id}
                onClick={() => setActiveTab(mod.id)}
                className={cn(
                  "p-6 rounded-2xl border transition-all text-left relative overflow-hidden group",
                  isActive ? "bg-primary border-primary shadow-lg shadow-primary/20 scale-105 z-10" : 
                  isCompleted ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                  "bg-card/40 border-white/5 text-muted-foreground hover:border-white/20"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <mod.icon className={cn("h-5 w-5", isActive ? "text-white" : isCompleted ? "text-emerald-500" : "text-zinc-500")} />
                  {isCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
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
            <Card className="bg-card/40 border-white/5 p-12 min-h-[400px] flex flex-col items-center justify-center text-center space-y-8">
              {activeTab === 'm1' && (
                <>
                  <HardDrive className="h-16 w-16 text-primary animate-pulse" />
                  <div className="space-y-4">
                    <h3 className="text-2xl font-black uppercase tracking-tighter text-white">Payload Synchronization</h3>
                    <p className="text-sm text-muted-foreground font-mono max-w-md mx-auto">Verifying 8GB source integrity on R2 cluster. This is a deterministic manual gate.</p>
                  </div>
                  <Button 
                    onClick={() => handleInitiatePhase("m2")}
                    disabled={isProcessing}
                    className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest italic h-16 px-12 rounded-2xl shadow-xl shadow-primary/20"
                  >
                    {isProcessing ? "Verifying..." : "Lock & Initiate Ignition"}
                  </Button>
                </>
              )}
              {activeTab === 'm2' && (
                <>
                  <Cpu className="h-16 w-16 text-accent animate-spin-slow" />
                  <div className="space-y-4">
                    <h3 className="text-2xl font-black uppercase tracking-tighter text-white">GPU Swarm Ignition</h3>
                    <p className="text-sm text-muted-foreground font-mono max-w-md mx-auto">Establishing stateless handshake with A10G cluster. Status: {game?.status || 'Waiting'}</p>
                  </div>
                  <Progress value={game?.progress_percentage || 0} className="w-full max-w-md h-2 bg-white/5" />
                </>
              )}
              {/* Other modules would follow the same pattern */}
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