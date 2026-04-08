import React, { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShotChart, Shot } from "@/components/Court"; // I'll fix the import in next iteration
import { 
  Play, 
  Target, 
  Activity, 
  History, 
  ChevronRight,
  TrendingUp,
  Cpu,
  Download
} from "lucide-react";
import { ShotChart as ShotChartComponent } from "@/components/ShotChart";

const MOCK_SHOTS: Shot[] = [
  { id: "1", x: 250, y: 52, is_made: true, player_name: "Steph Curry", shot_type: "Layup", timestamp: "Q1 08:45" },
  { id: "2", x: 100, y: 140, is_made: true, player_name: "Klay Thompson", shot_type: "3PT Jumper", timestamp: "Q1 07:12" },
  { id: "3", x: 400, y: 140, is_made: false, player_name: "Jordan Poole", shot_type: "3PT Jumper", timestamp: "Q1 05:30" },
  { id: "4", x: 250, y: 250, is_made: true, player_name: "Steph Curry", shot_type: "Midrange Jumper", timestamp: "Q1 04:15" },
  { id: "5", x: 50, y: 50, is_made: false, player_name: "Draymond Green", shot_type: "Hook Shot", timestamp: "Q1 02:10" },
];

export default function Home() {
  return (
    <Layout title="Dashboard | CourtVision Elite">
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-accent/50 text-accent font-mono text-[10px] uppercase tracking-widest px-2">
                System Status: Ready
              </Badge>
              <Badge variant="outline" className="border-primary/50 text-primary font-mono text-[10px] uppercase tracking-widest px-2">
                YOLOv11m Optimized
              </Badge>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">Game Analysis</h1>
            <p className="text-muted-foreground max-w-xl">
              Advanced tactical scouting powered by computer vision. Upload a YouTube link to begin automated clip extraction and shot tracking.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="h-12 px-6 rounded-xl border-border bg-card/50 hover:bg-secondary transition-all">
              <History className="mr-2 h-4 w-4" />
              Recent Games
            </Button>
            <Button className="h-12 px-8 rounded-xl bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all">
              <Play className="mr-2 h-4 w-4 fill-current" />
              New Session
            </Button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Active Models", value: "3", icon: Cpu, color: "text-accent" },
            { label: "Total Clips", value: "1,248", icon: Play, color: "text-primary" },
            { label: "Tracking Accuracy", value: "98.4%", icon: Target, color: "text-emerald-400" },
            { label: "Processing Speed", value: "0.4s/f", icon: TrendingUp, color: "text-blue-400" },
          ].map((stat, i) => (
            <Card key={i} className="glass-card border-none overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                    <p className="text-2xl font-mono font-bold">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-lg bg-white/5 ${stat.color} group-hover:scale-110 transition-transform`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 glass-card border-none">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Latest Game Analysis
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                View Full Table <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="aspect-video rounded-2xl bg-muted/30 border border-white/5 flex items-center justify-center group cursor-pointer relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                  <div className="space-y-1">
                    <p className="font-bold">GSW vs BOS - Q3 Highlights</p>
                    <p className="text-sm text-muted-foreground">Processed with YOLOv11m • 14 Clips detected</p>
                  </div>
                </div>
                <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center shadow-2xl scale-90 group-hover:scale-100 transition-transform">
                  <Play className="h-6 w-6 text-white fill-current translate-x-0.5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-none">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-accent" />
                Shot Chart
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <Download className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <ShotChartComponent shots={MOCK_SHOTS} />
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}