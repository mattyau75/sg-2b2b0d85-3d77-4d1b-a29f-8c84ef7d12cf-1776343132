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
import { Cpu, Settings2, Palette, Camera, Upload, Video, FileVideo, X, Loader2, CheckCircle2 } from "lucide-react";
import { rosterService } from "@/services/rosterService";
import { useUploads } from "@/contexts/UploadContext";
import { useRouter } from "next/router";
import { cn } from "@/lib/utils";

interface NewGameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewGameModal({ isOpen, onClose }: NewGameModalProps) {
  const router = useRouter();
  const { startUpload } = useUploads();
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingColors, setAnalyzingColors] = useState(false);
  const [detectedColors, setDetectedColors] = useState<string[]>([]);
  const [calibrationStep, setCalibrationStep] = useState<"upload" | "calibrate" | "settings">("upload");
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
      setFormData(prev => ({ ...prev, videoFile: file }));
      // Automatically trigger color analysis if teams are selected
      if (formData.homeTeamId && formData.awayTeamId) {
        startColorAnalysis(file);
      }
    }
  };

  const startColorAnalysis = async (file: File) => {
    setAnalyzingColors(true);
    setCalibrationStep("calibrate");
    // In a real flow, we'd upload a 10s chunk first, but here we'll simulate 
    // the GPU identifying the primary jersey colors from the stream.
    setTimeout(() => {
      setDetectedColors(["#FFFFFF", "#008000"]); // Simulated: White and Green
      setAnalyzingColors(false);
    }, 3000);
  };

  const handleProcess = async () => {
    if (!formData.videoFile) return;
    
    // Hand off to background manager
    startUpload(formData.videoFile, {
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
      camera_type: formData.cameraType
    });

    // Immediate UI feedback
    onClose();
    router.push('/analysis-queue');
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

  const toggleHomeColor = () => {
    if (!formData.homeTeamData) return;
    const { primary_color, secondary_color } = formData.homeTeamData;
    setFormData(prev => ({
      ...prev,
      homeColor: prev.homeColor === primary_color ? (secondary_color || primary_color) : primary_color
    }));
  };

  const toggleAwayColor = () => {
    if (!formData.awayTeamData) return;
    const { primary_color, secondary_color } = formData.awayTeamData;
    setFormData(prev => ({
      ...prev,
      awayColor: prev.awayColor === primary_color ? (secondary_color || primary_color) : primary_color
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
            Analyze high-performance basketball footage. Local video uploads ensure maximum precision.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-8 py-4 space-y-10 custom-scrollbar">
          {calibrationStep === "upload" ? (
            <>
              {/* Video Section */}
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <div className="flex items-center gap-2 text-sm font-bold tracking-tight uppercase">
                    <Video className="h-4 w-4 text-primary" />
                    Video Footage
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

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "group relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-12 transition-all cursor-pointer",
                    formData.videoFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/5"
                  )}
                >
                  <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleFileSelect} />
                  {formData.videoFile ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <FileVideo className="h-8 w-8 text-primary" />
                      </div>
                      <p className="text-lg font-semibold text-foreground">{formData.videoFile.name}</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                      <p className="text-lg font-bold text-foreground">Drag & drop game footage</p>
                    </>
                  )}
                </div>
              </div>

              {/* Teams Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-4">
                <div className="space-y-5">
                  <Label className="text-sm font-bold uppercase tracking-wider">Home Team</Label>
                  <Select onValueChange={handleHomeTeamChange}>
                    <SelectTrigger className="bg-background border-border h-12">
                      <SelectValue placeholder="Select team..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-5">
                  <Label className="text-sm font-bold uppercase tracking-wider">Away Team</Label>
                  <Select onValueChange={handleAwayTeamChange}>
                    <SelectTrigger className="bg-background border-border h-12">
                      <SelectValue placeholder="Select team..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-12 py-6">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold">Visual Calibration</h3>
                <p className="text-sm text-muted-foreground">We've identified the jersey colors in your video. Assign them to the correct teams.</p>
              </div>

              {analyzingColors ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  <p className="text-sm font-mono text-muted-foreground animate-pulse">SAMPLING VIDEO STREAM...</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4 p-6 rounded-2xl bg-muted/5 border border-border/50 text-center">
                    <Badge variant="outline" className="mb-2">HOME: {formData.homeTeamData?.name}</Badge>
                    <div className="flex justify-center gap-4">
                      {detectedColors.map(color => (
                        <button
                          key={color}
                          onClick={() => setFormData({...formData, homeColor: color})}
                          className={cn(
                            "h-16 w-16 rounded-full border-2 transition-all",
                            formData.homeColor === color ? "border-primary scale-110 shadow-lg shadow-primary/20" : "border-transparent opacity-40 hover:opacity-100"
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 p-6 rounded-2xl bg-muted/5 border border-border/50 text-center">
                    <Badge variant="outline" className="mb-2">AWAY: {formData.awayTeamData?.name}</Badge>
                    <div className="flex justify-center gap-4">
                      {detectedColors.map(color => (
                        <button
                          key={color}
                          onClick={() => setFormData({...formData, awayColor: color})}
                          className={cn(
                            "h-16 w-16 rounded-full border-2 transition-all",
                            formData.awayColor === color ? "border-accent scale-110 shadow-lg shadow-accent/20" : "border-transparent opacity-40 hover:opacity-100"
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-center">
                <Button variant="ghost" size="sm" onClick={() => setCalibrationStep("upload")} className="text-xs text-muted-foreground underline underline-offset-4">
                  Re-select teams or video
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-8 py-8 border-t border-border bg-muted/5">
          <Button variant="ghost" onClick={onClose} className="px-8">Cancel</Button>
          {calibrationStep === "upload" ? (
            <Button 
              onClick={() => {
                if (formData.videoFile && formData.homeTeamId && formData.awayTeamId) {
                  startColorAnalysis(formData.videoFile);
                }
              }} 
              disabled={!formData.videoFile || !formData.homeTeamId || !formData.awayTeamId}
              className="bg-primary hover:bg-primary/90 min-w-[200px] h-14 rounded-xl font-bold"
            >
              Calibrate Jersey Colors
            </Button>
          ) : (
            <Button 
              onClick={handleProcess} 
              disabled={analyzingColors}
              className="bg-primary hover:bg-primary/90 min-w-[200px] h-14 rounded-xl font-bold"
            >
              Deploy GPU Pipeline
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}