import React, { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  ResponsiveContainer 
} from "recharts";
import { 
  Target, 
  Zap, 
  Users, 
  BarChart3, 
  Download,
  Activity,
  ChevronRight,
  UserCheck
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ShotChart } from "@/components/ShotChart";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any[]>([]);
  const [shots, setShots] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState<string>("all");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Fetch player stats
      const { data: pStats } = await supabase
        .from("player_game_stats")
        .select(`
          *,
          player:players(name, number),
          game:games(home_team_id, away_team_id)
        `);
      
      if (pStats) setStats(pStats);

      // Mock shots for visualization if none exist
      setShots([
        { id: "1", x: 25, y: 10, is_make: true, player_name: "J. Smith", shot_type: "Layup" },
        { id: "2", x: 40, y: 15, is_make: false, player_name: "A. Johnson", shot_type: "3PT Jumper" },
        { id: "3", x: 10, y: 20, is_make: true, player_name: "M. Brown", shot_type: "Mid-range" },
        { id: "4", x: 25, y: 5, is_make: true, player_name: "J. Smith", shot_type: "Dunk" },
        { id: "5", x: 35, y: 35, is_make: false, player_name: "R. Williams", shot_type: "Deep 3" },
      ]);
      
      setLoading(false);
    };
    fetchData();
  }, []);

  return (
    <Layout title="Elite Scout | Analytics Dashboard" description="Tactical basketball personnel analysis.">
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] font-mono text-accent uppercase tracking-widest">Live Scout Feed Active</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Elite Scout Analytics</h1>
            <p className="text-muted-foreground text-sm">Deep personnel mapping and tactical shot distribution.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="bg-card/50 border-white/10 h-9 font-mono text-[11px] uppercase tracking-wider">
              <Download className="h-3.5 w-3.5 mr-2" />
              Export Report
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90 h-9 font-mono text-[11px] uppercase tracking-wider">
              <Activity className="h-3.5 w-3.5 mr-2" />
              Real-time Sync
            </Button>
          </div>
        </div>

        {/* Tactical Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Personnel Table */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-card/30 backdrop-blur-md border-white/5 overflow-hidden">
              <CardHeader className="bg-white/[0.02] border-b border-white/5 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-primary/10 text-primary">
                      <UserCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold uppercase tracking-wider">Personnel Efficiency</CardTitle>
                      <CardDescription className="text-[10px] font-mono uppercase">Player performance mapping</CardDescription>
                    </div>
                  </div>
                  <Select value={selectedGame} onValueChange={setSelectedGame}>
                    <SelectTrigger className="w-[180px] h-8 bg-black/20 border-white/10 text-[11px]">
                      <SelectValue placeholder="All Sessions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sessions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader className="bg-white/[0.01]">
                      <TableRow className="border-white/5 hover:bg-transparent">
                        <TableHead className="text-[10px] font-mono uppercase tracking-widest">Player</TableHead>
                        <TableHead className="text-[10px] font-mono uppercase tracking-widest text-center">PTS</TableHead>
                        <TableHead className="text-[10px] font-mono uppercase tracking-widest text-center">FG%</TableHead>
                        <TableHead className="text-[10px] font-mono uppercase tracking-widest text-center">REB</TableHead>
                        <TableHead className="text-[10px] font-mono uppercase tracking-widest text-center">AST</TableHead>
                        <TableHead className="text-[10px] font-mono uppercase tracking-widest text-right">Efficiency</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.map((row, i) => (
                        <TableRow key={i} className="border-white/5 hover:bg-white/[0.02] group">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-primary font-bold">#{row.player?.number || '00'}</span>
                              <span className="font-medium">{row.player?.name || 'Unknown Player'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-foreground/90">{row.pts || 0}</TableCell>
                          <TableCell className="text-center font-mono">
                            <Badge variant="outline" className="border-white/10 font-mono text-[10px] bg-black/20">
                              {((row.fgm / (row.fga || 1)) * 100).toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-mono">{row.reb || 0}</TableCell>
                          <TableCell className="text-center font-mono">{row.ast || 0}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary" 
                                  style={{ width: `${Math.min((row.pts / 30) * 100, 100)}%` }}
                                />
                              </div>
                              <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-card/30 border-white/5">
                <CardHeader>
                  <CardTitle className="text-xs uppercase tracking-widest font-mono flex items-center gap-2">
                    <BarChart3 className="h-3 w-3 text-accent" />
                    Volume Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.slice(0, 5)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                      <XAxis dataKey="player.name" hide />
                      <YAxis hide />
                      <ChartTooltip 
                        contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a' }}
                        itemStyle={{ color: '#fff', fontSize: '10px' }}
                      />
                      <Bar dataKey="fga" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              
              <Card className="bg-card/30 border-white/5">
                <CardHeader>
                  <CardTitle className="text-xs uppercase tracking-widest font-mono flex items-center gap-2">
                    <Zap className="h-3 w-3 text-primary" />
                    Impact Rating
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center h-[200px]">
                  <div className="text-5xl font-bold font-mono text-primary">84.2</div>
                  <div className="text-[10px] uppercase font-mono text-muted-foreground mt-2">Team Efficiency Index</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Column: Shot Chart */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="bg-card/30 backdrop-blur-md border-white/5">
              <CardHeader className="bg-white/[0.02] border-b border-white/5 py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-accent/10 text-accent">
                    <Target className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold uppercase tracking-wider">Shot Distribution</CardTitle>
                    <CardDescription className="text-[10px] font-mono uppercase">Tactical floor mapping</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <ShotChart shots={shots} />
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground">Paint Dominance</span>
                    <span className="text-xs font-bold text-foreground">62%</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-accent w-[62%]" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground">Perimeter Volume</span>
                    <span className="text-xs font-bold text-foreground">38%</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-[38%]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/30 border-white/5 p-4">
              <h4 className="text-[10px] uppercase font-mono tracking-widest text-accent mb-4">Tactical Summary</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Elite AI detection indicates heavy interior rotation. Player #24 showing high efficiency in transitional mid-range scenarios. Personnel mapping complete for 12/12 roster entities.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}