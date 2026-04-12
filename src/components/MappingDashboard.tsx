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
  RefreshCw
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

  const handleManualMatch = async (mappingId: string, playerId: string) => {
    setSaving(mappingId);
    try {
      // Direct Link: Map AI Track to Real Player
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

  const handleReset = async (mappingId: string) => {
    try {
      await rosterService.updateMapping(mappingId, null);
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
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-10 bg-muted rounded border border-white/5 overflow-hidden flex-shrink-0">
                          {track.snapshot_url ? (
                            <img 
                              src={track.snapshot_url} 
                              alt="Player Snapshot" 
                              className="h-full w-full object-cover"
                            />
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
                              className="w-4 h-4 rounded-sm border border-white/10 shadow-sm"
                              style={{ backgroundColor: track.detected_color || (track.team_side === 'home' ? '#EA580C' : '#06B6D4') }}
                              title="Detected Average Color"
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
                          {Math.round((track.confidence || 0) * 100)}% CONF
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {track.real_player_id ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          <span className="text-sm font-bold truncate max-w-[100px]">{track.players?.name || 'Unknown'}</span>
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
                          className="bg-background border border-white/10 rounded px-2 py-1 text-[10px] font-mono outline-none focus:ring-1 focus:ring-primary w-24 disabled:opacity-50"
                          onChange={(e) => handleManualMatch(track.id, e.target.value)}
                          defaultValue=""
                          disabled={saving === track.id}
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

      {/* RIGHT: ROSTER MAPPING STATUS (BIFURCATED) */}
      <Card className="bg-card/40 border-white/5 lg:col-span-1">
        <CardHeader className="border-b border-white/5 bg-accent/5">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <Users className="h-4 w-4 text-accent" /> ROSTER MAPPING STATUS
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-auto max-h-[600px]">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">
            {/* HOME TEAM COLUMN */}
            <div className="flex flex-col">
              <div className="p-3 bg-white/5 border-b border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Home Roster</span>
                <div 
                  className="w-6 h-3 rounded-sm border border-white/10 shadow-sm" 
                  style={{ backgroundColor: homeColor || '#EA580C' }}
                  title="Home Calibration Color"
                />
              </div>
              <div className="divide-y divide-white/5">
                {homeRoster.map((player) => {
                  const mapping = aiMappings.find(m => m.real_player_id === player.id);
                  return (
                    <div key={player.id} className="p-3 flex items-center justify-between hover:bg-white/5 transition-colors group">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-black italic text-muted-foreground w-6">#{player.number}</span>
                        <div className="flex flex-col">
                          <span className="font-bold text-xs text-white truncate max-w-[80px]">{player.name}</span>
                          <span className="text-[8px] text-muted-foreground uppercase">{player.position || 'G'}</span>
                        </div>
                      </div>
                      {mapping ? (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[8px] font-black px-1.5 py-0">
                          AI #{mapping.jersey_number}
                        </Badge>
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-white/10 group-hover:bg-amber-500/30 transition-colors" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AWAY TEAM COLUMN */}
            <div className="flex flex-col">
              <div className="p-3 bg-white/5 border-b border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Away Roster</span>
                <div 
                  className="w-6 h-3 rounded-sm border border-white/10 shadow-sm" 
                  style={{ backgroundColor: awayColor || '#06B6D4' }}
                  title="Away Calibration Color"
                />
              </div>
              <div className="divide-y divide-white/5">
                {awayRoster.map((player) => {
                  const mapping = aiMappings.find(m => m.real_player_id === player.id);
                  return (
                    <div key={player.id} className="p-3 flex items-center justify-between hover:bg-white/5 transition-colors group">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-black italic text-muted-foreground w-6">#{player.number}</span>
                        <div className="flex flex-col">
                          <span className="font-bold text-xs text-white truncate max-w-[80px]">{player.name}</span>
                          <span className="text-[8px] text-muted-foreground uppercase">{player.position || 'G'}</span>
                        </div>
                      </div>
                      {mapping ? (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[8px] font-black px-1.5 py-0">
                          AI #{mapping.jersey_number}
                        </Badge>
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-white/10 group-hover:bg-amber-500/30 transition-colors" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}