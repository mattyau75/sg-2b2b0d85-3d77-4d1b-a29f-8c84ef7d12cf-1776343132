import React, { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
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
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function GamesPage() {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const filteredGames = games.filter(game => {
    const searchStr = `${game.home_team?.name} ${game.away_team?.name} ${game.status}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  return (
    <Layout title="Games Directory | CourtVision Elite">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
              <Trophy className="h-10 w-10 text-primary" />
              GAMES <span className="text-primary">DIRECTORY</span>
            </h1>
            <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest">
              Review and manage your scouting analysis sessions
            </p>
          </div>
          <Button 
            onClick={() => setIsModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-white font-bold px-6 h-12 rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 gap-2"
          >
            <Plus className="h-5 w-5" />
            ANALYZE NEW GAME
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search by team name or status..." 
              className="pl-11 h-12 bg-card/50 border-border rounded-xl focus:ring-primary/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-12 rounded-xl gap-2 border-border/50 bg-card/30">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-2xl bg-muted/20 animate-pulse border border-border/50" />
            ))}
          </div>
        ) : filteredGames.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGames.map((game) => (
              <Link key={game.id} href={`/games/${game.id}`}>
                <Card className="bg-card/50 border-border hover:border-primary/50 transition-all cursor-pointer group hover:shadow-xl hover:shadow-primary/5 rounded-2xl overflow-hidden flex flex-col h-full">
                  <div className="h-2 bg-muted/30 w-full overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-1000" style={{ width: game.status === 'completed' ? '100%' : '45%' }} />
                  </div>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-mono text-[10px] uppercase tracking-tighter">
                        {game.status}
                      </Badge>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                        <Calendar className="h-3 w-3" />
                        {new Date(game.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-2">
                      <div className="flex flex-col items-center gap-1 flex-1 text-center">
                        <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center border border-border/50 group-hover:border-primary/30 transition-colors">
                          <Trophy className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <span className="text-sm font-bold truncate w-full">{game.home_team?.name || 'Home Team'}</span>
                      </div>
                      <div className="text-xl font-black italic text-muted-foreground/30">VS</div>
                      <div className="flex flex-col items-center gap-1 flex-1 text-center">
                        <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center border border-border/50 group-hover:border-primary/30 transition-colors">
                          <Trophy className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <span className="text-sm font-bold truncate w-full">{game.away_team?.name || 'Away Team'}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="mt-auto pt-0">
                    <div className="flex items-center justify-between pt-4 border-t border-border/50">
                      <div className="flex gap-4">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">
                          <Video className="h-3 w-3 text-accent" /> Clips: 12
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">
                          <Activity className="h-3 w-3 text-primary" /> Events: 142
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="bg-card/30 border-dashed border-2 border-border p-24 text-center rounded-3xl">
            <div className="space-y-4 max-w-sm mx-auto">
              <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20">
                <History className="h-10 w-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">No Games Analyzed Yet</h3>
                <p className="text-muted-foreground text-sm">
                  Your scouting library is currently empty. Start by uploading a YouTube game link for AI processing.
                </p>
              </div>
              <Button 
                onClick={() => setIsModalOpen(true)}
                className="bg-primary hover:bg-primary/90 text-white font-bold px-8 rounded-xl shadow-lg shadow-primary/20"
              >
                Analyze First Game
              </Button>
            </div>
          </Card>
        )}
      </div>

      <NewGameModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </Layout>
  );
}