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
  Plus, 
  UserPlus, 
  Activity,
  MoreHorizontal
} from "lucide-react";
import Link from "next/link";
import { rosterService } from "@/services/rosterService";
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

export default function TeamRoster() {
  const router = useRouter();
  const { id } = router.query;
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function loadTeam() {
      try {
        const data = await rosterService.getTeam(id as string);
        setTeam(data);
      } catch (error) {
        console.error("Failed to load team:", error);
      } finally {
        setLoading(false);
      }
    }
    loadTeam();
  }, [id]);

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
    <Layout title={`${team.name} Roster | CourtVision Elite`}>
      <div className="space-y-8">
        {/* Header */}
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
                    {team.players?.length || 0} Players
                  </div>
                </div>
              </div>
            </div>
            <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
              <UserPlus className="mr-2 h-4 w-4" />
              Add Player
            </Button>
          </div>
        </div>

        {/* Players Table */}
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
              {team.players?.length > 0 ? (
                team.players.map((player: any) => (
                  <TableRow key={player.id} className="border-white/5 hover:bg-white/5 transition-colors">
                    <TableCell className="text-center font-mono font-bold text-primary">
                      #{player.number || "--"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted border border-border overflow-hidden">
                          {player.avatar_url ? (
                            <img src={player.avatar_url} alt={player.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground bg-muted">
                              {player.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <span className="font-medium">{player.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-white/5 text-[10px]">
                        {player.position || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                          <DropdownMenuItem className="focus:bg-primary/20 cursor-pointer">
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem className="focus:bg-primary/20 cursor-pointer">
                            Edit Player
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:bg-destructive/10 cursor-pointer">
                            Remove Player
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
      </div>
    </Layout>
  );
}