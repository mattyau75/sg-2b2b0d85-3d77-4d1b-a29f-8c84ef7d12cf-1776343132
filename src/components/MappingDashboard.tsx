import React, { useState } from "react";
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
  Save
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MappingDashboardProps {
  gameId: string;
  aiMappings: any[];
  homeRoster: any[];
  awayRoster: any[];
  onRefresh: () => void;
}

export function MappingDashboard({ gameId, aiMappings, homeRoster, awayRoster, onRefresh }: MappingDashboardProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const unmappedTracks = aiMappings.filter(m => !m.real_player_id);
  const mappedTracks = aiMappings.filter(m => m.real_player_id);

  const handleManualMatch = async (mappingId: string, playerId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('ai_player_mappings')
        .update({ 
          real_player_id: playerId, 
          is_manual_override: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', mappingId);

      if (error) throw error;
      toast({ title: "Identity Linked", description: "Manual mapping saved successfully." });
      onRefresh();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Mapping Failed", description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (mappingId: string) => {
    try {
      await supabase
        .from('ai_player_mappings')
        .update({ real_player_id: null, is_manual_override: false })
        .eq('id', mappingId);
      onRefresh();
    } catch (err) {}
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT: AI DETECTED TRACKS */}
      <Card className="bg-card/40 border-white/5">
        <CardHeader className="border-b border-white/5 bg-primary/5">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-primary" /> AI DISCOVERY REGISTRY
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-[10px] uppercase font-mono">ID / Track</TableHead>
                <TableHead className="text-[10px] uppercase font-mono">AI Detection</TableHead>
                <TableHead className="text-[10px] uppercase font-mono">Assigned Roster</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aiMappings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground text-xs font-mono">
                    NO AI ENTITIES DETECTED YET. RUN MODULE 2 ANALYSIS.
                  </TableCell>
                </TableRow>
              ) : (
                aiMappings.map((track) => (
                  <TableRow key={track.id} className="border-white/5 group">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-mono text-muted-foreground">ID: {track.ai_track_id || track.id.slice(0, 8)}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <div className={cn(
                            "w-3 h-3 rounded-full",
                            track.team_side === 'home' ? "bg-primary" : "bg-accent"
                          )} />
                          <span className="text-[10px] font-bold uppercase">{track.team_side}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black italic text-white">#{track.jersey_number}</span>
                        <Badge variant="outline" className="text-[9px] h-4 font-mono bg-white/5">
                          {Math.round((track.confidence || 0) * 100)}% CONF
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {track.real_player_id ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          <span className="text-sm font-bold truncate max-w-[100px]">{track.player?.name}</span>
                          {track.is_manual_override && <Badge className="text-[8px] bg-primary/20 text-primary border-primary/20">MANUAL</Badge>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-amber-500">
                          <AlertCircle className="h-3 w-3" />
                          <span className="text-[10px] font-bold uppercase italic">Unmatched</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {track.real_player_id ? (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleReset(track.id)}>
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      ) : (
                        <select 
                          className="bg-background border border-white/10 rounded px-2 py-1 text-[10px] font-mono outline-none focus:ring-1 focus:ring-primary w-24"
                          onChange={(e) => handleManualMatch(track.id, e.target.value)}
                          defaultValue=""
                        >
                          <option value="" disabled>Link Roster...</option>
                          <optgroup label="Home Roster">
                            {homeRoster.map(p => <option key={p.id} value={p.id}>#{p.number} {p.name}</option>)}
                          </optgroup>
                          <optgroup label="Away Roster">
                            {awayRoster.map(p => <option key={p.id} value={p.id}>#{p.number} {p.name}</option>)}
                          </optgroup>
                        </select>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* RIGHT: ROSTER INTEGRITY VIEW */}
      <Card className="bg-card/40 border-white/5">
        <CardHeader className="border-b border-white/5 bg-accent/5">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <Users className="h-4 w-4 text-accent" /> ROSTER MAPPING STATUS
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-auto max-h-[600px]">
          <div className="grid grid-cols-1 divide-y divide-white/5">
            {[...homeRoster, ...awayRoster].map((player) => {
              const mapping = aiMappings.find(m => m.real_player_id === player.id);
              return (
                <div key={player.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-black italic text-muted-foreground w-8">#{player.number}</span>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-white">{player.name}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">{player.position || 'Player'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {mapping ? (
                      <div className="flex flex-col items-end">
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] font-black">
                          LINKED TO AI #{mapping.jersey_number}
                        </Badge>
                        <span className="text-[8px] font-mono text-muted-foreground mt-1">CONF: {Math.round((mapping.confidence || 0) * 100)}%</span>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground/50 border-white/5 text-[9px] font-mono italic">
                        NOT SEEN IN VIDEO
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}