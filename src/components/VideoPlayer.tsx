import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  url: string;
  className?: string;
}

export function VideoPlayer({ url, className }: VideoPlayerProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className={cn("w-full aspect-video bg-black/50 animate-pulse rounded-lg", className)} />;
  }

  const isYoutube = url.includes("youtube.com") || url.includes("youtu.be");
  
  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  if (isYoutube) {
    const videoId = getYoutubeId(url);
    return (
      <div className={cn("relative aspect-video rounded-xl overflow-hidden bg-muted", className)}>
        <iframe
          className="absolute inset-0 w-full h-full border-none"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className={cn("relative aspect-video rounded-xl overflow-hidden bg-black", className)}>
      <video
        className="absolute inset-0 w-full h-full"
        controls
        playsInline
        src={url}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}