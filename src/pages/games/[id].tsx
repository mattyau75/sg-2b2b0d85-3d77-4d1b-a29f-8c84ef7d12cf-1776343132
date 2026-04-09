import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { 
  Trophy, 
  Clock, 
  MapPin, 
  Users, 
  Activity, 
  RefreshCw, 
  ChevronRight, 
  Play, 
  ArrowLeft,
  Share2,
  Download,
  MoreVertical,
  Cpu,
  Video,
  ChevronLeft,
  LayoutGrid,
  List,
  Target
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { ShotChart } from "@/components/ShotChart";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VideoPlayer } from "@/components/VideoPlayer";
import { storageService } from "@/services/storageService";
import { cn } from "@/lib/utils";
import axios from "axios";

export default function GameDetailPage() {
  const [syncing, setSyncing] = useState(false);
  const [reRunning, setReRunning] = useState(false);
  const router = useRouter();
  const { id } = router.query;
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("boxscore");
  const [loading, setLoading] = useState(true);
  const [gameData, setGameData] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [playerMap, setPlayerMap] = useState<Record<string, string>>({});
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const fetchGameData = async () => {
    if (!id || typeof id !== "string") return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("games")
        .select(`
          *,
          home_team:teams!games_home_team_id_fkey(*),
          away_team:teams!games_away_team_id_fkey(*),
          play_by_play(*, player:players(*)),
          player_game_stats(*, player:players(*)),
          lineup_stats(*)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      
      setGameData(data);

      // Resolve video URL
      if (data.youtube_url) {
        setVideoUrl(data.youtube_url);
      } else if (data.video_path) {
        try {
          const signedUrl = await storageService.getSignedUrl(data.video_path);
          setVideoUrl(signedUrl);
        } catch (err) {
          console.error("Failed to get signed URL:", err);
        }
      }

      if (data.play_by_play) {
        data.play_by_play.sort((a: any, b: any) => (a.timestamp_seconds || 0) - (b.timestamp_seconds || 0));
        const pMap: Record<string, string> = {};
        data.play_by_play.forEach((e: any) => {
          if (e.player) pMap[e.player.id] = e.player.name;
        });
        setPlayerMap(pMap);
      }
    } catch (err) {
      console.error("Error fetching game:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGameData();
  }, [id]);

  const handleSyncStats = async () => {
    setSyncing(true);
    try {
      const response = await axios.post("/api/sync-game-stats", { gameId: id });
      if (response.data.success) {
        toast({ title: "Stats Synced", description: "Box score and play-by-play updated." });
        fetchGameData();
      }
    } catch (err: any) {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleReRunAnalysis = async () => {
    if (!gameData) return;
    setReRunning(true);
    try {
      const response = await axios.post("/api/process-game", { 
        gameId: id,
        videoPath: gameData.video_path,
        homeTeamId: gameData.home_team_id,
        awayTeamId: gameData.away_team_id,
        homeColor: gameData.home_team_color,
        awayColor: gameData.away_team_color
      });
      
      if (response.data.success) {
        toast({ title: "Analysis Restarted", description: "Redirecting to GPU queue..." });
        setTimeout(() => router.push("/analysis-queue"), 1500);
      }
    } catch (err: any) {
      toast({ title: "Trigger Failed", description: err.response?.data?.message || err.message, variant: "destructive" });
    } finally {
      setReRunning(false);
    }
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-96"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div></Layout>;

  if (!gameData) return <Layout title="Not Found"><div>Game Not Found</div></Layout>;

  const shotData = gameData.play_by_play
    ?.filter((e: any) => (e.event_type.includes("pt") || e.event_type.includes("shot")) && e.x_coord !== null && e.y_coord !== null)
    .map((e: any) => ({
      x: Number(e.x_coord),
      y: Number(e.y_coord),
      isMake: e.is_make,
      type: e.event_type.includes("3") ? "3PT" : "2PT",
      playerName: e.player?.name
    }));

  return (
    <Layout title={`${gameData.home_team?.name} vs ${gameData.away_team?.name}`}>
      <div className="space-y-8 pb-10">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push('/')} className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            {gameData.status === 'completed' ? (
              <Button 
                variant="outline" 
                className="gap-2 border-primary/20 hover:bg-primary/5"
                onClick={handleSyncStats}
                disabled={syncing}
              >
                <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
                {syncing ? "Syncing..." : "Re-sync Stats"}
              </Button>
            ) : (
              <Button 
                variant="outline" 
                className="gap-2 border-accent/20 hover:bg-accent/5 text-accent"
                onClick={handleReRunAnalysis}
                disabled={reRunning || !gameData.video_path}
              >
                <Cpu className={cn("h-4 w-4", reRunning && "animate-pulse")} />
                {reRunning ? "Triggering GPU..." : "Re-run AI Analysis"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleSyncStats} disabled={isSyncing} className="gap-2">
              <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
              Re-sync Stats
            </Button>
          </div>
        </div>

        {/* Scoreboard */}
        <Card className="bg-card/50 border-border overflow-hidden">
          <CardContent className="p-8">
            <div className="flex justify-between items-center">
              <div className="text-center space-y-2">
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20">
                  <Trophy className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-bold text-xl">{gameData.home_team?.name}</h3>
                <Badge variant="outline" className="font-mono text-[10px]">HOME</Badge>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-7xl font-black font-mono tracking-tighter text-foreground">
                  {gameData.home_score} <span className="text-muted/30">-</span> {gameData.away_score}
                </div>
                <Badge variant="secondary" className="mt-2 font-mono uppercase tracking-widest text-[10px]">
                  Final Result
                </Badge>
              </div>
              <div className="text-center space-y-2">
                <div className="h-16 w-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto border border-border">
                  <Trophy className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-bold text-xl">{gameData.away_team?.name}</h3>
                <Badge variant="outline" className="font-mono text-[10px]">AWAY</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-card/30 border border-border mb-6 p-1 h-auto grid grid-cols-2 md:grid-cols-5 gap-1">
            <TabsTrigger value="boxscore" className="gap-2"><LayoutGrid className="h-4 w-4" /> Boxscore</TabsTrigger>
            <TabsTrigger value="playbyplay" className="gap-2"><List className="h-4 w-4" /> Log</TabsTrigger>
            <TabsTrigger value="shotchart" className="gap-2"><Target className="h-4 w-4" /> Shots</TabsTrigger>
            <TabsTrigger value="lineups" className="gap-2"><Users className="h-4 w-4" /> Lineups</TabsTrigger>
            <TabsTrigger value="highlights" className="gap-2 text-primary"><Video className="h-4 w-4" /> Highlights</TabsTrigger>
          </TabsList>

          <TabsContent value="boxscore">
             <Card className="bg-card/20 border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-center">PTS</TableHead>
                      <TableHead className="text-center">REB</TableHead>
                      <TableHead className="text-center">AST</TableHead>
                      <TableHead className="text-center">FG</TableHead>
                      <TableHead className="text-center">3PT</TableHead>
                      <TableHead className="text-right">+/-</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gameData.player_game_stats?.map((s: any) => (
                      <TableRow key={s.id} className="hover:bg-muted/10 transition-colors">
                        <TableCell className="font-bold">
                          {s.player?.name} <span className="text-muted-foreground text-[10px] ml-1">#{s.player?.number}</span>
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-primary">{s.points}</TableCell>
                        <TableCell className="text-center font-mono">{s.rebounds}</TableCell>
                        <TableCell className="text-center font-mono">{s.assists}</TableCell>
                        <TableCell className="text-center font-mono text-xs">{s.fg_made}/{s.fg_attempted}</TableCell>
                        <TableCell className="text-center font-mono text-xs">{s.three_made}/{s.three_attempted}</TableCell>
                        <TableCell className={cn("text-right font-mono", s.plus_minus > 0 ? "text-emerald-400" : s.plus_minus < 0 ? "text-red-400" : "")}>
                          {s.plus_minus > 0 ? "+" : ""}{s.plus_minus}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
             </Card>
          </TabsContent>

          <TabsContent value="playbyplay">
            <ScrollArea className="h-[600px] rounded-xl border border-border bg-card/10">
              <div className="p-4 space-y-3">
                {gameData.play_by_play?.map((e: any) => (
                  <div key={e.id} className="flex items-center gap-4 p-4 rounded-lg bg-card/40 border border-border/50 group hover:border-primary/50 transition-all">
                    <div className="w-16 font-mono text-xs text-muted-foreground">
                      {Math.floor(e.timestamp_seconds / 60)}:{(e.timestamp_seconds % 60).toString().padStart(2, '0')}
                    </div>
                    <div className="flex-1 flex items-center gap-3">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold border",
                        e.team_id === gameData.home_team_id ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted border-border"
                      )}>
                        #{e.player?.number || '??'}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold">{e.player?.name || "Unknown Player"}</p>
                        <p className="text-xs text-muted-foreground uppercase tracking-tight">{e.event_type.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                    {e.video_url && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => window.open(e.video_url, '_blank')}>
                        <Video className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="shotchart">
            <Card className="bg-card/20 border-border p-12">
              <div className="max-w-xl mx-auto">
                <ShotChart shots={shotData || []} />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="lineups">
             <Card className="bg-card/20 border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Personnel</TableHead>
                      <TableHead className="text-center">MIN</TableHead>
                      <TableHead className="text-center">PTS FOR</TableHead>
                      <TableHead className="text-center">PTS AGN</TableHead>
                      <TableHead className="text-right">NET</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gameData.lineup_stats?.map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell className="py-4">
                          <div className="flex flex-wrap gap-1">
                            {l.player_ids.map((pid: string) => (
                              <Badge key={pid} variant="outline" className="text-[9px] px-1 h-5">
                                {playerMap[pid] || pid.substring(0, 4)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono">{l.minutes_played}</TableCell>
                        <TableCell className="text-center font-mono text-emerald-400">{l.points_for}</TableCell>
                        <TableCell className="text-center font-mono text-red-400">{l.points_against}</TableCell>
                        <TableCell className={cn("text-right font-mono font-bold", (l.points_for - l.points_against) > 0 ? "text-emerald-400" : "")}>
                          {(l.points_for - l.points_against) > 0 ? "+" : ""}{l.points_for - l.points_against}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
             </Card>
          </TabsContent>

          <TabsContent value="highlights">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {gameData.play_by_play?.filter((e: any) => e.video_url).map((clip: any) => (
                <Card key={clip.id} className="bg-card/40 border-border overflow-hidden group hover:border-primary/50 transition-all">
                  <div className="aspect-video bg-muted relative flex items-center justify-center">
                    <Video className="h-10 w-10 text-muted-foreground/30" />
                    <Button 
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-none flex items-center justify-center gap-2"
                      onClick={() => window.open(clip.video_url, '_blank')}
                    >
                      <Play className="h-5 w-5 fill-current" /> Watch Clip
                    </Button>
                  </div>
                  <CardContent className="p-4 space-y-1">
                    <p className="text-sm font-bold truncate">{clip.player?.name}</p>
                    <div className="flex justify-between items-center">
                      <Badge variant="secondary" className="text-[9px] uppercase">{clip.event_type.replace(/_/g, ' ')}</Badge>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {Math.floor(clip.timestamp_seconds / 60)}:{(clip.timestamp_seconds % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!gameData.play_by_play || gameData.play_by_play.filter((e: any) => e.video_url).length === 0) && (
                <div className="col-span-full py-20 text-center space-y-4 bg-card/20 rounded-xl border border-dashed border-border">
                  <Video className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                  <p className="text-muted-foreground">No video highlights generated for this game yet.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}