import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, TrendingUp, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

interface PlayerStats {
  player_id: string;
  player_name: string;
  jersey_number: string;
  team: "home" | "away";
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  fg_made: number;
  fg_attempted: number;
  three_pt_made: number;
  three_pt_attempted: number;
  ft_made: number;
  ft_attempted: number;
  turnovers: number;
  fouls: number;
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
      const { data, error } = await supabase
        .from("box_scores")
        .select("*")
        .eq("game_id", gameId);

      if (error) throw error;

      if (data) {
        const home = data.filter(p => p.team === "home");
        const away = data.filter(p => p.team === "away");
        setHomeStats(home as PlayerStats[]);
        setAwayStats(away as PlayerStats[]);
      }
    } catch (err: any) {
      logger.error("[BoxScore] Fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateFGPercentage = (made: number, attempted: number) => {
    if (attempted === 0) return "0.0";
    return ((made / attempted) * 100).toFixed(1);
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
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">STL</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">BLK</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">FG%</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">3P%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.map((player, idx) => (
              <TableRow key={idx} className="border-white/5 hover:bg-white/5 transition-colors">
                <TableCell className="font-mono text-xs text-muted-foreground">{player.jersey_number}</TableCell>
                <TableCell className="font-medium text-sm">
                  {player.player_name || `Player #${player.jersey_number}`}
                </TableCell>
                <TableCell className="text-center font-mono text-xs">{player.minutes}</TableCell>
                <TableCell className="text-center font-bold text-primary">{player.points}</TableCell>
                <TableCell className="text-center font-mono text-xs">{player.rebounds}</TableCell>
                <TableCell className="text-center font-mono text-xs">{player.assists}</TableCell>
                <TableCell className="text-center font-mono text-xs">{player.steals}</TableCell>
                <TableCell className="text-center font-mono text-xs">{player.blocks}</TableCell>
                <TableCell className="text-center font-mono text-xs">
                  {calculateFGPercentage(player.fg_made, player.fg_attempted)}%
                </TableCell>
                <TableCell className="text-center font-mono text-xs">
                  {calculateFGPercentage(player.three_pt_made, player.three_pt_attempted)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <Card className="glass-card border-none">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" /> Live Box Score
          </span>
          {(homeStats.length > 0 || awayStats.length > 0) && (
            <Badge variant="outline" className="text-[10px] border-primary/20 text-primary">
              AI Mapped
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="home" className="w-full">
          <TabsList className="w-full grid grid-cols-2 bg-muted/10 border-b border-white/5 rounded-none">
            <TabsTrigger 
              value="home" 
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-none"
            >
              Home Team
            </TabsTrigger>
            <TabsTrigger 
              value="away"
              className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-none"
            >
              Away Team
            </TabsTrigger>
          </TabsList>
          <TabsContent value="home" className="m-0 p-6">
            {renderStatsTable(homeStats)}
          </TabsContent>
          <TabsContent value="away" className="m-0 p-6">
            {renderStatsTable(awayStats)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}