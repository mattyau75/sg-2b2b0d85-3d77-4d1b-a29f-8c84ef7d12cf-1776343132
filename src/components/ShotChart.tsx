import React, { useEffect, useState } from "react";
import { Court } from "@/components/Court";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";

export interface Shot {
  id: string;
  x: number;
  y: number;
  is_make: boolean;
  player_id: string;
  player?: {
    name: string;
    number: number;
  };
  shot_type: string;
  game_time: string;
}

interface ShotChartProps {
  gameId: string;
}

export function ShotChart({ gameId }: ShotChartProps) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [filteredShots, setFilteredShots] = useState<Shot[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string>("all");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (gameId) {
      fetchShotData();
    }
  }, [gameId]);

  useEffect(() => {
    applyFilters();
  }, [shots, selectedPlayer, selectedTeam]);

  const fetchShotData = async () => {
    try {
      setLoading(true);

      // Fetch shot tracking data with player names
      const { data: shotData, error: shotError } = await supabase
        .from("shot_tracking")
        .select(`
          *,
          player:players(name, number)
        `)
        .eq("game_id", gameId);

      if (shotError) throw shotError;
      setShots((shotData as unknown as Shot[]) || []);

      // Fetch unique players for filtering
      const { data: gameData } = await supabase
        .from("games")
        .select("home_team_id, away_team_id")
        .eq("id", gameId)
        .single();

      if (gameData) {
        const { data: playerData } = await supabase
          .from("players")
          .select("*")
          .in("team_id", [gameData.home_team_id, gameData.away_team_id]);

        setPlayers(playerData || []);
      }
    } catch (err: any) {
      logger.error("[ShotChart] Fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...shots];

    if (selectedPlayer !== "all") {
      filtered = filtered.filter(shot => shot.player_id === selectedPlayer);
    }

    if (selectedTeam !== "all") {
      const teamPlayers = players.filter(p => p.team_id === selectedTeam);
      const playerIds = teamPlayers.map(p => p.id);
      filtered = filtered.filter(shot => playerIds.includes(shot.player_id));
    }

    setFilteredShots(filtered);
  };

  const getShotTypeColor = (shotType: string) => {
    switch (shotType) {
      case "layup":
      case "dunk":
        return "text-blue-400";
      case "mid_range":
        return "text-yellow-400";
      case "three_pointer":
        return "text-purple-400";
      default:
        return "text-muted-foreground";
    }
  };

  const calculateShotEfficiency = () => {
    if (filteredShots.length === 0) return { made: 0, total: 0, percentage: 0 };
    const made = filteredShots.filter(s => s.is_make).length;
    return {
      made,
      total: filteredShots.length,
      percentage: ((made / filteredShots.length) * 100).toFixed(1)
    };
  };

  const stats = calculateShotEfficiency();

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2">
        <Select value={selectedTeam} onValueChange={setSelectedTeam}>
          <SelectTrigger className="h-8 text-xs bg-muted/20 border-white/10 w-32">
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {/* Team options will be populated when we have game data */}
          </SelectContent>
        </Select>

        <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
          <SelectTrigger className="h-8 text-xs bg-muted/20 border-white/10 flex-1">
            <SelectValue placeholder="All Players" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Players</SelectItem>
            {players.map(player => (
              <SelectItem key={player.id} value={player.id} className="text-xs">
                #{player.number} {player.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Summary */}
      {filteredShots.length > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] border-primary/20">
            {stats.made}/{stats.total}
          </Badge>
          <span className="text-xs font-mono text-muted-foreground">
            {stats.percentage}% FG
          </span>
        </div>
      )}

      {/* Court with Shots */}
      <div className="relative bg-muted/10 rounded-xl overflow-hidden border border-white/5">
        <Court className="w-full h-full">
          {filteredShots.map((shot) => (
            <g key={shot.id}>
              <circle
                cx={shot.x}
                cy={shot.y}
                r="6"
                className={shot.is_make ? "fill-emerald-500/80 stroke-emerald-300" : "fill-red-500/80 stroke-red-300"}
                strokeWidth="2"
                style={{ cursor: 'pointer' }}
              >
                <title>
                  {shot.player?.name || 'Unknown'} - {shot.shot_type.replace('_', ' ')} - {shot.is_make ? 'Made' : 'Missed'} ({shot.game_time})
                </title>
              </circle>
            </g>
          ))}
        </Court>

        {filteredShots.length === 0 && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <Target className="h-8 w-8 text-muted-foreground/20 mx-auto" />
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
                No Shot Data Available
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      {filteredShots.length > 0 && (
        <div className="flex items-center gap-4 text-[10px] font-mono">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Made</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-muted-foreground">Missed</span>
          </div>
        </div>
      )}
    </div>
  );
}