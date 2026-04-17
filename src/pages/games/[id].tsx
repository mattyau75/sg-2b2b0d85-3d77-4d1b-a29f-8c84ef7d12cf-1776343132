import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VideoPlayer } from "@/components/VideoPlayer";
import { EditGameTeamsModal } from "@/components/EditGameTeamsModal";
import { MappingDashboard } from "@/components/MappingDashboard";
import { 
  Settings2, 
  Users, 
  Cpu, 
  PlayCircle, 
  CheckCircle2, 
  AlertCircle,
  Database,
  BarChart3,
  RefreshCw,
  Video,
  Check
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showBanner } from "@/components/DiagnosticBanner";
import { AuthGuard } from "@/components/AuthGuard";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import axios from "axios";
import { logger } from "@/lib/logger";
import { ErrorMonitor } from "@/components/ErrorMonitor";
import { useErrorMonitor } from "@/hooks/useErrorMonitor";

export default function GameDetail() {
  const router = useRouter();
  const gameId = typeof router.query.id === "string" ? router.query.id : undefined;
  const { toast } = useToast();
  const { errors, logError, dismissError, dismissAll } = useErrorMonitor();
  
  const [game, setGame] = useState<any>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isErrorMonitorOpen, setIsErrorMonitorOpen] = useState(false);

  // Stage Verifications
  const [stagesVerified, setStagesVerified] = useState({
    setup: false,
    analysis: false,
    mapping: false,
    finalize: false
  });

  // Mapping Data
  const [aiMappings, setAiMappings] = useState<any[]>([]);
  const [homeRoster, setHomeRoster] = useState<any[]>([]);
  const [awayRoster, setAwayRoster] = useState<any[]>([]);

  useEffect(() => {
    if (gameId) {
      loadGameData();
    }
  }, [gameId]);

  const loadGameData = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("games")
        .select(`*, home_team:home_team_id(name), away_team:away_team_id(name)`)
        .eq("id", gameId)
        .single();

      if (error) throw error;
      setGame(data);

      setStagesVerified({
        setup: data.setup_verified || false,
        analysis: data.analysis_verified || false,
        mapping: data.mapping_verified || false,
        finalize: data.finalize_verified || false
      });

      if (data.video_path) {
        const r2PublicDomain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN;
        const r2Endpoint = process.env.NEXT_PUBLIC_R2_ENDPOINT;
        const videoPath = data.video_path;

        let publicUrl;
        if (r2PublicDomain) {
          publicUrl = `https://${r2PublicDomain}/${videoPath}`;
        } else if (r2Endpoint) {
          publicUrl = `${r2Endpoint.replace(/\/$/, '')}/${videoPath}`;
        } else {
          logger.error("[GameDetail] No R2 public URL configured");
          return;
        }
        setVideoUrl(publicUrl);
      }
    } catch (error: any) {
      logger.error("Fetch failed:", error);
      logError("/api/games", 500, error.message, error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMappingData = async () => {
    if (!gameId) return;
    try {
      const { data: mappings } = await supabase
        .from('ai_player_mappings')
        .select('*, players(*)')
        .eq('game_id', gameId);
      
      setAiMappings(mappings || []);

      if (game?.home_team_id && game?.away_team_id) {
        const { data: home } = await supabase.from('players').select('*').eq('team_id', game.home_team_id);
        const { data: away } = await supabase.from('players').select('*').eq('team_id', game.away_team_id);
        setHomeRoster(home || []);
        setAwayRoster(away || []);
      }
    } catch (err) {
      logger.error("Mapping data fetch failed:", err);
    }
  };

  useEffect(() => {
    if (showMappingModal) {
      fetchMappingData();
    }
  }, [showMappingModal]);

  const toggleStageVerify = async (stage: keyof typeof stagesVerified) => {
    const isCurrentlyVerified = stagesVerified[stage];
    
    if (isCurrentlyVerified) {
      const stageOrder: (keyof typeof stagesVerified)[] = ['setup', 'analysis', 'mapping', 'finalize'];
      const currentIndex = stageOrder.indexOf(stage);
      const nextStage = stageOrder[currentIndex + 1];
      
      if (nextStage && stagesVerified[nextStage]) {
        toast({
          title: "Action Blocked",
          description: `Cannot unverify ${stage} because the next module (${nextStage}) is already verified.`,
          variant: "destructive"
        });
        return;
      }

      if (stage === 'setup' && game?.processing_status === 'analyzing') {
        toast({
          title: "Action Blocked",
          description: "Cannot unverify setup while AI analysis is actively running.",
          variant: "destructive"
        });
        return;
      }
    }

    const newValue = !isCurrentlyVerified;
    
    try {
      setStagesVerified(prev => ({ ...prev, [stage]: newValue }));

      const updateData: any = {};
      if (stage === 'setup') updateData.setup_verified = newValue;
      if (stage === 'analysis') updateData.analysis_verified = newValue;
      if (stage === 'mapping') updateData.mapping_verified = newValue;
      if (stage === 'finalize') updateData.finalize_verified = newValue;

      const { error } = await supabase
        .from("games")
        .update(updateData)
        .eq("id", gameId);

      if (error) throw error;

      toast({
        title: newValue ? "Stage Verified" : "Stage Unverified",
        description: `Progress permanently saved for ${stage} module.`,
      });
    } catch (err: any) {
      setStagesVerified(prev => ({ ...prev, [stage]: isCurrentlyVerified }));
      logError("Update Stage", 500, err.message, err);
    }
  };

  const handleStartProcess = async () => {
    if (!stagesVerified.setup) {
      showBanner("Step 01 (Setup) must be verified before starting AI analysis.", "warning", "PRE-FLIGHT BLOCKED");
      return;
    }

    setIsProcessing(true);
    const requestBody = { gameId: gameId };
    
    try {
      const res = await axios.post('/api/process-game', requestBody);
      showBanner("GPU Analysis Engine Dispatched Successfully", "success", "ANALYSIS INITIATED");
      loadGameData();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message;
      const status = err.response?.status || 500;
      
      logError("/api/process-game", status, errorMsg, err.response?.data, requestBody);
      showBanner(`AI Dispatch Failure: ${errorMsg}`, "error", "GPU CRITICAL 401/500");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-screen"><RefreshCw className="w-8 h-8 animate-spin text-primary" /></div></Layout>;

  return (
    <Layout title={`Game Details | ${game.home_team?.name} vs ${game.away_team?.name}`}>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-secondary/20 p-6 rounded-2xl border border-white/5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-primary border-primary/50 bg-primary/5">Elite Scouting</Badge>
              <span className="text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">{game.date ? new Date(game.date).toLocaleDateString() : 'No date'}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              {game.home_team?.name || 'Home Team'} <span className="text-muted-foreground mx-2">vs</span> {game.away_team?.name || 'Away Team'}
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm"
              className={cn(
                "gap-2 border-destructive/50 text-destructive hover:bg-destructive/10",
                errors.length > 0 && "animate-pulse border-destructive"
              )}
              onClick={() => setIsErrorMonitorOpen(true)}
            >
              <AlertCircle className="h-4 w-4" />
              Logs ({errors.length})
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.back()}>Back to Queue</Button>
            <Button size="sm" className="gap-2" onClick={handleStartProcess} disabled={isProcessing}>
              <PlayCircle className={cn("w-4 h-4", isProcessing && "animate-pulse")} />
              {isProcessing ? "Processing..." : "Run AI Scouting"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-black border-white/10 overflow-hidden rounded-2xl shadow-2xl">
              <div className="aspect-video bg-muted flex items-center justify-center relative">
                {videoUrl ? (
                  <VideoPlayer videoUrl={videoUrl} />
                ) : (
                  <div className="text-center space-y-4">
                    <Video className="w-12 h-12 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">Video stream pending...</p>
                  </div>
                )}
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ModuleCard 
                title="01. Setup & Calibration" 
                status={stagesVerified.setup ? "complete" : "pending"}
                description="Team selection and jersey color detection."
                onAction={() => setShowTeamsModal(true)}
                isVerified={stagesVerified.setup}
                onVerify={() => toggleStageVerify('setup')}
              />
              <ModuleCard 
                title="02. AI GPU Analysis" 
                status={stagesVerified.analysis ? "complete" : (game?.processing_status === 'analyzing' ? "processing" : "pending")}
                description="Heavy GPU inference for player tracking."
                onAction={handleStartProcess}
                disabled={!stagesVerified.setup}
                isVerified={stagesVerified.analysis}
                onVerify={() => toggleStageVerify('analysis')}
              />
              <ModuleCard 
                title="03. Personnel Mapping" 
                status={stagesVerified.mapping ? "complete" : "pending"}
                description="Map AI entities to roster players."
                onAction={() => setShowMappingModal(true)}
                disabled={!stagesVerified.analysis}
                isVerified={stagesVerified.mapping}
                onVerify={() => toggleStageVerify('mapping')}
              />
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <Card className="bg-secondary/10 border-white/5">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                  <BarChart3 className="w-4 h-4" />
                  Scouting Lifecycle
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <StageItem 
                  step="01" 
                  title="Video Ingest" 
                  status="completed" 
                  description="8GB Cloudflare R2 Upload verified."
                />
                <StageItem 
                  step="02" 
                  title="AI Inference" 
                  status={game.analysis_status === 'processing' ? 'active' : game.analysis_status === 'completed' ? 'completed' : 'pending'} 
                  description="GPU Object Tracking & Player Detection."
                />
                <StageItem 
                  step="03" 
                  title="Mapping" 
                  status={stagesVerified.mapping ? 'completed' : 'pending'} 
                  description="AI-to-Human entity verification."
                />
                <StageItem 
                  step="04" 
                  title="Tactical Boxscore" 
                  status={stagesVerified.finalize ? 'completed' : 'pending'} 
                  description="Generating elite analytics dashboard."
                />
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-primary" />
                  System Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Modal GPU Status</span>
                  <span className="flex items-center gap-1.5 text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Online
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <EditGameTeamsModal 
        game={game}
        isOpen={showTeamsModal} 
        onClose={() => setShowTeamsModal(false)}
        onUpdated={loadGameData}
      />

      {showMappingModal && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm p-4 md:p-10">
          <Card className="w-full h-full flex flex-col border-primary/20 overflow-hidden shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between bg-secondary/20 border-b border-white/5 p-4">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  Elite Mapping Engine
                </CardTitle>
                <CardDescription>AI-to-Human Identity Resolution</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowMappingModal(false)}>
                <AlertCircle className="w-5 h-5 rotate-45" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              <MappingDashboard 
                gameId={gameId as string} 
                aiMappings={aiMappings}
                homeRoster={homeRoster}
                awayRoster={awayRoster}
                homeColor={game?.home_team_color}
                awayColor={game?.away_team_color}
                onRefresh={fetchMappingData}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <ErrorMonitor 
        errors={errors} 
        onDismiss={dismissError} 
        onDismissAll={dismissAll} 
        isOpen={isErrorMonitorOpen}
        onToggle={() => setIsErrorMonitorOpen(!isErrorMonitorOpen)}
      />
    </Layout>
  );
}

function ModuleCard({ title, status, description, onAction, disabled, isVerified, onVerify }: any) {
  const getStatusColor = () => {
    if (status === 'complete') return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (status === 'processing') return 'bg-primary/20 text-primary border-primary/30 animate-pulse';
    return 'bg-muted/50 text-muted-foreground border-white/5';
  };

  return (
    <Card className={`p-5 transition-all duration-300 border bg-secondary/20 relative ${disabled ? 'opacity-50 grayscale pointer-events-none' : 'hover:border-primary/40'}`}>
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-bold text-sm tracking-tight">{title}</h3>
        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border ${getStatusColor()}`}>
          {status}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-4">{description}</p>
      
      <div className="flex items-center justify-between gap-3 mt-auto">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 text-[11px] font-bold border-white/10 hover:bg-white/5"
          onClick={onAction}
        >
          {status === 'complete' ? 'Review' : 'Initiate'}
        </Button>

        <div 
          className="flex items-center gap-2 cursor-pointer group"
          onClick={(e) => { e.stopPropagation(); onVerify(); }}
        >
          <div className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${isVerified ? 'bg-primary border-primary' : 'border-white/20 group-hover:border-primary/50'}`}>
            {isVerified && <Check className="w-3 h-3 text-white" />}
          </div>
          <span className={`text-[10px] font-bold uppercase transition-colors ${isVerified ? 'text-primary' : 'text-muted-foreground'}`}>
            Verify Complete
          </span>
        </div>
      </div>
    </Card>
  );
}

function StageItem({ step, title, status, description }: any) {
  const isActive = status === 'active';
  const isCompleted = status === 'completed';

  return (
    <div className="relative pl-8 border-l border-white/10 space-y-1">
      <div className={cn(
        "absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 flex items-center justify-center",
        isCompleted ? "bg-green-500 border-green-500" : 
        isActive ? "bg-primary border-primary animate-pulse" : 
        "bg-secondary border-muted"
      )}>
        {isCompleted && <CheckCircle2 className="w-3 h-3 text-white" />}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-muted-foreground">{step}</span>
        <h4 className={cn("text-sm font-semibold", isActive && "text-primary")}>{title}</h4>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}