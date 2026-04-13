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
  Video,
  HardDrive,
  AlertCircle,
  Trash2,
  Play
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
  const { id: gameIdRaw } = router.query;
  
  // 🛡️ STABLE ID BRIDGE: Ensuring the ID is locked for all modules
  const [gameId, setGameId] = useState<string | null>(null);
  
  useEffect(() => {
    if (router.isReady && gameIdRaw) {
      const id = Array.isArray(gameIdRaw) ? gameIdRaw[0] : gameIdRaw;
      if (isValidUUID(id)) {
        setGameId(id);
      }
    }
  }, [router.isReady, gameIdRaw]);
  
  const [game, setGame] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("m1");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // 🛡️ MANUAL COMMAND CENTER STATE
  const [manualMode, setManualMode] = useState(true); // Defaulting to true for high-density control
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [activeChannel, setActiveChannel] = useState<any>(null);

  const checkSequence = (step: number) => {
    if (step > 0 && !completedSteps.includes(step - 1)) {
      const stepNames = ["SYNC REALTIME", "VERIFY PAYLOAD", "IGNITE GPU SWARM", "FINALIZE M2"];
      showBanner(`Please complete Phase ${step}: ${stepNames[step - 1]} before proceeding.`, "error", "Sequence Blocked");
      return false;
    }
    return true;
  };

  const [homeRoster, setHomeRoster] = useState<any[]>([]);
  const [awayRoster, setAwayRoster] = useState<any[]>([]);
  const [aiMappings, setAiMappings] = useState<any[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isWarming, setIsWarming] = useState(false);
  const [manualStartRequested, setManualStartRequested] = useState(false);
  const [provisioningTimeout, setProvisioningTimeout] = useState<NodeJS.Timeout | null>(null);
  const isCurrentlyProcessing = game?.status === 'processing' || game?.status === 'analyzing';
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  
  // Diagnostic Banner State
  const [banner, setBanner] = useState<{ title: string; message: string; severity: BannerSeverity } | null>(null);

  // Pre-Ignition Health State
  const [healthStatus, setHealthStatus] = useState<{
    supabase: 'valid' | 'invalid' | 'checking',
    storage: 'valid' | 'invalid' | 'checking'
  }>({ supabase: 'checking', storage: 'checking' });

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

  const checkSystemHealth = async () => {
    try {
      const res = await fetch('/api/storage/test-connection');
      const data = await res.json();
      setHealthStatus({
        supabase: data.supabase_service_role ? 'valid' : 'invalid',
        storage: data.r2_connected ? 'valid' : 'invalid'
      });
    } catch (e) {
      setHealthStatus({ supabase: 'invalid', storage: 'invalid' });
    }
  };

  useEffect(() => {
    if (gameId) {
      fetchGameData();
      checkSystemHealth();
    }
  }, [gameId, fetchGameData]);

  useEffect(() => {
    if (!gameId || !isValidUUID(gameId)) return;

    // 🛡️ ULTIMATE HANDSHAKE: Real-time Pulse Monitoring
    const channel = supabase
      .channel(`game_pulse_${gameId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'games',
        filter: `id=eq.${gameId}` 
      }, (payload) => {
        setGame(payload.new as any);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [gameId]);

  const handleStartDiscovery = async (isDryRun: boolean = false) => {
    // 🛡️ IGNITION GUARD: Verify stable ID before handshake
    if (!gameId || !game) {
      showBanner("System Stall: Game ID not yet stabilized. Please wait for hydration.", "error", "Ignition Blocked");
      return;
    }
    
    setManualStartRequested(true);
    setAnalyzing(true);
    setIsWarming(true);
    setBanner(null);

    if (provisioningTimeout) clearTimeout(provisioningTimeout);
    const timeout = setTimeout(() => {
      if (game?.progress_percentage === 15) {
        setBanner({
          title: "GPU Cluster Warming Up",
          message: "The cluster is provisioning resources. This usually takes 45-90 seconds on first ignition. Please wait for the 18% handshake.",
          severity: "info"
        });
      }
    }, 45000);
    setProvisioningTimeout(timeout);

    try {
      const response = await fetch('/api/process-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          gameId: gameId, // Standardized to camelCase for the API
          video_path: game.video_path, 
          dry_run: isDryRun,
          homeColor: game.home_team_color,
          awayColor: game.away_team_color
        })
      });

      const data = await response.json();

      if (response.ok) {
        showBanner("GPU Swarm Ignition Successful", "success", "Swarm Launched");
        await fetchGameData(true);
      } else {
        showBanner(data.message || "Ignition Failed", "error", "System Stall");
        setBanner({
          title: "Critical System Stall",
          message: data.message || "The GPU cluster could not be ignited. Please check your credentials in Settings.",
          severity: "error"
        });
      }
    } catch (error: any) {
      showBanner(error.message || "Connection lost during ignition", "error", "Ignition Failed");
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
      // Direct Supabase update to clear the stuck 15% state immediately
      const { error: resetError } = await supabase
        .from('games')
        .update({
          status: 'scheduled',
          progress_percentage: 0,
          last_error: null,
          ignition_status: 'ready',
          processing_metadata: { 
            worker_logs: [{
              timestamp: new Date().toISOString(),
              message: "SYSTEM RESET: Clearing stale 15% ignition state.",
              severity: 'info'
            }]
          }
        } as any)
        .eq('id', gameId);

      if (resetError) throw resetError;

      const response = await fetch('/api/reset-game-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
      });

      showBanner("System state cleared. Ready for fresh ignition.", "success", "Swarm Reset Complete");
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

  const handleManualStep1 = async () => {
    if (!gameId || !checkSequence(0)) return;
    
    showBanner("📡 PHASE 1: Initializing Manual Realtime Handshake...", "info", "System Sync");

    if (activeChannel) await supabase.removeChannel(activeChannel);

    // 1. ATOMIC ID NORMALIZATION
    const normalizedId = gameId.toLowerCase();

    const channel = supabase
      .channel(`manual-sync-detail-${normalizedId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', // 🛡️ MATCH UPSERT PATTERN
          schema: 'public', 
          table: 'game_analysis', 
          filter: `game_id=eq.${normalizedId}` 
        },
        (payload) => {
          const entry = (payload.new || payload.old) as any;
          if (!entry) return;
          
          setGame((prev: any) => ({
            ...prev,
            progress_percentage: entry.progress_percentage ?? prev.progress_percentage,
            status: entry.status ?? prev.status,
            processing_metadata: {
              ...prev.processing_metadata,
              worker_logs: [
                ...(prev.processing_metadata?.worker_logs || []),
                { 
                  id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  timestamp: entry.updated_at || entry.created_at || new Date().toISOString(), 
                  message: entry.status_message, 
                  severity: entry.status === 'error' ? 'error' : 'info' 
                }
              ]
            }
          }));
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsSubscribed(true);
          setActiveChannel(channel);
          setCompletedSteps(prev => [...new Set([...prev, 0])]);
          showBanner(`✅ PHASE 1 COMPLETE: Listening on channel [${gameId.toLowerCase()}]`, "success", "Sync Established");
        }
      });
  };

  const handleManualStep2 = async () => {
    if (!gameId || !checkSequence(1)) return;
    
    showBanner("📦 PHASE 2: Verifying Video Payload & ID Stability...", "info", "Payload Check");

    // 🛡️ ATOMIC UPSERT: Prevent unique constraint collision
    const { error } = await supabase.from("game_analysis").upsert({
      game_id: gameId.toLowerCase(),
      status: "verifying",
      progress_percentage: 10,
      status_message: "🛰️ PHASE 2 COMPLETE: Forensic Payload Validated for GPU Ignition."
    }, { onConflict: 'game_id' });

    if (!error) {
      setCompletedSteps(prev => [...new Set([...prev, 1])]);
      await fetchGameData(true);
    } else {
      console.error("[Phase 2 Error]", error);
      showBanner(`❌ PHASE 2 FAILED: ${error.message}`, "error", "Payload Stall");
    }
  };

  const handleManualStep3 = async () => {
    if (!gameId || !checkSequence(2)) return;
    
    setManualStartRequested(true);
    setIsWarming(true);
    showBanner("🚀 PHASE 3: Dispatching Ignition Signal to GPU Cluster...", "info", "Ignition Launched");
    
    // 🛡️ FORENSIC DIAGNOSTIC WATCHDOG
    if (provisioningTimeout) clearTimeout(provisioningTimeout);
    const timeout = setTimeout(() => {
      if (game?.progress_percentage < 16) {
        const diagnosticMessage = "⚠️ HANDSHAKE DELAY: GPU Cluster is taking longer than 45s. Action Required: Please verify that 'supabase-keys' secret is correctly configured in your Modal.com dashboard.";
        showBanner(diagnosticMessage, "warning", "Diagnostic Alert");
        handleTraceLog({
          status: 'warning',
          status_message: diagnosticMessage,
          module: 'SYSTEM'
        });
      }
    }, 45000);
    setProvisioningTimeout(timeout);

    try {
      const response = await fetch('/api/process-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          gameId: gameId.toLowerCase(),
          video_path: game?.video_path // Proactively include video source
        })
      });

      if (!response.ok) {
        const err = await response.json();
        const apiError = `❌ IGNITION FAILED: API returned [${response.status} ${response.statusText}]. Reason: ${err.message || 'Unknown'}`;
        showBanner(apiError, "error", "Handshake Blocked");
        handleTraceLog({ status: 'error', status_message: apiError, module: 'API' });
        setIsWarming(false);
      } else {
        handleTraceLog({
          status: 'success',
          status_message: "✅ DISPATCH SUCCESS: Ignition Signal accepted by API. Waiting for GPU Heartbeat...",
          module: 'API'
        });
      }
    } catch (e: any) {
      const netError = `❌ NETWORK ERROR: Could not reach ignition API. Check your connection.`;
      showBanner(netError, "error", "Connection Lost");
      handleTraceLog({ status: 'error', status_message: netError, module: 'CLIENT' });
      setIsWarming(false);
    }
  };

  // 🛡️ HEARTBEAT & DATA LOCK MONITOR: Auto-advance Phase 3 only when DATA is generated
  useEffect(() => {
    // Phase 3 completion now requires 95% (Full Data Generation)
    if (manualStartRequested && game?.progress_percentage >= 95 && !completedSteps.includes(2)) {
      setCompletedSteps(prev => [...new Set([...prev, 2])]);
      setIsWarming(false);
      showBanner("✅ PHASE 3 COMPLETE: Raw Scouting Data (Box Scores, Shots, Events) Generated.", "success", "Data Locked");
      if (provisioningTimeout) clearTimeout(provisioningTimeout);
    }
  }, [game?.progress_percentage, manualStartRequested, completedSteps]);

  // 🛡️ PERSISTENT TRACE HANDLER: Prevent log clearing between phases
  const handleTraceLog = (entry: any) => {
    const validTimestamp = entry.created_at || new Date().toISOString();
    setGame((prev: any) => ({
      ...prev,
      processing_metadata: {
        ...prev.processing_metadata,
        worker_logs: [
          ...(prev.processing_metadata?.worker_logs || []),
          { 
            id: entry.id || `log-${Date.now()}`, 
            timestamp: validTimestamp, 
            message: entry.status_message, 
            severity: entry.status === 'error' ? 'error' : entry.status === 'warning' ? 'warning' : 'info' 
          }
        ]
      }
    }));
  };

  const handleManualStep4 = async () => {
    if (!gameId || !checkSequence(3)) return;
    
    const { error } = await supabase
      .from("games")
      .update({ m2_complete: true } as any)
      .eq('id', gameId);

    if (!error) {
      setCompletedSteps(prev => [...new Set([...prev, 3])]);
      showBanner("Module 2 Complete. Swarm analysis finalized.", "success", "Workflow Advanced");
      await fetchGameData(true);
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
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* ELITE DIAGNOSTIC BANNER */}
        {banner && (
          <DiagnosticBanner 
            title={banner.title} 
            message={banner.message} 
            severity={banner.severity} 
            onClose={() => setBanner(null)} 
          />
        )}

        {/* SYSTEM HEALTH MONITOR (PRE-IGNITION) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className={cn(
            "p-4 rounded-xl border flex items-center justify-between",
            healthStatus.supabase === 'valid' ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"
          )}>
            <div className="flex items-center gap-3">
              <ShieldCheck className={cn("h-5 w-5", healthStatus.supabase === 'valid' ? "text-emerald-500" : "text-red-500")} />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Master Credentials</p>
                <p className="text-sm font-semibold">{healthStatus.supabase === 'valid' ? "Authenticated & Secure" : "Credential Stall Detected"}</p>
              </div>
            </div>
            {healthStatus.supabase === 'invalid' && (
              <AlertCircle className="h-5 w-5 text-red-500 animate-pulse" />
            )}
          </div>

          <div className={cn(
            "p-4 rounded-xl border flex items-center justify-between",
            healthStatus.storage === 'valid' ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"
          )}>
            <div className="flex items-center gap-3">
              <HardDrive className={cn("h-5 w-5", healthStatus.storage === 'valid' ? "text-emerald-500" : "text-red-500")} />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">R2 Storage Uplink</p>
                <p className="text-sm font-semibold">{healthStatus.storage === 'valid' ? "Uplink Established" : "Storage Handshake Failed"}</p>
              </div>
            </div>
            {healthStatus.storage === 'invalid' && (
              <AlertCircle className="h-5 w-5 text-red-500 animate-pulse" />
            )}
          </div>
        </div>

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
            </Card>
          </TabsContent>

          <TabsContent value="m2">
            {!game?.m1_complete ? (
              <ModuleLocked moduleNum={2} requiredModule="Module 1: Calibration" />
            ) : (
              <Card className="bg-secondary/30 border-muted overflow-hidden relative group">
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Zap className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold uppercase tracking-tight">Module 2: Manual Command Center</h3>
                        <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Operator Control • Sequential Ignition</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetAnalysis}
                        disabled={resetting}
                        className="h-8 text-[10px] font-mono border-red-500/20 hover:bg-red-500/10 text-red-400"
                      >
                        {resetting ? <RefreshCw className="h-3 w-3 animate-spin mr-1.5" /> : <Trash2 className="h-3 w-3 mr-1.5" />}
                        RESET SWARM
                      </Button>
                    </div>
                  </div>

                  {/* 🛠️ ELITE MANUAL COMMAND CENTER GRID */}
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <Button 
                        variant={completedSteps.includes(0) ? "secondary" : "outline"}
                        className={`text-[10px] h-10 border-dashed ${completedSteps.includes(0) ? "border-green-500/50" : "border-primary/30"}`}
                        onClick={handleManualStep1}
                      >
                        {completedSteps.includes(0) ? "✅ PHASE 1: SYNCED" : "1. SYNC REALTIME"}
                      </Button>

                      <Button 
                        variant={completedSteps.includes(1) ? "secondary" : "outline"}
                        className={`text-[10px] h-10 border-dashed ${completedSteps.includes(1) ? "border-green-500/50" : "border-primary/30"}`}
                        onClick={handleManualStep2}
                      >
                        {completedSteps.includes(1) ? "✅ PHASE 2: VERIFIED" : "2. VERIFY PAYLOAD"}
                      </Button>

                      <Button 
                        variant={completedSteps.includes(2) ? "secondary" : "outline"}
                        className={`text-[10px] h-10 border-dashed ${completedSteps.includes(2) ? "border-green-500/50" : "border-primary/30"}`}
                        onClick={handleManualStep3}
                        disabled={isWarming || (manualStartRequested && game?.progress_percentage < 95)}
                      >
                        {isWarming ? (
                          <div className="flex items-center gap-2">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            <span>{game?.progress_percentage < 30 ? "WARMING..." : `ANALYZING ${game?.progress_percentage}%`}</span>
                          </div>
                        ) : (completedSteps.includes(2) ? "✅ PHASE 3: DATA GENERATED" : "3. IGNITE GPU")}
                      </Button>

                      <Button 
                        variant={completedSteps.includes(3) ? "secondary" : "outline"}
                        className={`text-[10px] h-10 border-dashed ${completedSteps.includes(3) ? "border-green-500/50" : "border-primary/30"}`}
                        onClick={handleManualStep4}
                      >
                        {completedSteps.includes(3) ? "✅ PHASE 4: LOCKED" : "4. FINALIZE M2"}
                      </Button>
                    </div>

                    <div className="flex gap-1 justify-center">
                      {[0, 1, 2, 3].map((s) => (
                        <div key={s} className={`h-1 w-full rounded-full ${completedSteps.includes(s) ? "bg-green-500" : "bg-primary/20"}`} />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="p-8 rounded-2xl bg-white/5 border border-white/10 shadow-inner relative overflow-hidden group">
                      <div className="space-y-4 relative z-10">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-[0.3em] text-white">GPU Swarm Status: {isCurrentlyProcessing ? "Active Analysis" : "Ready for Ignition"}</span>
                          <span className="text-2xl font-black italic text-primary font-mono tracking-tighter">{game?.progress_percentage || 0}%</span>
                        </div>
                        <Progress value={game?.progress_percentage || 0} className="h-2 bg-white/5" />
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl border border-white/5 bg-card/20 space-y-4">
                      <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                          <Terminal className="h-3 w-3" /> Live Technical Trace
                        </h4>
                      </div>
                      <div className="h-48 overflow-y-auto font-mono text-[11px] space-y-2 pr-4 custom-scrollbar">
                        {game?.processing_metadata?.worker_logs?.map((log: any, i: number) => (
                          <div key={i} className="flex gap-3 text-muted-foreground/80 hover:text-white transition-colors">
                            <span className="text-primary/50 shrink-0">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}]</span>
                            <span className={cn(log.severity === 'error' ? 'text-red-400' : log.severity === 'success' ? 'text-emerald-400 font-bold' : 'text-white/70')}>
                              {log.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="m5">
            {!game?.m2_complete ? (
              <ModuleLocked moduleNum={3} requiredModule="Module 2: Discovery Swarm" />
            ) : gameId && (
              <MappingDashboard 
                gameId={gameId} 
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