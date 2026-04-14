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
  Loader2,
  Info
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
import { Input } from "@/components/ui/input";
import { Palette, MapPin as MapPinIcon, Trophy as TrophyIcon, Calendar as CalendarIcon, Save, Search, Check, AlertTriangle } from "lucide-react";

const MODULES = [
  { id: 'm1', label: 'Calibration', icon: ShieldCheck, desc: 'Parameter Setup', key: 'm1_complete' },
  { id: 'm2', label: 'Processing', icon: Cpu, desc: 'AI Initialization', key: 'm2_complete' },
  { id: 'm3', label: 'Analysis', icon: Zap, desc: 'Game Processing', key: 'm3_complete' },
  { id: 'm4', label: 'Mapping', icon: Activity, desc: 'Roster Finalization', key: null }
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
  const [isAnalyzingColors, setIsAnalyzingColors] = useState(false);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [aiMappings, setAiMappings] = useState<any[]>([]);
  const [homeRoster, setHomeRoster] = useState<any[]>([]);
  const [awayRoster, setAwayRoster] = useState<any[]>([]);
  const [editData, setEditData] = useState<any>({});

  // Fetch game data
  const fetchGameData = async () => {
    if (!gameId) return;
    try {
      const { data, error } = await supabase
        .from('games')
        .select(`
          *,
          home_team:teams!games_home_team_id_fkey(*),
          away_team:teams!games_away_team_id_fkey(*),
          venue:venues(*)
        `)
        .eq('id', gameId)
        .single();

      if (error) throw error;
      setGame(data);
      setEditData({
        home_score: data.home_score || 0,
        away_score: data.away_score || 0,
        home_team_color: data.home_team_color || "",
        away_team_color: data.away_team_color || ""
      });
    } catch (err) {
      console.error("Error fetching game:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleColorSelection = (team: 'home' | 'away', color: string) => {
    const currentHome = editData.home_team_color;
    const currentAway = editData.away_team_color;
    const detectedColors = [game?.detected_home_color, game?.detected_away_color].filter(Boolean);

    // If clicking an already selected color for the SAME team, deselect it
    if (team === 'home' && currentHome === color) {
      setEditData({ ...editData, home_team_color: "" });
      return;
    }
    if (team === 'away' && currentAway === color) {
      setEditData({ ...editData, away_team_color: "" });
      return;
    }

    // Mutual exclusion logic for 2 colors
    if (detectedColors.length >= 2) {
      const otherColor = detectedColors.find(c => c !== color);
      if (team === 'home') {
        setEditData({ 
          ...editData, 
          home_team_color: color, 
          away_team_color: otherColor || "" 
        });
      } else {
        setEditData({ 
          ...editData, 
          away_team_color: color, 
          home_team_color: otherColor || "" 
        });
      }
    } else {
      // Single color or manual selection
      setEditData({ ...editData, [`${team}_team_color`]: color });
    }
  };

  useEffect(() => {
    if (game) {
      setEditData({
        home_team_name: game.home_team?.name || "",
        away_team_name: game.away_team?.name || "",
        venue_name: game.venue?.name || "",
        home_score: game.home_score || 0,
        away_score: game.away_score || 0,
        home_team_color: game.home_team_color || "",
        away_team_color: game.away_team_color || ""
      });
    }
  }, [game]);

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
        showBanner("Initializing AI Processing Hub...", "info", "READY");
        await axios.post('/api/process-game', { gameId });
        await workflowService.advanceModule(gameId as string, 'ignited');
        showBanner("Processing Hub Active. Analysis started.", "success", "PHASE 02 ACTIVE");
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
      // Use explicit keys to satisfy strict TypeScript definitions from Supabase
      const updatePayload: any = {};
      if (mod.key) {
        updatePayload[mod.key] = isComplete;
      }

      const { error } = await supabase
        .from('games')
        .update(updatePayload)
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

  const handleUpdateGameDetails = async () => {
    if (!gameId) return;
    try {
      const { error } = await supabase
        .from('games')
        .update({
          home_score: editData.home_score,
          away_score: editData.away_score,
          home_team_color: editData.home_team_color,
          away_team_color: editData.away_team_color
        })
        .eq('id', gameId);

      if (error) throw error;
      
      // Update team names if they changed (requires joining team update)
      // For now, we update the scores and colors which are direct on the games table
      
      showBanner("Game parameters calibrated", "success");
      await fetchGameData();
    } catch (err: any) {
      showBanner("Calibration failed", "error");
    }
  };

  const handleAnalyzeColors = async () => {
    if (!gameId || !game?.video_path) return;
    setIsAnalyzingColors(true);
    try {
      const res = await axios.post('/api/analyze-colors', { 
        gameId, 
        videoPath: game.video_path 
      });
      showBanner("Colors identified from footage", "success");
      await fetchGameData();
    } catch (err: any) {
      showBanner("Color recognition failed", "error");
    } finally {
      setIsAnalyzingColors(false);
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
        
        {/* Professional Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 rounded-3xl bg-card/50 border border-primary/20 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
             <div className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black tracking-widest border transition-all",
              isRealtimeActive ? "bg-accent/10 text-accent border-accent/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
            )}>
              {isRealtimeActive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isRealtimeActive ? "CONNECTED" : "OFFLINE"}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black tracking-widest py-1 px-3 italic uppercase">
                {game?.status || 'AWAITING SETUP'}
              </Badge>
              <Badge variant="outline" className="bg-white/5 text-muted-foreground border-white/10 text-[9px] font-mono tracking-tighter py-1 px-2 uppercase">
                ID: {game?.id?.slice(0, 8)}...
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
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-1">Analysis Progress</p>
                <p className="text-3xl font-black text-primary italic leading-none">{game?.progress_percentage || 0}%</p>
             </div>
          </div>
        </div>

        {/* Pipeline Stepper */}
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
                <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", isActive ? "text-white/70" : "text-muted-foreground")}>Step 0{idx + 1}</p>
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
                  <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                    <div className="flex items-center justify-between mb-2">
                      <div className="space-y-1">
                        <h3 className="text-2xl font-black uppercase tracking-tighter text-white italic">Calibration Hub</h3>
                        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Environmental & Parameter Tuning</p>
                      </div>
                      <Button 
                        size="sm"
                        onClick={handleUpdateGameDetails}
                        className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px] rounded-xl h-10 px-6"
                      >
                        <Save className="mr-2 h-4 w-4" /> Save Parameters
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Left: General Meta */}
                      <div className="space-y-6">
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                          <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                            <Trophy className="h-3 w-3" /> Identity Calibration
                          </p>
                          <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Home Final Score</Label>
                              <Input 
                                type="number"
                                value={editData.home_score}
                                onChange={(e) => setEditData({...editData, home_score: parseInt(e.target.value) || 0})}
                                className="bg-white/10 border-white/10 rounded-xl h-12 font-mono text-xl text-center focus:border-primary transition-all" 
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Away Final Score</Label>
                              <Input 
                                type="number"
                                value={editData.away_score}
                                onChange={(e) => setEditData({...editData, away_score: parseInt(e.target.value) || 0})}
                                className="bg-white/10 border-white/10 rounded-xl h-12 font-mono text-xl text-center focus:border-primary transition-all" 
                              />
                            </div>
                          </div>
                        </div>

                        <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                          <p className="text-[10px] font-black text-accent uppercase tracking-[0.2em] flex items-center gap-2">
                            <MapPin className="h-3 w-3" /> Venue Designation
                          </p>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Stadium Name</Label>
                            <Input 
                              value={game?.venue?.name || "Generic Field"} 
                              disabled
                              className="bg-white/5 border-white/5 rounded-xl h-12 font-bold opacity-40 cursor-not-allowed" 
                            />
                          </div>
                        </div>
                      </div>

                      {/* Right: Color Calibration */}
                      <div className="space-y-6">
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 border-dashed space-y-6 relative overflow-hidden group">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                              <Palette className="h-3 w-3 text-primary" /> Jersey Identification
                            </p>
                            <Button 
                              variant="outline"
                              size="sm"
                              disabled={isAnalyzingColors || !game?.video_path}
                              onClick={handleAnalyzeColors}
                              className="bg-white/5 border-white/10 text-[9px] font-black uppercase rounded-lg h-8 px-4 hover:bg-primary hover:text-white transition-all"
                            >
                              {isAnalyzingColors ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3 mr-1" />}
                              Extract Colors from Video
                            </Button>
                          </div>

                          {!game?.detected_home_color && !game?.detected_away_color ? (
                            <div className="py-8 text-center space-y-2 bg-white/[0.02] rounded-xl border border-white/5">
                              <AlertTriangle className="h-8 w-8 text-amber-500/50 mx-auto" />
                              <p className="text-[10px] font-mono text-muted-foreground uppercase">Run Extraction to Identify Jerseys</p>
                            </div>
                          ) : (
                            <div className="space-y-6">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                  <Label className="text-[10px] font-black uppercase text-muted-foreground block text-center italic">Home Jersey</Label>
                                  <div className="flex justify-center gap-3">
                                    {[game?.detected_home_color, game?.detected_away_color].filter(Boolean).map((color, i) => (
                                      <button
                                        key={i}
                                        onClick={() => handleColorSelection('home', color as string)}
                                        className={cn(
                                          "w-12 h-12 rounded-full border-2 transition-all flex items-center justify-center relative group",
                                          editData.home_team_color === color ? "border-primary scale-110 shadow-[0_0_20px_rgba(255,102,0,0.3)]" : "border-white/10 opacity-40 hover:opacity-100"
                                        )}
                                        style={{ backgroundColor: color as string }}
                                      >
                                        {editData.home_team_color === color && <Check className="h-5 w-5 text-white drop-shadow-md z-10" />}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  <Label className="text-[10px] font-black uppercase text-muted-foreground block text-center italic">Away Jersey</Label>
                                  <div className="flex justify-center gap-3">
                                    {[game?.detected_home_color, game?.detected_away_color].filter(Boolean).map((color, i) => (
                                      <button
                                        key={i}
                                        onClick={() => handleColorSelection('away', color as string)}
                                        className={cn(
                                          "w-12 h-12 rounded-full border-2 transition-all flex items-center justify-center relative group",
                                          editData.away_team_color === color ? "border-accent scale-110 shadow-[0_0_20px_rgba(0,255,255,0.3)]" : "border-white/10 opacity-40 hover:opacity-100"
                                        )}
                                        style={{ backgroundColor: color as string }}
                                      >
                                        {editData.away_team_color === color && <Check className="h-5 w-5 text-white drop-shadow-md z-10" />}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3">
                                <Info className="h-4 w-4 text-primary shrink-0" />
                                <p className="text-[9px] font-bold text-muted-foreground leading-relaxed">
                                  <span className="text-primary font-black uppercase">Mutual Assignment Active:</span> Selecting a color for one team automatically assigns the alternate to the opponent.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
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