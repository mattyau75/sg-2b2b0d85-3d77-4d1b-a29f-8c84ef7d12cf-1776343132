import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { storageService } from "@/services/storageService";
import { modalService } from "@/services/modalService";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

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

  const startUpload = useCallback(async (file: File, formData: any) => {
    const uploadId = Math.random().toString(36).substring(7);
    const controller = new AbortController();
    abortControllers.current[uploadId] = controller;
    
    const newUpload: UploadTask = {
      id: uploadId,
      fileName: file.name,
      progress: 0,
      status: "uploading"
    };

    setActiveUploads(prev => [...prev, newUpload]);

    try {
      // 1. Create game record
      const { data: gameData, error: dbError } = await supabase
        .from('games')
        .insert({
          home_team_id: formData.homeTeamId,
          away_team_id: formData.awayTeamId,
          status: 'scheduled'
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setActiveUploads(prev => prev.map(u => 
        u.id === uploadId ? { ...u, gameId: gameData.id } : u
      ));

      console.log(`[UploadContext] Starting multipart upload for: ${file.name}`);
      
      // 2. Upload video with progress tracking
      const videoKey = await storageService.uploadVideo(file, (progress) => {
        setActiveUploads(prev => prev.map(u => u.id === uploadId ? { ...u, progress } : u));
      }, controller.signal);

      console.log(`[UploadContext] Upload complete! Video key: ${videoKey}`);
      
      // 3. Update game record with video path
      const { error: updateError } = await supabase
        .from('games')
        .update({ video_path: videoKey, status: 'queued' })
        .eq('id', gameData.id);

      if (updateError) throw updateError;

      // 4. Trigger GPU processing
      setActiveUploads(prev => prev.map(u => 
        u.id === uploadId ? { ...u, status: "processing" } : u
      ));

      console.log(`[UploadContext] Triggering GPU analysis for game: ${gameData.id}`);
      
      const response = await axios.post("/api/process-game", {
        gameId: gameData.id,
        videoPath: videoKey,
        homeTeamId: formData.homeTeamId,
        awayTeamId: formData.awayTeamId,
        homeColor: formData.homeColor,
        awayColor: formData.awayColor
      });

      if (response.status !== 200) {
        throw new Error(`GPU Pipeline rejected: ${response.data?.message || 'Unknown error'}`);
      }

      console.log("[UploadContext] GPU analysis triggered successfully!");
      
      toast({
        title: "Analysis Started",
        description: "Video uploaded successfully. GPU analysis is now running.",
      });

      setActiveUploads(prev => prev.filter(u => u.id !== uploadId));
      delete abortControllers.current[uploadId];

    } catch (error: any) {
      if (error.message === "CANCELLED") {
        console.log("[UploadContext] Upload cancelled by user");
        return;
      }

      const serverData = error.response?.data;
      console.error("[UploadContext] Background Upload Failed!", {
        status: error.response?.status,
        message: error.message,
        serverDetails: serverData
      });
      
      setActiveUploads(prev => prev.map(u => 
        u.id === uploadId ? { ...u, status: "failed", error: serverData?.message || error.message } : u
      ));
      
      toast({
        title: "Upload Failed",
        description: error.response?.data?.message || error.message,
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