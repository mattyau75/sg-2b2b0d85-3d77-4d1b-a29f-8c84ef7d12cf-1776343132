import React, { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, TrendingUp, TrendingDown, Minus, Target, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface TeamStats {
  team_id: string;
  team_name: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fg_made: number;
  fg_attempted: number;
  three_pt_made: number;
  three_pt_attempted: number;
  ft_made: number;
  ft_attempted: number;
}

export default function TeamCompare() {
  const [games, setGames] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState<string>("");
  const [homeStats, setHomeStats] = useState<TeamStats | null>(null);
  const [awayStats, setAwayStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchGames();
  }, []);

  useEffect(() => {
    if (selectedGame) {
      fetchTeamStats();
    }
  }, [selectedGame]);

  const fetchGames = async () => {
    const { data } = await supabase
      .from("games")
      .select(`
        id,
        venue,
        created_at,
        home_team:teams!games_home_team_id_fkey(id, name),
        away_team:teams!games_away_team_id_fkey(id, name)
      `)
      .eq("status", "completed")
      .order("created_at", { ascending: false });
    
    if (data) setGames(data);
  };

  const fetchTeamStats = async () => {
    setLoading(true);
    try {
      const { data: gameData } = await supabase
        .from("games")
        .select("home_team_id, away_team_id, home_team:teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name)")
        .eq("id", selectedGame)
        .single();

      if (!gameData) return;

      const { data: boxScores } = await supabase
        .from("box_scores")
        .select("*")
        .eq("game_id", selectedGame);

      if (boxScores) {
        const homeTeamStats = aggregateTeamStats(boxScores.filter(s => s.team_id === gameData.home_team_id), gameData.home_team_id, gameData.home_team.name);
        const awayTeamStats = aggregateTeamStats(boxScores.filter(s => s.team_id === gameData.away_team_id), gameData.away_team_id, gameData.away_team.name);
        setHomeStats(homeTeamStats);
        setAwayStats(awayTeamStats);
      }
    } finally {
      setLoading(false);
    }
  };

  const aggregateTeamStats = (playerStats: any[], teamId: string, teamName: string): TeamStats => {
    return {
      team_id: teamId,
      team_name: teamName,
      points: playerStats.reduce((sum, p) => sum + (p.points || 0), 0),
      rebounds: playerStats.reduce((sum, p) => sum + (p.rebounds || 0), 0),
      assists: playerStats.reduce((sum, p) => sum + (p.assists || 0), 0),
      steals: playerStats.reduce((sum, p) => sum + (p.steals || 0), 0),
      blocks: playerStats.reduce((sum, p) => sum + (p.blocks || 0), 0),
      turnovers: playerStats.reduce((sum, p) => sum + (p.turnovers || 0), 0),
      fg_made: playerStats.reduce((sum, p) => sum + (p.fg_made || 0), 0),
      fg_attempted: playerStats.reduce((sum, p) => sum + (p.fg_attempted || 0), 0),
      three_pt_made: playerStats.reduce((sum, p) => sum + (p.three_pt_made || 0), 0),
      three_pt_attempted: playerStats.reduce((sum, p) => sum + (p.three_pt_attempted || 0), 0),
      ft_made: playerStats.reduce((sum, p) => sum + (p.ft_made || 0), 0),
      ft_attempted: playerStats.reduce((sum, p) => sum + (p.ft_attempted || 0), 0),
    };
  };

  const calculatePercentage = (made: number, attempted: number) => {
    if (!attempted) return 0;
    return ((made / attempted) * 100).toFixed(1);
  };

  const getDelta = (home: number, away: number) => {
    const diff = home - away;
    if (diff > 0) return { icon: TrendingUp, color: "text-emerald-400", value: `+${diff}` };
    if (diff < 0) return { icon: TrendingDown, color: "text-red-400", value: diff };
    return { icon: Minus, color: "text-muted-foreground", value: "0" };
  };

  const renderStatRow = (label: string, homeValue: number | string, awayValue: number | string, showDelta = true) => {
    const delta = showDelta && typeof homeValue === 'number' && typeof awayValue === 'number' 
      ? getDelta(homeValue, awayValue) 
      : null;
    const DeltaIcon = delta?.icon;

    return (
      <TableRow className="border-white/5 hover:bg-white/5">
        <TableCell className="font-medium text-sm">{label}</TableCell>
        <TableCell className="text-center">
          <span className="font-mono font-bold text-primary">{homeValue}</span>
        </TableCell>
        <TableCell className="text-center">
          {delta && DeltaIcon && (
            <div className={cn("flex items-center justify-center gap-1", delta.color)}>
              <DeltaIcon className="h-3 w-3" />
              <span className="text-xs font-mono">{delta.value}</span>
            </div>
          )}
        </TableCell>
        <TableCell className="text-center">
          <span className="font-mono font-bold text-accent">{awayValue}</span>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Layout title="Team Comparison | DribbleStats AI Elite">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Team Comparison</h1>
            <p className="text-muted-foreground text-sm">Side-by-side statistical analysis and performance deltas.</p>
          </div>
          
          <Select value={selectedGame} onValueChange={setSelectedGame}>
            <SelectTrigger className="w-[280px] bg-card/50 border-white/10">
              <SelectValue placeholder="Select a completed game..." />
            </SelectTrigger>
            <SelectContent>
              {games.map(game => (
                <SelectItem key={game.id} value={game.id}>
                  {game.home_team?.name} vs {game.away_team?.name} • {new Date(game.created_at).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!selectedGame ? (
          <Card className="glass-card border-none">
            <CardContent className="py-24 text-center">
              <Target className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest">Select a game to compare teams</p>
            </CardContent>
          </Card>
        ) : loading ? (
          <Card className="glass-card border-none">
            <CardContent className="py-24 text-center">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </CardContent>
          </Card>
        ) : homeStats && awayStats ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Team Headers */}
            <Card className="glass-card border-none bg-primary/5">
              <CardHeader>
                <CardTitle className="text-center">
                  <div className="space-y-2">
                    <Badge variant="outline" className="border-primary/50 text-primary text-xs">Home Team</Badge>
                    <h2 className="text-2xl font-bold">{homeStats.team_name}</h2>
                    <div className="text-5xl font-black text-primary font-mono">{homeStats.points}</div>
                  </div>
                </CardTitle>
              </CardHeader>
            </Card>

            <Card className="glass-card border-none bg-accent/5">
              <CardHeader>
                <CardTitle className="text-center">
                  <div className="space-y-2">
                    <Badge variant="outline" className="border-accent/50 text-accent text-xs">Away Team</Badge>
                    <h2 className="text-2xl font-bold">{awayStats.team_name}</h2>
                    <div className="text-5xl font-black text-accent font-mono">{awayStats.points}</div>
                  </div>
                </CardTitle>
              </CardHeader>
            </Card>

            {/* Stats Comparison Table */}
            <Card className="glass-card border-none lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Statistical Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Metric</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">Home</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">Delta</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">Away</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {renderStatRow("Rebounds", homeStats.rebounds, awayStats.rebounds)}
                    {renderStatRow("Assists", homeStats.assists, awayStats.assists)}
                    {renderStatRow("Steals", homeStats.steals, awayStats.steals)}
                    {renderStatRow("Blocks", homeStats.blocks, awayStats.blocks)}
                    {renderStatRow("Turnovers", homeStats.turnovers, awayStats.turnovers)}
                    {renderStatRow("FG%", `${calculatePercentage(homeStats.fg_made, homeStats.fg_attempted)}%`, `${calculatePercentage(awayStats.fg_made, awayStats.fg_attempted)}%`, false)}
                    {renderStatRow("3P%", `${calculatePercentage(homeStats.three_pt_made, homeStats.three_pt_attempted)}%`, `${calculatePercentage(awayStats.three_pt_made, awayStats.three_pt_attempted)}%`, false)}
                    {renderStatRow("FT%", `${calculatePercentage(homeStats.ft_made, homeStats.ft_attempted)}%`, `${calculatePercentage(awayStats.ft_made, awayStats.ft_attempted)}%`, false)}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}