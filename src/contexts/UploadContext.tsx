import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { storageService } from "@/services/storageService";
import { modalService } from "@/services/modalService";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UploadTask {
  id: string;
  fileName: string;
  progress: number;
  status: "uploading" | "processing" | "completed" | "failed" | "cancelled";
  error?: string;
  gameId?: string;
}

interface UploadContextType {
  activeUploads: UploadTask[];
  startUpload: (file: File, config: any) => Promise<void>;
  cancelUpload: (uploadId: string) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [activeUploads, setActiveUploads] = useState<UploadTask[]>([]);
  const abortControllers = useRef<Record<string, AbortController>>({});
  const { toast } = useToast();

  const cancelUpload = useCallback(async (uploadId: string) => {
    const task = activeUploads.find(t => t.id === uploadId);
    
    // 1. Abort network request
    if (abortControllers.current[uploadId]) {
      abortControllers.current[uploadId].abort();
      delete abortControllers.current[uploadId];
    }

    // 2. Clean up database record if it exists
    if (task?.gameId) {
      await supabase.from('games').delete().eq('id', task.gameId);
    }

    // 3. Update UI state
    setActiveUploads(prev => prev.filter(t => t.id !== uploadId));
    
    toast({ 
      title: "Upload Cancelled", 
      description: `Analysis for ${task?.fileName || 'the video'} was terminated.` 
    });
  }, [activeUploads, toast]);

  const startUpload = useCallback(async (file: File, config: any) => {
    const uploadId = Math.random().toString(36).substring(7);
    const controller = new AbortController();
    abortControllers.current[uploadId] = controller;
    
    const newTask: UploadTask = {
      id: uploadId,
      fileName: file.name,
      progress: 0,
      status: "uploading"
    };

    setActiveUploads(prev => [...prev, newTask]);

    try {
      // 1. Create game record
      const { data: newGame, error: dbError } = await supabase
        .from('games')
        .insert({
          home_team_id: config.home_team_id,
          away_team_id: config.away_team_id,
          camera_type: config.camera_type,
          status: 'scheduled'
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Update task with gameId for potential deletion
      setActiveUploads(prev => prev.map(t => 
        t.id === uploadId ? { ...t, gameId: newGame.id } : t
      ));

      // 2. Upload with progress and abort signal
      const videoPath = await storageService.uploadVideo(file, (progress) => {
        setActiveUploads(prev => prev.map(t => 
          t.id === uploadId ? { ...t, progress } : t
        ));
      }, controller.signal);

      // 3. Update game record
      await supabase
        .from('games')
        .update({ video_path: videoPath, status: 'queued' })
        .eq('id', newGame.id);

      // 4. Start GPU Processing
      setActiveUploads(prev => prev.map(t => 
        t.id === uploadId ? { ...t, status: "processing", progress: 100 } : t
      ));

      await modalService.processGame(videoPath, {
        ...config,
        gameId: newGame.id
      });

      toast({ 
        title: "Upload Complete", 
        description: `${file.name} is now being analyzed by the GPU swarm.` 
      });

      setActiveUploads(prev => prev.filter(t => t.id !== uploadId));
      delete abortControllers.current[uploadId];

    } catch (error: any) {
      if (error.message === "CANCELLED") return;

      console.error("Background Upload Failed:", error);
      setActiveUploads(prev => prev.map(t => 
        t.id === uploadId ? { ...t, status: "failed", error: error.message } : t
      ));
      toast({ 
        title: "Upload Failed", 
        description: error.message, 
        variant: "destructive" 
      });
      delete abortControllers.current[uploadId];
    }
  }, [toast]);

  return (
    <UploadContext.Provider value={{ activeUploads, startUpload, cancelUpload }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUploads() {
  const context = useContext(UploadContext);
  if (!context) throw new Error("useUploads must be used within UploadProvider");
  return context;
}