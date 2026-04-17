import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { User, TrendingUp, Target, Shield, Activity, Download, ChevronLeft } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function PlayerAnalytics() {
  const router = useRouter();
  const { id } = router.query;
  const [player, setPlayer] = useState<any>(null);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchPlayerData();
    }
  }, [id]);

  const fetchPlayerData = async () => {
    try {
      setLoading(true);

      const { data: playerData } = await supabase
        .from("players")
        .select("*, team:teams(name)")
        .eq("id", id)
        .single();

      const { data: statsData } = await supabase
        .from("box_scores")
        .select(`
          *,
          game:games(id, venue, created_at)
        `)
        .eq("player_id", id)
        .order("created_at", { ascending: false })
        .limit(10);

      setPlayer(playerData);
      setStats(statsData || []);
    } finally {
      setLoading(false);
    }
  };

  const calculateAverages = () => {
    if (stats.length === 0) return { ppg: 0, rpg: 0, apg: 0, fgp: 0 };
    return {
      ppg: (stats.reduce((sum, s) => sum + (s.points || 0), 0) / stats.length).toFixed(1),
      rpg: (stats.reduce((sum, s) => sum + (s.rebounds || 0), 0) / stats.length).toFixed(1),
      apg: (stats.reduce((sum, s) => sum + (s.assists || 0), 0) / stats.length).toFixed(1),
      fgp: ((stats.reduce((sum, s) => sum + (s.fg_made || 0), 0) / stats.reduce((sum, s) => sum + (s.fg_attempted || 1), 0)) * 100).toFixed(1)
    };
  };

  const getPerformanceTrend = () => {
    return stats.slice(0, 5).reverse().map((s, i) => ({
      game: `G${i + 1}`,
      points: s.points || 0,
      rebounds: s.rebounds || 0,
      assists: s.assists || 0
    }));
  };

  const getDefensiveRadar = () => {
    const totals = stats.reduce((acc, s) => ({
      steals: acc.steals + (s.steals || 0),
      blocks: acc.blocks + (s.blocks || 0),
      rebounds: acc.rebounds + (s.rebounds || 0)
    }), { steals: 0, blocks: 0, rebounds: 0 });

    return [
      { metric: "Steals", value: totals.steals },
      { metric: "Blocks", value: totals.blocks },
      { metric: "Rebounds", value: totals.rebounds }
    ];
  };

  const averages = calculateAverages();

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`${player?.name} | Player Analytics`}>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                <span className="text-2xl font-black text-primary">#{player?.jersey_number}</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{player?.name}</h1>
                <p className="text-muted-foreground">{player?.team?.name} • {player?.position || "Guard"}</p>
              </div>
            </div>
          </div>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="glass-card border-none">
            <CardHeader className="pb-3">
              <CardDescription className="text-[10px] uppercase font-mono">Points Per Game</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-primary">{averages.ppg}</div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none">
            <CardHeader className="pb-3">
              <CardDescription className="text-[10px] uppercase font-mono">Rebounds Per Game</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-accent">{averages.rpg}</div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none">
            <CardHeader className="pb-3">
              <CardDescription className="text-[10px] uppercase font-mono">Assists Per Game</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-blue-400">{averages.apg}</div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none">
            <CardHeader className="pb-3">
              <CardDescription className="text-[10px] uppercase font-mono">Field Goal %</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-emerald-400">{averages.fgp}%</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass-card border-none">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Performance Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={getPerformanceTrend()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="game" stroke="#71717a" style={{ fontSize: '10px' }} />
                  <YAxis stroke="#71717a" style={{ fontSize: '10px' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff', fontSize: '11px' }}
                  />
                  <Line type="monotone" dataKey="points" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="rebounds" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="assists" stroke="#60a5fa" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass-card border-none">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" /> Defensive Impact
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={getDefensiveRadar()}>
                  <PolarGrid stroke="#27272a" />
                  <PolarAngleAxis dataKey="metric" stroke="#71717a" style={{ fontSize: '11px' }} />
                  <PolarRadiusAxis stroke="#71717a" />
                  <Radar name="Defense" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card border-none">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Game Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Date</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground">Venue</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">PTS</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">REB</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">AST</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-muted-foreground text-center">FG%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((stat) => (
                  <TableRow key={stat.id} className="border-white/5 hover:bg-white/5">
                    <TableCell className="font-mono text-xs">
                      {stat.game?.created_at ? new Date(stat.game.created_at).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm">{stat.game?.venue || 'Unknown'}</TableCell>
                    <TableCell className="text-center font-bold text-primary">{stat.points || 0}</TableCell>
                    <TableCell className="text-center font-mono text-xs">{stat.rebounds || 0}</TableCell>
                    <TableCell className="text-center font-mono text-xs">{stat.assists || 0}</TableCell>
                    <TableCell className="text-center font-mono text-xs">
                      {stat.fg_attempted ? ((stat.fg_made / stat.fg_attempted) * 100).toFixed(1) : '0.0'}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}