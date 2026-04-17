import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Terminal, Cpu, Info, AlertTriangle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkerLog {
  id: string;
  event_type: string;
  severity: string;
  payload: any;
  timestamp_ms: number;
  module_id: string;
}

export function WorkerLogs({ gameId }: { gameId: string }) {
  const [logs, setLogs] = useState<WorkerLog[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gameId) return;

    // Fetch initial logs
    const fetchLogs = async () => {
      const { data } = await supabase
        .from('game_events')
        .select('*')
        .eq('game_id', gameId)
        .order('timestamp_ms', { ascending: true });
      
      if (data) setLogs(data);
    };

    fetchLogs();

    // Subscribe to real-time pulses
    const channel = supabase
      .channel(`gpu_trace_${gameId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'game_events',
        filter: `game_id=eq.${gameId}` 
      }, (payload) => {
        console.log("GPU Pulse Received:", payload.new);
        setLogs(prev => [...prev, payload.new as WorkerLog]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [gameId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-black/60 border border-white/5 rounded-2xl overflow-hidden font-mono text-[11px]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Terminal className="h-3 w-3" />
          <span className="font-black uppercase tracking-widest text-[10px]">Technical Trace Log</span>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-1">
             <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
             <span className="text-[9px] text-accent uppercase font-black">GPU Link Active</span>
           </div>
        </div>
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
        {logs.length === 0 && (
          <div className="text-white/20 italic p-4 text-center">Awaiting handshake pulse...</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3 leading-relaxed group hover:bg-white/5 p-1 rounded transition-colors">
            <span className="text-white/30 shrink-0 select-none">[{new Date(log.timestamp_ms).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
            <span className={cn(
              "uppercase font-black tracking-tighter shrink-0",
              log.severity === 'error' ? "text-red-500" : 
              log.severity === 'warn' ? "text-primary" : 
              "text-accent"
            )}>
              {log.severity || 'info'}
            </span>
            <span className="text-zinc-400 shrink-0">[{log.module_id || 'SYS'}]</span>
            <span className="text-zinc-100">{log.payload?.message || JSON.stringify(log.payload)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}