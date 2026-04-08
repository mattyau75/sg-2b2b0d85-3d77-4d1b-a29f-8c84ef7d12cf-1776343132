import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { 
  Trophy, 
  Calendar, 
  Clock, 
  ChevronLeft, 
  Play, 
  Target, 
  ListOrdered, 
  Table as TableIcon,
  Download,
  Share2,
  Video,
  Users
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { ShotChart } from "@/components/ShotChart";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { supabase } from "@/integrations/supabase/client";

export default function GameDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [activeTab, setActiveTab] = useState("boxscore");
  const [loading, setLoading] = useState(true);
  const [gameData, setGameData] = useState<any>(null);

  useEffect(() => {
    if (!id || typeof id !== "string") return;
    
    const fetchGameData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("games")
          .select(`
            *,
            home_team:teams!games_home_team_id_fkey(*),
            away_team:teams!games_away_team_id_fkey(*),
            play_by_play(*),
            player_game_stats(
              *,
              player:players(*)
            ),
            lineup_stats(*)
          `)
          .eq("id", id)
          .single();

        if (error) throw error;
        setGameData(data);
      } catch (err) {
        console.error("Error fetching game:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGameData();
  }, [id]);

  // Mock shots for the chart
  const mockShots = [
    { id: "1", x: 250, y: 52, is_made: true, player_name: "S. Curry", shot_type: "Layup", timestamp: "Q4 0:45" }
  ];

  // Mock data for the demonstration (fallback if no DB data)
  const gameInfo = gameData ? {
    homeTeam: gameData.home_team?.name,
    awayTeam: gameData.away_team?.name,
    homeScore: 112, // Calculated from stats in real use
    awayScore: 108,
    date: new Date(gameData.date).toLocaleDateString(),
    status: gameData.status,
    arena: gameData.venue,
    attendance: "18,064"
  } : {
    homeTeam: "Golden State Warriors",
    awayTeam: "LA Lakers",
    homeScore: 112,
    awayScore: 108,
    date: "2024-04-08",
    status: "Final",
    arena: "Chase Center",
    attendance: "18,064"
  };

  const boxscore = [
    { name: "Stephen Curry", pos: "G", min: "34", pts: 32, reb: 5, ast: 8, stl: 2, blk: 0, tov: 3, fg: "11-21", three: "6-12", ft: "4-4", plusMinus: "+12" },
    { name: "Klay Thompson", pos: "G", min: "30", pts: 18, reb: 3, ast: 2, stl: 1, blk: 1, tov: 1, fg: "7-15", three: "4-9", ft: "0-0", plusMinus: "+5" },
    { name: "Draymond Green", pos: "F", min: "32", pts: 8, reb: 10, ast: 11, stl: 3, blk: 2, tov: 4, fg: "3-6", three: "1-2", ft: "1-2", plusMinus: "+8" },
    { name: "Andrew Wiggins", pos: "F", min: "28", pts: 14, reb: 6, ast: 1, stl: 0, blk: 1, tov: 2, fg: "5-11", three: "2-5", ft: "2-3", plusMinus: "+2" },
    { name: "Kevon Looney", pos: "C", min: "24", pts: 6, reb: 12, ast: 3, stl: 1, blk: 0, tov: 0, fg: "3-4", three: "0-0", ft: "0-0", plusMinus: "-3" },
  ];

  const playByPlay = [
    { qtr: 4, time: "0:45", event: "Stephen Curry makes 26-foot three point jumper", score: "112-108", type: "shot", player: "S. Curry" },
    { qtr: 4, time: "1:12", event: "LeBron James misses 14-foot fadeaway jumper", score: "109-108", type: "miss", player: "L. James" },
    { qtr: 4, time: "2:05", event: "Anthony Davis blocks Draymond Green's layup", score: "109-108", type: "block", player: "A. Davis" },
    { qtr: 4, time: "3:30", event: "Klay Thompson makes 23-foot three point jumper (S. Curry assists)", score: "109-105", type: "shot", player: "K. Thompson" },
  ];

  if (loading) {
    return (
      <Layout title="Loading Game | CourtVision Elite">
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground font-mono animate-pulse">Synchronizing Tactical Data...</p>
        </div>
      </Layout>
    );
  }

  if (!gameData) {
    return (
      <Layout title="Game Not Found | CourtVision Elite">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
          <div className="h-20 w-20 bg-destructive/10 rounded-full flex items-center justify-center border border-destructive/20">
            <Trophy className="h-10 w-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Analysis Not Found</h2>
            <p className="text-muted-foreground max-w-xs mx-auto">
              We couldn't find the data for this specific game. It may have been deleted or the analysis is still pending.
            </p>
          </div>
          <Button onClick={() => window.location.href = "/"}>Back to Dashboard</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`${gameInfo.homeTeam} vs ${gameInfo.awayTeam} | CourtVision`}>
      <div className="space-y-8 pb-10">
        {/* Header Navigation */}
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            className="text-muted-foreground hover:text-foreground gap-2 pl-0"
            onClick={() => router.push('/')}
          >
            <ChevronLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="border-border gap-2 text-xs">
              <Download className="h-3 w-3" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" className="border-border gap-2 text-xs">
              <Share2 className="h-3 w-3" /> Share Analysis
            </Button>
          </div>
        </div>

        {/* Scoreboard Hero */}
        <Card className="bg-card/50 border-border overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />
          <CardContent className="p-8 md:p-12 relative">
            <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-8 text-center md:text-left">
              {/* Home Team */}
              <div className="flex flex-col items-center md:items-start gap-4">
                <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-xl shadow-primary/5">
                  <Trophy className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold">{gameInfo.homeTeam}</h2>
                  <p className="text-muted-foreground font-mono text-sm tracking-widest">HOME</p>
                </div>
              </div>

              {/* Score */}
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="flex items-center gap-6 md:gap-10">
                  <span className="text-5xl md:text-7xl font-bold tracking-tighter">{gameInfo.homeScore}</span>
                  <span className="text-xl md:text-2xl text-muted-foreground font-light">vs</span>
                  <span className="text-5xl md:text-7xl font-bold tracking-tighter">{gameInfo.awayScore}</span>
                </div>
                <Badge variant="outline" className="mt-4 bg-muted/50 border-border text-xs uppercase tracking-[0.2em] px-4">
                  {gameInfo.status}
                </Badge>
              </div>

              {/* Away Team */}
              <div className="flex flex-col items-center md:items-end gap-4 text-center md:text-right">
                <div className="h-20 w-20 rounded-3xl bg-muted flex items-center justify-center border border-border shadow-xl">
                  <Trophy className="h-10 w-10 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold">{gameInfo.awayTeam}</h2>
                  <p className="text-muted-foreground font-mono text-sm tracking-widest">AWAY</p>
                </div>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-border/50 flex flex-wrap justify-center md:justify-between items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{gameInfo.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{gameInfo.arena}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-accent/50 text-accent font-mono text-[10px]">AI-VERIFIED</Badge>
                <Badge variant="outline" className="border-primary/50 text-primary font-mono text-[10px]">GPU PROCESSED</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tactical Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card/50 border border-border p-1 h-12">
            <TabsTrigger value="boxscore" className="data-[state=active]:bg-primary data-[state=active]:text-white gap-2 px-6">
              <TableIcon className="h-4 w-4" /> Boxscore
            </TabsTrigger>
            <TabsTrigger value="playbyplay" className="data-[state=active]:bg-primary data-[state=active]:text-white gap-2 px-6">
              <ListOrdered className="h-4 w-4" /> Play-by-Play
            </TabsTrigger>
            <TabsTrigger value="shotchart" className="data-[state=active]:bg-primary data-[state=active]:text-white gap-2 px-6">
              <Target className="h-4 w-4" /> Shot Chart
            </TabsTrigger>
            <TabsTrigger value="lineups" className="data-[state=active]:bg-primary data-[state=active]:text-white gap-2 px-6">
              <Users className="h-4 w-4" /> Lineups
            </TabsTrigger>
          </TabsList>

          <TabsContent value="boxscore" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Card className="bg-card/30 border-border overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/20">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" /> {gameInfo.homeTeam} Player Stats
                </CardTitle>
              </CardHeader>
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-[200px] text-xs uppercase tracking-widest font-mono">Player</TableHead>
                    <TableHead className="text-center text-xs uppercase tracking-widest font-mono">MIN</TableHead>
                    <TableHead className="text-center text-xs uppercase tracking-widest font-mono text-primary font-bold">PTS</TableHead>
                    <TableHead className="text-center text-xs uppercase tracking-widest font-mono">REB</TableHead>
                    <TableHead className="text-center text-xs uppercase tracking-widest font-mono">AST</TableHead>
                    <TableHead className="text-center text-xs uppercase tracking-widest font-mono">STL</TableHead>
                    <TableHead className="text-center text-xs uppercase tracking-widest font-mono">BLK</TableHead>
                    <TableHead className="text-center text-xs uppercase tracking-widest font-mono">FG</TableHead>
                    <TableHead className="text-center text-xs uppercase tracking-widest font-mono">3PT</TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-widest font-mono">+/-</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boxscore.map((player) => (
                    <TableRow key={player.name} className="border-border hover:bg-muted/20 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{player.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{player.pos}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">{player.min}</TableCell>
                      <TableCell className="text-center font-mono text-sm font-bold text-primary">{player.pts}</TableCell>
                      <TableCell className="text-center font-mono text-sm">{player.reb}</TableCell>
                      <TableCell className="text-center font-mono text-sm">{player.ast}</TableCell>
                      <TableCell className="text-center font-mono text-sm">{player.stl}</TableCell>
                      <TableCell className="text-center font-mono text-sm">{player.blk}</TableCell>
                      <TableCell className="text-center font-mono text-sm text-muted-foreground">{player.fg}</TableCell>
                      <TableCell className="text-center font-mono text-sm text-muted-foreground">{player.three}</TableCell>
                      <TableCell className={`text-right font-mono text-sm ${player.plusMinus.startsWith('+') ? 'text-green-500' : 'text-accent'}`}>
                        {player.plusMinus}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="playbyplay" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                {playByPlay.map((play, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 rounded-xl bg-card/40 border border-border hover:bg-card/60 transition-all group">
                    <div className="flex flex-col items-center gap-1 w-16 pt-1">
                      <span className="text-xs font-bold text-primary">Q{play.qtr}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{play.time}</span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-relaxed">{play.event}</p>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-[10px] uppercase border-border bg-muted/30">
                          {play.type.toUpperCase()}
                        </Badge>
                        <span className="text-[10px] font-mono text-muted-foreground">{play.score}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary group-hover:scale-110 transition-all">
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="space-y-6">
                <Card className="bg-card/50 border-border sticky top-24">
                  <CardHeader>
                    <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Video className="h-4 w-4 text-primary" /> Live Clip Review
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-xl overflow-hidden border border-border bg-black">
                      <AspectRatio ratio={16/9}>
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs font-mono">
                          VIDEO_READY_FOR_PLAYBACK
                        </div>
                      </AspectRatio>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Select any play from the timeline to automatically sync the video player to the correct game timestamp.
                    </p>
                    <Button className="w-full bg-primary hover:bg-primary/90 text-xs uppercase tracking-widest font-bold">
                      View All Clips
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="shotchart" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <Card className="bg-card/30 border-border p-8">
                  <ShotChart shots={mockShots} />
                </Card>
              </div>
              <div className="space-y-6">
                <Card className="bg-card/50 border-border">
                  <CardHeader>
                    <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Shot Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs">
                        <span>Paint Points</span>
                        <span className="font-mono text-primary">48</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-[48%]" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs">
                        <span>Mid-Range Efficiency</span>
                        <span className="font-mono text-accent">42.5%</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-accent w-[42%]" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs">
                        <span>Corner Three Attempts</span>
                        <span className="font-mono text-primary">14</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-[65%]" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-6">
                    <p className="text-xs text-primary font-bold uppercase tracking-widest mb-2">AI Scouting Report</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      The Warriors high-screen action generated a 1.25 PPP (Points Per Possession) during the 4th quarter. Stephen Curry's gravity created 12 "Wide Open" looks for perimeter shooters.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="lineups" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Card className="bg-card/30 border-border overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/20">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> Tactical Lineup Efficiency
                </CardTitle>
              </CardHeader>
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-[350px] text-xs uppercase tracking-widest font-mono">5-Player Unit</TableHead>
                    <TableHead className="text-center text-xs uppercase tracking-widest font-mono">MIN</TableHead>
                    <TableHead className="text-center text-xs uppercase tracking-widest font-mono">PTS +/-</TableHead>
                    <TableHead className="text-center text-xs uppercase tracking-widest font-mono text-primary font-bold">OFF RTG</TableHead>
                    <TableHead className="text-center text-xs uppercase tracking-widest font-mono text-accent font-bold">DEF RTG</TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-widest font-mono font-bold">NET RTG</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gameData?.lineup_stats?.length > 0 ? (
                    gameData.lineup_stats.map((lineup: any, index: number) => {
                      const netRtg = ((lineup.points_for - lineup.points_against) / (lineup.possessions || 1) * 100).toFixed(1);
                      const offRtg = (lineup.points_for / (lineup.possessions || 1) * 100).toFixed(1);
                      const defRtg = (lineup.points_against / (lineup.possessions || 1) * 100).toFixed(1);
                      
                      return (
                        <TableRow key={index} className="border-border hover:bg-muted/20 transition-colors">
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {lineup.player_ids.slice(0, 5).map((pid: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-[9px] bg-muted/50 border-border px-1">
                                  {gameData.player_game_stats?.find((p: any) => p.player_id === pid)?.player?.name?.split(' ').pop() || "Player"}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono text-sm">{lineup.minutes_played}</TableCell>
                          <TableCell className={`text-center font-mono text-sm ${(lineup.points_for - lineup.points_against) >= 0 ? 'text-green-500' : 'text-accent'}`}>
                            {lineup.points_for - lineup.points_against >= 0 ? '+' : ''}{lineup.points_for - lineup.points_against}
                          </TableCell>
                          <TableCell className="text-center font-mono text-sm text-primary font-bold">{offRtg}</TableCell>
                          <TableCell className="text-center font-mono text-sm text-accent font-bold">{defRtg}</TableCell>
                          <TableCell className={`text-right font-mono text-sm font-bold ${Number(netRtg) >= 0 ? 'text-green-500' : 'text-accent'}`}>
                            {Number(netRtg) >= 0 ? '+' : ''}{netRtg}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground font-mono text-sm">
                        No lineup data tracked for this game yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}