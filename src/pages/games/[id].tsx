import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings2, 
  Cpu, 
  RefreshCw, 
  ChevronLeft, 
  Calendar, 
  MapPin, 
  LayoutDashboard,
  Trophy,
  History,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ShotChart, type Shot } from "@/components/ShotChart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { storageService } from "@/services/storageService";
import { EditGameTeamsModal } from "@/components/EditGameTeamsModal";
import axios from "axios";

export default function GameDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const gameId = typeof id === "string" ? id : undefined;
  const { toast } = useToast();
  
  const [game, setGame] = useState<any>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("stats");
  const [syncing, setSyncing] = useState(false);
  const [reRunning, setReRunning] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchGameData = async () => {
    if (!gameId) return;
    
    try {
      // Fetch Game with team details
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select(`
          *,
          home_team:teams!games_home_team_id_fkey(*),
          away_team:teams!games_away_team_id_fkey(*)
        `)
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;
      setGame(gameData);

      // Fetch Shots from Play-by-Play
      const { data: pbpData, error: pbpError } = await supabase
        .from("play_by_play")
        .select(`
          id,
          x_coord,
          y_coord,
          is_make,
          event_type,
          game_time,
          player:players(name)
        `)
        .eq("game_id", gameId)
        .not("x_coord", "is", null);
      
      if (!pbpError && pbpData) {
        const formattedShots: Shot[] = pbpData.map((item: any) => ({
          id: item.id,
          x: Number(item.x_coord) || 0,
          y: Number(item.y_coord) || 0,
          is_made: !!item.is_make,
          player_name: item.player?.name || "Unknown Player",
          shot_type: item.event_type,
          timestamp: item.game_time
        }));
        setShots(formattedShots);
      }

      // Get Video URL from R2
      if (gameData?.video_path) {
        const url = await storageService.getSignedUrl(gameData.video_path);
        setVideoUrl(url);
      }
    } catch (error: any) {
      console.error("Error fetching game:", error);
      toast({
        variant: "destructive",
        title: "Error fetching game details",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (gameId) fetchGameData();
  }, [gameId]);

  const handleSyncStats = async () => {
    if (!gameId) return;
    setSyncing(true);
    try {
      await axios.post("/api/sync-game-stats", { gameId });
      toast({
        title: "Stats Synced",
        description: "Game statistics have been updated from the latest analysis data."
      });
      fetchGameData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: error.response?.data?.error || error.message
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleReAnalyze = async () => {
    if (!gameId || !game) return;
    setReRunning(true);
    try {
      await axios.post("/api/process-game", { 
        gameId,
        videoPath: game.video_path,
        homeTeamId: game.home_team_id,
        awayTeamId: game.away_team_id,
        homeColor: game.home_team_color || "#FFFFFF",
        awayColor: game.away_team_color || "#0B0F19"
      });
      toast({
        title: "Analysis Started",
        description: "GPU engine has been re-triggered for this game."
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: error.response?.data?.error || error.message
      });
    } finally {
      setReRunning(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header Navigation & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="-ml-2 h-8 text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
              onClick={() => router.push('/games')}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Back to Games
            </Button>
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
                {game?.home_team?.name || "Home"} <span className="text-primary/60 px-2 font-light">vs</span> {game?.away_team?.name || "Away"}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-medium">
                <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-primary" /> {game?.date ? new Date(game.date).toLocaleDateString() : 'Date'}</span>
                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" /> {game?.location || 'CourtVision Arena'}</span>
                <Badge variant="outline" className={cn(
                  "border-primary/20 bg-primary/5 text-primary",
                  game?.status === 'completed' && "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                )}>
                  {(game?.status || 'PENDING').toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Button 
              variant="outline" 
              className="bg-card/40 border-primary/30 hover:bg-primary/10 hover:border-primary/60 text-primary-foreground shadow-sm h-11 px-6"
              onClick={() => setIsEditModalOpen(true)}
            >
              <Settings2 className="h-4.5 w-4.5 mr-2 text-primary" />
              Edit Teams
            </Button>
            
            <Button 
              variant="outline" 
              className="bg-card/40 border-muted hover:bg-white/5 h-11 px-6"
              onClick={handleSyncStats}
              disabled={syncing}
            >
              <RefreshCw className={cn("h-4.5 w-4.5 mr-2", syncing && "animate-spin")} />
              {syncing ? "Syncing..." : "Sync Stats"}
            </Button>

            {game?.video_path && (
              <Button 
                variant="default"
                className="bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 h-11 px-6 font-semibold"
                onClick={handleReAnalyze}
                disabled={reRunning}
              >
                <Cpu className={cn("h-4.5 w-4.5 mr-2", reRunning && "animate-pulse")} />
                {reRunning ? "Processing..." : "Re-analyze Game"}
              </Button>
            )}
          </div>
        </div>

        {/* Video & Scoreboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            {videoUrl ? (
              <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-2xl border border-white/5 bg-black ring-1 ring-white/10">
                <VideoPlayer url={videoUrl} className="w-full h-full" />
              </div>
            ) : (
              <Card className="aspect-video flex items-center justify-center bg-card/20 border-dashed border-2 border-white/5 rounded-2xl">
                <div className="text-center space-y-2">
                  <Activity className="h-10 w-10 text-muted/30 mx-auto animate-pulse" />
                  <p className="text-muted-foreground font-medium">Video stream initializing...</p>
                </div>
              </Card>
            )}
          </div>

          <div className="lg:col-span-4">
            <Card className="bg-card/40 border-white/5 backdrop-blur-sm h-full overflow-hidden shadow-xl">
              <div className="p-6 border-b border-white/5 bg-gradient-to-br from-primary/10 to-transparent">
                <h3 className="text-lg font-bold flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /> Live Scoreboard</h3>
              </div>
              <CardContent className="p-8 space-y-8">
                <div className="flex justify-between items-center text-center">
                  <div className="space-y-3">
                    <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center mx-auto text-2xl font-black text-primary shadow-inner">
                      {game?.home_team?.name?.charAt(0) || 'H'}
                    </div>
                    <p className="font-bold text-white tracking-tight">{game?.home_team?.name || "Home"}</p>
                  </div>
                  <div className="text-center">
                    <div className="text-6xl font-black tracking-tighter text-white drop-shadow-sm font-mono">
                      {game?.home_score || 0}<span className="text-primary px-1">-</span>{game?.away_score || 0}
                    </div>
                    <Badge variant="outline" className="mt-2 bg-black/40 border-white/10 text-xs font-mono tracking-widest uppercase py-1 px-3">
                      Quarter 4 • 0:00
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    <div className="w-16 h-16 rounded-full bg-muted/20 border-2 border-white/10 flex items-center justify-center mx-auto text-2xl font-black text-white/40">
                      {game?.away_team?.name?.charAt(0) || 'A'}
                    </div>
                    <p className="font-bold text-white tracking-tight">{game?.away_team?.name || "Away"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Analysis Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-card/40 border border-white/5 p-1.5 h-auto grid grid-cols-2 md:grid-cols-4 gap-2 mb-8">
            <TabsTrigger value="stats" className="data-[state=active]:bg-primary data-[state=active]:text-white h-11 font-semibold transition-all">
              <LayoutDashboard className="h-4 w-4 mr-2" /> Box Score
            </TabsTrigger>
            <TabsTrigger value="shotchart" className="data-[state=active]:bg-primary data-[state=active]:text-white h-11 font-semibold transition-all">
              <Activity className="h-4 w-4 mr-2" /> Shot Chart
            </TabsTrigger>
            <TabsTrigger value="playbyplay" className="data-[state=active]:bg-primary data-[state=active]:text-white h-11 font-semibold transition-all">
              <History className="h-4 w-4 mr-2" /> Play-by-Play
            </TabsTrigger>
            <TabsTrigger value="insights" className="data-[state=active]:bg-primary data-[state=active]:text-white h-11 font-semibold transition-all">
              <Trophy className="h-4 w-4 mr-2" /> Elite Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stats">
            <Card className="bg-card/40 border-white/5 shadow-2xl">
              <CardContent className="p-0">
                <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                  <h3 className="font-bold text-lg flex items-center gap-2"><LayoutDashboard className="h-5 w-5 text-primary" /> Advanced Metrics</h3>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-black/20">
                      <TableRow className="hover:bg-transparent border-white/5">
                        <TableHead className="w-[200px] font-bold text-primary">PLAYER</TableHead>
                        <TableHead className="text-center font-bold">PTS</TableHead>
                        <TableHead className="text-center font-bold">REB</TableHead>
                        <TableHead className="text-center font-bold">AST</TableHead>
                        <TableHead className="text-center font-bold">STL</TableHead>
                        <TableHead className="text-center font-bold">BLK</TableHead>
                        <TableHead className="text-center font-bold">FG%</TableHead>
                        <TableHead className="text-center font-bold text-primary">EFF</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <TableRow key={i} className="border-white/5 hover:bg-white/5 transition-colors cursor-default">
                          <TableCell className="font-semibold text-white">#{(i * 7) % 30} Player Name</TableCell>
                          <TableCell className="text-center font-mono">{10 + i * 2}</TableCell>
                          <TableCell className="text-center font-mono">{i + 2}</TableCell>
                          <TableCell className="text-center font-mono">{i}</TableCell>
                          <TableCell className="text-center font-mono">1</TableCell>
                          <TableCell className="text-center font-mono">0</TableCell>
                          <TableCell className="text-center font-mono">45.5%</TableCell>
                          <TableCell className="text-center font-mono font-bold text-primary">+{15 + i}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shotchart">
            <Card className="bg-card/40 border-white/5 shadow-2xl p-8">
              <ShotChart shots={shots} />
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Teams Modal Integration */}
        {game && (
          <EditGameTeamsModal 
            game={game} 
            isOpen={isEditModalOpen} 
            onClose={() => setIsEditModalOpen(false)} 
            onUpdated={fetchGameData} 
          />
        )}
      </div>
    </Layout>
  );
}