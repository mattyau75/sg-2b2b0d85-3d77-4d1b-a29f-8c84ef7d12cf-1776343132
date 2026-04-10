import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Video, FileVideo, Upload, Loader2, X } from "lucide-react";
import { useUploads } from "@/contexts/UploadContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

interface NewGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (gameId: string) => void;
}

export function NewGameModal({ isOpen, onClose, onUploadSuccess }: NewGameModalProps) {
  const { toast } = useToast();
  const { startUpload, activeUploads, cancelUpload } = useUploads();
  const [isStarting, setIsStarting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const currentUpload = activeUploads.find(u => u.fileName === selectedFile?.name);
  const isUploading = !!currentUpload && currentUpload.status === "uploading";
  const uploadProgress = currentUpload?.progress || 0;

  const handleCancel = () => {
    if (isUploading && currentUpload) {
      cancelUpload(currentUpload.id);
    }
    setSelectedFile(null);
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleStartUpload = async () => {
    if (!selectedFile) return;
    setIsStarting(true);
    
    try {
      const result = await startUpload(selectedFile, {
        cameraType: "panning"
      });
      
      const gameId = result as unknown as string;
      
      if (gameId) {
        toast({ title: "Upload Complete", description: "Footage stored. Proceeding to Calibration." });
        onUploadSuccess(gameId);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message
      });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-xl bg-card border-border p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="px-8 pt-8 pb-4">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <Video className="h-6 w-6 text-primary" />
            Step 1: Rapid Video Ingestion
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Drop your game footage here to begin the elite discovery pipeline.
          </DialogDescription>
        </DialogHeader>

        <div className="px-8 py-6">
          <div 
            onClick={() => !isStarting && !isUploading && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files?.[0];
              if (file && !isStarting && !isUploading) setSelectedFile(file);
            }}
            className={cn(
              "group relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-16 transition-all duration-300 cursor-pointer",
              selectedFile ? "border-primary bg-primary/5 shadow-inner" : "border-border hover:border-primary/50 hover:bg-muted/5",
              (isStarting || isUploading) && "opacity-80 cursor-not-allowed pointer-events-none"
            )}
          >
            <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleFileSelect} />
            
            {isUploading ? (
              <div className="flex flex-col items-center gap-8 w-full max-w-sm">
                <div className="relative h-20 w-20">
                  <Loader2 className="h-20 w-20 text-primary animate-spin absolute inset-0 opacity-20" />
                  <div className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold text-primary">
                    {Math.round(uploadProgress)}%
                  </div>
                </div>
                <div className="w-full space-y-3">
                  <Progress value={uploadProgress} className="h-2.5 bg-primary/10" />
                  <p className="text-center text-sm font-medium text-muted-foreground italic animate-pulse">
                    Streaming footage to DribbleStats Cloud...
                  </p>
                </div>
              </div>
            ) : selectedFile ? (
              <div className="flex flex-col items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                  <FileVideo className="h-10 w-10 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground line-clamp-1 max-w-[300px]">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1 uppercase tracking-tighter">Click or drag to replace file</p>
                </div>
              </div>
            ) : (
              <>
                <div className="h-20 w-20 rounded-full bg-muted/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="text-xl font-bold text-foreground">Drag & Drop Game Footage</p>
                <p className="text-sm text-muted-foreground mt-2">Elite precision starts with high-quality MP4 or MOV</p>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="px-8 py-8 border-t border-border bg-muted/5">
          <Button 
            variant="ghost" 
            onClick={handleCancel} 
            className="text-muted-foreground hover:text-foreground font-bold"
          >
            {isUploading ? "CANCEL UPLOAD" : "CANCEL"}
          </Button>
          <Button 
            onClick={handleStartUpload} 
            disabled={!selectedFile || isStarting || isUploading}
            className="bg-primary hover:bg-primary/90 min-w-[200px] h-14 rounded-xl font-black text-xs tracking-widest uppercase shadow-xl shadow-primary/20"
          >
            {isStarting || isUploading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {isUploading ? 'INGESTING...' : 'INITIATING...'}</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" /> UPLOAD FOOTAGE</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}