import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EditGameTeamsModalProps {
  game: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditGameTeamsModal({ game, isOpen, onClose, onUpdated }: EditGameTeamsModalProps) {
  const [teams, setTeams] = useState<any[]>([]);
  const [homeTeamId, setHomeTeamId] = useState(game?.home_team_id || "");
  const [awayTeamId, setAwayTeamId] = useState(game?.away_team_id || "");
  const [homeColor, setHomeColor] = useState(game?.home_team_color || "#FFFFFF");
  const [awayColor, setAwayColor] = useState(game?.away_team_color || "#0B0F19");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchTeams() {
      const { data } = await supabase.from('teams').select('id, name').order('name');
      if (data) setTeams(data);
    }
    if (isOpen) fetchTeams();
  }, [isOpen]);

  const handleSave = async (reanalyze = false) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('games')
        .update({
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          home_team_color: homeColor,
          away_team_color: awayColor
        })
        .eq('id', game.id);

      if (error) throw error;

      toast({ title: "Teams Updated", description: "Game metadata successfully re-allocated." });
      
      if (reanalyze) {
        // Trigger re-analysis via API
        await fetch('/api/process-game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            gameId: game.id,
            videoPath: game.video_path,
            homeTeamId,
            awayTeamId,
            homeColor,
            awayColor
          }),
        });
        toast({ title: "Analysis Restarted", description: "GPU is now re-analyzing with new rosters." });
      }

      onUpdated();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-primary">Re-allocate Teams</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-4">
            <Label className="text-foreground/70">Home Team (Directory)</Label>
            <Select value={homeTeamId} onValueChange={setHomeTeamId}>
              <SelectTrigger className="bg-muted/30 border-border">
                <SelectValue placeholder="Select Home Team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-3">
              <Input 
                type="color" 
                value={homeColor} 
                onChange={(e) => setHomeColor(e.target.value)}
                className="w-12 h-10 p-1 border-none bg-transparent"
              />
              <span className="text-xs text-muted-foreground">Jersey Color (Home)</span>
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-foreground/70">Away Team (Directory)</Label>
            <Select value={awayTeamId} onValueChange={setAwayTeamId}>
              <SelectTrigger className="bg-muted/30 border-border">
                <SelectValue placeholder="Select Away Team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-3">
              <Input 
                type="color" 
                value={awayColor} 
                onChange={(e) => setAwayColor(e.target.value)}
                className="w-12 h-10 p-1 border-none bg-transparent"
              />
              <span className="text-xs text-muted-foreground">Jersey Color (Away)</span>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="border-border">Cancel</Button>
          <Button onClick={() => handleSave(false)} disabled={loading}>Save Only</Button>
          <Button onClick={() => handleSave(true)} disabled={loading} className="bg-primary hover:bg-primary/90">Save & Re-analyze</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}