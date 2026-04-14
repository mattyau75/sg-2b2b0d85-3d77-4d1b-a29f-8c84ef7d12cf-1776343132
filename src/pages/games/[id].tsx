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
  ChevronRight,
  RefreshCw,
  Video
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { storageService } from "@/services/storageService";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import axios from "axios";

export default function GameDetailPage() {
  const router = useRouter();
  const id = router.query.id as string;
  const { toast } = useToast();
  
  const [game, setGame] = useState<any>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Mapping Data
  const [aiMappings, setAiMappings] = useState<any[]>([]);
  const [homeRoster, setHomeRoster] = useState<any[]>([]);
  const [awayRoster, setAwayRoster] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      fetchGame();
      fetchMappingData();
    }
  }, [id]);

  const fetchGame = async () => {
    try {
      const { data, error } = await supabase
        .from("games")
        .select(`*, home_team:home_team_id(name), away_team:away_team_id(name)`)
        .eq("id", id)
        .single();

      if (error) throw error;
      setGame(data);

      if (data.video_path) {
        if (data.video_path.startsWith('http')) {
          setVideoUrl(data.video_path);
        } else if (process.env.NEXT_PUBLIC_R2_ENDPOINT) {
          const r2Base = process.env.NEXT_PUBLIC_R2_ENDPOINT.replace(/\/$/, '');
          const bucket = process.env.NEXT_PUBLIC_R2_BUCKET_NAME || 'videos';
          setVideoUrl(`${r2Base}/${bucket}/${data.video_path}`);
        } else {
          const url = await storageService.getUrl(data.video_path);
          setVideoUrl(url);
        }
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchMappingData = async () => {
    if (!id) return;
    try {
      // Fetch AI Mappings
      const { data: mappings } = await supabase
        .from('ai_player_mappings')
        .select('*, players(*)')
        .eq('game_id', id);
      
      setAiMappings(mappings || []);

      // Fetch Rosters
      if (game?.home_team_id && game?.away_team_id) {
        const { data: home } = await supabase.from('players').select('*').eq('team_id', game.home_team_id);
        const { data: away } = await supabase.from('players').select('*').eq('team_id', game.away_team_id);
        setHomeRoster(home || []);
        setAwayRoster(away || []);
      }
    } catch (err) {
      console.error("Mapping data fetch failed:", err);
    }
  };

  const handleStartProcess = async () => {
    setIsProcessing(true);
    try {
      await axios.post('/api/process-game', { gameId: id });
      toast({ title: "AI Process Started", description: "The scouting worker has been triggered." });
    } catch (err: any) {
      toast({ title: "Process Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-screen"><RefreshCw className="w-8 h-8 animate-spin text-primary" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-20">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-secondary/20 p-6 rounded-2xl border border-white/5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-primary border-primary/50 bg-primary/5">Elite Scouting</Badge>
              <span className="text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">{new Date(game.date).toLocaleDateString()}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              {game.home_team?.name} <span className="text-muted-foreground mx-2">vs</span> {game.away_team?.name}
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.back()}>Back to Queue</Button>
            <Button size="sm" className="gap-2" onClick={handleStartProcess} disabled={isProcessing}>
              <PlayCircle className={cn("w-4 h-4", isProcessing && "animate-pulse")} />
              {isProcessing ? "Processing..." : "Run AI Scouting"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Stage: Video Player */}
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
                title="Personnel Calibration"
                description="Match team rosters and jersey colors for AI tracking."
                icon={<Settings2 className="w-5 h-5" />}
                status={game.analysis_status === 'completed' ? 'done' : 'todo'}
                actionLabel="Configure Teams"
                onClick={() => setShowTeamsModal(true)}
              />
              <ModuleCard 
                title="AI Roster Mapping"
                description="Link AI detected entities to human database records."
                icon={<Users className="w-5 h-5" />}
                status="todo"
                actionLabel="Open Mapping Engine"
                onClick={() => setShowMappingModal(true)}
                disabled={!game.analysis_status}
              />
            </div>
          </div>

          {/* Sidebar: Tactical Modules */}
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
                  status="pending" 
                  description="AI-to-Human entity verification."
                />
                <StageItem 
                  step="04" 
                  title="Tactical Boxscore" 
                  status="pending" 
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

      {/* MODALS */}
      <EditGameTeamsModal 
        game={game}
        isOpen={showTeamsModal} 
        onClose={() => setShowTeamsModal(false)}
        onUpdated={fetchGame}
      />

      {/* Mapping Engine Popup */}
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
                gameId={id} 
                aiMappings={aiMappings}
                homeRoster={homeRoster}
                awayRoster={awayRoster}
                onRefresh={fetchMappingData}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </Layout>
  );
}

function ModuleCard({ title, description, icon, status, actionLabel, onClick, disabled }: any) {
  return (
    <Card className={cn(
      "bg-secondary/10 border-white/5 transition-all hover:border-primary/30",
      disabled && "opacity-50 pointer-events-none"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            {icon}
          </div>
          {status === 'done' ? (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-muted" />
          )}
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="secondary" size="sm" className="w-full gap-2 text-xs" onClick={onClick}>
          {actionLabel}
          <ChevronRight className="w-3 h-3" />
        </Button>
      </CardContent>
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