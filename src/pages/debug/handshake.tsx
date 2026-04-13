import React, { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Zap, 
  RefreshCw, 
  Activity, 
  ShieldCheck, 
  Cpu, 
  Database,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Wifi
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function HandshakeDebugPage() {
  const [testId] = useState(`handshake-${Math.random().toString(36).substr(2, 9)}`);
  const [status, setStatus] = useState<'idle' | 'sending' | 'waiting' | 'success' | 'error'>('idle');
  const [log, setLog] = useState<any[]>([]);
  const [dbState, setDbState] = useState<any>(null);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'gpu' = 'info') => {
    setLog(prev => [{
      timestamp: new Date().toLocaleTimeString(),
      msg,
      type
    }, ...prev]);
  };

  useEffect(() => {
    const channel = supabase
      .channel('handshake-monitor')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'handshake_debug', filter: `test_id=eq.${testId}` },
        (payload) => {
          const entry = payload.new as any;
          setDbState(entry);
          if (entry.status === 'success') {
            setStatus('success');
            addLog(`GPU SIGNAL RECEIVED: "${entry.message}"`, 'gpu');
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [testId]);

  const handlePulse = async () => {
    setStatus('sending');
    setLog([]);
    addLog(`INITIATING PULSE: ID [${testId}]`, 'info');

    try {
      // 1. Initialise DB Row
      addLog("Preparing Database Handshake Row...", "info");
      const { error: dbErr } = await supabase.from('handshake_debug').upsert({
        test_id: testId,
        status: 'pending',
        message: 'Awaiting GPU Heartbeat...'
      }, { onConflict: 'test_id' });

      if (dbErr) throw dbErr;
      addLog("Database Ready. Row Locked.", "success");

      // 2. Dispatch Pulse
      addLog("Dispatching Ignition Signal to Modal.com...", "info");
      const response = await fetch('/api/debug/ping-gpu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_id: testId })
      });

      const data = await response.json();
      
      if (data.status === 'success' || data.status === 'dispatched') {
        setStatus('waiting');
        addLog("Signal Received by Modal Entry Gate. GPU Cluster Initializing...", "success");
      } else {
        throw new Error(data.message || "Dispatch Failed");
      }
    } catch (e: any) {
      setStatus('error');
      addLog(`SYSTEM STALL: ${e.message}`, 'error');
    }
  };

  return (
    <Layout title="Forensic Handshake Diagnostic">
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        <div className="flex flex-col gap-2">
          <Badge variant="outline" className="w-fit bg-primary/10 text-primary border-primary/20 uppercase font-mono text-[10px]">DIAGNOSTIC MODE</Badge>
          <h1 className="text-4xl font-black tracking-tighter text-white uppercase">Forensic Handshake</h1>
          <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest">Zero-G Communication Audit • Website ↔ GPU ↔ Database</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1 bg-card/40 border-white/5 p-6 space-y-6">
            <div className="space-y-4">
              <Button 
                onClick={handlePulse} 
                disabled={status === 'sending' || status === 'waiting'}
                className={cn(
                  "w-full h-16 text-lg font-black uppercase tracking-widest shadow-xl transition-all",
                  status === 'idle' && "bg-primary hover:bg-primary/90 shadow-primary/20",
                  status === 'sending' && "bg-amber-600 animate-pulse",
                  status === 'waiting' && "bg-blue-600",
                  status === 'success' && "bg-emerald-600",
                  status === 'error' && "bg-red-600"
                )}
              >
                {status === 'idle' && <><Zap className="mr-3 h-6 w-6" /> FORCE PING</>}
                {status === 'sending' && <><RefreshCw className="mr-3 h-6 w-6 animate-spin" /> DISPATCHING</>}
                {status === 'waiting' && <><Activity className="mr-3 h-6 w-6 animate-pulse" /> WAITING</>}
                {status === 'success' && <><CheckCircle2 className="mr-3 h-6 w-6" /> VERIFIED</>}
                {status === 'error' && <><AlertCircle className="mr-3 h-6 w-6" /> FAILED</>}
              </Button>
              <p className="text-[10px] text-center text-muted-foreground font-mono">TEST ID: {testId}</p>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                <ShieldCheck className="h-3 w-3" /> System Health
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Supabase Realtime</span>
                  <Badge variant="outline" className="text-emerald-500 bg-emerald-500/10 border-emerald-500/20 px-1 py-0 h-4 text-[9px]">ACTIVE</Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Modal Entry Gate</span>
                  <Badge variant="outline" className="text-blue-500 bg-blue-500/10 border-blue-500/20 px-1 py-0 h-4 text-[9px]">MONITORING</Badge>
                </div>
              </div>
            </div>
          </Card>

          <Card className="md:col-span-2 bg-black/40 border-white/5 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Terminal className="h-3 w-3" /> Forensic Output Trace
              </h4>
              {status === 'waiting' && <Wifi className="h-3 w-3 text-blue-500 animate-pulse" />}
            </div>
            <div className="flex-1 p-4 h-[300px] overflow-y-auto font-mono text-[11px] space-y-2 custom-scrollbar">
              {log.length === 0 && (
                <div className="h-full flex items-center justify-center text-muted-foreground/30 italic">
                  Awaiting pulse ignition...
                </div>
              )}
              {log.map((entry, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-muted-foreground shrink-0">[{entry.timestamp}]</span>
                  <span className={cn(
                    entry.type === 'error' && "text-red-400 font-bold",
                    entry.type === 'success' && "text-emerald-400 font-bold",
                    entry.type === 'gpu' && "text-blue-400 font-black italic border-l-2 border-blue-500 pl-2",
                    entry.type === 'info' && "text-white/70"
                  )}>
                    {entry.msg}
                  </span>
                </div>
              ))}
            </div>
            {dbState && (
              <div className="p-4 bg-white/5 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Database className="h-3 w-3 text-primary" />
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">DB Status: {dbState.status}</span>
                  </div>
                  {dbState.gpu_heartbeat && (
                    <div className="flex items-center gap-1.5">
                      <Cpu className="h-3 w-3 text-accent" />
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">GPU Beat: {new Date(dbState.gpu_heartbeat).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
}