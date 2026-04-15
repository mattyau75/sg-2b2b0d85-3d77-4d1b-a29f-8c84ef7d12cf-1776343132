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
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { showBanner } from "@/components/DiagnosticBanner";
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
  X,
  Camera
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [cameraType, setCameraType] = useState<"panning" | "fixed">("panning");
  
  const [isSaving, setIsSaving] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [detectedColors, setDetectedColors] = useState<string[]>([]);
  
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
      setCameraType(game.camera_type || "panning");
      
      if (game.detected_home_color && game.detected_away_color) {
        setDetectedColors([game.detected_home_color, game.detected_away_color]);
      } else {
        runCalibration();
      }
      
      loadTacticalData();
    }
  }, [game, isOpen]);

  const loadTacticalData = async () => {
    try {
      const [{ data: teamsData }, { data: venuesData }] = await Promise.all([
        supabase.from('teams').select('*').order('name'),
        supabase.from('venues').select('*').order('name')
      ]);
      setTeams(teamsData || []);
      setVenues(venuesData || []);
    } catch (error) {
      console.error("[EditGame] Load failed:", error);
    }
  };

  const runCalibration = async () => {
    const targetPath = game?.video_path;
    if (!game?.id || !targetPath) return;
    
    setCalibrating(true);
    try {
      const { data } = await axios.post("/api/analyze-colors", {
        gameId: game.id,
        videoPath: targetPath
      });
      if (data.success) {
        setDetectedColors(data.colors);
      }
    } catch (error) {
      console.error("[Calibration] Pulse error:", error);
    } finally {
      setCalibrating(false);
    }
  };

  const handleAddVenue = async () => {
    const sanitizedName = newVenueName.trim();
    if (!sanitizedName) return;
    try {
      const { data, error } = await supabase.from('venues').insert({ name: sanitizedName }).select().single();
      if (!error && data) {
        setVenues(prev => [...prev, data]);
        setVenueId(data.id);
        setNewVenueName("");
        setIsAddingVenue(false);
      }
    } catch (error) {
      console.error("[EditGame] Venue registration error");
    }
  };

  const handleSave = async () => {
    if (!game?.id) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("games")
        .update({
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          home_team_color: homeColor,
          away_team_color: awayColor,
          home_score: homeScore,
          away_score: awayScore,
          date: gameDate?.toISOString(),
          venue_id: venueId,
          camera_type: cameraType
        })
        .eq("id", game.id);

      if (error) throw error;
      showBanner("Tactical parameters synced", "success");
      onUpdated();
      onClose();
    } catch (error: any) {
      showBanner("Sync failed", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-background border-white/5 p-0 overflow-hidden shadow-2xl flex flex-col h-[90vh] text-white">
        <div className="px-8 pt-8 pb-6 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <DialogTitle className="text-2xl font-black tracking-tight uppercase italic">
                Parameter Calibration
              </DialogTitle>
            </div>
            <DialogDescription className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.2em]">
              AI Roster Mapping Engine • Environmental Tuning
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="flex-1 w-full">
          <div className="px-8 py-6 space-y-10">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" /> Video Color Calibration
                </Label>
                {calibrating && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/5 p-6 rounded-2xl border border-white/5">
                <div className="space-y-4">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">AI Detected Palette</Label>
                  <div className="flex gap-3 flex-wrap">
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
                  </div>
                </div>
                
                <div className="space-y-4 border-l border-white/5 pl-6">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Manual Override</Label>
                    <Button variant="ghost" size="icon" onClick={() => { const h = homeColor; setHomeColor(awayColor); setAwayColor(h); }} className="h-6 w-6">
                      <ArrowLeftRight className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="h-10 rounded-lg border border-white/10 shadow-inner overflow-hidden flex" style={{ backgroundColor: homeColor || 'transparent' }}>
                        {!homeColor && <div className="m-auto text-[9px] font-mono text-muted-foreground uppercase">Home</div>}
                      </div>
                      {homeColor && <button onClick={() => setHomeColor("")} className="text-[8px] font-bold text-destructive uppercase hover:underline">Clear</button>}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="h-10 rounded-lg border border-white/10 shadow-inner overflow-hidden flex" style={{ backgroundColor: awayColor || 'transparent' }}>
                        {!awayColor && <div className="m-auto text-[9px] font-mono text-muted-foreground uppercase">Away</div>}
                      </div>
                      {awayColor && <button onClick={() => setAwayColor("")} className="text-[8px] font-bold text-destructive uppercase hover:underline">Clear</button>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <Label className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <Trophy className="h-3.5 w-3.5" /> Personnel Setup
                </Label>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Home Team</Label>
                    <Select value={homeTeamId} onValueChange={setHomeTeamId}>
                      <SelectTrigger className="bg-white/5 border-white/10 h-11 text-white">
                        <SelectValue placeholder="Select Home..." />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-white/10 text-white">
                        {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Away Team</Label>
                    <Select value={awayTeamId} onValueChange={setAwayTeamId}>
                      <SelectTrigger className="bg-white/5 border-white/10 h-11 text-white">
                        <SelectValue placeholder="Select Away..." />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-white/10 text-white">
                        {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

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
                          <SelectTrigger className="bg-white/5 border-white/10 h-11 flex-1 text-white">
                            <SelectValue placeholder="Search Venues..." />
                          </SelectTrigger>
                          <SelectContent className="bg-background border-white/10 text-white">
                            {venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" onClick={() => setIsAddingVenue(true)} className="h-11 w-11 shrink-0 bg-white/5 border-white/10">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input 
                          value={newVenueName} 
                          onChange={(e) => setNewVenueName(e.target.value)} 
                          placeholder="Venue Name..." 
                          className="bg-white/5 border-white/10 h-11 text-white"
                          autoFocus
                        />
                        <Button size="icon" onClick={handleAddVenue} className="h-11 w-11 shrink-0 bg-primary">
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
                        <Button variant="outline" className="w-full justify-start text-left font-normal bg-white/5 border-white/10 h-11 text-sm text-white hover:bg-white/10">
                          <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                          {gameDate ? format(gameDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-background border-white/10 z-[200]">
                        <Calendar mode="single" selected={gameDate} onSelect={setGameDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <Camera className="h-3.5 w-3.5" /> Discovery Optimization
              </Label>
              <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold">Camera Orientation</h4>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
                      Calibrates motion compensation for the tracking swarm
                    </p>
                  </div>
                  <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 self-start">
                    <button
                      onClick={() => setCameraType("panning")}
                      className={cn(
                        "px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                        cameraType === "panning" ? "bg-primary text-white" : "text-muted-foreground hover:text-white"
                      )}
                    >
                      Panning
                    </button>
                    <button
                      onClick={() => setCameraType("fixed")}
                      className={cn(
                        "px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                        cameraType === "fixed" ? "bg-primary text-white" : "text-muted-foreground hover:text-white"
                      )}
                    >
                      Fixed
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-8 py-8 border-t border-white/5 bg-white/[0.02] shrink-0">
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground font-bold hover:text-white">DISCARD</Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !homeTeamId || !awayTeamId} 
            className="bg-primary hover:bg-primary/90 min-w-[240px] h-14 rounded-xl font-black text-xs tracking-widest uppercase shadow-xl shadow-primary/20"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "SYNC PARAMETERS"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}