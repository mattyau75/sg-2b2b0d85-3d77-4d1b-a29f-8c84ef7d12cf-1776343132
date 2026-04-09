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

interface NewGameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewGameModal({ isOpen, onClose }: NewGameModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { startUpload } = useUploads();
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    videoFile: null as File | null,
    homeTeamId: "",
    awayTeamId: "",
    cameraType: "panning" as "panning" | "fixed"
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
    }
  };

  const handleProcess = async () => {
    if (!formData.videoFile) return;
    setUploading(true);
    
    try {
      // 1. Upload to Storage
      const fileName = `${Date.now()}-${formData.videoFile.name}`;
      const uploadPath = `games/${fileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(uploadPath, formData.videoFile);

      if (uploadError) throw uploadError;

      // 2. Create the game record in pending status
      const { data: newGame, error: gameError } = await supabase
        .from('games')
        .insert({
          video_path: uploadPath,
          status: 'pending',
          date: new Date().toISOString(),
          home_team_id: formData.homeTeamId || null,
          away_team_id: formData.awayTeamId || null,
          camera_type: formData.cameraType
        })
        .select()
        .single();

      if (gameError) throw gameError;

      toast({ 
        title: "Footage Registered", 
        description: "Opening Module 1: Identity & Mapping." 
      });

      // Redirect to the Game Detail page for modular execution
      router.push(`/games/${newGame.id}`);
      onClose();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message
      });
    } finally {
      setUploading(false);
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
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={cn(
                "group relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-12 transition-all cursor-pointer",
                formData.videoFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/5",
                uploading && "opacity-50 cursor-not-allowed"
              )}
            >
              <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleFileSelect} />
              {uploading ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  <p className="text-lg font-semibold text-foreground">Uploading footage...</p>
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
          <Button variant="ghost" onClick={onClose} disabled={uploading}>Cancel</Button>
          <Button 
            onClick={handleProcess} 
            disabled={!formData.videoFile || uploading}
            className="bg-primary hover:bg-primary/90 min-w-[200px] h-12 rounded-xl font-bold shadow-lg shadow-primary/20"
          >
            {uploading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registering...</>
            ) : (
              <><Cpu className="h-4 w-4 mr-2" /> Start Modular Analysis</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}