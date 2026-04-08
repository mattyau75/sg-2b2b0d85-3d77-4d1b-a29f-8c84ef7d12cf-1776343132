import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Youtube, Target, Cpu, SlidersHorizontal, Settings2, Palette } from "lucide-react";
import { rosterService } from "@/services/rosterService";
import { modalService } from "@/services/modalService";
import { useToast } from "@/hooks/use-toast";

interface NewGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (jobId: string) => void;
}

export function NewGameModal({ isOpen, onClose, onSuccess }: NewGameModalProps) {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    youtubeUrl: "",
    homeTeamId: "",
    awayTeamId: "",
    homeColor: "#FF6B00",
    awayColor: "#FFFFFF",
    imgsz: 1280,
    conf: 0.25,
    iou: 0.45,
    tracking: true,
    agnosticNms: true,
    rimDetection: true,
    shotLogic: true,
  });

  useEffect(() => {
    if (isOpen) {
      loadTeams();
    }
  }, [isOpen]);

  const loadTeams = async () => {
    try {
      const data = await rosterService.getTeams();
      setTeams(data);
    } catch (error) {
      console.error("Failed to load teams:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!formData.youtubeUrl) {
      toast({ title: "Missing URL", description: "Please provide a YouTube link.", variant: "destructive" });
      return;
    }
    if (!formData.homeTeamId || !formData.awayTeamId) {
      toast({ title: "Teams Required", description: "Select both Home and Away teams.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await modalService.processGame(formData.youtubeUrl, {
        imgsz: formData.imgsz,
        conf: formData.conf,
        iou: formData.iou,
        tracking: formData.tracking,
        agnostic_nms: formData.agnosticNms,
        rim_detection: formData.rimDetection,
        shot_logic: formData.shotLogic,
        home_team_id: formData.homeTeamId,
        away_team_id: formData.awayTeamId,
        home_team_color: formData.homeColor,
        away_team_color: formData.awayColor,
      });
      
      toast({ title: "Analysis Started", description: "GPU Pipeline initiated on Modal.com" });
      onSuccess(result.job_id);
      onClose();
    } catch (error: any) {
      toast({ title: "Processing Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border p-0 overflow-hidden">
        <div className="flex flex-col h-[80vh] md:h-auto">
          <DialogHeader className="p-6 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="h-4 w-4 text-primary" />
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">A100-ACTIVE</Badge>
            </div>
            <DialogTitle className="text-2xl">New Game Analysis</DialogTitle>
            <DialogDescription>Link video and metadata for AI-powered clip extraction.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Step 1: Video */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Youtube className="h-4 w-4 text-red-500" />
                Video Source
              </div>
              <Input 
                placeholder="Paste YouTube URL..." 
                className="bg-background border-border font-mono text-sm"
                value={formData.youtubeUrl}
                onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
              />
            </div>

            {/* Step 2: Teams & Colors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Home Team */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <div className="h-2 w-2 rounded-full bg-accent" />
                  Home Team
                </div>
                <Select onValueChange={(val) => setFormData({ ...formData, homeTeamId: val })}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select team..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Palette className="h-3 w-3" /> Jersey Color
                  </Label>
                  <div className="flex items-center gap-3">
                    <div 
                      className="h-10 w-10 rounded-lg border border-border shadow-inner"
                      style={{ backgroundColor: formData.homeColor }}
                    />
                    <input 
                      type="color" 
                      value={formData.homeColor}
                      onChange={(e) => setFormData({ ...formData, homeColor: e.target.value })}
                      className="h-10 w-full bg-background border border-border rounded-lg cursor-pointer px-1 py-1"
                    />
                  </div>
                </div>
              </div>

              {/* Away Team */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                  Away Team
                </div>
                <Select onValueChange={(val) => setFormData({ ...formData, awayTeamId: val })}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select team..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Palette className="h-3 w-3" /> Jersey Color
                  </Label>
                  <div className="flex items-center gap-3">
                    <div 
                      className="h-10 w-10 rounded-lg border border-border shadow-inner"
                      style={{ backgroundColor: formData.awayColor }}
                    />
                    <input 
                      type="color" 
                      value={formData.awayColor}
                      onChange={(e) => setFormData({ ...formData, awayColor: e.target.value })}
                      className="h-10 w-full bg-background border border-border rounded-lg cursor-pointer px-1 py-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Inference Optimization */}
            <div className="pt-6 border-t border-border space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Settings2 className="h-4 w-4 text-accent" />
                  Inference Optimization
                </div>
                <Badge variant="secondary" className="text-[9px] font-mono">YOLOv11m Optimized</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Img Size (px)</Label>
                    <span className="text-[10px] font-mono text-accent">{formData.imgsz}</span>
                  </div>
                  <Slider 
                    value={[formData.imgsz]} 
                    min={640} max={1280} step={320}
                    onValueChange={([val]) => setFormData({ ...formData, imgsz: val })}
                  />
                  <p className="text-[9px] text-muted-foreground italic">Use 1280px for small jersey numbers in wide pans.</p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Confidence</Label>
                    <span className="text-[10px] font-mono text-accent">{formData.conf}</span>
                  </div>
                  <Slider 
                    value={[formData.conf]} 
                    min={0.1} max={0.9} step={0.05}
                    onValueChange={([val]) => setFormData({ ...formData, conf: val })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] uppercase text-muted-foreground">ByteTrack</Label>
                    <p className="text-[9px] text-muted-foreground">ID persistence across pans</p>
                  </div>
                  <Switch 
                    checked={formData.tracking}
                    onCheckedChange={(val) => setFormData({ ...formData, tracking: val })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] uppercase text-muted-foreground">Shot Intelligence</Label>
                    <p className="text-[9px] text-muted-foreground">Rim & Ball trajectory logic</p>
                  </div>
                  <Switch 
                    checked={formData.rimDetection}
                    onCheckedChange={(val) => setFormData({ ...formData, rimDetection: val })}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 border-t border-border bg-muted/10 gap-2">
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>Cancel</Button>
            <Button 
              onClick={handleProcess} 
              disabled={isProcessing}
              className="bg-primary hover:bg-primary/90 text-white min-w-[140px]"
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </div>
              ) : "Start Analysis"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}