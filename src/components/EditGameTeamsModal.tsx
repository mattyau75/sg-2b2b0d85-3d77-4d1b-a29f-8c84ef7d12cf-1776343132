import React, { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
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
import { CalendarIcon, Loader2, Sparkles, HelpCircle, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import axios from "axios";

// Helper for UUID validation
const isValidUUID = (uuid: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

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
  const [venue, setVenue] = useState("");
  const [loading, setLoading] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [detectedColors, setDetectedColors] = useState<string[]>([]);
  const [detectedPlayers, setDetectedPlayers] = useState<any[]>([]);
  const [manualMappings, setManualMappings] = useState<Record<string, string>>({}); // jersey_number -> player_id
  const { toast } = useToast();

  useEffect(() => {
    if (game && isOpen) {
      setHomeTeamId(game.home_team_id || "");
      setAwayTeamId(game.away_team_id || "");
      setHomeColor(game.home_team_color || "#FFFFFF");
      setAwayColor(game.away_team_color || "#0B0F19");
      
      // Safe date parsing
      const initialDate = game.date ? new Date(game.date) : new Date();
      setGameDate(isNaN(initialDate.getTime()) ? new Date() : initialDate);
      
      setVenue(game.venue || "DribbleStats Stadium");
      setManualMappings(game.processing_metadata?.manual_mappings || {});
      
      if (game.detected_home_color && game.detected_away_color) {
        setDetectedColors([game.detected_home_color, game.detected_away_color]);
      } else {
        runCalibration();
      }
    }
  }, [game, isOpen]);

  const [homeRoster, setHomeRoster] = useState<any[]>([]);
  const [awayRoster, setAwayRoster] = useState<any[]>([]);

  useEffect(() => {
    async function fetchRosters() {
      if (homeTeamId) {
        const { data } = await supabase.from('players').select('*').eq('team_id', homeTeamId);
        setHomeRoster(data || []);
      }
      if (awayTeamId) {
        const { data } = await supabase.from('players').select('*').eq('team_id', awayTeamId);
        setAwayRoster(data || []);
      }
    }
    if (isOpen) fetchRosters();
  }, [homeTeamId, awayTeamId, isOpen]);

  useEffect(() => {
    async function fetchTeams() {
      const { data } = await supabase.from('teams').select('id, name').order('name');
      if (data) setTeams(data);
    }
    if (isOpen) fetchTeams();
  }, [isOpen]);

  const runCalibration = async () => {
    if (!game?.id || !isValidUUID(game.id) || !game?.video_path) return;
    setCalibrating(true);
    try {
      const { data } = await axios.post("/api/analyze-colors", {
        gameId: game.id,
        videoPath: game.video_path
      });
      if (data.success) {
        setDetectedColors(data.colors);
        toast({ title: "Calibration Complete", description: "Identified two primary team colors from video." });
      }
    } catch (error) {
      console.error("Calibration error:", error);
    } finally {
      setCalibrating(false);
    }
  };

  const swapDetectedColors = () => {
    setDetectedColors([...detectedColors].reverse());
  };

  const allocateColors = () => {
    if (detectedColors.length === 2) {
      setHomeColor(detectedColors[0]);
      setAwayColor(detectedColors[1]);
      toast({ title: "Colors Allocated", description: "Video calibrated colors applied to rosters." });
    }
  };

  const handleSave = async (reAnalyze = false) => {
    if (!game?.id || !isValidUUID(game.id)) return;
    setLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('games')
        .update({
          home_team_id: isValidUUID(homeTeamId) ? homeTeamId : null,
          away_team_id: isValidUUID(awayTeamId) ? awayTeamId : null,
          home_team_color: homeColor,
          away_team_color: awayColor,
          date: gameDate ? gameDate.toISOString() : null,
          venue: venue,
          status: reAnalyze ? 'pending' : game.status,
          processing_metadata: {
            ...game.processing_metadata,
            manual_mappings: manualMappings
          }
        })
        .eq('id', game.id);

      if (updateError) throw updateError;

      if (reAnalyze) {
        await axios.post("/api/process-game", {
          gameId: game.id,
          homeTeamId,
          awayTeamId,
          homeColor,
          awayColor,
          config: { scouting_mode: "deep_recognition", roster_sync: true }
        });
        toast({ title: "GPU Engine Restarted", description: "Modular scouting active with calibrated colors." });
      } else {
        toast({ title: "Metadata Updated", description: "Game details and team rosters have been linked." });
      }

      onUpdated();
      onClose();
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border shadow-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-primary text-xl font-bold tracking-tight">Module 1: Identity & Mapping</DialogTitle>
          <DialogDescription className="text-muted-foreground/80 font-mono text-xs uppercase tracking-wider">
            Match video identities to your directory rosters
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* Video Color Calibration Section */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-4 relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                <Label className="text-white text-xs font-bold uppercase tracking-widest">Video Color Calibration</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary transition-colors" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-popover border-border p-3 max-w-xs">
                      <p className="text-xs leading-relaxed">
                        Computer vision analyzes the video to identify team jersey colors. 
                        Allocate these to ensure 100% accurate player recognition in the scouting pipeline.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {calibrating && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            </div>

            {detectedColors.length === 2 ? (
              <div className="flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="flex items-center gap-3 bg-background/50 p-2 rounded-lg border border-white/5 flex-1">
                  <div className="w-8 h-8 rounded shadow-inner" style={{ backgroundColor: detectedColors[0] }} />
                  <div className="flex-1 text-[10px] font-mono font-bold text-muted-foreground uppercase">Detected A</div>
                </div>
                
                <Button variant="ghost" size="icon" onClick={swapDetectedColors} className="hover:bg-primary/20 hover:text-primary rounded-full h-8 w-8">
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-3 bg-background/50 p-2 rounded-lg border border-white/5 flex-1">
                  <div className="w-8 h-8 rounded shadow-inner" style={{ backgroundColor: detectedColors[1] }} />
                  <div className="flex-1 text-[10px] font-mono font-bold text-muted-foreground uppercase">Detected B</div>
                </div>

                <Button onClick={allocateColors} size="sm" className="bg-primary hover:bg-primary/90 text-[10px] font-bold h-8 px-4">
                  ALLOCATE
                </Button>
              </div>
            ) : !calibrating && (
              <Button onClick={runCalibration} variant="outline" className="w-full h-10 border-dashed border-primary/30 text-primary font-bold text-xs">
                RE-RUN VISUAL CALIBRATION
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground/70 text-[10px] font-bold uppercase tracking-widest">Game Venue</Label>
              <Input value={venue} onChange={(e) => setVenue(e.target.value)} className="bg-muted/20 border-border h-10 text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground/70 text-[10px] font-bold uppercase tracking-widest">Game Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-muted/20 border-border h-10 text-sm", !gameDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {gameDate ? format(gameDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-auto p-0 bg-popover border-border z-[150]" 
                  align="start"
                  side="bottom"
                  onInteractOutside={(e) => e.preventDefault()}
                >
                  <Calendar 
                    mode="single" 
                    selected={gameDate} 
                    onSelect={(date) => {
                      if (date) {
                        setGameDate(date);
                      }
                    }}
                    className="rounded-md border-none" 
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground/70 text-[10px] font-bold uppercase tracking-widest">Home Team & Tactical Color</Label>
              <div className="flex gap-2">
                <Select value={homeTeamId} onValueChange={setHomeTeamId}>
                  <SelectTrigger className="bg-muted/20 border-border h-10 flex-1">
                    <SelectValue placeholder="Select Home Team" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="color" value={homeColor} onChange={(e) => setHomeColor(e.target.value)} className="w-12 h-10 p-1 bg-muted/20 border-border cursor-pointer shrink-0" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground/70 text-[10px] font-bold uppercase tracking-widest">Away Team & Tactical Color</Label>
              <div className="flex gap-2">
                <Select value={awayTeamId} onValueChange={setAwayTeamId}>
                  <SelectTrigger className="bg-muted/20 border-border h-10 flex-1">
                    <SelectValue placeholder="Select Away Team" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="color" value={awayColor} onChange={(e) => setAwayColor(e.target.value)} className="w-12 h-10 p-1 bg-muted/20 border-border cursor-pointer shrink-0" />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-2 bg-muted/50 -mx-6 -mb-6 p-6">
          <Button variant="ghost" onClick={onClose} className="hover:bg-muted text-muted-foreground text-xs font-bold">CANCEL</Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => handleSave(false)} disabled={loading} className="border-border hover:bg-white/5 flex-1 sm:flex-none text-xs font-bold px-6">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "SAVE METADATA"}
            </Button>
            <Button onClick={() => handleSave(true)} disabled={loading} className="bg-primary hover:bg-primary/90 text-white font-bold flex-1 sm:flex-none shadow-lg shadow-primary/20 text-xs px-6">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "SAVE & START AI MAPPING"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}