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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditGameTeamsModalProps {
  game: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditGameTeamsModal({ game, isOpen, onClose, onUpdated }: EditGameTeamsModalProps) {
  const [teams, setTeams] = useState<any[]>([]);
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [homeColor, setHomeColor] = useState("#FFFFFF");
  const [awayColor, setAwayColor] = useState("#0B0F19");
  const [gameDate, setGameDate] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (game && isOpen) {
      setHomeTeamId(game.home_team_id || "");
      setAwayTeamId(game.away_team_id || "");
      setHomeColor(game.home_team_color || "#FFFFFF");
      setAwayColor(game.away_team_color || "#0B0F19");
      setGameDate(game.date ? new Date(game.date) : new Date());
    }
  }, [game, isOpen]);

  useEffect(() => {
    async function fetchTeams() {
      const { data } = await supabase.from('teams').select('id, name').order('name');
      if (data) setTeams(data);
    }
    if (isOpen) fetchTeams();
  }, [isOpen]);

  const handleSave = async (reanalyze = false) => {
    if (!homeTeamId || !awayTeamId) {
      toast({ title: "Validation Error", description: "Please select both teams.", variant: "destructive" });
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
          date: gameDate?.toISOString(),
          status: reanalyze ? 'processing' : (game.status || 'completed')
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
        toast({ title: "Analysis Restarted", description: "GPU is now re-analyzing with updated roster data." });
      } else {
        toast({ title: "Success", description: "Game metadata updated successfully." });
      }

      onUpdated();
      onClose();
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] bg-card border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-primary text-xl font-bold tracking-tight">Game Metadata</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5 py-4">
          <div className="space-y-2">
            <Label className="text-foreground/70 text-xs font-bold uppercase tracking-wider">Game Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal bg-muted/20 border-border h-11",
                    !gameDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                  {gameDate ? format(gameDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
                <Calendar
                  mode="single"
                  selected={gameDate}
                  onSelect={setGameDate}
                  initialFocus
                  className="rounded-md border-none"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-3">
            <Label className="text-foreground/70 text-xs font-bold uppercase tracking-wider">Home Team & Color</Label>
            <div className="flex gap-2">
              <Select value={homeTeamId} onValueChange={setHomeTeamId}>
                <SelectTrigger className="bg-muted/20 border-border h-11 flex-1">
                  <SelectValue placeholder="Home Team" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input 
                type="color" 
                value={homeColor} 
                onChange={(e) => setHomeColor(e.target.value)}
                className="w-14 h-11 p-1 bg-muted/20 border-border cursor-pointer shrink-0"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-foreground/70 text-xs font-bold uppercase tracking-wider">Away Team & Color</Label>
            <div className="flex gap-2">
              <Select value={awayTeamId} onValueChange={setAwayTeamId}>
                <SelectTrigger className="bg-muted/20 border-border h-11 flex-1">
                  <SelectValue placeholder="Away Team" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input 
                type="color" 
                value={awayColor} 
                onChange={(e) => setAwayColor(e.target.value)}
                className="w-14 h-11 p-1 bg-muted/20 border-border cursor-pointer shrink-0"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button variant="ghost" onClick={onClose} className="hover:bg-muted text-muted-foreground">Cancel</Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={() => handleSave(false)} 
              disabled={loading} 
              className="border-border hover:bg-white/5 flex-1 sm:flex-none"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Only"}
            </Button>
            <Button 
              onClick={() => handleSave(true)} 
              disabled={loading} 
              className="bg-primary hover:bg-primary/90 text-white font-bold flex-1 sm:flex-none shadow-lg shadow-primary/20"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & Re-analyze"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}