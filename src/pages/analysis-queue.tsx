import React, { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import {
  Cpu,
  Activity,
  Clock,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  Trash2,
  XCircle,
  UploadCloud,
  Settings2 
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { showBanner } from "@/components/DiagnosticBanner";
import { useUploads } from "@/contexts/UploadContext";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { EditGameTeamsModal } from "@/components/EditGameTeamsModal";

const STATUS_CONFIG: Record<string, { label: string; color: string; progress: number }> = {
  'pending': { label: 'Queued', color: 'text-zinc-400', progress: 10 },
  'ignited': { label: 'GPU Handshake', color: 'text-blue-400', progress: 20 },
  'analyzing': { label: 'AI Processing', color: 'text-orange-400 animate-pulse', progress: 65 },
  'completed': { label: 'Analysis Ready', color: 'text-emerald-400', progress: 100 },
  'error': { label: 'GPU Stalled', color: 'text-red-400', progress: 0 }
};

export default function AnalysisQueuePage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [editingGame, setEditingGame] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { activeUploads, cancelUpload } = useUploads();

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select(`
          *,
          home_team:teams!games_home_team_id_fkey(name),
          away_team:teams!games_away_team_id_fkey(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (err) {
      console.error("Fetch jobs error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();

    const channel = supabase
      .channel('queue-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games' },
        () => {
          fetchJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRetry = async (id: string) => {
    try {
      const { error } = await supabase
        .from('games')
        .update({ 
          status: 'pending', 
          progress_percentage: 0 
        } as any)
        .eq('id', id);

      if (error) throw error;
      showBanner("Analysis Re-Queued", "info");
    } catch (err: any) {
      showBanner("Retry Failed", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? All analyzed data will be lost.")) return;
    try {
      const { error } = await supabase.from('games').delete().eq('id', id);
      if (error) throw error;
      showBanner("Job Purged", "info");
      setJobs(prev => prev.filter(j => j.id !== id));
    } catch (err: any) {
      showBanner("Delete Failed", "error");
    }
  };

  const activeJobs = jobs.filter(j => j.status !== 'completed' && j.status !== 'error');
  const finishedJobs = jobs.filter(j => j.status === 'completed' || j.status === 'error');

  return (
    <Layout title="Processing Queue | DribbleStats AI Elite">
      <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black tracking-tighter uppercase italic text-white">
            Processing <span className="text-primary not-italic">Queue</span>
          </h1>
          <p className="text-muted-foreground flex items-center gap-2 font-mono text-xs uppercase tracking-widest">
            <Activity className="h-4 w-4 text-primary animate-pulse" />
            Monitoring {activeJobs.length + activeUploads.length} Active GPU Swarms
          </p>
        </div>

        {activeUploads.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              <UploadCloud className="h-3 w-3" /> Live R2 Ingestion
            </div>
            <div className="grid grid-cols-1 gap-4">
              {activeUploads.map((upload) => (
                <Card key={upload.id} className="bg-primary/5 border-primary/20 overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-1">
                        <h3 className="text-lg font-black uppercase tracking-tighter text-white">{upload.fileName}</h3>
                        <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Streaming to R2...</p>
                      </div>
                      <div className="w-full md:w-64 space-y-2">
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-muted-foreground uppercase">Progress</span>
                          <span className="font-bold text-primary">{upload.progress}%</span>
                        </div>
                        <Progress value={upload.progress} className="h-1.5 bg-primary/10" />
                      </div>
                      <Button variant="outline" size="sm" className="border-red-500/30 text-red-500 hover:bg-red-500/10 h-10 px-4" onClick={() => cancelUpload(upload.id)}>
                        <XCircle className="h-4 w-4 mr-2" /> Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            <Cpu className="h-3 w-3" /> GPU Cluster Activity
          </div>
          {activeJobs.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {activeJobs.map((job) => {
                const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
                return (
                  <Card key={job.id} className="bg-card/30 border-white/5 overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-black uppercase tracking-tighter text-white">
                              {job.home_team?.name} vs {job.away_team?.name}
                            </h3>
                            <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-widest px-2", config.color)}>
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-mono truncate max-w-md">{job.video_path}</p>
                        </div>
                        <div className="w-full md:w-64 space-y-2">
                          <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-muted-foreground uppercase">Analysis</span>
                            <span className={cn("font-bold", config.color)}>{job.progress_percentage || 0}%</span>
                          </div>
                          <Progress value={job.progress_percentage || 0} className="h-1.5" />
                        </div>
                        <div className="flex items-center gap-2">
                           <Button variant="outline" size="sm" className="h-10 border-white/10 hover:bg-white/5" onClick={() => setEditingGame(job)}>
                             <Settings2 className="h-4 w-4" />
                           </Button>
                           <Button variant="ghost" size="sm" asChild className="h-10 w-10">
                             <Link href={`/games/${job.id}`}><ExternalLink className="h-4 w-4" /></Link>
                           </Button>
                           <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-red-500 h-10 w-10" onClick={() => handleDelete(job.id)}>
                             <Trash2 className="h-4 w-4" />
                           </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            activeUploads.length === 0 && (
              <Card className="bg-card/20 border-dashed border-white/10 py-16 flex flex-col items-center justify-center text-center">
                <Clock className="h-12 w-12 text-muted-foreground/20 mb-4" />
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">No Active Swarms</p>
              </Card>
            )
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            <CheckCircle2 className="h-3 w-3" /> Recent Intel Logs
          </div>
          <div className="grid grid-cols-1 gap-2">
            {finishedJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between p-4 rounded-2xl bg-card/20 border border-white/5 hover:bg-card/30 transition-colors group">
                <div className="flex items-center gap-4">
                  {job.status === 'error' ? <AlertCircle className="h-5 w-5 text-red-500" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-tighter text-white">{job.home_team?.name} vs {job.away_team?.name}</h4>
                    <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">{new Date(job.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" asChild className="h-10 px-4 text-[10px] font-black uppercase tracking-widest hover:text-primary">
                    <Link href={`/games/${job.id}`}>View Intelligence</Link>
                  </Button>
                  <Button variant="ghost" size="sm" className="h-10 w-10 text-muted-foreground hover:text-red-500" onClick={() => handleDelete(job.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <EditGameTeamsModal 
        game={editingGame} 
        isOpen={!!editingGame} 
        onClose={() => setEditingGame(null)} 
        onUpdated={fetchJobs} 
      />
    </Layout>
  );
}