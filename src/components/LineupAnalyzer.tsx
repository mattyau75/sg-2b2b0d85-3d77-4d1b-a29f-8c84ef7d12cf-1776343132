import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Users, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface LineupStat {
  id: string;
  player_ids: string[];
  minutes_played: number;
  points_for: number;
  points_against: number;
  rebounds: number;
  assists: number;
  turnovers: number;
  steals: number;
  blocks: number;
  possessions: number;
  players?: Array<{ name: string; number: number }>;
}

interface LineupAnalyzerProps {
  gameId: string;
}

export function LineupAnalyzer({ gameId }: LineupAnalyzerProps) {
  const [homeLineups, setHomeLineups] = useState<LineupStat[]>([]);
  const [awayLineups, setAwayLineups] = useState<LineupStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (gameId) {
      fetchLineupData();
    }
  }, [gameId]);

  const fetchLineupData = async () => {
    try {
      setLoading(true);

      const { data: gameData } = await supabase
        .from("games")
        .select("home_team_id, away_team_id")
        .eq("id", gameId)
        .single();

      if (!gameData) return;

      // Fetch lineup stats for both teams
      const { data: lineupData } = await supabase
        .from("lineup_stats")
        .select("*")
        .eq("game_id", gameId);

      if (!lineupData) return;

      // Fetch player names for all lineups
      const enrichedLineups = await Promise.all(
        lineupData.map(async (lineup) => {
          const { data: players } = await supabase
            .from("players")
            .select("id, name, number")
            .in("id", lineup.player_ids);

          return {
            ...lineup,
            players: players || []
          };
        })
      );

      const homeTeamLineups = enrichedLineups.filter(l => l.team_id === gameData.home_team_id);
      const awayTeamLineups = enrichedLineups.filter(l => l.team_id === gameData.away_team_id);

      setHomeLineups(homeTeamLineups);
      setAwayLineups(awayTeamLineups);
    } finally {
      setLoading(false);
    }
  };

  const calculatePlusMinus = (lineup: LineupStat) => {
    return lineup.points_for - lineup.points_against;
  };

  const calculateNetRating = (lineup: LineupStat) => {
    if (lineup.possessions === 0) return 0;
    const offRating = (lineup.points_for / lineup.possessions) * 100;
    const defRating = (lineup.points_against / lineup.possessions) * 100;
    return (offRating - defRating).toFixed(1);
  };

  const formatPlayerNames = (players: Array<{ name: string; number: number }>) => {
    if (!players || players.length === 0) return "Unknown Lineup";
    return players
      .sort((a, b) => a.number - b.number)
      .map(p => `#${p.number}`)
      .join(", ");
  };

  const renderLineupTable = (lineups: LineupStat[]) => {
    if (lineups.length === 0) {
      return (
        <div className="py-12 text-center">
          <div className="h-12 w-12 bg-muted/10 rounded-full mx-auto flex items-center justify-center mb-4">
            <Users className="h-6 w-6 text-muted-foreground/20" />
          </div>
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
            No Lineup Data Available
          </p>
        </div>
      );
    }

    // Sort by plus/minus descending
    const sortedLineups = [...lineups].sort((a, b) => calculatePlusMinus(b) - calculatePlusMinus(a));

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Lineup</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">MIN</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">+/-</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">NET RTG</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">REB</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">TO</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">STL</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">BLK</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLineups.map((lineup, index) => {
              const plusMinus = calculatePlusMinus(lineup);
              const netRating = calculateNetRating(lineup);
              
              return (
                <TableRow key={lineup.id} className="border-white/5 hover:bg-white/5 transition-colors">
                  <TableCell className="font-mono text-xs max-w-[200px]">
                    <div className="flex items-center gap-2">
                      {formatPlayerNames(lineup.players || [])}
                      {index === 0 && (
                        <Badge variant="outline" className="text-[8px] border-emerald-500/50 text-emerald-400">
                          BEST
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs">
                    {Number(lineup.minutes_played).toFixed(1)}
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs font-bold">
                    <div className={cn("flex items-center justify-center gap-1", plusMinus >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {plusMinus >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      <span>{plusMinus >= 0 ? '+' : ''}{plusMinus}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs">
                    {netRating}
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs">{lineup.rebounds}</TableCell>
                  <TableCell className="text-center font-mono text-xs">{lineup.turnovers}</TableCell>
                  <TableCell className="text-center font-mono text-xs">{lineup.steals}</TableCell>
                  <TableCell className="text-center font-mono text-xs">{lineup.blocks}</TableCell>
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
            <Users className="h-4 w-4 text-primary" /> Lineup Analysis
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
          <Users className="h-4 w-4 text-primary" /> Best 5-Player Combinations
        </CardTitle>
        <CardDescription className="text-[10px] font-mono">
          Identify elite on-court lineups by +/-, net rating, and defensive impact
        </CardDescription>
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
            {renderLineupTable(homeLineups)}
          </TabsContent>
          <TabsContent value="away" className="mt-4">
            {renderLineupTable(awayLineups)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}