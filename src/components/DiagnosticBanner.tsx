import React from "react";
import { X, AlertTriangle, Cpu, Sparkles, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type BannerSeverity = "info" | "warning" | "error" | "success";

interface DiagnosticBannerProps {
  title: string;
  message: string;
  severity: BannerSeverity;
  onClose: () => void;
  className?: string;
}

export function DiagnosticBanner({ title, message, severity, onClose, className }: DiagnosticBannerProps) {
  const variants = {
    info: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    warning: "bg-amber-500/10 border-amber-500/20 text-amber-500",
    error: "bg-red-500/10 border-red-500/20 text-red-500",
    success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
  };

  const icons = {
    info: Cpu,
    warning: AlertTriangle,
    error: Terminal,
    success: Sparkles,
  };

  const Icon = icons[severity];

  return (
    <div className={cn("relative overflow-hidden rounded-xl border animate-in fade-in slide-in-from-top-2 duration-300", variants[severity], className)}>
      <div className="flex items-start gap-4 p-4">
        <div className="mt-1">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-1">
          <h5 className="font-bold uppercase tracking-widest text-[10px]">{title}</h5>
          <p className="text-xs font-mono leading-relaxed opacity-90">{message}</p>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          className="h-6 w-6 rounded-full hover:bg-white/10 -mt-1 -mr-1"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      {/* Decorative pulse line for active diagnostic states */}
      {(severity === "warning" || severity === "info") && (
        <div className="absolute bottom-0 left-0 h-[2px] w-full bg-current opacity-20 overflow-hidden">
          <div className="h-full w-1/3 bg-current animate-shimmer" />
        </div>
      )}
    </div>
  );
}