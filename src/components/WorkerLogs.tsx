import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Terminal, Activity, AlertCircle, Clock, Cpu, ShieldCheck } from "lucide-react";

export interface LogEntry {
  timestamp: string;
  level: "info" | "heartbeat" | "error" | "warning";
  message: string;
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
      <div className={cn("flex flex-col items-center justify-center p-8 border border-white/5 rounded-xl bg-black/20 text-muted-foreground/40", className)}>
        <Terminal className="h-8 w-8 mb-2 opacity-20" />
        <p className="text-[10px] font-mono uppercase tracking-widest animate-pulse">Awaiting GPU Swarm Connection...</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col border border-white/10 rounded-xl bg-black/40 overflow-hidden shadow-2xl", className)}>
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Activity className="h-3 w-3 text-primary animate-pulse" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">Technical Trace: Live Pulse</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground">
            <Clock className="h-2.5 w-2.5" />
            {new Date().toLocaleTimeString([], { hour12: false })}
          </span>
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="p-4 h-[250px] overflow-y-auto font-mono text-[10px] space-y-2 scrollbar-thin scrollbar-thumb-white/10"
      >
        {logs.map((log, i) => (
          <div key={i} className="flex gap-3 animate-in fade-in slide-in-from-left-1 duration-300">
            <span className="text-muted-foreground/30 whitespace-nowrap">
              [{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
            </span>
            <span className={cn(
              "font-black uppercase tracking-tighter shrink-0 w-16",
              log.level === 'error' ? "text-red-500" : 
              log.level === 'warning' ? "text-amber-500" :
              log.level === 'heartbeat' ? "text-primary" : 
              log.level === 'info' ? "text-accent" : "text-muted-foreground"
            )}>
              {log.level}
            </span>
            <span className={cn(
              "break-all leading-relaxed",
              log.level === 'error' ? "text-red-400" : "text-foreground/70"
            )}>
              {log.message}
            </span>
          </div>
        ))}
      </div>
      
      <div className="px-4 py-1.5 bg-primary/5 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-[8px] font-mono text-primary/60 uppercase tracking-tighter italic">
            <ShieldCheck className="h-2.5 w-2.5" />
            Secure GPU Tunnel
          </span>
          <span className="flex items-center gap-1 text-[8px] font-mono text-accent/60 uppercase tracking-tighter italic">
            <Cpu className="h-2.5 w-2.5" />
            T4 Optimized
          </span>
        </div>
        <span className="text-[8px] font-mono text-muted-foreground/40 uppercase">
          Packets: {logs.length}
        </span>
      </div>
    </div>
  );
}