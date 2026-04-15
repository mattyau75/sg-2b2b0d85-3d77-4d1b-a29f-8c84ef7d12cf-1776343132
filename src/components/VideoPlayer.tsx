import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  videoUrl: string;
}

export function VideoPlayer({ videoUrl }: VideoPlayerProps) {
  return (
    <div className="w-full h-full bg-black rounded-xl overflow-hidden shadow-2xl border border-white/5">
      <video 
        controls 
        className="w-full h-full object-contain"
        preload="auto"
        playsInline
      >
        <source src={videoUrl} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}