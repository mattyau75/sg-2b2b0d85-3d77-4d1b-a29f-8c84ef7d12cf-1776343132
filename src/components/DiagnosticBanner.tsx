import React, { useState, useEffect } from "react";
import { X, Info, AlertCircle, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type BannerSeverity = "info" | "error" | "success" | "warning";

interface BannerProps {
  title?: string;
  message: string;
  severity: BannerSeverity;
  onClose?: () => void;
  className?: string;
  persistent?: boolean;
}

export function DiagnosticBanner({ title, message, severity, onClose, className, persistent = true }: BannerProps) {
  const [isVisible, setIsVisible] = useState(true);
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
        "flex items-start justify-between p-4 rounded-lg border shadow-lg animate-in fade-in slide-in-from-top-4 duration-300 relative",
        severity === "info" && "bg-secondary border-muted text-foreground",
        severity === "error" && "bg-destructive/10 border-destructive/20 text-destructive",
        severity === "success" && "bg-accent/10 border-accent/20 text-accent",
        severity === "warning" && "bg-primary/10 border-primary/20 text-primary",
        className
      )}
    >
      <div className="flex gap-3 flex-1 min-w-0">
        <Icon className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="space-y-1 flex-1 min-w-0">
          {title && <h5 className="text-sm font-bold uppercase tracking-tight">{title}</h5>}
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message}</p>
        </div>
      </div>
      {onClose && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="p-2 hover:bg-foreground/10 rounded-full transition-colors shrink-0 ml-2 relative z-10 group"
          aria-label="Close notification"
          type="button"
        >
          <X className="w-4 h-4 group-hover:scale-110 transition-transform" />
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
    const handleAddBanner = (e: any) => {
      const newBanner = e.detail;
      // All banners are now strictly persistent by default
      setBanners((prev) => [...prev, { ...newBanner, persistent: true }]);
    };

    window.addEventListener("add-banner" as any, handleAddBanner);
    return () => window.removeEventListener("add-banner" as any, handleAddBanner);
  }, []);

  const removeBanner = (id: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
  };

  if (banners.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-[100] flex flex-col gap-3 w-full max-w-md pointer-events-none">
      {banners.map((banner) => (
        <div
          key={banner.id}
          className={cn(
            "pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-2xl animate-in slide-in-from-right-8 duration-300",
            banner.severity === "error" ? "bg-red-500/10 border-red-500/50 text-red-200" :
            banner.severity === "success" ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-200" :
            banner.severity === "warning" ? "bg-orange-500/10 border-orange-500/50 text-orange-200" :
            "bg-blue-500/10 border-blue-500/50 text-blue-200"
          )}
        >
          <div className="mt-0.5">
            {banner.severity === "error" ? <AlertCircle className="h-5 w-5" /> : 
             banner.severity === "warning" ? <AlertTriangle className="h-5 w-5" /> :
             <Info className="h-5 w-5" />}
          </div>
          <div className="flex-1 space-y-1">
            {banner.title && <p className="text-xs font-black uppercase tracking-widest">{banner.title}</p>}
            <p className="text-sm font-medium leading-relaxed">{banner.message}</p>
          </div>
          <button 
            onClick={() => removeBanner(banner.id)}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            title="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
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
      persistent: true // Ensure all global banners are persistent
    },
  });
  window.dispatchEvent(event);
};