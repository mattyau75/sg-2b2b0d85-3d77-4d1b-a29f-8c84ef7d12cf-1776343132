import React, { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import {
  Cpu,
  Activity,
  Clock,
  AlertCircle,
  RefreshCw,
  Play,
  CheckCircle2,
  ExternalLink,
  Trash2,
  XCircle,
  UploadCloud } from
"lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUploads } from "@/contexts/UploadContext";
import Link from "next/link";
import { cn } from "@/lib/utils";
import axios from "axios";

const STATUS_CONFIG: Record<string, {label: string;color: string;progress: number;}> = {
  'queued': { label: 'In Queue', color: 'text-primary', progress: 15 },
  'processing': { label: 'Detecting Players', color: 'text-blue-400', progress: 35 },
  'analyzing': { label: 'Analyzing Plays', color: 'text-purple-400', progress: 65 },
  'finalizing': { label: 'Finalizing Boxscore', color: 'text-accent', progress: 90 },
  'completed': { label: 'Analysis Ready', color: 'text-emerald-400', progress: 100 },
  'error': { label: 'System Error', color: 'text-destructive', progress: 0 }
};

export default function AnalysisQueuePage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { activeUploads, cancelUpload } = useUploads();
  const { toast } = useToast();

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase.
      from('games').
      select(`
          *,
          home_team:teams!games_home_team_id_fkey(name),
          away_team:teams!games_away_team_id_fkey(name)
        `).
      neq('status', 'scheduled').
      order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (err) {
      console.error("Fetch jobs error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("games")
        .select(`
          id, 
          status, 
          created_at,
          video_path,
          home_team:teams!games_home_team_id_fkey(name),
          away_team:teams!games_away_team_id_fkey(name)
        `)
        .in('status', ['pending', 'processing', 'failed'])
        .order("created_at", { ascending: false });
    } catch (err) {
      console.error("Fetch queue error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games' },
        (payload) => {
          console.log('[Queue] Realtime Update Received:', payload);
          fetchJobs(); // Refresh the list on any change
        }
      )
      .subscribe((status) => {
        if (status === 'CLOSED') {
          console.warn('[Queue] WebSocket closed. Re-subscribing...');
          setTimeout(() => channel.subscribe(), 1000);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRetry = async (id: string) => {
    setIsRefreshing(true);
    try {
      // 1. Fetch game data with robust team relation mapping
      const { data: game, error: fetchError } = await supabase
        .from('games')
        .select(`
          *,
          home_team:teams!games_home_team_id_fkey(id, name),
          away_team:teams!games_away_team_id_fkey(id, name)
        `)
        .eq('id', id)
        .single();

      if (fetchError || !game) throw fetchError || new Error("Game not found");

      // 2. Trigger the GPU analysis API with safe fallbacks
      const payload = { 
        gameId: id,
        videoPath: game.video_path,
        homeTeam: game.home_team?.name || "Home Team",
        awayTeam: game.away_team?.name || "Away Team",
        homeColor: game.detected_home_color || "#FFFFFF",
        awayColor: game.detected_away_color || "#0B0F19",
        settings: {
          inference_mode: "high_accuracy",
          temporal_tracking: true
        }
      };

      console.log("[Queue] Re-triggering with payload:", payload);
      await axios.post("/api/process-game", payload);

      toast({ 
        title: "Analysis Re-triggered", 
        description: `GPU re-engaged for ${payload.homeTeam} vs ${payload.awayTeam}.` 
      });
      fetchJobs();
    } catch (err: any) {
      console.error("[Queue] Retry failed:", err);
      toast({ title: "Re-trigger Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this analysis? All associated stats and highlights will be lost.")) return;

    try {
      const { error } = await supabase.from('games').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Job Deleted", description: "Analysis record has been removed." });
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    }
  };

  const activeJobs = jobs.filter((j) => j.status !== 'completed' && j.status !== 'error');
  const finishedJobs = jobs.filter((j) => j.status === 'completed' || j.status === 'error');

  return (
    <Layout title="Analysis Queue | CourtVision Elite">
      <div className="space-y-8 pb-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold tracking-tight">Processing Queue</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary animate-pulse" />
            Monitoring {activeJobs.length + activeUploads.length} active GPU analysis jobs on A100 cluster
          </p>
        </div>

        {/* Active Uploads Section */}
        {activeUploads.length > 0 &&
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-primary">
              <UploadCloud className="h-3 w-3" /> Live Video Uploads
            </div>
            <div className="grid grid-cols-1 gap-4">
              {activeUploads.map((upload) =>
            <Card key={upload.id} className="bg-primary/5 border-primary/20 overflow-hidden relative group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-bold">{upload.fileName}</h3>
                          <Badge variant="outline" className="capitalize font-mono text-[10px] text-primary border-primary/30">
                            Uploading
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">
                          Direct R2 Stream active...
                        </p>
                      </div>
                      
                      <div className="w-full md:w-64 space-y-2">
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-muted-foreground uppercase">Progress</span>
                          <span className="font-bold text-primary">{upload.progress}%</span>
                        </div>
                        <Progress value={upload.progress} className="h-1.5 bg-primary/10" />
                      </div>

                      <div className="flex items-center gap-2">
                         <Button
                      variant="outline"
                      size="sm"
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive h-10 px-4"
                      onClick={() => cancelUpload(upload.id)}>
                      
                           <XCircle className="h-4 w-4 mr-2" /> Cancel
                         </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
            )}
            </div>
          </div>
        }

        {/* Active Analysis Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
            <Cpu className="h-3 w-3" /> Active GPU Processing
          </div>
          
          {activeJobs.length > 0 ?
          <div className="grid grid-cols-1 gap-4">
              {activeJobs.map((job) => {
              const config = STATUS_CONFIG[job.status] || { label: job.status, color: 'text-primary', progress: 10 };
              return (
                <Card key={job.id} className="bg-card/30 border-border overflow-hidden relative group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold">{job.home_team?.name} vs {job.away_team?.name}</h3>
                            <Badge variant="outline" className={cn("capitalize font-mono text-[10px]", config.color)}>
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono truncate max-w-md">
                            Source: {job.youtube_url || job.video_path}
                          </p>
                        </div>
                        
                        <div className="w-full md:w-64 space-y-2">
                          <div className="flex justify-between text-[10px] font-mono">
                            <span className="text-muted-foreground uppercase">Progress</span>
                            <span className={cn("font-bold", config.color)}>{config.progress}%</span>
                          </div>
                          <Progress value={config.progress} className="h-1.5" />
                        </div>

                        <div className="flex items-center gap-2">
                           <Button 
                             variant="outline" 
                             size="sm" 
                             className="h-10 border-primary/20 hover:bg-primary/5"
                             onClick={() => handleRetry(job.id)}
                           >
                             <RefreshCw className="h-4 w-4 mr-2" /> Restart
                           </Button>
                           <Button variant="ghost" size="sm" asChild className="h-10 w-10">
                             <Link href={`/games/${job.id}`}>
                               <ExternalLink className="h-4 w-4" />
                             </Link>
                           </Button>
                           <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-10 w-10"
                          onClick={() => handleDelete(job.id)}>
                          
                             <Trash2 className="h-4 w-4" />
                           </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>);

            })}
            </div> :

          activeUploads.length === 0 &&
          <Card className="bg-card/20 border-dashed border-border py-12 flex flex-col items-center justify-center text-center">
                <Clock className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-bold text-muted-foreground">No Active Jobs</h3>
                <p className="text-xs text-muted-foreground/60 max-w-xs mt-2">
                  Initiate a new game analysis from the dashboard to see processing updates here.
                </p>
              </Card>

          }
        </div>

        {/* History / Error Section */}
        <div className="space-y-4">
           <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
            <RefreshCw className="h-3 w-3" /> Recent History
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            {finishedJobs.map((job) =>
            <div key={job.id} className="flex items-center justify-between p-4 rounded-xl bg-card/20 border border-border/50 hover:bg-card/30 transition-colors">
                <div className="flex items-center gap-4">
                  {job.status === 'error' ?
                <AlertCircle className="h-5 w-5 text-destructive" /> :

                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                }
                  <div>
                    <h4 className="text-sm font-bold">{job.home_team?.name} vs {job.away_team?.name}</h4>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {new Date(job.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {job.status === 'error' &&
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2 text-xs"
                  onClick={() => handleRetry(job.id)}>
                  
                      <RefreshCw className="h-3 w-3" /> Retry
                    </Button>
                }
                  <Button variant="ghost" size="sm" asChild className="h-8">
                    <Link href={`/games/${job.id}`}>
                      {job.status === 'completed' ? 'View Results' : 'Check Logs'}
                    </Link>
                  </Button>
                  <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(job.id)}>
                  
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>);

}