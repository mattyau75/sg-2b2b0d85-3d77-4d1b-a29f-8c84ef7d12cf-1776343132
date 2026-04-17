import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, 
  UserPlus, 
  Link2, 
  AlertCircle, 
  CheckCircle2, 
  Fingerprint,
  RotateCcw,
  Save,
  Palette,
  Image as ImageIcon,
  RefreshCw,
  Zap,
  CheckCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { showBanner } from "@/components/DiagnosticBanner";
import { rosterService } from "@/services/rosterService";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logger } from "@/lib/logger";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MappingDashboardProps {
  gameId: string;
  aiMappings: any[];
  homeRoster: any[];
  awayRoster: any[];
  homeColor?: string;
  awayColor?: string;
  onRefresh: () => void;
}

export function MappingDashboard({ gameId, aiMappings, homeRoster, awayRoster, homeColor, awayColor, onRefresh }: MappingDashboardProps) {
  const [saving, setSaving] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [aiPlayers, setAiPlayers] = useState<any[]>([]);
  const [rosterPlayers, setRosterPlayers] = useState<any[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [homeTeamId, setHomeTeamId] = useState<string | null>(null);
  const [awayTeamId, setAwayTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (gameId) {
      fetchMappingData();
    }
  }, [gameId]);

  const fetchMappingData = async () => {
    try {
      setLoading(true);
      
      // Fetch game details to get team IDs
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("home_team_id, away_team_id")
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;
      setHomeTeamId(gameData.home_team_id);
      setAwayTeamId(gameData.away_team_id);

      // Fetch AI-detected players
      const { data: aiData, error: aiError } = await supabase
        .from("player_tracking")
        .select("*")
        .eq("game_id", gameId);

      if (aiError) throw aiError;
      setAiPlayers(aiData || []);

      // Fetch roster players
      const { data: rosterData, error: rosterError } = await supabase
        .from("players")
        .select("*")
        .in("team_id", [gameData.home_team_id, gameData.away_team_id]);

      if (rosterError) throw rosterError;
      setRosterPlayers(rosterData || []);

      // Fetch existing mappings
      const { data: mappingData, error: mappingError } = await supabase
        .from("player_mappings")
        .select("*")
        .eq("game_id", gameId);

      if (mappingError) throw mappingError;
      
      const mappingMap: Record<string, string> = {};
      mappingData?.forEach(m => {
        mappingMap[m.ai_player_id] = m.roster_player_id;
      });
      setMappings(mappingMap);
    } catch (err: any) {
      logger.error("[MappingDashboard] Fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMapping = async (aiPlayerId: string, rosterPlayerId: string) => {
    try {
      const { error } = await supabase
        .from("player_mappings")
        .upsert({
          game_id: gameId,
          ai_player_id: aiPlayerId,
          roster_player_id: rosterPlayerId
        });

      if (error) throw error;
      
      setMappings(prev => ({ ...prev, [aiPlayerId]: rosterPlayerId }));
    } catch (err: any) {
      logger.error("[MappingDashboard] Mapping failed", err);
    }
  };

  const getTeamPlayers = (teamId: string | null) => {
    return rosterPlayers.filter(p => p.team_id === teamId);
  };

  const getAIPlayersByTeam = (team: "home" | "away") => {
    return aiPlayers.filter(p => p.team === team);
  };

  const renderMappingList = (team: "home" | "away", teamId: string | null) => {
    const teamAIPlayers = getAIPlayersByTeam(team);
    const teamRosterPlayers = getTeamPlayers(teamId);

    if (teamAIPlayers.length === 0) {
      return (
        <div className="py-8 text-center">
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
            No AI Detections Yet
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {teamAIPlayers.map((aiPlayer) => (
          <div key={aiPlayer.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
              <span className="text-sm font-black text-primary">#{aiPlayer.jersey_number}</span>
            </div>
            <div className="flex-1">
              <Select
                value={mappings[aiPlayer.id] || ""}
                onValueChange={(value) => handleMapping(aiPlayer.id, value)}
              >
                <SelectTrigger className="h-8 text-xs bg-muted/20 border-white/10">
                  <SelectValue placeholder="Map to player..." />
                </SelectTrigger>
                <SelectContent>
                  {teamRosterPlayers.map((player) => (
                    <SelectItem key={player.id} value={player.id} className="text-xs">
                      #{player.jersey_number} {player.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {mappings[aiPlayer.id] && (
              <Badge variant="outline" className="text-[8px] border-emerald-500/50 text-emerald-400">
                Mapped
              </Badge>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="home" className="w-full">
      <TabsList className="w-full grid grid-cols-2 bg-muted/10 border border-white/5">
        <TabsTrigger value="home" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
          Home
        </TabsTrigger>
        <TabsTrigger value="away" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
          Away
        </TabsTrigger>
      </TabsList>
      <TabsContent value="home" className="mt-4">
        {renderMappingList("home", homeTeamId)}
      </TabsContent>
      <TabsContent value="away" className="mt-4">
        {renderMappingList("away", awayTeamId)}
      </TabsContent>
    </Tabs>
  );
}