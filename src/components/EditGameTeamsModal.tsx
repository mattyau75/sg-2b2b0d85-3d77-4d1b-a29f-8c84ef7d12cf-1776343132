import React, { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
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
    if (game) {
      setHomeTeamId(game.home_team_id || "");
      setAwayTeamId(game.away_team_id || "");
      setHomeColor(game.home_team_color || "#FFFFFF");
      setAwayColor(game.away_team_color || "#0B0F19");
    }
  }, [game]);

  useEffect(() => {
    async function fetchTeams() {
      const { data } = await supabase.from('teams').select('id, name').order('name');
      if (data) setTeams(data);
    }
    if (isOpen) fetchTeams();
  }, [isOpen]);

  const handleSave = async (reanalyze = false) => {
    if (!homeTeamId || !awayTeamId) {
      toast({ title: "Error", description: "Please select both teams", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('games')
        .update({
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          home_team_color: homeColor,
          away_team_color: awayColor,
          status: reanalyze ? 'processing' : game.status
        })
        .eq('id', game.id);

      if (error) throw error;

      if (reanalyze) {
        const response = await fetch('/api/process-game', {
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
        
        if (!response.ok) throw new Error("Failed to trigger re-analysis");
        toast({ title: "Analysis Restarted", description: "GPU is now re-analyzing with new rosters." });
      } else {
        toast({ title: "Teams Updated", description: "Game metadata successfully re-allocated." });
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
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-primary text-xl font-bold">Re-allocate Teams</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-4">
            <Label className="text-foreground/70 font-medium">Home Team (Directory)</Label>
            <Select value={homeTeamId} onValueChange={setHomeTeamId}>
              <SelectTrigger className="bg-muted/30 border-border">
                <SelectValue placeholder="Select Home Team" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-3 bg-muted/20 p-2 rounded-md border border-border/50">
              <Input 
                type="color" 
                value={homeColor} 
                onChange={(e) => setHomeColor(e.target.value)}
                className="w-12 h-10 p-1 border-none bg-transparent cursor-pointer"
              />
              <span className="text-xs text-muted-foreground uppercase font-mono">{homeColor} - Home Jersey</span>
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-foreground/70 font-medium">Away Team (Directory)</Label>
            <Select value={awayTeamId} onValueChange={setAwayTeamId}>
              <SelectTrigger className="bg-muted/30 border-border">
                <SelectValue placeholder="Select Away Team" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-3 bg-muted/20 p-2 rounded-md border border-border/50">
              <Input 
                type="color" 
                value={awayColor} 
                onChange={(e) => setAwayColor(e.target.value)}
                className="w-12 h-10 p-1 border-none bg-transparent cursor-pointer"
              />
              <span className="text-xs text-muted-foreground uppercase font-mono">{awayColor} - Away Jersey</span>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} className="hover:bg-muted">Cancel</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleSave(false)} disabled={loading} className="border-border">
              Save Only
            </Button>
            <Button onClick={() => handleSave(true)} disabled={loading} className="bg-primary hover:bg-primary/90 text-white font-bold">
              Save & Re-analyze
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}