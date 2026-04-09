import React, { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Users, MapPin, ChevronRight, Search, Settings2 } from "lucide-react";
import Link from "next/link";
import { rosterService } from "@/services/rosterService";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function RosterDirectory() {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [newTeam, setNewTeam] = useState({ 
    name: "", 
    city: "", 
    primary_color: "#FF6B00",
    secondary_color: "#FFFFFF" 
  });
  const { toast } = useToast();

  const loadTeams = async () => {
    try {
      const data = await rosterService.getTeams();
      setTeams(data);
    } catch (error) {
      console.error("Failed to load teams:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchTeams = async () => {
      setLoading(true);
      try {
        const data = await rosterService.getTeams();
        setTeams(data || []);
      } catch (error) {
        console.error("Error fetching teams:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTeams();
  }, []);

  const handleAddTeam = async () => {
    if (!newTeam.name) return;
    try {
      await rosterService.createTeam(newTeam);
      toast({ title: "Team Created", description: `${newTeam.name} has been added to the registry.` });
      setIsAddTeamOpen(false);
      setNewTeam({ name: "", city: "", primary_color: "#FF6B00", secondary_color: "#FFFFFF" });
      loadTeams();
    } catch (error) {
      toast({ title: "Error", description: "Failed to create team.", variant: "destructive" });
    }
  };

  const handleEditTeam = async () => {
    if (!selectedTeam?.name || !selectedTeam?.id) return;
    try {
      await rosterService.updateTeam(selectedTeam.id, {
        name: selectedTeam.name,
        city: selectedTeam.city,
        primary_color: selectedTeam.primary_color,
      });
      toast({ title: "Team Updated", description: `${selectedTeam.name} details have been saved.` });
      setIsEditTeamOpen(false);
      loadTeams();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update team.", variant: "destructive" });
    }
  };

  const filteredTeams = teams.filter(team => 
    team.name.toLowerCase().includes(search.toLowerCase()) || 
    team.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout title="Teams | DribbleStats AI Elite">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Team Directory</h1>
            <p className="text-muted-foreground">Manage organizational rosters and player performance profiles.</p>
          </div>
          <Dialog open={isAddTeamOpen} onOpenChange={setIsAddTeamOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="mr-2 h-4 w-4" />
                Add Team
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Add New Team</DialogTitle>
                <DialogDescription>Add a new organization to the DribbleStats registry.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Team Name</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g. Golden State Warriors" 
                    value={newTeam.name}
                    onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input 
                    id="city" 
                    placeholder="e.g. San Francisco" 
                    value={newTeam.city}
                    onChange={(e) => setNewTeam({ ...newTeam, city: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="color">Primary Color</Label>
                    <div className="flex items-center gap-3">
                      <div 
                        className="h-10 w-10 rounded-lg border border-border shadow-inner flex-shrink-0"
                        style={{ backgroundColor: newTeam.primary_color }}
                      />
                      <input 
                        id="color"
                        type="color" 
                        value={newTeam.primary_color}
                        onChange={(e) => setNewTeam({ ...newTeam, primary_color: e.target.value })}
                        className="h-10 w-full bg-background border border-border rounded-lg cursor-pointer px-1 py-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddTeamOpen(false)}>Cancel</Button>
                <Button onClick={handleAddTeam}>Save Team</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search teams by name or city..." 
            className="pl-10 h-12 bg-card/50 border-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-2xl bg-muted/20" />
            ))}
          </div>
        ) : filteredTeams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTeams.map((team) => (
              <div key={team.id} className="relative group">
                <Link href={`/roster/${team.id}`}>
                  <Card className="group hover:border-primary/50 transition-all cursor-pointer overflow-hidden bg-card/50 backdrop-blur-sm border-border">
                    <div 
                      className="h-1.5 w-full" 
                      style={{ backgroundColor: team.primary_color || 'var(--primary)' }} 
                    />
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center border border-border overflow-hidden">
                        {team.logo_url ? (
                          <img src={team.logo_url} alt={team.name} className="h-full w-full object-contain" />
                        ) : (
                          <Users className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <CardTitle className="text-lg">{team.name}</CardTitle>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {team.city || "Unassigned"}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between pt-2">
                      <Badge variant="secondary" className="bg-white/5 text-[10px] uppercase tracking-wider font-mono">
                        View Roster
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                    </CardContent>
                  </Card>
                </Link>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="absolute top-4 right-4 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity bg-card/80 backdrop-blur hover:bg-primary hover:text-white"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedTeam(team);
                    setIsEditTeamOpen(true);
                  }}
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-64 rounded-2xl border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground space-y-4">
            <Users className="h-10 w-10 opacity-20" />
            <p>No teams found matching your search.</p>
          </div>
        )}

        {/* Edit Team Dialog */}
        <Dialog open={isEditTeamOpen} onOpenChange={setIsEditTeamOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Edit Team Details</DialogTitle>
              <DialogDescription>Modify organizational settings for {selectedTeam?.name}.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Team Name</Label>
                <Input 
                  id="edit-name" 
                  value={selectedTeam?.name || ""}
                  onChange={(e) => setSelectedTeam({ ...selectedTeam, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-city">City</Label>
                <Input 
                  id="edit-city" 
                  value={selectedTeam?.city || ""}
                  onChange={(e) => setSelectedTeam({ ...selectedTeam, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-color">Primary Color</Label>
                <div className="flex items-center gap-3">
                  <div 
                    className="h-10 w-10 rounded-lg border border-border shadow-inner flex-shrink-0"
                    style={{ backgroundColor: selectedTeam?.primary_color }}
                  />
                  <input 
                    id="edit-color"
                    type="color" 
                    value={selectedTeam?.primary_color || "#FF6B00"}
                    onChange={(e) => setSelectedTeam({ ...selectedTeam, primary_color: e.target.value })}
                    className="h-10 w-full bg-background border border-border rounded-lg cursor-pointer px-1 py-1"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditTeamOpen(false)}>Cancel</Button>
              <Button onClick={handleEditTeam}>Update Team</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}