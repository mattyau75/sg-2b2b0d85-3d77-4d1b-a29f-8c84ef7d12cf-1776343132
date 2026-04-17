import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VideoPlayer } from "@/components/VideoPlayer";
import { EditGameTeamsModal } from "@/components/EditGameTeamsModal";
import { MappingDashboard } from "@/components/MappingDashboard";
import { ShotChart } from "@/components/ShotChart";
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
  Check,
  AlertTriangle,
  Terminal,
  Zap,
  Activity,
  Info,
  ChevronRight,
  Target,
  MousePointer2
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
import { WorkerLogs } from "@/components/WorkerLogs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BoxScore } from "@/components/BoxScore";
import { PlayByPlayFeed } from "@/components/PlayByPlayFeed";

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
  const [isCommandCenterOpen, setIsCommandCenterOpen] = useState(false);

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

  const handleStartAnalysis = async () => {
    if (!gameId) return;
    setIsProcessing(true);
    const requestBody = { gameId: gameId };
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token 
        ? { Authorization: `Bearer ${session.access_token}` } 
        : {};

      await axios.post('/api/process-game', requestBody, { headers });
      showBanner("GPU Analysis Engine Dispatched Successfully", "success", "ANALYSIS INITIATED");
      loadGameData();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message;
      logError("/api/process-game", err.response?.status || 500, errorMsg, err.response?.data, requestBody);
      showBanner(`AI Dispatch Failure: ${errorMsg}`, "error", "GPU CRITICAL");
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
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono uppercase tracking-widest">
              <span className="text-primary font-bold">{game?.venue || 'Elite Scouting'}</span>
              <span>•</span>
              <span>{game.created_at ? new Date(game.created_at).toLocaleDateString() : 'No date'}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              {game.home_team?.name || 'Home Team'} <span className="text-muted-foreground mx-2">vs</span> {game.away_team?.name || 'Away Team'}
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Floating AI Command Center Trigger */}
             <Dialog open={isCommandCenterOpen} onOpenChange={setIsCommandCenterOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className={cn(
                      "h-12 w-12 rounded-full border-primary/20 bg-primary/5 hover:bg-primary/10 group relative transition-all",
                      game?.status === 'analyzing' && "animate-pulse border-primary shadow-[0_0_15px_rgba(255,100,0,0.3)]"
                    )}
                  >
                    <Cpu className={cn("h-6 w-6 text-primary group-hover:scale-110 transition-transform")} />
                    {game?.status === 'analyzing' && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-accent text-[8px] font-black items-center justify-center text-black">AI</span>
                      </span>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl bg-background/95 backdrop-blur-2xl border-white/5 p-0 overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-3 h-[600px]">
                    {/* Progress Sidebar */}
                    <div className="p-8 border-r border-white/5 space-y-8 bg-black/40">
                      <div className="space-y-2">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                          <Activity className="h-5 w-5 text-primary" /> AI Cluster Engine
                        </h2>
                        <p className="text-xs text-muted-foreground font-mono">Real-time GPU Synchronization Status</p>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-mono font-bold uppercase">
                            <span>Analysis Momentum</span>
                            <span>{game?.progress_percentage || 0}%</span>
                          </div>
                          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all duration-1000" 
                              style={{ width: `${game?.progress_percentage || 0}%` }}
                            />
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
                          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Current Phase</p>
                          <p className="text-xs font-medium text-white italic">{game?.status_message || 'Cluster Warming...'}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 pt-4">
                           <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                              <p className="text-[8px] text-muted-foreground uppercase">GPU Health</p>
                              <p className="text-xs font-bold text-accent">99.2%</p>
                           </div>
                           <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                              <p className="text-[8px] text-muted-foreground uppercase">Latency</p>
                              <p className="text-xs font-bold text-blue-400">0.4s/f</p>
                           </div>
                        </div>
                      </div>

                      <div className="pt-8">
                         <Button 
                           variant="destructive" 
                           className="w-full h-10 text-xs font-bold uppercase tracking-widest border border-red-500/20"
                           disabled={game?.status !== 'analyzing'}
                           onClick={async () => {
                             if (confirm("Terminate GPU job immediately?")) {
                               await supabase.from("games").update({ status: 'cancelled' }).eq("id", gameId);
                               setIsCommandCenterOpen(false);
                               loadGameData();
                             }
                           }}
                         >
                           Terminate Analysis
                         </Button>
                      </div>
                    </div>

                    {/* Technical Trace Log */}
                    <div className="md:col-span-2 p-0 flex flex-col bg-black/60">
                       <WorkerLogs gameId={gameId as string} />
                    </div>
                  </div>
                </DialogContent>
             </Dialog>

            <Button variant="outline" size="sm" onClick={() => router.back()}>Queue</Button>
            <Button size="sm" className="gap-2" onClick={handleStartAnalysis} disabled={isProcessing}>
              <PlayCircle className={cn("w-4 h-4", isProcessing && "animate-pulse")} />
              {isProcessing ? "Processing..." : "Run AI Scouting"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-6">
            <Card className="glass-card border-none overflow-hidden aspect-video relative group">
              {videoUrl ? (
                <VideoPlayer videoUrl={videoUrl} />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted/5">
                  <div className="text-center space-y-4">
                    <Video className="w-12 h-12 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">Video stream pending...</p>
                  </div>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <Card className="glass-card border-none">
                 <CardHeader className="flex flex-row items-center justify-between">
                   <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                     <MousePointer2 className="h-4 w-4 text-primary" /> Shot Chart Intelligence
                   </CardTitle>
                 </CardHeader>
                 <CardContent>
                    <ShotChart shots={[]} />
                 </CardContent>
               </Card>
               
               <PlayByPlayFeed gameId={gameId as string} />
            </div>
          </div>

          <div className="space-y-6">
             <BoxScore gameId={gameId as string} />
             
             <Card className="glass-card border-none">
                <CardHeader>
                  <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" /> AI Mapping
                  </CardTitle>
                  <CardDescription className="text-[10px] font-mono">
                    Connect AI-detected jerseys to roster identities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MappingDashboard gameId={gameId as string} />
                </CardContent>
             </Card>
          </div>
        </div>
      </div>

      <ErrorMonitor 
        errors={errors} 
        onDismiss={dismissError} 
        onDismissAll={dismissAll} 
        isOpen={isErrorMonitorOpen}
        onToggle={() => setIsErrorMonitorOpen(!isErrorMonitorOpen)}
        forceVisible={false}
      />
    </Layout>
  );
}