import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Trophy } from "lucide-react";

interface PlayerStats {
  id: string;
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
  minutes_played: number;
  plus_minus: number;
  player: {
    name: string;
    number: number;
  } | null;
}

interface BoxScoreProps {
  gameId: string;
}

export function BoxScore({ gameId }: BoxScoreProps) {
  const [homeStats, setHomeStats] = useState<PlayerStats[]>([]);
  const [awayStats, setAwayStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (gameId) {
      fetchBoxScore();
    }
  }, [gameId]);

  const fetchBoxScore = async () => {
    try {
      setLoading(true);

      const { data: gameData } = await supabase
        .from("games")
        .select("home_team_id, away_team_id")
        .eq("id", gameId)
        .single();

      if (!gameData) return;

      const { data: stats } = await supabase
        .from("box_scores")
        .select(`
          *,
          player:players(name, number)
        `)
        .eq("game_id", gameId);

      const homeTeamStats = (stats || []).filter(s => s.team_id === gameData.home_team_id);
      const awayTeamStats = (stats || []).filter(s => s.team_id === gameData.away_team_id);

      setHomeStats(homeTeamStats);
      setAwayStats(awayTeamStats);
    } finally {
      setLoading(false);
    }
  };

  const calculateFGPercentage = (made: number, attempted: number) => {
    if (!attempted || attempted === 0) return "0.0";
    return ((made / attempted) * 100).toFixed(1);
  };

  const calculate2PPercentage = (fgMade: number, fgAttempted: number, threeMade: number, threeAttempted: number) => {
    const twoPtMade = fgMade - threeMade;
    const twoPtAttempted = fgAttempted - threeAttempted;
    if (!twoPtAttempted || twoPtAttempted === 0) return "0.0";
    return ((twoPtMade / twoPtAttempted) * 100).toFixed(1);
  };

  const calculateEFF = (stat: PlayerStats) => {
    // Standard Efficiency Formula: (PTS + REB + AST + STL + BLK) - (FGA - FGM) - (FTA - FTM) - TO
    const positive = stat.points + stat.rebounds + stat.assists + stat.steals + stat.blocks;
    const fgMissed = stat.fg_attempted - stat.fg_made;
    const ftMissed = stat.ft_attempted - stat.ft_made;
    const negative = fgMissed + ftMissed + stat.turnovers;
    return positive - negative;
  };

  const calculateRNK = (stat: PlayerStats) => {
    // Weighted Player Ranking: (PTS × 1.0) + (REB × 1.2) + (AST × 1.5) + (STL × 2.0) + (BLK × 2.0) + (EFF × 0.5)
    const eff = calculateEFF(stat);
    const rank = 
      (stat.points * 1.0) +
      (stat.rebounds * 1.2) +
      (stat.assists * 1.5) +
      (stat.steals * 2.0) +
      (stat.blocks * 2.0) +
      (eff * 0.5);
    return rank.toFixed(1);
  };

  const renderStatsTable = (stats: PlayerStats[]) => {
    if (stats.length === 0) {
      return (
        <div className="py-12 text-center">
          <div className="h-12 w-12 bg-muted/10 rounded-full mx-auto flex items-center justify-center mb-4">
            <Trophy className="h-6 w-6 text-muted-foreground/20" />
          </div>
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
            Awaiting AI Stats Pipeline
          </p>
        </div>
      );
    }

    // Sort by RNK descending
    const sortedStats = [...stats].sort((a, b) => parseFloat(calculateRNK(b)) - parseFloat(calculateRNK(a)));

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground">#</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Player</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">MIN</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">PTS</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">REB</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">AST</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">+/-</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">EFF</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">RNK</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">FG%</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">2P%</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">3P%</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">FT%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedStats.map((stat, index) => {
              const eff = calculateEFF(stat);
              const rnk = calculateRNK(stat);
              const plusMinus = stat.plus_minus || 0;
              
              return (
                <TableRow key={stat.id} className="border-white/5 hover:bg-white/5 transition-colors">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {stat.player?.number || '-'}
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    <div className="flex items-center gap-2">
                      {stat.player?.name || 'Unknown Player'}
                      {index === 0 && (
                        <Badge variant="outline" className="text-[8px] border-primary/50 text-primary">MVP</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs">{stat.minutes_played || 0}</TableCell>
                  <TableCell className="text-center font-bold text-primary">{stat.points || 0}</TableCell>
                  <TableCell className="text-center font-mono text-xs">{stat.rebounds || 0}</TableCell>
                  <TableCell className="text-center font-mono text-xs">{stat.assists || 0}</TableCell>
                  <TableCell className="text-center font-mono text-xs">
                    <span className={plusMinus >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {plusMinus >= 0 ? '+' : ''}{plusMinus}
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs font-semibold">
                    {eff}
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs font-bold text-accent">
                    {rnk}
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs">
                    {calculateFGPercentage(stat.fg_made, stat.fg_attempted)}%
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs">
                    {calculate2PPercentage(stat.fg_made, stat.fg_attempted, stat.three_pt_made, stat.three_pt_attempted)}%
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs">
                    {calculateFGPercentage(stat.three_pt_made, stat.three_pt_attempted)}%
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs">
                    {calculateFGPercentage(stat.ft_made, stat.ft_attempted)}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="glass-card border-none">
        <CardHeader>
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" /> Box Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-none">
      <CardHeader>
        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" /> Advanced Box Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="home" className="w-full">
          <TabsList className="w-full grid grid-cols-2 bg-muted/10 border border-white/5">
            <TabsTrigger value="home" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              Home Team
            </TabsTrigger>
            <TabsTrigger value="away" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              Away Team
            </TabsTrigger>
          </TabsList>
          <TabsContent value="home" className="mt-4">
            {renderStatsTable(homeStats)}
          </TabsContent>
          <TabsContent value="away" className="mt-4">
            {renderStatsTable(awayStats)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}