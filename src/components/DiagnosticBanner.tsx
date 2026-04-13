import React, { useState, useEffect } from "react";
import { X, Info, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type BannerSeverity = "info" | "error" | "success" | "warning";

interface BannerProps {
  title?: string;
  message: string;
  severity: BannerSeverity;
  onClose?: () => void;
  className?: string;
}

export function DiagnosticBanner({ title, message, severity, onClose, className }: BannerProps) {
  const icons = {
    info: Info,
    error: AlertCircle,
    success: CheckCircle,
    warning: AlertTriangle,
  };

  const Icon = icons[severity];

  return (
    <div
      className={cn(
        "flex items-start justify-between p-4 rounded-lg border shadow-lg animate-in fade-in slide-in-from-top-4 duration-300",
        severity === "info" && "bg-secondary border-muted text-foreground",
        severity === "error" && "bg-destructive/10 border-destructive/20 text-destructive",
        severity === "success" && "bg-accent/10 border-accent/20 text-accent",
        severity === "warning" && "bg-primary/10 border-primary/20 text-primary",
        className
      )}
    >
      <div className="flex gap-3">
        <Icon className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="space-y-1">
          {title && <h5 className="text-sm font-bold uppercase tracking-tight">{title}</h5>}
          <p className="text-sm leading-relaxed">{message}</p>
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 hover:bg-foreground/10 rounded-full transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

interface GlobalBanner extends BannerProps {
  id: string;
}

export function GlobalBannerContainer() {
  const [banners, setBanners] = useState<GlobalBanner[]>([]);

  useEffect(() => {
    const handleAddBanner = (event: CustomEvent<GlobalBanner>) => {
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
        <DiagnosticBanner
          key={banner.id}
          {...banner}
          onClose={() => removeBanner(banner.id)}
        />
      ))}
    </div>
  );
}

export const showBanner = (message: string, severity: BannerSeverity = "info", title?: string) => {
  const event = new CustomEvent("add-banner", {
    detail: { 
      id: Math.random().toString(36).substr(2, 9), 
      message, 
      severity,
      title,
      // 🛡️ STICKY PERSISTENCE: No duration property means it never auto-hides
    },
  });
  window.dispatchEvent(event);
};