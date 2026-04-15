import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  videoUrl: string;
}

export function VideoPlayer({ videoUrl }: VideoPlayerProps) {
  if (!videoUrl) {
    return (
      <div className="w-full h-full bg-black/40 flex items-center justify-center rounded-xl border border-white/5">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Authorizing R2 Stream...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black rounded-xl overflow-hidden shadow-2xl border border-white/5 relative group">
      <video 
        controls 
        className="w-full h-full object-contain"
        preload="metadata"
        playsInline
        autoPlay={false}
        key={videoUrl} // Force re-render when a new authorized URL arrives
      >
        <source src={videoUrl} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}