import React, { useState, useEffect, useRef } from "react";
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
import { Cpu, Settings2, Palette, Camera, Upload, Video, FileVideo, X } from "lucide-react";
import { rosterService } from "@/services/rosterService";
import { modalService } from "@/services/modalService";
import { storageService } from "@/services/storageService";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRouter } from "next/router";
import { cn } from "@/lib/utils";

interface NewGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJobStarted: (jobId: string) => void;
}

export function NewGameModal({ isOpen, onClose, onJobStarted }: NewGameModalProps) {
  const router = useRouter();
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    videoFile: null as File | null,
    homeTeamId: "",
    awayTeamId: "",
    cameraType: "panning" as "panning" | "fixed",
    homeColor: "#ff6b00",
    awayColor: "#0066ff",
    homeTeamData: null as any,
    awayTeamData: null as any,
    imgsz: 1280,
    conf: 0.25,
    iou: 0.45,
    tracking: true,
    agnosticNms: false,
    rimDetection: true,
    shotLogic: true
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 8GB Limit (8 * 1024 * 1024 * 1024)
      if (file.size > 8589934592) { 
        toast({ title: "File too large", description: "Please upload a video under 8GB.", variant: "destructive" });
        return;
      }
      setFormData(prev => ({ ...prev, videoFile: file }));
    }
  };

  const handleProcess = async () => {
    if (!formData.videoFile) {
      toast({ title: "Missing File", description: "Please upload a video file.", variant: "destructive" });
      return;
    }
    if (!formData.homeTeamId || !formData.awayTeamId) {
      toast({ title: "Teams Required", description: "Select both Home and Away teams.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    setUploadProgress(10); // Start progress

    try {
      // 1. Create the game record in Supabase
      const { data: newGame, error: dbError } = await supabase
        .from('games')
        .insert({
          home_team_id: formData.homeTeamId,
          away_team_id: formData.awayTeamId,
          camera_type: formData.cameraType,
          status: 'scheduled'
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setUploadProgress(25);
      
      let videoPath = "";
      if (formData.videoFile) {
        // High-performance R2 upload with progress tracking
        videoPath = await storageService.uploadVideo(
          formData.videoFile, 
          (progress) => setUploadProgress(progress)
        );
        
        // Update game with R2 storage key
        await supabase
          .from('games')
          .update({ video_path: videoPath })
          .eq('id', newGame.id);
      }

      // 2. Trigger the GPU pipeline via Modal.com
      const result = await modalService.processGame(
        videoPath, 
        {
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
          camera_type: formData.cameraType,
          gameId: newGame.id
        }
      );
      
      toast({ title: "Analysis Started", description: `GPU Pipeline initiated for Game ID: ${newGame.id.substring(0, 8)}` });
      onJobStarted(result.job_id || "started");
      onClose();
      router.push('/analysis-queue');
    } catch (error: any) {
      toast({ title: "Processing Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  const handleHomeTeamChange = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    setFormData(prev => ({ 
      ...prev, 
      homeTeamId: teamId,
      homeColor: team?.primary_color || "#ff6b00",
      homeTeamData: team
    }));
  };

  const handleAwayTeamChange = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    setFormData(prev => ({ 
      ...prev, 
      awayTeamId: teamId,
      awayColor: team?.primary_color || "#0066ff",
      awayTeamData: team
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[95vh] bg-card border-border p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-8 pt-8 pb-4">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <Cpu className="h-6 w-6 text-primary" />
            Process New Game
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Analyze high-performance basketball footage for scouting and advanced metrics. Local video uploads ensure maximum precision.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-8 py-4 space-y-10 custom-scrollbar">
          {/* Step 1: Video Source */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-2 text-sm font-bold tracking-tight uppercase">
                <Video className="h-4 w-4 text-primary" />
                Video Footage
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  <Camera className="h-3 w-3" /> Camera Calibration
                </div>
                <Select 
                  value={formData.cameraType} 
                  onValueChange={(val: "panning" | "fixed") => setFormData({...formData, cameraType: val})}
                >
                  <SelectTrigger className="w-[140px] bg-background border-border h-8 text-[11px] font-mono">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="panning" className="text-xs">PANNING</SelectItem>
                    <SelectItem value="fixed" className="text-xs">FIXED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "group relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-12 transition-all cursor-pointer",
                formData.videoFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/5"
              )}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="video/*" 
                onChange={handleFileSelect}
              />
              
              {formData.videoFile ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center animate-in fade-in zoom-in duration-300">
                    <FileVideo className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-foreground">{formData.videoFile.name}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {(formData.videoFile.size / (1024 * 1024)).toFixed(1)} MB • LOCAL STORAGE
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-xs hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData(prev => ({ ...prev, videoFile: null }));
                    }}
                  >
                    <X className="h-3.5 w-3.5 mr-2" /> Replace Video
                  </Button>
                </div>
              ) : (
                <>
                  <div className="h-20 w-20 rounded-full bg-muted/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Upload className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">Drag & drop game footage</p>
                  <p className="text-xs text-muted-foreground mt-2 font-medium">MP4, MOV, or AVI up to 8GB supported</p>
                </>
              )}

              {isProcessing && uploadProgress > 0 && uploadProgress < 100 && (
                <div className="absolute inset-x-8 bottom-8 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300 ease-out shadow-[0_0_10px_rgba(var(--primary),0.5)]" 
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2">
                    <p className="text-[10px] text-primary font-bold tracking-widest uppercase">Uploading to Storage</p>
                    <p className="text-[10px] text-primary font-mono font-bold">{uploadProgress}%</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Teams & Colors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-4">
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                <div className="h-2 w-2 rounded-full bg-primary" />
                Home Team Selection
              </div>
              <Select onValueChange={handleHomeTeamChange}>
                <SelectTrigger className="bg-background border-border h-12 text-sm">
                  <SelectValue placeholder="Select primary team..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-sm">{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="space-y-4">
                <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 font-bold">
                  <Palette className="h-3 w-3" /> Jersey Attribution
                </Label>
                <div className="flex items-center gap-3">
                  {formData.homeTeamData ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "flex-1 h-16 gap-3 border-2 transition-all flex-col items-center justify-center rounded-xl",
                          formData.homeColor === formData.homeTeamData.primary_color 
                            ? "border-primary bg-primary/10 shadow-[0_0_20px_rgba(var(--primary),0.15)]" 
                            : "border-border opacity-50 grayscale hover:grayscale-0"
                        )}
                        onClick={() => setFormData({ ...formData, homeColor: formData.homeTeamData.primary_color })}
                      >
                        <div className="h-5 w-5 rounded-full border-2 border-white/20 shadow-sm" style={{ backgroundColor: formData.homeTeamData.primary_color }} />
                        <span className="text-[9px] uppercase font-black tracking-tighter">Primary Kit</span>
                      </Button>
                      {formData.homeTeamData.secondary_color && (
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "flex-1 h-16 gap-3 border-2 transition-all flex-col items-center justify-center rounded-xl",
                            formData.homeColor === formData.homeTeamData.secondary_color 
                              ? "border-primary bg-primary/10 shadow-[0_0_20px_rgba(var(--primary),0.15)]" 
                              : "border-border opacity-50 grayscale hover:grayscale-0"
                        )}
                        onClick={() => setFormData({ ...formData, homeColor: formData.homeTeamData.secondary_color })}
                      >
                        <div className="h-5 w-5 rounded-full border-2 border-white/20 shadow-sm" style={{ backgroundColor: formData.homeTeamData.secondary_color }} />
                        <span className="text-[9px] uppercase font-black tracking-tighter">Away Kit</span>
                      </Button>
                      )}
                    </>
                  ) : (
                    <div className="h-16 w-full rounded-xl border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground uppercase font-bold tracking-widest bg-muted/5">
                      Pending home selection
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                <div className="h-2 w-2 rounded-full bg-accent" />
                Opponent Selection
              </div>
              <Select onValueChange={handleAwayTeamChange}>
                <SelectTrigger className="bg-background border-border h-12 text-sm">
                  <SelectValue placeholder="Select visiting team..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-sm">{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="space-y-4">
                <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 font-bold">
                  <Palette className="h-3 w-3" /> Jersey Attribution
                </Label>
                <div className="flex items-center gap-3">
                  {formData.awayTeamData ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "flex-1 h-16 gap-3 border-2 transition-all flex-col items-center justify-center rounded-xl",
                          formData.awayColor === formData.awayTeamData.primary_color 
                            ? "border-accent bg-accent/10 shadow-[0_0_20px_rgba(var(--accent),0.15)]" 
                            : "border-border opacity-50 grayscale hover:grayscale-0"
                        )}
                        onClick={() => setFormData({ ...formData, awayColor: formData.awayTeamData.primary_color })}
                      >
                        <div className="h-5 w-5 rounded-full border-2 border-white/20 shadow-sm" style={{ backgroundColor: formData.awayTeamData.primary_color }} />
                        <span className="text-[9px] uppercase font-black tracking-tighter">Primary Kit</span>
                      </Button>
                      {formData.awayTeamData.secondary_color && (
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "flex-1 h-16 gap-3 border-2 transition-all flex-col items-center justify-center rounded-xl",
                            formData.awayColor === formData.awayTeamData.secondary_color 
                              ? "border-accent bg-accent/10 shadow-[0_0_20px_rgba(var(--accent),0.15)]" 
                              : "border-border opacity-50 grayscale hover:grayscale-0"
                          )}
                          onClick={() => setFormData({ ...formData, awayColor: formData.awayTeamData.secondary_color })}
                        >
                          <div className="h-5 w-5 rounded-full border-2 border-white/20 shadow-sm" style={{ backgroundColor: formData.awayTeamData.secondary_color }} />
                          <span className="text-[9px] uppercase font-black tracking-tighter">Away Kit</span>
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className="h-16 w-full rounded-xl border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground uppercase font-bold tracking-widest bg-muted/5">
                      Pending opponent selection
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Inference Settings */}
          <div className="pt-10 border-t border-border space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-tight">
                <Settings2 className="h-4 w-4 text-primary" />
                High-Performance Optimization
              </div>
              <Badge variant="secondary" className="text-[10px] font-mono bg-primary/10 text-primary border-primary/20 font-black px-3 py-1">YOLOv11-PRO ARCHITECTURE</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Input Resolution</Label>
                  <span className="text-[10px] font-mono font-black text-primary bg-primary/10 px-2 py-0.5 rounded">{formData.imgsz} PX</span>
                </div>
                <Slider 
                  value={[formData.imgsz]} 
                  min={640} max={1280} step={320}
                  onValueChange={([val]) => setFormData({ ...formData, imgsz: val })}
                  className="py-4"
                />
                <p className="text-[9px] text-muted-foreground leading-relaxed italic">Higher resolution increases detection accuracy for distant players but requires more GPU memory.</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Detection Threshold</Label>
                  <span className="text-[10px] font-mono font-black text-primary bg-primary/10 px-2 py-0.5 rounded">{formData.conf}</span>
                </div>
                <Slider 
                  value={[formData.conf]} 
                  min={0.1} max={0.9} step={0.05}
                  onValueChange={([val]) => setFormData({ ...formData, conf: val })}
                  className="py-4"
                />
                <p className="text-[9px] text-muted-foreground leading-relaxed italic">Lower confidence increases recall (detecting more objects) but may introduce false positives.</p>
              </div>

              <div className="flex items-center justify-between p-5 rounded-2xl bg-muted/5 border border-border/50 hover:border-primary/30 transition-colors group">
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase font-bold text-foreground group-hover:text-primary transition-colors">ByteTrack Engine</Label>
                  <p className="text-[10px] text-muted-foreground leading-tight">Persistent player ID tracking across fast motion and occlusions.</p>
                </div>
                <Switch 
                  checked={formData.tracking}
                  onCheckedChange={(val) => setFormData({ ...formData, tracking: val })}
                />
              </div>

              <div className="flex items-center justify-between p-5 rounded-2xl bg-muted/5 border border-border/50 hover:border-primary/30 transition-colors group">
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase font-bold text-foreground group-hover:text-primary transition-colors">Ball & Rim Intelligence</Label>
                  <p className="text-[10px] text-muted-foreground leading-tight">Physics-based arc detection and rim proximity shot validation.</p>
                </div>
                <Switch 
                  checked={formData.rimDetection}
                  onCheckedChange={(val) => setFormData({ ...formData, rimDetection: val })}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-8 py-8 border-t border-border bg-muted/5 gap-4">
          <Button 
            variant="ghost" 
            onClick={onClose} 
            disabled={isProcessing}
            className="text-muted-foreground hover:text-foreground hover:bg-muted/10 px-8"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleProcess} 
            disabled={isProcessing}
            className="bg-primary hover:bg-primary/90 text-white min-w-[220px] h-14 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {isProcessing ? (
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="uppercase tracking-widest">{uploadProgress > 0 && uploadProgress < 100 ? `Uploading (${uploadProgress}%)` : "Initializing GPU Swarm"}</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Cpu className="h-5 w-5" />
                <span className="uppercase tracking-widest">Deploy GPU Pipeline</span>
              </div>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}