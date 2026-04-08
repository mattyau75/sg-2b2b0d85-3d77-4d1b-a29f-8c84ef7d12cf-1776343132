import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { 
  Trophy, ChevronLeft, RefreshCw, Edit2, Save, X, Trash2 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { ShotChart } from "@/components/ShotChart";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function GameDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("boxscore");
  const [loading, setLoading] = useState(true);
  const [gameData, setGameData] = useState<any>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editedEvent, setEditedEvent] = useState<any>(null);

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
      if (data.play_by_play) {
        data.play_by_play.sort((a: any, b: any) => (a.timestamp_seconds || 0) - (b.timestamp_seconds || 0));
      }
      setGameData(data);
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
    setIsSyncing(true);
    try {
      const response = await fetch("/api/sync-game-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: id })
      });
      if (!response.ok) throw new Error("Sync failed");
      toast({ title: "Stats Re-calculated", description: "Boxscore and scores have been updated." });
      await fetchGameData();
    } catch (error: any) {
      toast({ title: "Sync Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEditEvent = (event: any) => {
    setEditingEventId(event.id);
    setEditedEvent({ ...event });
  };

  const handleSaveEvent = async () => {
    try {
      const { error } = await supabase
        .from("play_by_play")
        .update({
          player_id: editedEvent.player_id,
          event_type: editedEvent.event_type,
          timestamp_seconds: editedEvent.timestamp_seconds,
          is_make: editedEvent.event_type.startsWith("made")
        })
        .eq("id", editedEvent.id);

      if (error) throw error;
      
      setEditingEventId(null);
      toast({ title: "Event Updated", description: "Re-calculating stats..." });
      await handleSyncStats();
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("Delete this event?")) return;
    try {
      const { error } = await supabase.from("play_by_play").delete().eq("id", eventId);
      if (error) throw error;
      toast({ title: "Event Deleted", description: "Re-calculating stats..." });
      await handleSyncStats();
    } catch (error: any) {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    }
  };

  if (loading) return (
    <Layout title="Loading Game | CourtVision Elite">
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground font-mono animate-pulse">Syncing Tactical Data...</p>
      </div>
    </Layout>
  );

  if (!gameData) return (
    <Layout title="Game Not Found | CourtVision Elite">
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <Trophy className="h-12 w-12 text-destructive" />
        <h2 className="text-2xl font-bold">Game Not Found</h2>
        <Button onClick={() => router.push("/")}>Back to Dashboard</Button>
      </div>
    </Layout>
  );

  const players = [
    ...(gameData.player_game_stats?.map((s: any) => s.player) || [])
  ].filter((p, i, a) => p && a.findIndex(t => t?.id === p.id) === i);

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
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSyncStats} 
            disabled={isSyncing}
            className="gap-2"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Re-sync Stats'}
          </Button>
        </div>

        <Card className="bg-card/50 border-border overflow-hidden">
          <CardContent className="p-8">
            <div className="flex justify-between items-center text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <Trophy className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-bold">{gameData.home_team?.name}</h3>
              </div>
              <div className="text-6xl font-black font-mono">
                {gameData.home_score || 0} - {gameData.away_score || 0}
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center">
                  <Trophy className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-bold">{gameData.away_team?.name}</h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-card/30 border border-border mb-6">
            <TabsTrigger value="boxscore">Boxscore</TabsTrigger>
            <TabsTrigger value="playbyplay">Play-by-Play</TabsTrigger>
            <TabsTrigger value="shotchart">Shot Chart</TabsTrigger>
            <TabsTrigger value="lineups">Lineups</TabsTrigger>
          </TabsList>

          <TabsContent value="boxscore">
             <Card className="bg-card/30 border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-center">PTS</TableHead>
                      <TableHead className="text-center">REB</TableHead>
                      <TableHead className="text-center">AST</TableHead>
                      <TableHead className="text-center">FG</TableHead>
                      <TableHead className="text-right">+/-</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gameData.player_game_stats?.map((stat: any) => (
                      <TableRow key={stat.id}>
                        <TableCell className="font-bold">{stat.player?.name} <span className="text-muted-foreground text-[10px]">#{stat.player?.number}</span></TableCell>
                        <TableCell className="text-center font-mono text-primary font-bold">{stat.points}</TableCell>
                        <TableCell className="text-center font-mono">{stat.rebounds}</TableCell>
                        <TableCell className="text-center font-mono">{stat.assists}</TableCell>
                        <TableCell className="text-center font-mono text-xs">{stat.fg_made}-{stat.fg_attempted}</TableCell>
                        <TableCell className="text-right font-mono">{stat.plus_minus >= 0 ? '+' : ''}{stat.plus_minus}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
             </Card>
          </TabsContent>

          <TabsContent value="playbyplay">
            <div className="space-y-4">
              {gameData.play_by_play?.map((event: any) => (
                <div key={event.id} className="flex items-center gap-4 p-4 rounded-xl bg-card/40 border border-border group">
                  <div className="w-16 font-mono text-xs text-muted-foreground">
                    {editingEventId === event.id ? (
                      <Input 
                        type="number" 
                        value={editedEvent.timestamp_seconds} 
                        onChange={(e) => setEditedEvent({ ...editedEvent, timestamp_seconds: parseInt(e.target.value) })}
                        className="h-8 py-1 px-2"
                      />
                    ) : (
                      `${Math.floor(event.timestamp_seconds / 60)}:${(event.timestamp_seconds % 60).toString().padStart(2, '0')}`
                    )}
                  </div>
                  
                  <div className="flex-1">
                    {editingEventId === event.id ? (
                      <div className="flex gap-2">
                        <Select 
                          value={editedEvent.player_id} 
                          onValueChange={(val) => setEditedEvent({ ...editedEvent, player_id: val })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Player" />
                          </SelectTrigger>
                          <SelectContent>
                            {players.map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Select 
                          value={editedEvent.event_type} 
                          onValueChange={(val) => setEditedEvent({ ...editedEvent, event_type: val })}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Event" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="made_2pt">Made 2PT</SelectItem>
                            <SelectItem value="missed_2pt">Missed 2PT</SelectItem>
                            <SelectItem value="made_3pt">Made 3PT</SelectItem>
                            <SelectItem value="missed_3pt">Missed 3PT</SelectItem>
                            <SelectItem value="rebound">Rebound</SelectItem>
                            <SelectItem value="assist">Assist</SelectItem>
                            <SelectItem value="steal">Steal</SelectItem>
                            <SelectItem value="block">Block</SelectItem>
                            <SelectItem value="turnover">Turnover</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{event.player?.name || "Unknown"}</span>
                        <span className="text-muted-foreground">{event.event_type.replace('_', ' ')}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {editingEventId === event.id ? (
                      <>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500" onClick={handleSaveEvent}><Save className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setEditingEventId(null)}><X className="h-4 w-4" /></Button>
                      </>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleEditEvent(event)}><Edit2 className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={() => handleDeleteEvent(event.id)}><Trash2 className="h-4 w-4" /></Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="shotchart">
            <Card className="bg-card/30 border-border p-8 flex flex-col items-center">
              <div className="w-full max-w-2xl min-h-[400px]">
                <ShotChart shots={shotData || []} />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="lineups">
            <Card className="bg-card/30 border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lineup</TableHead>
                    <TableHead className="text-center">MIN</TableHead>
                    <TableHead className="text-center">PTS FOR</TableHead>
                    <TableHead className="text-center">PTS AGN</TableHead>
                    <TableHead className="text-right">NET</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gameData.lineup_stats?.map((lineup: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs font-mono">
                        {lineup.player_ids?.join(', ')}
                      </TableCell>
                      <TableCell className="text-center font-mono">{lineup.minutes_played}</TableCell>
                      <TableCell className="text-center font-mono text-green-500">{lineup.points_for}</TableCell>
                      <TableCell className="text-center font-mono text-destructive">{lineup.points_against}</TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {(lineup.points_for - lineup.points_against) >= 0 ? '+' : ''}
                        {lineup.points_for - lineup.points_against}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}