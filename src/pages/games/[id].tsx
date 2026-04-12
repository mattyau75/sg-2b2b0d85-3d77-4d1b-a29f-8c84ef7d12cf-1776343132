import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle2, 
  Activity, 
  Sparkles, 
  Cpu, 
  Zap, 
  ChevronRight, 
  RefreshCw, 
  X, 
  ShieldCheck,
  Globe,
  Database,
  Terminal,
  AlertTriangle,
  Fingerprint,
  Lock as LockIcon,
  Wifi,
  WifiOff,
  Calendar,
  MapPin,
  Settings2,
  Trophy,
  Video
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { storageService } from "@/services/storageService";
import { WorkerLogs, type LogEntry } from "@/components/WorkerLogs";
import { EditGameTeamsModal } from "@/components/EditGameTeamsModal";
import { DiagnosticBanner, type BannerSeverity, showBanner } from "@/components/DiagnosticBanner";
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
  
  const [game, setGame] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("m1");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [homeRoster, setHomeRoster] = useState<any[]>([]);
  const [awayRoster, setAwayRoster] = useState<any[]>([]);
  const [aiMappings, setAiMappings] = useState<any[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isWarming, setIsWarming] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [manualStartRequested, setManualStartRequested] = useState(false);
  const [provisioningTimeout, setProvisioningTimeout] = useState<NodeJS.Timeout | null>(null);
  const [workerLogs, setWorkerLogs] = useState<LogEntry[]>([]);
  const isCurrentlyProcessing = game?.status === 'processing' || game?.status === 'analyzing';
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  
  // Diagnostic Banner State (Local override for specific GPU errors)
  const [banner, setBanner] = useState<{ title: string; message: string; severity: BannerSeverity } | null>(null);

  const fetchGameData = useCallback(async (isUpdate = false) => {
    if (!gameId || !isValidUUID(gameId)) {
      if (!isUpdate) setLoading(false);
      return;
    }
    
    try {
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select(`*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*), venue:venues(*)`)
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

  const handleStartDiscovery = async (isDryRun: boolean = false) => {
    if (!gameId || !game) return;
    
    setManualStartRequested(true);
    setAnalyzing(true);
    setIsWarming(true);
    setBanner(null);

    if (provisioningTimeout) clearTimeout(provisioningTimeout);

    const timeout = setTimeout(() => {
      if (game?.progress_percentage === 10) {
        setBanner({
          title: "Provisioning Bottleneck Detected",
          message: "The GPU Swarm is active but the App has not received a heartbeat. Please verify that SUPABASE_SERVICE_ROLE_KEY is correctly added to your Modal.com Secrets.",
          severity: "warning"
        });
      }
    }, 45000);
    setProvisioningTimeout(timeout);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      setBanner({
        title: "Cluster Cold-Start Detected",
        message: "GPU resources are still warming up. Connection is established, awaiting telemetry. This typically takes 30-60s on first ignition.",
        severity: "info"
      });
    }, 5000);

    try {
      const response = await fetch('/api/process-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          game_id: gameId, 
          video_path: game.video_path, 
          dry_run: isDryRun
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        showBanner("GPU cluster is now processing your footage.", "success", "AI Swarm Ignited");
        await fetchGameData(true);
      } else {
        const errorData = await response.json();
        setBanner({
          title: "Handshake Failed",
          message: errorData.message || "Failed to establish GPU connection. Please verify your SUPABASE_SERVICE_ROLE_KEY in Modal Secrets.",
          severity: "error"
        });
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        setBanner({
          title: "Connection Timeout",
          message: "The GPU swarm took too long to respond. The cluster may be experiencing high load or a cold-start delay. Please try again in 30 seconds.",
          severity: "warning"
        });
      } else {
        setBanner({
          title: "System Error",
          message: error.message || "An unexpected error occurred during ignition. Check the Technical Trace below for details.",
          severity: "error"
        });
      }
    } finally {
      setAnalyzing(false);
      setIsWarming(false);
    }
  };

  const handleResetAnalysis = async () => {
    if (!gameId) return;
    setResetting(true);
    setBanner(null);
    setAnalyzing(false);
    
    try {
      const response = await fetch('/api/reset-game-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to reset analysis state");
      }

      showBanner("All system states cleared. Bottleneck resolved.", "success", "Swarm Reset Complete");
      await fetchGameData(true);
      setBanner(null);
    } catch (error: any) {
      showBanner(error.message, "error", "Reset Failed");
    } finally {
      setResetting(false);
    }
  };

  const handleCancelAnalysis = async () => {
    if (!gameId) return;
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from('games')
        .update({
          status: 'scheduled',
          last_error: 'Analysis cancelled by user.',
          progress_percentage: 0,
          ignition_status: 'cancelled',
          processing_metadata: { 
            ...(game?.processing_metadata || {}), 
            worker_logs: [],
            last_heartbeat: null
          }
        } as any)
        .eq('id', gameId);

      if (error) throw error;
      setAnalyzing(false);
      setIsWarming(false);
      showBanner("GPU analysis cancelled and state reset.", "warning", "Swarm Decommissioned");
      await fetchGameData(true);
    } catch (error: any) {
      showBanner(error.message, "error", "Cancellation Failed");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCompleteModule = async (moduleId: number) => {
    if (!gameId) return;
    const updateKey = `m${moduleId}_complete`;
    try {
      const updateData = { [updateKey]: true } as any;
      const { error } = await supabase.from('games').update(updateData).eq('id', gameId);
      if (error) throw error;
      showBanner("Elite workflow advanced.", "success", `Module ${moduleId} Complete`);
      await fetchGameData(true);
    } catch (error: any) {
      showBanner(error.message, "error", "Update Failed");
    }
  };

  const ModuleLocked = ({ moduleNum, requiredModule }: { moduleNum: number, requiredModule: string }) => (
    <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 border border-dashed border-white/10 rounded-2xl bg-black/20">
      <div className="h-16 w-16 rounded-full bg-muted/20 flex items-center justify-center">
        <LockIcon className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-white uppercase tracking-tight">Module {moduleNum} Locked</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Personnel Discovery requires high-precision calibration. Please complete <span className="text-primary font-bold">{requiredModule}</span> to proceed.
        </p>
      </div>
      <Button variant="outline" onClick={() => setActiveTab(`m${moduleNum-1}`)} className="bg-background border-primary/20">
        Return to Module {moduleNum-1} <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );

  if (loading) return <Layout><div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div></Layout>;

  return (
    <Layout title={`${game?.home_team?.name || 'Game'} vs ${game?.away_team?.name || 'Game'}`}>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Elite Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-2xl bg-card/50 border border-primary/20 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2">
            <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-mono border", isRealtimeActive ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20")}>
              {isRealtimeActive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isRealtimeActive ? "LIVE SYNC" : "CONNECTING..."}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 uppercase font-mono text-[10px]">ELITE WORKFLOW ACTIVE</Badge>
              <h1 className="text-4xl font-extrabold tracking-tighter text-white">{game?.home_team?.name || "Home"} <span className="text-primary italic">vs</span> {game?.away_team?.name || "Away"}</h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
              <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-primary" /> {game?.date ? new Date(game.date).toLocaleDateString() : 'Date'}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-accent" /> {game?.venue?.name || 'Stadium'}</span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="bg-background border-primary/20" onClick={() => setIsEditModalOpen(true)}><Settings2 className="h-4 w-4 mr-2 text-primary" /> EDIT GAME & RE-CALIBRATE</Button>
          </div>
        </div>

        {/* Tactical Video Monitor */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/5 bg-black ring-1 ring-white/10">
              {videoUrl && <VideoPlayer url={videoUrl} className="w-full h-full" />}
            </div>
          </div>
          <div className="lg:col-span-4">
            <Card className="bg-card/40 border-white/5 h-full overflow-hidden flex flex-col">
              <div className="p-6 border-b border-white/5 bg-gradient-to-br from-primary/5 to-transparent">
                <h3 className="text-lg font-bold flex items-center gap-2 font-mono"><Trophy className="h-5 w-5 text-primary" /> PROGRESS TRACKER</h3>
              </div>
              <CardContent className="p-6 flex-1 space-y-6">
                {[
                  { id: 1, label: "Calibration", complete: game?.m1_complete, icon: Settings2 },
                  { id: 2, label: "Discovery Swarm", complete: game?.m2_complete, icon: Zap },
                  { id: 3, label: "Mapping Engine", complete: game?.status === 'completed', icon: Fingerprint },
                ].map((mod) => (
                  <div key={mod.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", mod.complete ? "bg-emerald-500/20" : "bg-muted/20")}>
                        <mod.icon className={cn("h-4 w-4", mod.complete ? "text-emerald-500" : "text-muted-foreground")} />
                      </div>
                      <span className={cn("text-xs font-bold uppercase tracking-widest", mod.complete ? "text-white" : "text-muted-foreground")}>Step {mod.id}: {mod.label}</span>
                    </div>
                    {mod.complete ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : (mod.id === 1 || (mod.id === 2 && game?.m1_complete) || (mod.id === 3 && game?.m2_complete)) ? <Badge variant="outline" className="text-[8px] text-primary border-primary/20">READY</Badge> : <LockIcon className="h-3 w-3 text-muted-foreground/30" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modular Workflow Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-card/40 border border-white/5 p-1 h-auto grid grid-cols-1 md:grid-cols-3 gap-2 mb-8">
            <TabsTrigger value="m1" className="data-[state=active]:bg-primary h-12 font-bold uppercase tracking-tighter text-xs">
              <Settings2 className="h-4 w-4 mr-2" /> 01: Calibration
            </TabsTrigger>
            <TabsTrigger value="m2" className="data-[state=active]:bg-primary h-12 font-bold uppercase tracking-tighter text-xs">
              <Zap className="h-4 w-4 mr-2" /> 02: Discovery Swarm
            </TabsTrigger>
            <TabsTrigger value="m5" className="data-[state=active]:bg-accent data-[state=active]:text-black h-12 font-bold uppercase tracking-tighter text-xs">
              <Fingerprint className="h-4 w-4 mr-2" /> 03: Mapping Engine
            </TabsTrigger>
          </TabsList>

          <TabsContent value="m1">
            <Card className="bg-card/40 border-white/5 p-8 space-y-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black flex items-center gap-2 uppercase tracking-tighter"><Settings2 className="h-6 w-6 text-primary" /> Module 1: Elite Calibration</h3>
                  <p className="text-sm text-muted-foreground font-mono">Initialization, color clustering, and roster validation.</p>
                </div>
                {!game?.m1_complete && (
                  <Button 
                    onClick={() => handleCompleteModule(1)} 
                    className="bg-emerald-600 hover:bg-emerald-700 font-bold uppercase tracking-widest text-xs shadow-lg shadow-emerald-500/20 border border-emerald-400/20"
                  >
                    Mark Calibration Ready <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
                {game?.m1_complete && (
                  <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 px-4 py-1.5 uppercase font-black text-[10px] tracking-widest">
                    <CheckCircle2 className="h-3 w-3 mr-2" /> Calibration Verified
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-[0.2em]">Video Metadata</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Camera Type</span>
                      <span className="font-mono text-white uppercase">{game?.camera_type || 'panning'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Venue</span>
                      <span className="font-mono text-white">{game?.venue?.name || 'Not set'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Video Stream</span>
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">ENCODED</Badge>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                  <h4 className="text-xs font-bold text-accent uppercase tracking-[0.2em]">Color Calibration</h4>
                  <div className="flex items-center gap-8">
                    <div className="space-y-2">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Home Team</div>
                      <div className="h-12 w-24 rounded-lg border border-white/10 shadow-xl" style={{ backgroundColor: game?.home_team_color || '#333' }} />
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Away Team</div>
                      <div className="h-12 w-24 rounded-lg border border-white/10 shadow-xl" style={{ backgroundColor: game?.away_team_color || '#666' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Video className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white uppercase tracking-tight">Footage Precision Check</div>
                    <div className="text-xs text-muted-foreground">Review calibration metadata before triggering AI Swarm.</div>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setIsEditModalOpen(true)} className="bg-background border-primary/20">
                  EDIT GAME & RE-CALIBRATE <Settings2 className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="m2">
            {!game?.m1_complete ? (
              <ModuleLocked moduleNum={2} requiredModule="Module 1: Calibration" />
            ) : (
              <Card className="bg-card/40 border-white/5 p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black flex items-center gap-2 uppercase tracking-tighter"><Zap className="h-6 w-6 text-primary" /> Module 2: Unified Discovery Swarm</h3>
                    <p className="text-sm text-muted-foreground font-mono italic">GPU-accelerated raw entity detection, event tracking, and tactical analysis.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {isCurrentlyProcessing && (
                      <Button 
                        onClick={handleCancelAnalysis} 
                        disabled={isCancelling}
                        variant="destructive" 
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-bold uppercase tracking-widest text-[10px] h-10"
                      >
                        {isCancelling ? <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> : <X className="h-3 w-3 mr-2" />}
                        Kill Swarm
                      </Button>
                    )}
                    <Button 
                      onClick={() => handleStartDiscovery(false)} 
                      disabled={analyzing || isCurrentlyProcessing} 
                      className={cn("font-bold h-10 px-10 uppercase tracking-tighter shadow-lg shadow-primary/20", "bg-primary")}
                    >
                      {(analyzing || isCurrentlyProcessing) ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      {(analyzing || isCurrentlyProcessing) ? "ANALYZING..." : "ANALYZE AI DETECTION"}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* MAIN PROGRESS ENGINE */}
                  <div className="lg:col-span-8 space-y-6">
                    <div className="p-8 rounded-2xl bg-white/5 border border-white/10 shadow-inner relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Cpu className="h-24 w-24 text-white" />
                      </div>
                      
                      <div className="space-y-4 relative z-10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn("h-3 w-3 rounded-full", isCurrentlyProcessing ? "bg-primary animate-pulse" : "bg-muted")} />
                            <span className="text-xs font-black uppercase tracking-[0.3em] text-white">GPU Swarm Status: {isCurrentlyProcessing ? "Active Analysis" : "Ready for Ignition"}</span>
                          </div>
                          <span className="text-2xl font-black italic text-primary font-mono tracking-tighter">
                            {game?.progress_percentage || 0}%
                          </span>
                        </div>
                        
                        <Progress value={game?.progress_percentage || 0} className="h-2 bg-white/5" />
                        
                        <div className="grid grid-cols-4 gap-4 pt-4">
                          {[
                            { label: "Ignition", threshold: 10 },
                            { label: "Raw Discovery", threshold: 40 },
                            { label: "Event Tracking", threshold: 75 },
                            { label: "Final Pack", threshold: 95 }
                          ].map((s) => (
                            <div key={s.label} className="space-y-2">
                              <div className={cn("h-1 rounded-full transition-all duration-700", (game?.progress_percentage || 0) >= s.threshold ? "bg-primary shadow-[0_0_10px_rgba(234,88,12,0.5)]" : "bg-white/5")} />
                              <span className={cn("text-[9px] font-black uppercase tracking-widest block text-center", (game?.progress_percentage || 0) >= s.threshold ? "text-primary" : "text-muted-foreground/30")}>
                                {s.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl border border-white/5 bg-card/20 space-y-4">
                      <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                          <Terminal className="h-3 w-3" /> Live Technical Trace
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[9px] font-mono text-emerald-500 uppercase tracking-tighter">Live Pulse Active</span>
                        </div>
                      </div>
                      <div className="h-48 overflow-y-auto font-mono text-[11px] space-y-2 pr-4 custom-scrollbar">
                        {game?.processing_metadata?.worker_logs?.map((log: any, i: number) => (
                          <div key={i} className="flex gap-3 text-muted-foreground/80 hover:text-white transition-colors">
                            <span className="text-primary/50 shrink-0">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}]</span>
                            <span className={cn(
                              log.severity === 'error' ? 'text-red-400' : 
                              log.severity === 'success' ? 'text-emerald-400 font-bold' : 
                              'text-white/70'
                            )}>
                              {log.message}
                            </span>
                          </div>
                        )) || (
                          <div className="h-full flex items-center justify-center text-muted-foreground/20 italic">
                            Awaiting GPU cluster heartbeat...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SIDEBAR STATUS */}
                  <div className="lg:col-span-4 space-y-6">
                    <Card className="bg-white/5 border-white/5 overflow-hidden">
                      <div className="p-4 border-b border-white/5 bg-primary/5">
                        <h4 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                          <ShieldCheck className="h-3 w-3 text-primary" /> System Health
                        </h4>
                      </div>
                      <CardContent className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground uppercase font-mono">Infrastructure</span>
                          <div className="flex items-center gap-1.5">
                            <Globe className="h-3 w-3 text-emerald-500" />
                            <span className="text-[10px] font-bold text-white">Online</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground uppercase font-mono">Real-time Sync</span>
                          <div className="flex items-center gap-1.5">
                            <Activity className="h-3 w-3 text-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-white">Connected</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground uppercase font-mono">GPU State</span>
                          <div className="flex items-center gap-1.5">
                            <Cpu className={cn("h-3 w-3", isCurrentlyProcessing ? "text-primary animate-pulse" : "text-muted-foreground")} />
                            <span className={cn("text-[10px] font-bold", isCurrentlyProcessing ? "text-primary" : "text-muted-foreground")}>
                              {isCurrentlyProcessing ? "Processing" : "Idle"}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="p-6 rounded-2xl bg-accent/5 border border-accent/20 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
                          <Fingerprint className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <div className="text-[10px] font-black text-white uppercase tracking-tight">Post-Analysis Bridge</div>
                          <div className="text-[9px] text-muted-foreground font-mono uppercase">Move to Mapping Engine</div>
                        </div>
                      </div>
                      <Button 
                        onClick={() => setActiveTab("m5")} 
                        className="w-full bg-accent hover:bg-accent/80 text-black font-black uppercase italic tracking-tighter text-[11px] h-10"
                        disabled={!game?.m2_complete}
                      >
                        Launch Mapping Dashboard <ChevronRight className="ml-2 h-3 w-3" />
                      </Button>
                    </div>

                    <Button 
                      onClick={handleResetAnalysis} 
                      variant="ghost" 
                      className="w-full text-muted-foreground hover:text-red-400 hover:bg-red-400/5 text-[9px] font-black uppercase tracking-widest h-8"
                    >
                      <RefreshCw className="h-3 w-3 mr-2" /> Reset Swarm Cluster
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="m5">
            {!game?.m2_complete ? (
              <ModuleLocked moduleNum={3} requiredModule="Module 2: Discovery Swarm" />
            ) : (
              <MappingDashboard 
                gameId={game.id} 
                aiMappings={aiMappings} 
                homeRoster={homeRoster} 
                awayRoster={awayRoster} 
                homeColor={game.home_team_color}
                awayColor={game.away_team_color}
                onRefresh={() => fetchGameData(true)} 
              />
            )}
          </TabsContent>
        </Tabs>

        {game && <EditGameTeamsModal game={game} isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onUpdated={fetchGameData} />}
      </div>
    </Layout>
  );
}