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
import { 
  CalendarIcon, 
  Loader2, 
  Sparkles, 
  MapPin, 
  Trophy, 
  ArrowLeftRight,
  Plus,
  Check,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { venueService } from "@/services/venueService";
import axios from "axios";

interface EditGameTeamsModalProps {
  game: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditGameTeamsModal({ game, isOpen, onClose, onUpdated }: EditGameTeamsModalProps) {
  const [teams, setTeams] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [homeColor, setHomeColor] = useState("");
  const [awayColor, setAwayColor] = useState("");
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [gameDate, setGameDate] = useState<Date | undefined>(new Date());
  const [venueId, setVenueId] = useState("");
  const [newVenueName, setNewVenueName] = useState("");
  const [isAddingVenue, setIsAddingVenue] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [detectedColors, setDetectedColors] = useState<string[]>([]);
  
  const { toast } = useToast();

  useEffect(() => {
    if (game && isOpen) {
      setHomeTeamId(game.home_team_id || "");
      setAwayTeamId(game.away_team_id || "");
      setHomeColor(game.home_team_color || "");
      setAwayColor(game.away_team_color || "");
      setHomeScore(game.home_score || 0);
      setAwayScore(game.away_score || 0);
      setGameDate(game.date ? new Date(game.date) : new Date());
      setVenueId(game.venue_id || "");
      
      if (game.detected_home_color && game.detected_away_color) {
        setDetectedColors([game.detected_home_color, game.detected_away_color]);
      } else {
        runCalibration();
      }
      
      loadData();
    }
  }, [game, isOpen]);

  const loadData = async () => {
    try {
      const [teamsData, venuesData] = await Promise.all([
        supabase.from('teams').select('*').order('name'),
        venueService.getVenues()
      ]);
      setTeams(teamsData.data || []);
      setVenues(venuesData);
    } catch (error) {
      console.error("Load failed:", error);
    }
  };

  const runCalibration = async () => {
    if (!game?.id || !game?.video_path) return;
    setCalibrating(true);
    try {
      const { data } = await axios.post("/api/analyze-colors", {
        gameId: game.id,
        videoPath: game.video_path
      });
      if (data.success) {
        setDetectedColors(data.colors);
      }
    } catch (error) {
      console.error("Calibration error:", error);
    } finally {
      setCalibrating(false);
    }
  };

  const handleAddVenue = async () => {
    if (!newVenueName.trim()) return;
    try {
      const venue = await venueService.createVenue(newVenueName.trim());
      setVenues([...venues, venue]);
      setVenueId(venue.id);
      setNewVenueName("");
      setIsAddingVenue(false);
      toast({ title: "Venue Created", description: `${venue.name} added to memory.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed", description: error.message });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('games')
        .update({
          home_team_id: homeTeamId || null,
          away_team_id: awayTeamId || null,
          home_team_color: homeColor,
          away_team_color: awayColor,
          home_score: homeScore,
          away_score: awayScore,
          date: gameDate?.toISOString(),
          venue_id: venueId || null
        })
        .eq('id', game.id);

      if (error) throw error;

      // Prepare for AI Discovery
      if (homeTeamId && awayTeamId) {
        await axios.post("/api/prepare-mapping", {
          gameId: game.id,
          homeTeamId,
          awayTeamId
        });
      }

      toast({ title: "Game Initialized", description: "Metadata saved. AI Discovery Swarm ignited." });
      onUpdated();
      onClose();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Setup Failed", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-card border-border p-0 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <DialogHeader className="px-8 pt-8 pb-4 border-b border-border/50">
          <DialogTitle className="text-2xl font-black flex items-center gap-3 tracking-tight">
            <Sparkles className="h-6 w-6 text-primary animate-pulse" />
            Step 2: Elite Metadata & Calibration
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest">
            Configure ground truth for the AI discovery pipeline
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-10 custom-scrollbar">
          {/* Visual Color Calibration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" /> Video Color Calibration
              </Label>
              {calibrating && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            </div>
            
            <div className="grid grid-cols-2 gap-6 bg-muted/10 p-6 rounded-2xl border border-white/5">
              <div className="space-y-4">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase">Detected Options</Label>
                <div className="flex gap-3">
                  {detectedColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        if (!homeColor) setHomeColor(color);
                        else if (!awayColor) setAwayColor(color);
                        else setHomeColor(color);
                      }}
                      className="group relative h-12 w-12 rounded-xl border border-white/10 shadow-lg transition-transform hover:scale-110 active:scale-95 overflow-hidden"
                      style={{ backgroundColor: color }}
                    >
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Plus className="h-4 w-4 text-white" />
                      </div>
                    </button>
                  ))}
                  {detectedColors.length === 0 && !calibrating && (
                    <p className="text-xs text-muted-foreground italic">No colors detected. <button onClick={runCalibration} className="text-primary hover:underline">Retry?</button></p>
                  )}
                </div>
              </div>
              
              <div className="space-y-4 border-l border-white/5 pl-6">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">Active Assignments</Label>
                  <Button variant="ghost" size="icon" onClick={() => { const h = homeColor; setHomeColor(awayColor); setAwayColor(h); }} className="h-6 w-6">
                    <ArrowLeftRight className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="h-10 rounded-lg border border-white/10 shadow-inner overflow-hidden flex" style={{ backgroundColor: homeColor || 'transparent' }}>
                      {!homeColor && <div className="m-auto text-[9px] font-mono text-muted-foreground">HOME</div>}
                    </div>
                    {homeColor && <button onClick={() => setHomeColor("")} className="text-[8px] font-bold text-destructive uppercase hover:underline">Clear</button>}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="h-10 rounded-lg border border-white/10 shadow-inner overflow-hidden flex" style={{ backgroundColor: awayColor || 'transparent' }}>
                      {!awayColor && <div className="m-auto text-[9px] font-mono text-muted-foreground">AWAY</div>}
                    </div>
                    {awayColor && <button onClick={() => setAwayColor("")} className="text-[8px] font-bold text-destructive uppercase hover:underline">Clear</button>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            {/* Team Selection */}
            <div className="space-y-6">
              <Label className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <Trophy className="h-3.5 w-3.5" /> Personnel Setup
              </Label>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">Home Team</Label>
                  <Select value={homeTeamId} onValueChange={setHomeTeamId}>
                    <SelectTrigger className="bg-muted/20 border-border h-11">
                      <SelectValue placeholder="Select Home..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">Away Team</Label>
                  <Select value={awayTeamId} onValueChange={setAwayTeamId}>
                    <SelectTrigger className="bg-muted/20 border-border h-11">
                      <SelectValue placeholder="Select Away..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Venue & Date */}
            <div className="space-y-6">
              <Label className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" /> Location & Time
              </Label>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">Game Venue</Label>
                  {!isAddingVenue ? (
                    <div className="flex gap-2">
                      <Select value={venueId} onValueChange={setVenueId}>
                        <SelectTrigger className="bg-muted/20 border-border h-11 flex-1">
                          <SelectValue placeholder="Search Venues..." />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="icon" onClick={() => setIsAddingVenue(true)} className="h-11 w-11 shrink-0 bg-muted/20">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input 
                        value={newVenueName} 
                        onChange={(e) => setNewVenueName(e.target.value)} 
                        placeholder="Venue Name..." 
                        className="bg-muted/20 border-border h-11"
                        autoFocus
                      />
                      <Button size="icon" onClick={handleAddVenue} className="h-11 w-11 shrink-0">
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setIsAddingVenue(false)} className="h-11 w-11 shrink-0">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">Game Date</Label>
                  <Popover modal={true}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal bg-muted/20 border-border h-11 text-sm">
                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                        {gameDate ? format(gameDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-popover border-border z-[200]">
                      <Calendar mode="single" selected={gameDate} onSelect={setGameDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>

          {/* Manual Scoreboard */}
          <div className="space-y-4">
            <Label className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5" /> Manual Scoreboard (Ground Truth)
            </Label>
            <div className="grid grid-cols-2 gap-12 bg-primary/5 p-8 rounded-3xl border border-primary/10">
              <div className="flex flex-col items-center gap-4">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">HOME FINAL</Label>
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="icon" onClick={() => setHomeScore(Math.max(0, homeScore - 1))} className="h-10 w-10 rounded-full">-</Button>
                  <Input 
                    type="number" 
                    value={homeScore} 
                    onChange={(e) => setHomeScore(parseInt(e.target.value) || 0)}
                    className="w-24 text-4xl font-black text-center bg-transparent border-none focus-visible:ring-0"
                  />
                  <Button variant="outline" size="icon" onClick={() => setHomeScore(homeScore + 1)} className="h-10 w-10 rounded-full">+</Button>
                </div>
              </div>
              <div className="flex flex-col items-center gap-4 border-l border-white/5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">AWAY FINAL</Label>
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="icon" onClick={() => setAwayScore(Math.max(0, awayScore - 1))} className="h-10 w-10 rounded-full">-</Button>
                  <Input 
                    type="number" 
                    value={awayScore} 
                    onChange={(e) => setAwayScore(parseInt(e.target.value) || 0)}
                    className="w-24 text-4xl font-black text-center bg-transparent border-none focus-visible:ring-0"
                  />
                  <Button variant="outline" size="icon" onClick={() => setAwayScore(awayScore + 1)} className="h-10 w-10 rounded-full">+</Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-8 py-8 border-t border-border bg-muted/5">
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground font-bold">DISCARD</Button>
          <Button 
            onClick={handleSave} 
            disabled={loading || !homeTeamId || !awayTeamId} 
            className="bg-primary hover:bg-primary/90 min-w-[240px] h-14 rounded-xl font-black text-xs tracking-widest uppercase shadow-xl shadow-primary/20"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "SAVE METADATA & START DISCOVERY"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}