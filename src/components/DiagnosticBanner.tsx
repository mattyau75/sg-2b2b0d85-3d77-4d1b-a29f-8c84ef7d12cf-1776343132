import React, { useState, useEffect } from "react";
import { AlertCircle, CheckCircle, Info, X, Zap, Cpu, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

type BannerType = "info" | "success" | "warning" | "error";

interface DiagnosticBannerProps {
  message: string;
  type: BannerType;
  moduleId?: string;
  onDismiss?: () => void;
}

export function DiagnosticBanner({ message, type, moduleId, onDismiss }: DiagnosticBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const config = {
    info: { icon: Info, bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400" },
    success: { icon: CheckCircle, bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400" },
    warning: { icon: Zap, bg: "bg-primary/10", border: "border-primary/20", text: "text-primary" },
    error: { icon: AlertCircle, bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400" },
  }[type];

  return (
    <div className={cn(
      "fixed top-20 right-6 z-50 w-80 animate-in slide-in-from-right-8 duration-500",
      "p-4 rounded-xl border backdrop-blur-md shadow-2xl",
      config.bg, config.border
    )}>
      <div className="flex gap-3">
        <config.icon className={cn("h-5 w-5 shrink-0", config.text)} />
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <span className={cn("text-[10px] font-black uppercase tracking-widest", config.text)}>
              {moduleId || "System Pulse"}
            </span>
            <button onClick={() => { setIsVisible(false); onDismiss?.(); }} className="hover:opacity-70 transition-opacity">
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
          <p className="text-xs font-medium leading-relaxed text-zinc-100">{message}</p>
        </div>
      </div>
    </div>
  );
}

// Global hook for triggering diagnostic banners from anywhere
export const showBanner = (message: string, type: BannerType = "info", moduleId?: string) => {
  const event = new CustomEvent("sg_show_banner", { detail: { message, type, moduleId } });
  window.dispatchEvent(event);
};