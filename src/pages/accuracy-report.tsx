import React, { useState } from "react";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, CheckCircle2, AlertTriangle, Target, BarChart3, Search, Play, ZoomIn } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { cn } from "@/lib/utils";

const MOCK_TEMPORAL_DATA = [
  { frame: 1, confidence: 45, guess: "23" },
  { frame: 5, confidence: 48, guess: "23" },
  { frame: 10, confidence: 52, guess: "23" },
  { frame: 15, confidence: 35, guess: "28" },
  { frame: 20, confidence: 65, guess: "23" },
  { frame: 25, confidence: 88, guess: "23" },
  { frame: 30, confidence: 94, guess: "23" },
  { frame: 35, confidence: 96, guess: "23" },
  { frame: 40, confidence: 98, guess: "23" },
];

const MOCK_CLIPS = [
  { id: 1, player: "LeBron James", number: "23", detected: "23", confidence: 98, status: "match", type: "Fast Break" },
  { id: 2, player: "Anthony Davis", number: "3", detected: "3", confidence: 92, status: "match", type: "Post Up" },
  { id: 3, player: "Austin Reaves", number: "15", detected: "18", confidence: 62, status: "mismatch", type: "Corner 3" },
  { id: 4, player: "D'Angelo Russell", number: "1", detected: "1", confidence: 85, status: "match", type: "Drive" },
];

export default function AccuracyReport() {
  const [selectedClip, setSelectedClip] = useState(MOCK_CLIPS[0]);

  return (
    <Layout>
      <SEO title="AI Accuracy Report | DribbleStats Elite" />
      
      <div className="space-y-8 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              AI Vision Audit
            </h1>
            <p className="text-muted-foreground">Verification of Temporal Voting & Jersey Recognition Engine.</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1">
              <Brain className="h-3 w-3 mr-2" />
              YOLOv11m Active
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-secondary/20 border-white/5 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center text-xs uppercase tracking-wider font-semibold text-primary">
                <Target className="h-3 w-3 mr-2" /> Global Accuracy
              </CardDescription>
              <CardTitle className="text-4xl font-mono text-white">94.2%</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={94.2} className="h-1 bg-white/5" indicatorClassName="bg-primary" />
              <p className="text-xs text-muted-foreground mt-3">+2.4% vs previous build (v8s)</p>
            </CardContent>
          </Card>

          <Card className="bg-secondary/20 border-white/5 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center text-xs uppercase tracking-wider font-semibold text-accent">
                <ZoomIn className="h-3 w-3 mr-2" /> ROI Upscale Gain
              </CardDescription>
              <CardTitle className="text-4xl font-mono text-white">3.2x</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={85} className="h-1 bg-white/5" indicatorClassName="bg-accent" />
              <p className="text-xs text-muted-foreground mt-3">Resolution multiplier for small numbers</p>
            </CardContent>
          </Card>

          <Card className="bg-secondary/20 border-white/5 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center text-xs uppercase tracking-wider font-semibold text-emerald-400">
                <CheckCircle2 className="h-3 w-3 mr-2" /> Temporal Stability
              </CardDescription>
              <CardTitle className="text-4xl font-mono text-white">42ms</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={90} className="h-1 bg-white/5" indicatorClassName="bg-emerald-400" />
              <p className="text-xs text-muted-foreground mt-3">Average time to identity lock</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-secondary/20 border-white/5 overflow-hidden">
              <CardHeader className="border-b border-white/5 bg-white/5 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-lg">
                      <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Temporal Voting Analysis</CardTitle>
                      <CardDescription>Visualizing identity confidence across 40 frames</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono bg-black/40">
                    ID Lock: Frame 25
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-[300px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={MOCK_TEMPORAL_DATA}>
                      <defs>
                        <linearGradient id="colorConf" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis 
                        dataKey="frame" 
                        stroke="rgba(255,255,255,0.4)" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        label={{ value: 'Frames In-Sight', position: 'insideBottom', offset: -5, fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                      />
                      <YAxis 
                        stroke="rgba(255,255,255,0.4)" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        domain={[0, 100]}
                        label={{ value: 'Confidence (%)', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0B0F19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        itemStyle={{ color: 'hsl(var(--primary))' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="confidence" 
                        stroke="hsl(var(--primary))" 
                        fillOpacity={1} 
                        fill="url(#colorConf)" 
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-center">
                    <p className="text-[10px] uppercase text-muted-foreground mb-1">Raw OCR Guess</p>
                    <p className="text-xl font-mono text-white">#23</p>
                  </div>
                  <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-center">
                    <p className="text-[10px] uppercase text-muted-foreground mb-1">Temporal Mean</p>
                    <p className="text-xl font-mono text-primary">#23.4</p>
                  </div>
                  <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-center">
                    <p className="text-[10px] uppercase text-muted-foreground mb-1">Roster Match</p>
                    <p className="text-xl font-mono text-emerald-400">#23</p>
                  </div>
                  <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-center">
                    <p className="text-[10px] uppercase text-muted-foreground mb-1">ROI Upscale</p>
                    <p className="text-xl font-mono text-accent">Active</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-secondary/20 border-white/5 overflow-hidden">
              <CardHeader className="border-b border-white/5 bg-white/5 px-6 py-4">
                <CardTitle className="text-lg">Mapping Truth Table</CardTitle>
                <CardDescription>Comparison of AI detections vs Manual Ground Truth</CardDescription>
              </CardHeader>
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="hover:bg-transparent border-white/5">
                    <TableHead className="text-white font-semibold">Player Name</TableHead>
                    <TableHead className="text-white font-semibold text-center">Roster #</TableHead>
                    <TableHead className="text-white font-semibold text-center">AI Detect</TableHead>
                    <TableHead className="text-white font-semibold text-center">Confidence</TableHead>
                    <TableHead className="text-white font-semibold text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_CLIPS.map((clip) => (
                    <TableRow 
                      key={clip.id} 
                      className={cn(
                        "border-white/5 transition-colors cursor-pointer",
                        selectedClip.id === clip.id ? "bg-primary/10" : "hover:bg-white/5"
                      )}
                      onClick={() => setSelectedClip(clip)}
                    >
                      <TableCell className="font-medium text-white">{clip.player}</TableCell>
                      <TableCell className="text-center font-mono">{clip.number}</TableCell>
                      <TableCell className="text-center font-mono">
                        <span className={clip.status === 'match' ? 'text-emerald-400' : 'text-destructive font-bold'}>
                          {clip.detected}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn(
                          "font-mono",
                          clip.confidence > 90 ? "text-emerald-400 border-emerald-400/20" : 
                          clip.confidence > 70 ? "text-primary border-primary/20" : "text-destructive border-destructive/20"
                        )}>
                          {clip.confidence}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {clip.status === 'match' ? (
                          <div className="flex items-center justify-end text-emerald-400 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> VALIDATED
                          </div>
                        ) : (
                          <div className="flex items-center justify-end text-destructive text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" /> MISMATCH
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <Card className="bg-secondary/20 border-white/5 overflow-hidden sticky top-6">
              <CardHeader className="bg-primary/10 border-b border-primary/20">
                <div className="flex items-center gap-2 text-primary uppercase text-[10px] font-bold tracking-widest mb-1">
                  <Play className="h-3 w-3 fill-current" /> Clip Visualizer
                </div>
                <CardTitle className="text-xl">{selectedClip.player}</CardTitle>
                <CardDescription>AI Inspection: {selectedClip.type}</CardDescription>
              </CardHeader>
              <div className="aspect-video bg-black relative flex items-center justify-center group">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="text-white/20 flex flex-col items-center">
                  <Brain className="h-12 w-12 mb-2 opacity-20" />
                  <span className="text-[10px] font-mono tracking-tighter uppercase opacity-30">Vision Stream Offline</span>
                </div>
                
                {/* Simulated ROI Boxes */}
                <div className="absolute top-1/4 left-1/3 w-24 h-48 border-2 border-primary rounded-sm animate-pulse shadow-[0_0_15px_rgba(255,102,0,0.5)]">
                  <div className="absolute -top-6 left-0 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-t-sm">
                    {selectedClip.detected} | {selectedClip.confidence}%
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                   <div className="text-[10px] font-mono text-white/60">
                      FRAME_IDX: 00245<br/>
                      BOT_SORT_ID: 104
                   </div>
                   <div className="flex gap-1">
                      <div className="w-1 h-3 bg-primary animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1 h-5 bg-primary animate-bounce [animation-delay:-0.1s]" />
                      <div className="w-1 h-2 bg-primary animate-bounce [animation-delay:-0.2s]" />
                   </div>
                </div>
              </div>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Detection Strategy</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={cn(
                      "p-3 rounded-lg border text-center transition-all",
                      selectedClip.status === 'match' ? "bg-emerald-500/10 border-emerald-500/20" : "bg-destructive/10 border-destructive/20"
                    )}>
                      <p className="text-[10px] uppercase text-muted-foreground mb-1">Voting Engine</p>
                      <p className="text-sm font-bold text-white">{selectedClip.status === 'match' ? 'Consistent' : 'Volatile'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                      <p className="text-[10px] uppercase text-muted-foreground mb-1">OCR Clarity</p>
                      <p className="text-sm font-bold text-white">High Res</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Engine Logs</h4>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                    <div className="text-[10px] font-mono p-2 rounded bg-black/40 border border-white/5">
                      <span className="text-primary">[VISION]</span> Object detected: jersey_torso (class 0)
                    </div>
                    <div className="text-[10px] font-mono p-2 rounded bg-black/40 border border-white/5">
                      <span className="text-accent">[UPSCLE]</span> 3x bicubic resize applied to ROI_104
                    </div>
                    <div className="text-[10px] font-mono p-2 rounded bg-black/40 border border-white/5">
                      <span className="text-emerald-400">[VOTING]</span> Accumulating votes: [23: 14, 28: 2]
                    </div>
                    <div className="text-[10px] font-mono p-2 rounded bg-black/40 border border-white/5">
                      <span className="text-primary font-bold">[MAPPED]</span> Identity locked to Roster ID: LBJ-23
                    </div>
                  </div>
                </div>

                <Button className="w-full bg-primary hover:bg-primary/90 text-white group">
                  MANUAL OVERRIDE
                  <AlertTriangle className="h-4 w-4 ml-2 group-hover:rotate-12 transition-transform" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}