import React, { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { 
  Card, 
  CardContent, 
  CardHeader 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Trophy, 
  Search, 
  Plus, 
  Calendar, 
  ChevronRight, 
  Video, 
  Activity,
  History,
  Filter
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EditGameTeamsModal } from "@/components/EditGameTeamsModal";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { NewGameModal } from "@/components/NewGameModal";
import { useUploads } from "@/contexts/UploadContext";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, Loader2, AlertCircle, XCircle } from "lucide-react";
import { useRouter } from "next/router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Info } from "lucide-react";

export default function GamesPage() {
  const { activeUploads, cancelUpload } = useUploads();
  const router = useRouter();
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
  const [isWaitModalOpen, setIsWaitModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedGameForEdit, setSelectedGameForEdit] = useState<any>(null);

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("games")
      .select(`
        *,
        home_team:teams!games_home_team_id_fkey(name, logo_url),
        away_team:teams!games_away_team_id_fkey(name, logo_url)
      `)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setGames(data);
    }
    setLoading(false);
  };

  const handleUploadSuccess = async (gameId: string) => {
    setIsNewGameModalOpen(false);
    
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (data) {
      setSelectedGameForEdit(data);
      setIsEditModalOpen(true);
    }
  };

  const handleGameClick = (game: any) => {
    // 1. Check if upload is currently in progress
    const isUploading = activeUploads.some(u => u.gameId === game.id);
    if (isUploading) {
      setIsWaitModalOpen(true);
      return;
    }

    // 2. Check if video has been uploaded
    if (!game.video_path) {
      setIsNewGameModalOpen(true);
      return;
    }

    // 3. Successful verification -> proceed
    router.push(`/games/${game.id}`);
  };

  const filteredGames = games.filter(game => {
    const searchStr = `${game.home_team?.name} ${game.away_team?.name} ${game.status}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  return (
    <Layout title="Games Archive | DribbleStats AI">
      <div className="space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent uppercase">
              Games Archive
            </h1>
            <p className="text-muted-foreground text-sm font-medium">Manage historical footage and AI game analysis.</p>
          </div>
          <NewGameModal open={isNewGameModalOpen} onOpenChange={setIsNewGameModalOpen} />
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search by team name or status..." 
              className="pl-11 h-12 bg-card/50 border-border rounded-xl focus:ring-primary/20 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-12 w-full md:w-auto rounded-xl gap-2 border-border/50 bg-card/30 font-bold px-6">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>

        {/* Active Background Uploads */}
        {activeUploads.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
              <UploadCloud className="h-4 w-4 animate-bounce" /> Active Intelligence Streams
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeUploads.map((upload) => (
                <Card key={upload.id} className="bg-primary/5 border-primary/20 backdrop-blur-md relative overflow-hidden group">
                  <div className="absolute top-0 left-0 h-full bg-primary/5 transition-all duration-500" style={{ width: `${upload.progress}%` }} />
                  <CardHeader className="p-4 pb-2 relative z-10">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="text-xs font-bold truncate max-w-[200px]">{upload.fileName}</p>
                        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-tighter">
                          {upload.status === 'uploading' ? 'Streaming to R2' : upload.status === 'processing' ? 'Igniting GPU Swarm' : 'Finalizing'}
                        </p>
                      </div>
                      <button 
                        onClick={() => cancelUpload(upload.id)}
                        className="text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 relative z-10">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-black font-mono">
                        <span className={cn(
                          upload.status === 'failed' ? "text-red-500" : "text-primary"
                        )}>
                          {upload.status === 'failed' ? 'ERROR' : `${Math.round(upload.progress)}%`}
                        </span>
                        {upload.status !== 'failed' && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                      </div>
                      <Progress value={upload.progress} className="h-1 bg-white/5" />
                      {upload.error && (
                        <p className="text-[9px] text-red-400 font-medium leading-tight mt-1 truncate">
                          {upload.error}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-muted/10 animate-pulse border border-border/50" />
            ))}
          </div>
        ) : filteredGames.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredGames.map((game) => (
              <div key={game.id} onClick={() => handleGameClick(game)}>
                <Card className="bg-card/40 border-border/40 hover:border-primary/40 transition-all cursor-pointer group hover:shadow-2xl hover:shadow-primary/5 rounded-2xl overflow-hidden flex flex-col h-full backdrop-blur-sm">
                  <div className="h-1.5 bg-muted/20 w-full overflow-hidden shrink-0">
                    <div 
                      className={cn(
                        "h-full transition-all duration-1000 ease-out",
                        game.status === 'completed' ? 'bg-emerald-500' : 'bg-primary'
                      )} 
                      style={{ width: game.status === 'completed' ? '100%' : '45%' }} 
                    />
                  </div>
                  <CardHeader className="p-5 pb-2 shrink-0">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-md",
                          game.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                          game.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                          'bg-primary/10 text-primary border-primary/20'
                        )}
                      >
                        {game.status === 'pending' ? 'Awaiting Analysis' : game.status}
                      </Badge>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono uppercase tracking-widest font-bold">
                        <Calendar className="h-3 w-3" />
                        {new Date(game.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between gap-2 py-4 px-2 bg-white/5 rounded-xl border border-white/5">
                      <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                        <div className="h-14 w-14 rounded-full bg-background/50 flex items-center justify-center border border-border/50 group-hover:border-primary/20 transition-all shadow-inner">
                          {game.home_team?.logo_url ? (
                            <img src={game.home_team.logo_url} alt="" className="h-8 w-8 object-contain" />
                          ) : (
                            <Trophy className="h-7 w-7 text-muted-foreground/50 group-hover:text-primary/50 transition-colors" />
                          )}
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-tight text-center w-full truncate px-1">
                          {game.home_team?.name || 'Home Team'}
                        </span>
                      </div>
                      
                      <div className="flex flex-col items-center justify-center gap-1 shrink-0">
                        <span className="text-xs font-black italic text-muted-foreground/20 leading-none">VS</span>
                        <div className="h-px w-4 bg-white/10" />
                      </div>
                      
                      <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                        <div className="h-14 w-14 rounded-full bg-background/50 flex items-center justify-center border border-border/50 group-hover:border-primary/20 transition-all shadow-inner">
                          {game.away_team?.logo_url ? (
                            <img src={game.away_team.logo_url} alt="" className="h-8 w-8 object-contain" />
                          ) : (
                            <Trophy className="h-7 w-7 text-muted-foreground/50 group-hover:text-primary/50 transition-colors" />
                          )}
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-tight text-center w-full truncate px-1">
                          {game.away_team?.name || 'Away Team'}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 pt-4 mt-auto">
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <div className="flex gap-5">
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-black tracking-tighter">
                          <Video className="h-3.5 w-3.5 text-accent" /> 
                          <span className="text-white/80">12</span> <span className="hidden sm:inline">Clips</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-black tracking-tighter">
                          <Activity className="h-3.5 w-3.5 text-primary" /> 
                          <span className="text-white/80">142</span> <span className="hidden sm:inline">Events</span>
                        </div>
                      </div>
                      <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                        <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        ) : (
          <Card className="bg-card/20 border-dashed border-2 border-border/50 p-12 sm:p-24 text-center rounded-3xl backdrop-blur-sm">
            <div className="space-y-6 max-w-sm mx-auto">
              <div className="h-24 w-24 bg-primary/5 rounded-full flex items-center justify-center mx-auto border border-primary/10">
                <History className="h-12 w-12 text-primary/40" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black uppercase tracking-tighter">No Games Found</h3>
                <p className="text-muted-foreground text-sm font-medium">
                  Your scouting library is empty.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Wait Modal for In-Progress Uploads */}
      <AlertDialog open={isWaitModalOpen} onOpenChange={setIsWaitModalOpen}>
        <AlertDialogContent className="bg-background border-white/5 rounded-3xl p-8">
          <AlertDialogHeader className="space-y-4">
            <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <AlertDialogTitle className="text-2xl font-black uppercase tracking-tighter text-center">
              Intelligence Stream Active
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground font-medium text-center">
              Please wait until the video has finished streaming to the R2 cluster. 
              Navigating now would break the calibration sequence.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8">
            <AlertDialogAction className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest italic rounded-xl w-full">
              Acknowledged
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between mb-12">
        <div className="space-y-1">
          <h1 className="text-4xl font-black uppercase tracking-tighter italic italic flex items-center gap-3">
            <History className="h-8 w-8 text-primary" />
            Game <span className="text-primary not-italic">Archive</span>
          </h1>
          <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest">Historical Payload Registry</p>
        </div>
      </div>

      <EditGameTeamsModal 
        game={selectedGameForEdit}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onUpdated={() => {
          fetchGames();
          setIsEditModalOpen(false);
        }}
      />
    </Layout>
  );
}