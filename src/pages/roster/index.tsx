import React, { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Users, MapPin, ChevronRight, Search } from "lucide-react";
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
  const [newTeam, setNewTeam] = useState({ name: "", city: "", primary_color: "#FF6B00" });
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
    loadTeams();
  }, []);

  const handleAddTeam = async () => {
    if (!newTeam.name) return;
    try {
      await rosterService.createTeam(newTeam);
      toast({ title: "Team Created", description: `${newTeam.name} has been added to the registry.` });
      setIsAddTeamOpen(false);
      setNewTeam({ name: "", city: "", primary_color: "#FF6B00" });
      loadTeams();
    } catch (error) {
      toast({ title: "Error", description: "Failed to create team.", variant: "destructive" });
    }
  };

  const filteredTeams = teams.filter(team => 
    team.name.toLowerCase().includes(search.toLowerCase()) || 
    team.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout title="Teams | CourtVision Elite">
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
                <DialogTitle>Create New Team</DialogTitle>
                <DialogDescription>Add a new organization to the CourtVision registry.</DialogDescription>
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
              <Link key={team.id} href={`/roster/${team.id}`}>
                <Card className="glass-card border-none hover:ring-1 hover:ring-primary/50 transition-all group overflow-hidden">
                  <div 
                    className="h-2 w-full" 
                    style={{ backgroundColor: team.primary_color || 'var(--primary)' }} 
                  />
                  <CardHeader className="flex flex-row items-center gap-4">
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
            ))}
          </div>
        ) : (
          <div className="h-64 rounded-2xl border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground space-y-4">
            <Users className="h-10 w-10 opacity-20" />
            <p>No teams found matching your search.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}