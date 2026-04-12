import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings2, 
  RefreshCw, 
  Calendar, 
  MapPin, 
  Users,
  Sparkles,
  Wifi,
  WifiOff,
  Trophy,
  Lock,
  CheckCircle2,
  ChevronRight,
  Activity,
  BarChart3,
  Video,
  AlertTriangle,
  Terminal,
  Cpu,
  RotateCcw,
  Zap,
  X
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

  // Remove automatic trigger from useEffect
  useEffect(() => {
    if (activeTab === "mapping" && game?.status === "pending") {
      // Logic removed: We no longer auto-trigger handleStartAnalysis() here.
      // The user must manually click the "Analyze AI Detection" button.
      console.log("[UI] Mapping tab active. Awaiting manual analysis trigger.");
    }
  }, [activeTab, game?.status]);

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

  const handleVerifyHandshake = async () => {
    if (!gameId || !game) return;
    setIsVerifying(true);
    setBanner(null);

    try {
      const response = await fetch('/api/process-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: gameId, video_path: game.video_path, dry_run: true }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        let errorMessage = errorData.message || "Failed to establish GPU connection.";
        let severity: BannerSeverity = "error";

        if (errorMessage.includes("SUPABASE_SERVICE_ROLE_KEY")) {
          errorMessage = "CREDENTIAL BOTTLENECK: The SUPABASE_SERVICE_ROLE_KEY is missing or invalid in your Modal.com Secrets. The GPU cannot report back progress.";
        } else if (errorMessage.includes("Video file not found")) {
          errorMessage = "STORAGE BOTTLENECK: The video file is not accessible in R2. Please re-upload or check your R2_ACCESS_KEY_ID permissions.";
        } else if (response.status === 504) {
          errorMessage = "NETWORK BOTTLENECK: GPU Swarm timed out during handshake. This typically indicates a cluster cold-start delay. Retrying in 30s is recommended.";
          severity = "warning";
        }

        setBanner({
          title: "Handshake Bottleneck Detected",
          message: errorMessage,
          severity: severity
        });
      } else {
        showBanner("GPU cluster successfully verified credentials and storage access.", "success", "Handshake Established");
        setBanner({
          title: "Swarm Verified & Active",
          message: "GPU Swarm Handshake successful. Cluster is provisioned and awaiting ignition pulse.",
          severity: "success"
        });
      }
    } catch (error: any) {
      setBanner({
        title: "Communication Error",
        message: error.message || "Handshake request failed at the App Server level.",
        severity: "error"
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetAnalysis = async () => {
    if (!gameId) return;
    setResetting(true);
    try {
      const { error } = await supabase
        .from('games')
        .update({
          status: 'scheduled',
          last_error: null,
          progress_percentage: 0,
          processing_metadata: { 
            ...(game?.processing_metadata || {}), 
            worker_logs: [],
            last_heartbeat: null
          }
        } as any)
        .eq('id', gameId);

      if (error) throw error;
      showBanner("All status flags cleared. Ready for re-ignition.", "info", "Swarm Cluster Reset");
      await fetchGameData(true);
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
        <Lock className="h-8 w-8 text-muted-foreground" />
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
                  { id: 2, label: "Discovery", complete: game?.m2_complete, icon: Users },
                  { id: 3, label: "Analysis", complete: game?.m3_complete, icon: Activity },
                  { id: 4, label: "Insights", complete: false, icon: BarChart3 },
                ].map((mod) => (
                  <div key={mod.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", mod.complete ? "bg-emerald-500/20" : "bg-muted/20")}>
                        <mod.icon className={cn("h-4 w-4", mod.complete ? "text-emerald-500" : "text-muted-foreground")} />
                      </div>
                      <span className={cn("text-xs font-bold uppercase tracking-widest", mod.complete ? "text-white" : "text-muted-foreground")}>Module {mod.id}: {mod.label}</span>
                    </div>
                    {mod.complete ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : mod.id === 1 || (mod.id === 2 && game?.m1_complete) || (mod.id === 3 && game?.m2_complete) ? <Badge variant="outline" className="text-[8px] text-primary border-primary/20">READY</Badge> : <Lock className="h-3 w-3 text-muted-foreground/30" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modular Workflow Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-card/40 border border-white/5 p-1 h-auto grid grid-cols-2 lg:grid-cols-4 gap-2 mb-8">
            <TabsTrigger value="m1" className="data-[state=active]:bg-primary h-12 font-bold uppercase tracking-tighter text-xs">
              <Settings2 className="h-4 w-4 mr-2" /> 01: Calibration
            </TabsTrigger>
            <TabsTrigger value="m2" className="data-[state=active]:bg-primary h-12 font-bold uppercase tracking-tighter text-xs">
              <Users className="h-4 w-4 mr-2" /> 02: Discovery
            </TabsTrigger>
            <TabsTrigger value="m3" className="data-[state=active]:bg-primary h-12 font-bold uppercase tracking-tighter text-xs">
              <Activity className="h-4 w-4 mr-2" /> 03: Analysis
            </TabsTrigger>
            <TabsTrigger value="m4" className="data-[state=active]:bg-primary h-12 font-bold uppercase tracking-tighter text-xs">
              <BarChart3 className="h-4 w-4 mr-2" /> 04: Insights
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

              <div className="p-6 rounded-2xl border border-primary/20 bg-primary/5 flex items-center justify-between">
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
                    <h3 className="text-2xl font-black flex items-center gap-2 uppercase tracking-tighter"><Users className="h-6 w-6 text-primary" /> Module 2: AI Roster Discovery</h3>
                    <p className="text-sm text-muted-foreground font-mono">GPU-accelerated personnel mapping and identity validation.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {isCurrentlyProcessing && !game.last_error && (
                      <Button 
                        onClick={handleCancelAnalysis} 
                        disabled={isCancelling}
                        variant="destructive" 
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-bold uppercase tracking-widest text-xs"
                      >
                        {isCancelling ? <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> : <X className="h-3 w-3 mr-2" />}
                        Cancel Swarm
                      </Button>
                    )}
                    {!game?.m2_complete && (
                      <Button onClick={() => handleCompleteModule(2)} variant="outline" className="border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10 font-bold uppercase tracking-widest text-xs">
                        Finalize Mappings <CheckCircle2 className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                    <Button onClick={() => handleStartDiscovery(false)} disabled={analyzing || (isCurrentlyProcessing && !game.last_error)} className={cn("font-bold h-10 px-8 uppercase tracking-tighter", "bg-primary")}>
                      {(analyzing || (isCurrentlyProcessing && !game.last_error)) ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      {(analyzing || (isCurrentlyProcessing && !game.last_error)) ? "ANALYZING..." : "ANALYZE AI DETECTION"}
                    </Button>
                  </div>
                </div>

                {banner && (
                  <DiagnosticBanner 
                    title={banner.title}
                    message={banner.message}
                    severity={banner.severity}
                    onClose={() => setBanner(null)}
                    className="mb-4"
                  />
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 rounded-2xl bg-white/5 border border-white/10 shadow-inner">
                  <div className="lg:col-span-8 space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-[0.2em]">
                        <span className="flex items-center gap-2 text-primary">
                          <Cpu className={cn("h-3 w-3", (analyzing || isWarming) && "animate-pulse")} /> 
                          {isWarming && (game?.progress_percentage || 0) < 15 ? "GPU Swarm: Cluster Warming..." : "GPU Swarm Cluster: Stage Progress"}
                        </span>
                        <span className={cn(game?.status === 'error' ? "text-red-500" : "text-accent")}>
                          {game?.progress_percentage || 0}% Complete
                        </span>
                      </div>
                      <Progress value={game?.progress_percentage || 0} className="h-1.5 bg-white/5" />
                      
                      <div className="grid grid-cols-4 gap-2 pt-2">
                        {[
                          { step: 1, label: "Ignition", threshold: 10 },
                          { step: 2, label: "Provision", threshold: 30 },
                          { step: 3, label: "Stream", threshold: 70 },
                          { step: 4, label: "Finalize", threshold: 95 }
                        ].map((s) => (
                          <div key={s.step} className="space-y-1">
                            <div className={cn("h-1 rounded-full", (game?.progress_percentage || 0) >= s.threshold ? "bg-primary" : "bg-white/5")} />
                            <span className={cn("text-[8px] font-black uppercase tracking-widest block text-center", (game?.progress_percentage || 0) >= s.threshold ? "text-primary" : "text-muted-foreground/40")}>
                              {s.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                          <Terminal className="h-3 w-3" /> Live Technical Trace
                          {(analyzing || isWarming) && <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
                        </h4>
                        <Badge variant="outline" className="text-[8px] font-mono border-white/10 text-muted-foreground">
                          {workerLogs.length} Packets Received
                        </Badge>
                      </div>
                      <WorkerLogs logs={workerLogs} className="h-[300px] border border-white/10 bg-black/40 rounded-xl" />
                    </div>
                  </div>

                  <div className="lg:col-span-4 space-y-4">
                    <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3 h-full flex flex-col">
                      <h4 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3 text-amber-500" /> Diagnostic Engine
                      </h4>
                      <div className="space-y-2.5 flex-1">
                        {[
                          { label: "App Server", status: "Online", icon: CheckCircle2, color: "text-emerald-500" },
                          { label: "Database (Supabase)", status: isRealtimeActive ? "Connected" : "Syncing", icon: Activity, color: isRealtimeActive ? "text-emerald-500" : "text-amber-500" },
                          { label: "GPU Swarm (Modal)", status: isCurrentlyProcessing ? "Active" : "Idle", icon: Sparkles, color: isCurrentlyProcessing ? "text-primary" : "text-muted-foreground" }
                        ].map((d, i) => (
                          <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/5">
                            <div className="flex flex-col">
                              <span className="text-[9px] text-muted-foreground uppercase font-bold">{d.label}</span>
                              <span className={cn("text-[10px] font-mono", d.color)}>{d.status}</span>
                            </div>
                            <d.icon className={cn("h-3.5 w-3.5", d.color)} />
                          </div>
                        ))}
                      </div>
                      
                      {game?.last_error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 space-y-2">
                          <div className="flex items-center gap-2 text-[9px] font-bold text-red-500 uppercase tracking-widest">
                            <AlertTriangle className="h-3 w-3" /> Fatal Bottleneck
                          </div>
                          <p className="text-[10px] text-red-400/80 font-mono leading-relaxed truncate">
                            {game.last_error}
                          </p>
                        </div>
                      )}

                      <div className="pt-2 space-y-2">
                        <Button 
                          variant="ghost" 
                          onClick={handleVerifyHandshake}
                          disabled={isVerifying || analyzing}
                          className="w-full h-9 bg-accent/5 hover:bg-accent/10 text-[9px] font-black uppercase tracking-widest border border-accent/10 text-accent"
                        >
                          {isVerifying ? <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> : <Terminal className="h-3 w-3 mr-2" />}
                          Verify Swarm Handshake
                        </Button>
                        <Button 
                          variant="ghost" 
                          onClick={() => { handleStartDiscovery(true); }}
                          disabled={analyzing || resetting}
                          className="w-full h-9 bg-accent/5 hover:bg-accent/10 text-[9px] font-black uppercase tracking-widest border border-accent/10 text-accent"
                        >
                          <Zap className="h-3 w-3 mr-2" />
                          Execute Dry-Run Test
                        </Button>
                        <Button 
                          variant="ghost" 
                          onClick={handleResetAnalysis} 
                          disabled={resetting || isCurrentlyProcessing}
                          className="w-full h-9 bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest border border-white/5"
                        >
                          <RotateCcw className="h-3 w-3 mr-2" />
                          Reset Swarm Cluster
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <MappingDashboard 
                  gameId={game.id} 
                  aiMappings={aiMappings} 
                  homeRoster={homeRoster} 
                  awayRoster={awayRoster} 
                  homeColor={game.home_team_color}
                  awayColor={game.away_team_color}
                  onRefresh={() => fetchGameData(true)} 
                />
              </Card>
            )}
          </TabsContent>

          <TabsContent value="m3">
            {!game?.m2_complete ? (
              <ModuleLocked moduleNum={3} requiredModule="Module 2: Discovery" />
            ) : (
              <Card className="bg-card/40 border-white/5 p-12 text-center space-y-6">
                <div className="h-20 w-20 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto">
                  <Activity className="h-10 w-10 text-accent animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-black uppercase tracking-tighter italic">Module 3: Tactical Analysis</h3>
                  <p className="text-muted-foreground max-w-md mx-auto font-mono text-sm">
                    Personnel mapped. Transitioning to event tracking, shot detection, and play-by-play generation.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-4">
                  <Badge className="bg-accent/20 text-accent border-accent/30 py-1 px-4 uppercase font-mono text-xs">READY FOR PROCESSING</Badge>
                </div>
                <Button className="bg-accent hover:bg-accent/90 font-black h-12 px-10 uppercase tracking-widest text-xs">
                  EXECUTE EVENT TRACKING
                </Button>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="m4">
            {!game?.m3_complete ? (
              <ModuleLocked moduleNum={4} requiredModule="Module 3: Analysis" />
            ) : (
              <Card className="bg-card/40 border-white/5 p-12 text-center space-y-6">
                <div className="h-20 w-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                  <BarChart3 className="h-10 w-10 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-black uppercase tracking-tighter">Module 4: Elite Insights</h3>
                  <p className="text-muted-foreground max-w-md mx-auto font-mono text-sm">
                    Intelligence synthesis. Generating efficiency reports, personnel trends, and scout-ready highlights.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-4">
                  <Badge className="bg-primary/20 text-primary border-primary/30 py-1 px-4 uppercase font-mono text-xs">AWAITING ANALYTICS PAYLOAD</Badge>
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {game && <EditGameTeamsModal game={game} isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onUpdated={fetchGameData} />}
      </div>
    </Layout>
  );
}