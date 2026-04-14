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
  metadata?: any;
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

  const startUpload = useCallback(async (file: File, gameMetadata: any): Promise<string | undefined> => {
    const uploadId = crypto.randomUUID();
    
    // 1. Create Game record in staging status
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .insert([{
        home_team_id: gameMetadata.homeTeam,
        away_team_id: gameMetadata.awayTeam,
        date: gameMetadata.gameDate.toISOString(),
        venue_id: gameMetadata.venueId,
        home_score: gameMetadata.homeScore,
        away_score: gameMetadata.awayScore,
        status: 'uploading'
      }])
      .select()
      .single();

    if (gameError) {
      showBanner("Failed to register game record", "error");
      throw gameError;
    }

    // Add task to tracking
    setActiveUploads(prev => [...prev, {
      id: uploadId,
      fileName: file.name,
      progress: 5, // Start at 5% to show activity immediately
      status: "uploading",
      gameId: gameData.id,
      metadata: gameMetadata
    }]);

    // Start background process
    (async () => {
      try {
        const abortController = new AbortController();
        abortControllers.current[uploadId] = abortController;

        // 2. Upload video to Supabase Storage using S3 Multipart Bypass
        // Removed abortController.signal as the new S3 multipart service uses axios internally
        const videoPath = await storageService.uploadVideo(file, (progress) => {
          console.log(`[UploadProgress] ${file.name}: ${progress}%`);
          setActiveUploads(prev => prev.map(t => 
            t.id === uploadId ? { ...t, progress } : t
          ));
        });

        console.log(`[UploadContext] Video successfully uploaded via S3 Multipart: ${videoPath}`);
        delete abortControllers.current[uploadId];

        // 3. Update game record with the video path and transition to 'pending' for Modal.com workers
        const { error: updateError } = await supabase
          .from('games')
          .update({ 
            video_path: videoPath, 
            status: 'pending',
            processing_status: 'ready_for_gpu' // Signal for Modal.com
          })
          .eq('id', gameData.id);

        if (updateError) throw updateError;

        setActiveUploads(prev => prev.map(t => 
          t.id === uploadId ? { ...t, status: "completed", progress: 100 } : t
        ));

        // Auto-remove completed task after 5 seconds
        setTimeout(() => {
          setActiveUploads(prev => prev.filter(t => t.id !== uploadId));
        }, 5000);

      } catch (err: any) {
        console.error("[UploadContext] Background process failed:", err);
        
        // Fix for React Error #130: Ensure we don't pass undefined to state
        const errorMessage = err.message || "Unknown upload error";
        
        setActiveUploads(prev => prev.map(t => 
          t.id === uploadId ? { 
            ...t, 
            status: "failed",
            progress: 0,
            error: errorMessage.includes("413") 
              ? "Storage limit exceeded. Increase limit in Supabase Dashboard (Storage > Settings)." 
              : errorMessage
          } : t
        ));
      }
    })();

    return gameData.id;
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