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
import { NewGameModal } from "@/components/NewGameModal";
import { EditGameTeamsModal } from "@/components/EditGameTeamsModal";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function GamesPage() {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
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

  const filteredGames = games.filter(game => {
    const searchStr = `${game.home_team?.name} ${game.away_team?.name} ${game.status}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  return (
    <Layout title="Games Directory | DribbleStats AI Elite">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent uppercase">
              Games Directory
            </h1>
            <p className="text-muted-foreground text-sm font-medium">Manage historical footage and AI scouting reports.</p>
          </div>
          <Button 
            className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all duration-300 h-12 rounded-xl font-bold px-6 shrink-0"
            onClick={() => setIsNewGameModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            ADD NEW GAME
          </Button>
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

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-muted/10 animate-pulse border border-border/50" />
            ))}
          </div>
        ) : filteredGames.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredGames.map((game) => (
              <Link key={game.id} href={`/games/${game.id}`}>
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
                          game.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-primary/10 text-primary border-primary/20'
                        )}
                      >
                        {game.status}
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
              </Link>
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
                  Your scouting library is empty. Upload your first game link to ignite the AI engine.
                </p>
              </div>
              <Button 
                onClick={() => setIsNewGameModalOpen(true)}
                className="bg-primary hover:bg-primary/90 text-white font-black px-10 h-12 rounded-xl shadow-xl shadow-primary/20 uppercase tracking-widest text-xs"
              >
                Analyze First Game
              </Button>
            </div>
          </Card>
        )}
      </div>

      <NewGameModal 
        isOpen={isNewGameModalOpen} 
        onClose={() => setIsNewGameModalOpen(false)} 
        onUploadSuccess={handleUploadSuccess}
      />

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