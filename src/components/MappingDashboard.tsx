import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MappingDashboardProps {
  gameId: string;
}

export function MappingDashboard({ gameId }: MappingDashboardProps) {
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

      // Fetch AI-detected players (from ai_player_mappings table)
      const { data: aiData, error: aiError } = await supabase
        .from("ai_player_mappings")
        .select("*")
        .eq("game_id", gameId);

      if (aiError) throw aiError;
      setAiPlayers(aiData || []);

      // Build initial mapping state from what is already saved in the DB
      const mappingMap: Record<string, string> = {};
      aiData?.forEach(m => {
        if (m.real_player_id) {
          mappingMap[m.id] = m.real_player_id;
        }
      });
      setMappings(mappingMap);

      // Fetch roster players
      const { data: rosterData, error: rosterError } = await supabase
        .from("players")
        .select("*")
        .in("team_id", [gameData.home_team_id, gameData.away_team_id]);

      if (rosterError) throw rosterError;
      setRosterPlayers(rosterData || []);

    } catch (err: any) {
      logger.error("[MappingDashboard] Fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMapping = async (mappingRowId: string, rosterPlayerId: string) => {
    try {
      const { error } = await supabase
        .from("ai_player_mappings")
        .update({
          real_player_id: rosterPlayerId,
          is_manual_override: true,
          is_manual_match: true
        })
        .eq("id", mappingRowId);

      if (error) throw error;
      
      setMappings(prev => ({ ...prev, [mappingRowId]: rosterPlayerId }));
    } catch (err: any) {
      logger.error("[MappingDashboard] Mapping update failed", err);
    }
  };

  const getTeamPlayers = (teamId: string | null) => {
    return rosterPlayers.filter(p => p.team_id === teamId);
  };

  const getAIPlayersByTeam = (teamSide: "home" | "away") => {
    return aiPlayers.filter(p => p.team_side === teamSide);
  };

  const renderMappingList = (teamSide: "home" | "away", teamId: string | null) => {
    const teamAIPlayers = getAIPlayersByTeam(teamSide);
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
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0 overflow-hidden relative">
              {aiPlayer.snapshot_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={aiPlayer.snapshot_url} alt="AI Snapshot" className="w-full h-full object-cover opacity-60" />
              ) : null}
              <span className="text-sm font-black text-primary z-10 absolute">#{aiPlayer.jersey_number || '?'}</span>
            </div>
            <div className="flex-1">
              <Select
                value={mappings[aiPlayer.id] || ""}
                onValueChange={(value) => handleMapping(aiPlayer.id, value)}
              >
                <SelectTrigger className="h-8 text-xs bg-muted/20 border-white/10">
                  <SelectValue placeholder="Map to roster player..." />
                </SelectTrigger>
                <SelectContent>
                  {teamRosterPlayers.map((player) => (
                    <SelectItem key={player.id} value={player.id} className="text-xs">
                      #{player.number || '?'} {player.name}
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
          Home Identity
        </TabsTrigger>
        <TabsTrigger value="away" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
          Away Identity
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