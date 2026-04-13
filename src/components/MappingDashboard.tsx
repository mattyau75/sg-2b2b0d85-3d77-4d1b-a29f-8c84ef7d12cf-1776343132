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

  const handleManualMatch = async (mappingId: string, playerId: string) => {
    setSaving(mappingId);
    try {
      const { error } = await supabase
        .from('ai_player_mappings')
        .update({ 
          real_player_id: playerId, 
          is_manual_override: true,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', mappingId);

      if (error) throw error;
      
      showBanner("Personnel Identity Locked", "success");
      onRefresh();
    } catch (error: any) {
      showBanner(error.message || "Mapping Failed", "error");
    } finally {
      setSaving(null);
    }
  };

  const handleCommitStats = async () => {
    const unmatched = aiMappings.filter(m => !m.real_player_id).length;
    if (unmatched > 0) {
      if (!confirm(`Warning: ${unmatched} AI tracks are still unmatched. Their stats will not be attributed to specific players. Proceed?`)) return;
    }

    setCommitting(true);
    try {
      // Logic to commit raw AI events to official player game stats
      const { error } = await supabase.rpc('commit_game_stats', { 
        target_game_id: gameId 
      });

      if (error) throw error;

      showBanner("Official Records Finalized", "success", "Mapping Engine Locked");
      onRefresh();
    } catch (error: any) {
      showBanner(error.message || "Commit Failed", "error", "Transaction Error");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6 mt-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-accent/5 p-6 rounded-2xl border border-accent/20 shadow-inner">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center border border-accent/20">
            <Zap className="h-6 w-6 text-accent animate-pulse" />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tighter text-white italic">Module 04: Mapping Engine</h3>
            <p className="text-xs text-muted-foreground font-mono">Synchronize AI Discovery Payload with Official Roster Records</p>
          </div>
        </div>
        <Button 
          onClick={handleCommitStats} 
          disabled={committing || aiMappings.length === 0}
          className="bg-accent hover:bg-accent/80 text-black font-black uppercase italic tracking-tighter h-12 px-8 text-sm shadow-lg shadow-accent/20 border border-accent/30"
        >
          {committing ? <RefreshCw className="h-5 w-5 animate-spin mr-3" /> : <CheckCircle className="h-5 w-5 mr-3" />}
          Commit Official Stats
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                      AWAITING ANALYSIS COMPLETION.
                    </TableCell>
                  </TableRow>
                ) : (
                  aiMappings.map((track) => (
                    <TableRow key={track.id} className="border-white/5 group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative h-12 w-10 bg-muted rounded border border-white/5 overflow-hidden flex-shrink-0">
                            {track.snapshot_url ? (
                              <img src={track.snapshot_url} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center">
                                <ImageIcon className="h-4 w-4 text-muted-foreground/20" />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-mono text-muted-foreground">ID: {track.ai_track_id || track.id.slice(0, 8)}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <div 
                                className="w-4 h-4 rounded-sm" 
                                style={{ backgroundColor: track.detected_color || (track.team_side === 'home' ? homeColor : awayColor) }} 
                              />
                              <span className="text-[10px] font-bold uppercase">{track.team_side}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-black italic text-white">#{track.jersey_number}</span>
                          <Badge variant="outline" className="text-[9px] h-4 font-mono bg-white/5">
                            {Math.round((track.confidence || 0) * 100)}%
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {track.real_player_id ? (
                          <div className="flex items-center gap-2 text-emerald-500">
                            <CheckCircle2 className="h-3 w-3" />
                            <span className="text-xs font-bold">{track.players?.name}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold uppercase italic text-amber-500">Unmatched</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <select 
                          className="bg-background border border-white/10 rounded px-2 py-1 text-[10px] font-mono outline-none focus:ring-1 focus:ring-primary w-24 disabled:opacity-50"
                          onChange={(e) => handleManualMatch(track.id, e.target.value)}
                          value={track.real_player_id || ""}
                          disabled={saving === track.id}
                        >
                          <option value="">Link...</option>
                          <optgroup label="Home Roster">
                            {homeRoster.map(p => <option key={p.id} value={p.id}>#{p.number} {p.name}</option>)}
                          </optgroup>
                          <optgroup label="Away Roster">
                            {awayRoster.map(p => <option key={p.id} value={p.id}>#{p.number} {p.name}</option>)}
                          </optgroup>
                        </select>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-white/5">
          <CardHeader className="border-b border-white/5 bg-accent/5">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" /> ROSTER STATUS
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Home Roster</span>
                <div className="space-y-2">
                  {homeRoster.map(p => {
                    const mapped = aiMappings.find(m => m.real_player_id === p.id);
                    return (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5">
                        <span className="text-xs font-bold">#{p.number} {p.name}</span>
                        {mapped ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <div className="h-1.5 w-1.5 rounded-full bg-white/10" />}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Away Roster</span>
                <div className="space-y-2">
                  {awayRoster.map(p => {
                    const mapped = aiMappings.find(m => m.real_player_id === p.id);
                    return (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5">
                        <span className="text-xs font-bold">#{p.number} {p.name}</span>
                        {mapped ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <div className="h-1.5 w-1.5 rounded-full bg-white/10" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}