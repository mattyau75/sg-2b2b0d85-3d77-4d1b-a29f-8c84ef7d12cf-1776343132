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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Youtube, Cpu, Settings2, Palette, Camera, Upload, Video, FileVideo, X } from "lucide-react";
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
    sourceType: "upload" as "upload" | "youtube",
    youtubeUrl: "",
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
      setFormData(prev => ({ ...prev, videoFile: file, sourceType: "upload" }));
    }
  };

  const handleProcess = async () => {
    if (formData.sourceType === "youtube" && !formData.youtubeUrl) {
      toast({ title: "Missing URL", description: "Please provide a YouTube link.", variant: "destructive" });
      return;
    }
    if (formData.sourceType === "upload" && !formData.videoFile) {
      toast({ title: "Missing File", description: "Please upload a video file.", variant: "destructive" });
      return;
    }
    if (!formData.homeTeamId || !formData.awayTeamId) {
      toast({ title: "Teams Required", description: "Select both Home and Away teams.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Create the game record in Supabase
      const { data: newGame, error: dbError } = await supabase
        .from('games')
        .insert({
          youtube_url: formData.sourceType === "youtube" ? formData.youtubeUrl : null,
          home_team_id: formData.homeTeamId,
          away_team_id: formData.awayTeamId,
          camera_type: formData.cameraType,
          status: 'scheduled'
        })
        .select()
        .single();

      if (dbError) throw dbError;

      let videoPath = "";
      if (formData.sourceType === "upload" && formData.videoFile) {
        videoPath = await storageService.uploadVideoResumable(
          formData.videoFile, 
          newGame.id,
          (uploaded, total) => {
            const progress = Math.round((uploaded / total) * 100);
            setUploadProgress(progress);
          }
        );
        
        // Update game with storage path
        await supabase
          .from('games')
          .update({ video_path: videoPath })
          .eq('id', newGame.id);
      }

      // 2. Trigger the GPU pipeline via Modal.com
      const result = await modalService.processGame(
        formData.sourceType === "youtube" ? formData.youtubeUrl : videoPath, 
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
      <DialogContent className="max-w-2xl bg-card border-border p-0 overflow-hidden">
        <div className="flex flex-col h-[85vh] md:h-auto">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Process New Game</DialogTitle>
            <DialogDescription>
              Analyze high-performance basketball footage for scouting and advanced metrics.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Step 1: Video Source */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Video className="h-4 w-4 text-accent" />
                  Video Source
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground">
                    <Camera className="h-3 w-3" /> Camera
                  </div>
                  <Select 
                    value={formData.cameraType} 
                    onValueChange={(val: "panning" | "fixed") => setFormData({...formData, cameraType: val})}
                  >
                    <SelectTrigger className="w-[120px] bg-background border-border h-8 text-[11px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="panning">Panning</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Tabs 
                value={formData.sourceType} 
                onValueChange={(val: any) => setFormData(prev => ({ ...prev, sourceType: val }))}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 bg-muted/20 border border-border/50">
                  <TabsTrigger value="upload" className="gap-2 text-xs">
                    <Upload className="h-3.5 w-3.5" /> Local Upload
                  </TabsTrigger>
                  <TabsTrigger value="youtube" className="gap-2 text-xs">
                    <Youtube className="h-3.5 w-3.5 text-red-500" /> YouTube
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="upload" className="pt-4 mt-0">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "group relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer",
                      formData.videoFile ? "border-accent bg-accent/5" : "border-border hover:border-accent/50 hover:bg-muted/5"
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
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                          <FileVideo className="h-6 w-6 text-accent" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-foreground">{formData.videoFile.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {(formData.videoFile.size / (1024 * 1024)).toFixed(1)} MB • Click to change
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[10px] hover:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormData(prev => ({ ...prev, videoFile: null }));
                          }}
                        >
                          <X className="h-3 w-3 mr-1" /> Remove
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground mb-3 group-hover:text-accent group-hover:scale-110 transition-transform" />
                        <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground">Click to upload game footage</p>
                        <p className="text-[10px] text-muted-foreground mt-1">MP4, MOV, or AVI up to 500MB</p>
                      </>
                    )}

                    {isProcessing && uploadProgress > 0 && uploadProgress < 100 && (
                      <div className="absolute inset-x-4 bottom-4">
                        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-accent transition-all duration-300" 
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <p className="text-[9px] text-center mt-1 text-accent font-bold">Uploading to Storage... {uploadProgress}%</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="youtube" className="pt-4 mt-0">
                  <div className="space-y-4">
                    <Input 
                      placeholder="Paste YouTube game URL..." 
                      className="bg-background border-border font-mono text-sm h-12"
                      value={formData.youtubeUrl}
                      onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                    />
                    <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-[11px] text-yellow-200/80 leading-relaxed">
                      <span className="font-bold flex items-center gap-1.5 mb-1">
                        <Settings2 className="h-3 w-3" /> Connection Note
                      </span>
                      YouTube processing requires valid authentication cookies in the GPU worker. Direct uploads are recommended for higher reliability.
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Step 2: Teams & Colors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  Home Team
                </div>
                <Select onValueChange={handleHomeTeamChange}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select team..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="space-y-3">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Palette className="h-3 w-3" /> Jersey Color
                  </Label>
                  <div className="flex items-center gap-2">
                    {formData.homeTeamData ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "flex-1 h-12 gap-2 border-2 transition-all",
                            formData.homeColor === formData.homeTeamData.primary_color 
                              ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.2)]" 
                              : "border-border opacity-50 grayscale hover:grayscale-0"
                          )}
                          onClick={() => setFormData({ ...formData, homeColor: formData.homeTeamData.primary_color })}
                        >
                          <div className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: formData.homeTeamData.primary_color }} />
                          <span className="text-[10px] uppercase font-bold">Primary</span>
                        </Button>
                        {formData.homeTeamData.secondary_color && (
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "flex-1 h-12 gap-2 border-2 transition-all",
                              formData.homeColor === formData.homeTeamData.secondary_color 
                                ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.2)]" 
                                : "border-border opacity-50 grayscale hover:grayscale-0"
                          )}
                          onClick={() => setFormData({ ...formData, homeColor: formData.homeTeamData.secondary_color })}
                        >
                          <div className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: formData.homeTeamData.secondary_color }} />
                          <span className="text-[10px] uppercase font-bold">Secondary</span>
                        </Button>
                        )}
                      </>
                    ) : (
                      <div className="h-12 w-full rounded-lg border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground italic">
                        Select home team first
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <div className="h-2 w-2 rounded-full bg-accent" />
                  Away Team
                </div>
                <Select onValueChange={handleAwayTeamChange}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select team..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="space-y-3">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Palette className="h-3 w-3" /> Jersey Color
                  </Label>
                  <div className="flex items-center gap-2">
                    {formData.awayTeamData ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "flex-1 h-12 gap-2 border-2 transition-all",
                            formData.awayColor === formData.awayTeamData.primary_color 
                              ? "border-accent bg-accent/10 shadow-[0_0_15px_rgba(var(--accent),0.2)]" 
                              : "border-border opacity-50 grayscale hover:grayscale-0"
                          )}
                          onClick={() => setFormData({ ...formData, awayColor: formData.awayTeamData.primary_color })}
                        >
                          <div className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: formData.awayTeamData.primary_color }} />
                          <span className="text-[10px] uppercase font-bold">Primary</span>
                        </Button>
                        {formData.awayTeamData.secondary_color && (
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "flex-1 h-12 gap-2 border-2 transition-all",
                              formData.awayColor === formData.awayTeamData.secondary_color 
                                ? "border-accent bg-accent/10 shadow-[0_0_15px_rgba(var(--accent),0.2)]" 
                                : "border-border opacity-50 grayscale hover:grayscale-0"
                            )}
                            onClick={() => setFormData({ ...formData, awayColor: formData.awayTeamData.secondary_color })}
                          >
                            <div className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: formData.awayTeamData.secondary_color }} />
                            <span className="text-[10px] uppercase font-bold">Secondary</span>
                          </Button>
                        )}
                      </>
                    ) : (
                      <div className="h-12 w-full rounded-lg border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground italic">
                        Select away team first
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Inference Settings */}
            <div className="pt-6 border-t border-border space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Settings2 className="h-4 w-4 text-accent" />
                  Inference Optimization
                </div>
                <Badge variant="secondary" className="text-[9px] font-mono bg-accent/10 text-accent border-accent/20">YOLOv11m Optimized</Badge>
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

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/5 border border-border/50">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] uppercase text-muted-foreground">ByteTrack</Label>
                    <p className="text-[9px] text-muted-foreground">ID persistence across frames</p>
                  </div>
                  <Switch 
                    checked={formData.tracking}
                    onCheckedChange={(val) => setFormData({ ...formData, tracking: val })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/5 border border-border/50">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] uppercase text-muted-foreground">Shot Intel</Label>
                    <p className="text-[9px] text-muted-foreground">Rim proximity & Ball arc logic</p>
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
              className="bg-primary hover:bg-primary/90 text-white min-w-[160px] h-11"
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {uploadProgress > 0 && uploadProgress < 100 ? "Uploading..." : "Initializing GPU..."}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  Start Analysis
                </div>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}