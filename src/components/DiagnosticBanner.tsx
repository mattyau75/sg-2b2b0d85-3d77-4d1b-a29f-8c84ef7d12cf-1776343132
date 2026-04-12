import React, { useState, useEffect } from "react";
import { X, Info, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type BannerType = "info" | "error" | "success" | "warning";

interface Banner {
  id: string;
  message: string;
  type: BannerType;
}

export function DiagnosticBanner() {
  const [banners, setBanners] = useState<Banner[]>([]);

  // Listen for custom events to show banners
  useEffect(() => {
    const handleAddBanner = (event: CustomEvent<Banner>) => {
      setBanners((prev) => [...prev, event.detail]);
    };

    window.addEventListener("add-banner" as any, handleAddBanner);
    return () => window.removeEventListener("add-banner" as any, handleAddBanner);
  }, []);

  const removeBanner = (id: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
  };

  if (banners.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl flex flex-col gap-2 px-4">
      {banners.map((banner) => (
        <div
          key={banner.id}
          className={cn(
            "flex items-center justify-between p-4 rounded-lg border shadow-lg animate-in fade-in slide-in-from-top-4 duration-300",
            banner.type === "info" && "bg-secondary border-muted text-foreground",
            banner.type === "error" && "bg-destructive/10 border-destructive/20 text-destructive",
            banner.type === "success" && "bg-accent/10 border-accent/20 text-accent",
            banner.type === "warning" && "bg-primary/10 border-primary/20 text-primary"
          )}
        >
          <div className="flex items-center gap-3">
            {banner.type === "info" && <Info className="w-5 h-5" />}
            {banner.type === "error" && <AlertCircle className="w-5 h-5" />}
            {banner.type === "success" && <CheckCircle className="w-5 h-5" />}
            {banner.type === "warning" && <AlertCircle className="w-5 h-5" />}
            <p className="text-sm font-medium">{banner.message}</p>
          </div>
          <button
            onClick={() => removeBanner(banner.id)}
            className="p-1 hover:bg-foreground/10 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// Helper to trigger banners from anywhere
export const showBanner = (message: string, type: BannerType = "info") => {
  const event = new CustomEvent("add-banner", {
    detail: { id: Math.random().toString(36).substr(2, 9), message, type },
  });
  window.dispatchEvent(event);
};