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
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <Card className={cn("bg-black/40 border-muted/20 flex flex-col h-full", className)}>
      <CardHeader className="py-3 px-4 border-b border-muted/10 flex flex-row items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm font-medium">Elite Technical Trace</CardTitle>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Live Stream</span>
        </div>
      </CardHeader>
      <CardContent 
        ref={scrollRef}
        className="p-0 overflow-y-auto font-mono text-[11px] leading-relaxed flex-1"
      >
        <div className="p-4 space-y-1">
          {logs.length === 0 ? (
            <div className="text-muted-foreground/30 italic py-2">Awaiting system ignition...</div>
          ) : (
            logs.map((log, index) => (
              <div key={log.id || index} className="flex gap-3 group border-b border-white/5 pb-1 last:border-0">
                <span className="text-muted-foreground/40 shrink-0">
                  [{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
                </span>
                <span className={cn(
                  "shrink-0 font-bold uppercase w-12",
                  log.level === 'error' ? "text-red-500" : 
                  log.level === 'warn' ? "text-yellow-500" : "text-accent"
                )}>
                  {log.level}
                </span>
                <span className="text-foreground/90 break-all">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}