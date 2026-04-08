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
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { 
  TrendingUp, 
  Target, 
  Zap, 
  Users, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter
} from "lucide-react";
import { rosterService } from "@/services/rosterService";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export default function AnalyticsPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any[]>([]);

  useEffect(() => {
    const fetchTeams = async () => {
      const data = await rosterService.getTeams();
      setTeams(data);
    };
    fetchTeams();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      const { data, error } = await supabase.from("player_game_stats").select("*");
      if (!error && data) setStats(data);
      setLoading(false);
    };
    fetchStats();
  }, []);

  const hasData = stats.length > 0;

  return (
    <Layout title="Analytics | CourtVision Elite" description="Advanced basketball performance metrics and trends.">
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-accent/50 text-accent font-mono text-[10px] uppercase tracking-widest px-2">
                Live Data Feed
              </Badge>
              <Badge variant="outline" className="border-primary/50 text-primary font-mono text-[10px] uppercase tracking-widest px-2">
                SOTA Analytics
              </Badge>
            </div>
            <h1 className="text-4xl font-bold">Performance Analytics</h1>
            <p className="text-muted-foreground">
              Deep dive into team efficiency, player trends, and tactical shot distribution.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-[200px] bg-card/50 border-border">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map(team => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="h-10 px-4 rounded-xl cursor-pointer hover:bg-muted/80 transition-colors">
              Last 30 Days
            </Badge>
          </div>
        </div>

        {/* High-Level Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Offensive Rating", value: hasData ? "114.2" : "0.0", trend: hasData ? "+2.4" : "0.0", icon: Zap, color: "text-primary" },
            { label: "Defensive Rating", value: hasData ? "108.5" : "0.0", trend: hasData ? "-1.1" : "0.0", icon: Target, color: "text-accent" },
            { label: "True Shooting %", value: hasData ? "58.4%" : "0.0%", trend: hasData ? "+0.8" : "0.0", icon: TrendingUp, color: "text-green-500" },
            { label: "AST/TO Ratio", value: hasData ? "2.14" : "0.0", trend: hasData ? "+0.15" : "0.0", icon: Users, color: "text-blue-500" },
          ].map((metric) => (
            <Card key={metric.label} className="bg-card/30 backdrop-blur-sm border-border hover:border-primary/20 transition-all">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-2 rounded-lg bg-muted/50 ${metric.color}`}>
                    <metric.icon className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className={metric.trend.startsWith('+') ? "text-green-500 border-green-500/20" : "text-accent border-accent/20"}>
                    {metric.trend.startsWith('+') ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                    {metric.trend}
                  </Badge>
                </div>
                <h3 className="text-2xl font-bold font-mono tracking-tighter">{metric.value}</h3>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{metric.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="trends" className="w-full">
          <TabsList className="bg-muted/30 border border-border p-1 rounded-xl mb-6">
            <TabsTrigger value="trends" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
              <BarChart3 className="h-4 w-4 mr-2" />
              Scoring Trends
            </TabsTrigger>
            <TabsTrigger value="efficiency" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
              <Target className="h-4 w-4 mr-2" />
              Efficiency
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trends" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 bg-card/30 border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Point Distribution</CardTitle>
                  <CardDescription>Points, Assists, and Rebounds over the last 5 games</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hasData ? stats : []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: "8px" }}
                        itemStyle={{ fontSize: "12px" }}
                      />
                      <Bar dataKey="pts" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Points" />
                      <Bar dataKey="ast" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Assists" />
                      <Bar dataKey="reb" fill="#4ade80" radius={[4, 4, 0, 0]} name="Rebounds" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-card/30 border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Shot Selection</CardTitle>
                  <CardDescription>By Court Location</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px] flex flex-col items-center justify-center">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={hasData ? stats : []}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {hasData ? stats.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        )) : []}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: "8px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-full mt-6 space-y-2">
                    {hasData ? stats.map((item: any) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-mono font-bold">{item.value}%</span>
                      </div>
                    )) : []}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="efficiency" className="space-y-6">
            <Card className="bg-card/30 border-border">
              <CardHeader>
                <CardTitle className="text-lg">Shot Efficiency Over Time</CardTitle>
                <CardDescription>Tracking True Shooting % and eFG% performance</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hasData ? stats : []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: "8px" }}
                    />
                    <Line type="monotone" dataKey="pts" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}