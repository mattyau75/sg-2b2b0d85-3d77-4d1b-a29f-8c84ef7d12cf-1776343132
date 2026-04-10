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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video, FileVideo, Upload, Loader2, Cpu } from "lucide-react";
import { rosterService } from "@/services/rosterService";
import { useUploads } from "@/contexts/UploadContext";
import { useRouter } from "next/router";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { storageService } from "@/services/storageService";
import { Progress } from "@/components/ui/progress";

interface NewGameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewGameModal({ isOpen, onClose }: NewGameModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { startUpload, activeUploads, cancelUpload } = useUploads();
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    videoFile: null as File | null,
    homeTeamId: "",
    awayTeamId: "",
    cameraType: "panning" as "panning" | "fixed"
  });

  // Find if there's an active upload for the selected file
  const currentUpload = activeUploads.find(u => u.fileName === formData.videoFile?.name);
  const isUploading = !!currentUpload && currentUpload.status === "uploading";
  const uploadProgress = currentUpload?.progress || 0;

  const handleCancel = () => {
    if (isUploading && currentUpload) {
      cancelUpload(currentUpload.id);
    }
    onClose();
  };

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
    }
  };

  const handleProcess = async () => {
    if (!formData.videoFile) return;
    setIsStarting(true);
    
    try {
      // Use the centralized UploadContext for multipart progress-tracked upload
      await startUpload(formData.videoFile, {
        homeTeamId: formData.homeTeamId || null,
        awayTeamId: formData.awayTeamId || null,
        cameraType: formData.cameraType
      });

      // The context handles redirect or toast upon completion/start
      // But for this modal, we can close it once the upload is 'handed off'
      onClose();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Initialization Failed",
        description: error.message
      });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-8 pt-8 pb-4">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <Upload className="h-6 w-6 text-primary" />
            Add New Game Footage
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Upload your game video to begin the modular scouting pipeline.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-8 py-4 space-y-8 custom-scrollbar">
          {/* Video Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-2 text-sm font-bold tracking-tight uppercase">
                <Video className="h-4 w-4 text-primary" />
                Footage Selection
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
              onClick={() => !isStarting && !isUploading && fileInputRef.current?.click()}
              className={cn(
                "group relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-12 transition-all cursor-pointer",
                formData.videoFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/5",
                (isStarting || isUploading) && "opacity-80 cursor-not-allowed"
              )}
            >
              <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleFileSelect} />
              
              {isUploading ? (
                <div className="flex flex-col items-center gap-6 w-full max-w-sm">
                  <div className="relative h-16 w-16">
                    <Loader2 className="h-16 w-16 text-primary animate-spin absolute inset-0 opacity-20" />
                    <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold text-primary">
                      {Math.round(uploadProgress)}%
                    </div>
                  </div>
                  <div className="w-full space-y-2">
                    <Progress value={uploadProgress} className="h-2 bg-primary/10" />
                    <p className="text-center text-sm font-medium text-muted-foreground italic animate-pulse">
                      Streaming footage to elite cloud storage...
                    </p>
                  </div>
                </div>
              ) : isStarting ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  <p className="text-lg font-semibold text-foreground italic">Initializing AI discovery swarm...</p>
                </div>
              ) : formData.videoFile ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileVideo className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-lg font-semibold text-foreground text-center line-clamp-1">{formData.videoFile.name}</p>
                  <p className="text-xs text-muted-foreground">Click to change file</p>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                  <p className="text-lg font-bold text-foreground">Drag & drop game footage</p>
                  <p className="text-sm text-muted-foreground">Support MP4, MOV, AVI</p>
                </>
              )}
            </div>
          </div>

          {/* Preliminary Team Info (Optional at this step) */}
          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-border/30">
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Home Team (Optional)</Label>
              <Select value={formData.homeTeamId} onValueChange={(val) => setFormData(prev => ({ ...prev, homeTeamId: val }))}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select team..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Away Team (Optional)</Label>
              <Select value={formData.awayTeamId} onValueChange={(val) => setFormData(prev => ({ ...prev, awayTeamId: val }))}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select team..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="px-8 py-8 border-t border-border bg-muted/5">
          <Button 
            variant="ghost" 
            onClick={handleCancel} 
            disabled={isStarting}
          >
            {isUploading ? "Cancel Upload" : "Cancel"}
          </Button>
          <Button 
            onClick={handleProcess} 
            disabled={!formData.videoFile || isStarting || isUploading}
            className="bg-primary hover:bg-primary/90 min-w-[200px] h-12 rounded-xl font-bold shadow-lg shadow-primary/20"
          >
            {isStarting || isUploading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {isUploading ? 'Uploading...' : 'Starting...'}</>
            ) : (
              <><Cpu className="h-4 w-4 mr-2" /> Start Modular Analysis</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}