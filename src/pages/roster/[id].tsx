import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  MapPin, 
  ArrowLeft, 
  UserPlus, 
  Activity,
  MoreHorizontal,
  Edit,
  Trash2,
  ExternalLink
} from "lucide-react";
import Link from "next/link";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showBanner } from "@/components/DiagnosticBanner";
import { rosterService } from "@/services/rosterService";

export default function TeamRoster() {
  const router = useRouter();
  const teamId = typeof router.query.id === 'string' ? router.query.id : undefined;
  
  const [team, setTeam] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [isEditPlayerOpen, setIsEditPlayerOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [newPlayer, setNewPlayer] = useState({ name: "", number: "", position: "" });

  const fetchTeamData = async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const { data: teamData, error: teamError } = await supabase
        .from("teams")
        .select("*")
        .eq("id", teamId)
        .single();

      if (teamError) throw teamError;
      setTeam(teamData);

      const { data: rosterData, error: rosterError } = await supabase
        .from("players")
        .select("*")
        .eq("team_id", teamId)
        .order("number", { ascending: true });

      if (rosterError) throw rosterError;
      setPlayers(rosterData || []);
    } catch (err) {
      logger.error("[RosterDetail] Error fetching roster", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, [teamId]);

  const handleAddPlayer = async () => {
    if (!newPlayer.name || !teamId) return;
    try {
      await rosterService.createPlayer({
        name: newPlayer.name,
        number: parseInt(newPlayer.number) || 0,
        position: newPlayer.position,
        team_id: teamId,
      });
      showBanner(`${newPlayer.name} is now on the roster.`, "success", "Player Added");
      setIsAddPlayerOpen(false);
      setNewPlayer({ name: "", number: "", position: "" });
      fetchTeamData();
    } catch (error) {
      showBanner("Failed to add player.", "error", "Error");
    }
  };

  const handleEditPlayer = async () => {
    if (!selectedPlayer?.name || !selectedPlayer?.id) return;
    try {
      await rosterService.updatePlayer(selectedPlayer.id, {
        name: selectedPlayer.name,
        number: parseInt(selectedPlayer.number) || 0,
        position: selectedPlayer.position,
      });
      showBanner(`${selectedPlayer.name} details saved.`, "success", "Player Updated");
      setIsEditPlayerOpen(false);
      fetchTeamData();
    } catch (error) {
      showBanner("Failed to update player.", "error", "Error");
    }
  };

  if (loading) {
    return (
      <Layout title="Loading Team...">
        <div className="space-y-8">
          <Skeleton className="h-32 w-full rounded-2xl bg-muted/20" />
          <Skeleton className="h-96 w-full rounded-2xl bg-muted/20" />
        </div>
      </Layout>
    );
  }

  if (!team) {
    return (
      <Layout title="Team Not Found">
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
          <p className="text-muted-foreground text-lg">Team not found.</p>
          <Button asChild variant="outline">
            <Link href="/roster">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Directory
            </Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`${team.name} Roster | DribbleStats AI Elite`}>
      <div className="space-y-8">
        <div className="flex flex-col gap-6">
          <Link href="/roster" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors w-fit">
            <ArrowLeft className="h-4 w-4" />
            Back to Teams
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="h-24 w-24 rounded-2xl bg-muted flex items-center justify-center border border-border shadow-xl relative overflow-hidden">
                <div 
                  className="absolute bottom-0 left-0 w-full h-1" 
                  style={{ backgroundColor: team.primary_color }} 
                />
                {team.logo_url ? (
                  <img src={team.logo_url} alt={team.name} className="h-16 w-16 object-contain" />
                ) : (
                  <Users className="h-12 w-12 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-4xl font-bold">{team.name}</h1>
                  <Badge variant="outline" className="border-accent text-accent">Active Roster</Badge>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <div className="flex items-center gap-1.5 text-sm">
                    <MapPin className="h-4 w-4" />
                    {team.city || "Unassigned"}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Users className="h-4 w-4" />
                    {players.length} Players
                  </div>
                </div>
              </div>
            </div>
            <Dialog open={isAddPlayerOpen} onOpenChange={setIsAddPlayerOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Player
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle>Add New Player</DialogTitle>
                  <DialogDescription>Register a new athlete to the {team.name} active roster.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="pname">Full Name</Label>
                    <Input 
                      id="pname" 
                      placeholder="e.g. Steph Curry" 
                      value={newPlayer.name}
                      onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="num">Jersey #</Label>
                      <Input 
                        id="num" 
                        type="number" 
                        placeholder="30" 
                        value={newPlayer.number}
                        onChange={(e) => setNewPlayer({ ...newPlayer, number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pos">Position</Label>
                      <Input 
                        id="pos" 
                        placeholder="G, F, C" 
                        value={newPlayer.position}
                        onChange={(e) => setNewPlayer({ ...newPlayer, position: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddPlayerOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddPlayer}>Add to Roster</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="glass-card border-none overflow-hidden">
          <CardHeader className="border-b border-white/5 bg-white/5 py-4">
            <CardTitle className="text-sm font-mono uppercase tracking-widest flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Player Registry
            </CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-white/5">
                <TableHead className="w-16 text-center font-mono text-[10px] uppercase">No.</TableHead>
                <TableHead className="font-mono text-[10px] uppercase">Player</TableHead>
                <TableHead className="font-mono text-[10px] uppercase">Position</TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.length > 0 ? (
                players.map((player: any) => (
                  <TableRow key={player.id} className="border-white/5 hover:bg-white/5">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {player.jersey_number}
                    </TableCell>
                    <TableCell className="font-medium">{player.name}</TableCell>
                    <TableCell className="text-center font-mono text-xs">
                      {player.position || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Link href={`/player/${player.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          View Stats
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">
                    No players assigned to this roster yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Dialog open={isEditPlayerOpen} onOpenChange={setIsEditPlayerOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Edit Player Details</DialogTitle>
              <DialogDescription>Update the information and profile for this player.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-pname">Full Name</Label>
                <Input 
                  id="edit-pname" 
                  value={selectedPlayer?.name || ""}
                  onChange={(e) => setSelectedPlayer({ ...selectedPlayer, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-num">Jersey #</Label>
                  <Input 
                    id="edit-num" 
                    type="number" 
                    value={selectedPlayer?.number || ""}
                    onChange={(e) => setSelectedPlayer({ ...selectedPlayer, number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-pos">Position</Label>
                  <Input 
                    id="edit-pos" 
                    value={selectedPlayer?.position || ""}
                    onChange={(e) => setSelectedPlayer({ ...selectedPlayer, position: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditPlayerOpen(false)}>Cancel</Button>
              <Button onClick={handleEditPlayer}>Update Player</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}