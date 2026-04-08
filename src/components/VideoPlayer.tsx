import React from "react";
import { Card } from "@/components/ui/card";

interface VideoPlayerProps {
  videoId: string;
  className?: string;
}

export function VideoPlayer({ videoId, className }: VideoPlayerProps) {
  if (!videoId) return null;

  return (
    <div className={`relative aspect-video rounded-2xl overflow-hidden bg-muted ${className}`}>
      <iframe
        className="absolute inset-0 w-full h-full border-none"
        src={`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}