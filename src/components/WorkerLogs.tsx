import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Terminal, Activity, Zap, ShieldCheck, AlertCircle } from "lucide-react";

export interface LogEntry {
  timestamp: string;
  message: string;
  level: "info" | "warning" | "error" | "heartbeat";
}

interface WorkerLogsProps {
  logs: LogEntry[];
  className?: string;
}

export function WorkerLogs({ logs, className }: WorkerLogsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!logs || logs.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-8 text-center space-y-3 bg-black/20 border border-dashed border-white/5 rounded-xl", className)}>
        <Activity className="h-8 w-8 text-muted-foreground/20 animate-pulse" />
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">System Idle</p>
          <p className="text-[9px] text-muted-foreground/50 font-mono">Awaiting GPU cluster ignition pulse...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={scrollRef}
      className={cn(
        "font-mono text-[10px] overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent",
        className
      )}
    >
      {logs.map((log, index) => {
        const date = new Date(log.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        return (
          <div 
            key={index} 
            className={cn(
              "flex gap-3 leading-relaxed border-l-2 pl-3 py-0.5 transition-colors",
              log.level === "heartbeat" ? "border-primary/50 bg-primary/5" : 
              log.level === "error" ? "border-red-500/50 bg-red-500/5" :
              log.level === "warning" ? "border-amber-500/50 bg-amber-500/5" : 
              "border-white/10 hover:bg-white/5"
            )}
          >
            <span className="text-muted-foreground/40 shrink-0 select-none">[{timeStr}]</span>
            <span className="shrink-0 flex items-center">
              {log.level === "heartbeat" && <Zap className="h-3 w-3 text-primary" />}
              {log.level === "info" && <ShieldCheck className="h-3 w-3 text-emerald-500" />}
              {log.level === "warning" && <AlertCircle className="h-3 w-3 text-amber-500" />}
              {log.level === "error" && <AlertCircle className="h-3 w-3 text-red-500" />}
            </span>
            <span className={cn(
              "break-words",
              log.level === "heartbeat" ? "text-primary font-bold" : 
              log.level === "error" ? "text-red-400" :
              log.level === "warning" ? "text-amber-400" :
              "text-white/80"
            )}>
              {log.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}