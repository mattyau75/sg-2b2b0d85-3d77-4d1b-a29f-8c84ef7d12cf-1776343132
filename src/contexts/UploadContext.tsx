import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { storageService } from "@/services/storageService";
import { modalService } from "@/services/modalService";
import { supabase } from "@/integrations/supabase/client";
import { showBanner } from "@/components/DiagnosticBanner";
import axios from "axios";
import { useRouter } from "next/router";

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
  startUpload: (file: File, config: any) => Promise<string | undefined>;
  cancelUpload: (uploadId: string) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [activeUploads, setActiveUploads] = useState<UploadTask[]>([]);
  const abortControllers = useRef<Record<string, AbortController>>({});
  const router = useRouter();

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
    
    showBanner(`Analysis for ${task?.fileName || 'the video'} was terminated.`, "info", "Upload Cancelled");
  }, [activeUploads]);

  const startUpload = useCallback(async (file: File, formData: any): Promise<string | undefined> => {
    // 1. Create Game record in staging status
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .insert([{
        status: 'uploading',
        camera_type: formData.cameraType || 'panning'
      }])
      .select()
      .single();

    if (gameError) throw gameError;

    const uploadId = crypto.randomUUID();
    const videoKey = `raw-footage/${gameData.id}-${file.name.replace(/\s+/g, '_')}`;

    // Add task to tracking
    setActiveUploads(prev => [...prev, {
      id: uploadId,
      fileName: file.name,
      progress: 0,
      status: "uploading",
      gameId: gameData.id
    }]);

    try {
      // 2. Perform Multipart Upload
      const abortController = new AbortController();
      abortControllers.current[uploadId] = abortController;

      await storageService.uploadVideo(file, (progress) => {
        setActiveUploads(prev => prev.map(t => 
          t.id === uploadId ? { ...t, progress } : t
        ));
      }, abortController.signal);

      // Clean up controller after successful upload
      delete abortControllers.current[uploadId];

      // 3. Update game record with video path
      const { error: updateError } = await supabase
        .from('games')
        .update({ 
          video_path: videoKey, 
          status: 'queued' 
        })
        .eq('id', gameData.id);

      if (updateError) throw updateError;

      // REMOVED: Immediate redirect. Returning gameId instead.
      setActiveUploads(prev => prev.filter(t => t.id !== uploadId));
      return gameData.id;

    } catch (error: any) {
      // Clean up controller on failure
      delete abortControllers.current[uploadId];

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
      
      showBanner("Upload Failed", error.response?.data?.message || error.message, "error");
    }
  }, []);

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