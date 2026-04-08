import React, { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Play, 
  Target, 
  Activity, 
  History, 
  ChevronRight,
  TrendingUp,
  Cpu,
  Download,
  ListTodo,
  Youtube,
  Upload,
  Settings2,
  SlidersHorizontal
} from "lucide-react";
import { ShotChart as ShotChartComponent, type Shot } from "@/components/ShotChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { modalService } from "@/services/modalService";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const MOCK_SHOTS: Shot[] = [
  { id: "1", x: 250, y: 52, is_made: true, player_name: "Steph Curry", shot_type: "Layup", timestamp: "Q1 08:45" },
  { id: "2", x: 100, y: 140, is_made: true, player_name: "Klay Thompson", shot_type: "3PT Jumper", timestamp: "Q1 07:12" },
  { id: "3", x: 400, y: 140, is_made: false, player_name: "Jordan Poole", shot_type: "3PT Jumper", timestamp: "Q1 05:30" },
  { id: "4", x: 250, y: 250, is_made: true, player_name: "Steph Curry", shot_type: "Midrange Jumper", timestamp: "Q1 04:15" },
  { id: "5", x: 50, y: 50, is_made: false, player_name: "Draymond Green", shot_type: "Hook Shot", timestamp: "Q1 02:10" },
];

const MOCK_STATS = [
  { player: "Steph Curry", pos: "G", min: "34", pts: "32", reb: "5", ast: "8", stl: "2", blk: "0", fg: "11-18", tp: "6-10" },
  { player: "Klay Thompson", pos: "G", min: "32", pts: "22", reb: "3", ast: "2", stl: "1", blk: "1", fg: "8-16", tp: "4-9" },
  { player: "Andrew Wiggins", pos: "F", min: "30", pts: "18", reb: "7", ast: "1", stl: "2", blk: "2", fg: "7-12", tp: "2-4" },
  { player: "Draymond Green", pos: "F", min: "28", pts: "8", reb: "12", ast: "10", stl: "1", blk: "1", fg: "3-5", tp: "0-1" },
  { player: "Kevon Looney", pos: "C", min: "24", pts: "6", reb: "10", ast: "4", stl: "0", blk: "1", fg: "3-4", tp: "0-0" },
];

const MOCK_PBP = [
  { time: "08:45", quarter: "Q1", event: "Steph Curry makes 2pt layup", score: "2-0", player: "Steph Curry" },
  { time: "08:20", quarter: "Q1", event: "Jayson Tatum misses 3pt jumper", score: "2-0", player: "Jayson Tatum" },
  { time: "07:55", quarter: "Q1", event: "Draymond Green defensive rebound", score: "2-0", player: "Draymond Green" },
  { time: "07:32", quarter: "Q1", event: "Andrew Wiggins makes 2pt jumper", score: "4-0", player: "Andrew Wiggins" },
  { time: "07:12", quarter: "Q1", event: "Klay Thompson makes 3pt jumper (Steph Curry assist)", score: "7-0", player: "Klay Thompson" },
];

export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [config, setConfig] = useState({
    imgsz: 1280,
    conf: 0.25,
    iou: 0.45,
    tracking: true,
    agnosticNms: true,
  });
  const { toast } = useToast();

  const handleProcessGame = async () => {
    if (!youtubeUrl) {
      toast({
        title: "Missing URL",
        description: "Please paste a YouTube URL to begin processing.",
        variant: "destructive",
      });
      return;
    }

    if (!youtubeUrl.includes("youtube.com") && !youtubeUrl.includes("youtu.be")) {
      toast({
        title: "Invalid URL",
        description: "Please provide a valid YouTube link.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      await modalService.processGame(youtubeUrl, {
        imgsz: config.imgsz,
        conf: config.conf,
        iou: config.iou,
        tracking: config.tracking,
        agnostic_nms: config.agnosticNms,
      });
      toast({
        title: "Processing Started",
        description: "Modal.com GPU (A100) has initiated the YOLOv11m pipeline.",
      });
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Failed to connect to Modal.com. Check your credentials.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 relative min-w-[300px]">
              <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="Paste unlisted YouTube URL..." 
                className="w-full h-12 pl-11 pr-12 rounded-xl bg-card/50 border border-border focus:border-primary outline-none transition-all text-sm font-mono"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-accent">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 bg-card/95 backdrop-blur-xl border-border shadow-2xl p-6" align="end">
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 mb-2">
                        <SlidersHorizontal className="h-4 w-4 text-accent" />
                        <h4 className="font-bold text-sm">Inference Configuration</h4>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Img Size (px)</Label>
                          <span className="text-[10px] font-mono text-accent">{config.imgsz}</span>
                        </div>
                        <Slider 
                          value={[config.imgsz]} 
                          min={640} 
                          max={1280} 
                          step={320}
                          onValueChange={([val]) => setConfig({ ...config, imgsz: val })}
                          className="py-2"
                        />
                        <p className="text-[9px] text-muted-foreground">Use 1280px for small jersey numbers.</p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Confidence</Label>
                          <span className="text-[10px] font-mono text-accent">{config.conf}</span>
                        </div>
                        <Slider 
                          value={[config.conf]} 
                          min={0.1} 
                          max={0.9} 
                          step={0.05}
                          onValueChange={([val]) => setConfig({ ...config, conf: val })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">ByteTrack</Label>
                          <p className="text-[9px] text-muted-foreground">ID persistence across pans</p>
                        </div>
                        <Switch 
                          checked={config.tracking}
                          onCheckedChange={(val) => setConfig({ ...config, tracking: val })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Agnostic NMS</Label>
                          <p className="text-[9px] text-muted-foreground">Better cluster detection</p>
                        </div>
                        <Switch 
                          checked={config.agnosticNms}
                          onCheckedChange={(val) => setConfig({ ...config, agnosticNms: val })}
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <Button 
              onClick={handleProcessGame}
              disabled={isProcessing}
              className="h-12 px-8 rounded-xl bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </div>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Process Game
                </>
              )}
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
          <div className="lg:col-span-2 space-y-8">
            <Card className="glass-card border-none">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Latest Game Analysis
                </CardTitle>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="font-mono text-[10px]">GSW 112</Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">BOS 108</Badge>
                </div>
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

            <Tabs defaultValue="boxscore" className="w-full">
              <TabsList className="bg-card/50 border border-white/5 p-1 rounded-xl mb-6">
                <TabsTrigger value="boxscore" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
                  Boxscore
                </TabsTrigger>
                <TabsTrigger value="pbp" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
                  Play-by-Play
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="boxscore">
                <Card className="glass-card border-none overflow-hidden">
                  <Table>
                    <TableHeader className="bg-white/5">
                      <TableRow className="hover:bg-transparent border-white/5">
                        <TableHead className="font-mono text-[10px] uppercase tracking-wider">Player</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center">Pos</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center">Min</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center">Pts</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center">Reb</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center">Ast</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center">FG</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase tracking-wider text-center">3P</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {MOCK_STATS.map((row) => (
                        <TableRow key={row.player} className="border-white/5 hover:bg-white/5 transition-colors">
                          <TableCell className="font-medium py-3">{row.player}</TableCell>
                          <TableCell className="text-center text-muted-foreground font-mono text-xs">{row.pos}</TableCell>
                          <TableCell className="text-center font-mono text-xs">{row.min}</TableCell>
                          <TableCell className="text-center font-mono font-bold text-accent">{row.pts}</TableCell>
                          <TableCell className="text-center font-mono text-xs">{row.reb}</TableCell>
                          <TableCell className="text-center font-mono text-xs">{row.ast}</TableCell>
                          <TableCell className="text-center font-mono text-xs">{row.fg}</TableCell>
                          <TableCell className="text-center font-mono text-xs">{row.tp}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>

              <TabsContent value="pbp">
                <Card className="glass-card border-none p-2">
                  <div className="space-y-1">
                    {MOCK_PBP.map((event, i) => (
                      <div key={i} className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors group cursor-pointer">
                        <div className="text-[10px] font-mono text-muted-foreground w-12">{event.time}</div>
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                          <Target className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{event.event}</p>
                          <p className="text-[10px] font-mono text-muted-foreground uppercase">{event.player}</p>
                        </div>
                        <div className="text-xs font-mono font-bold text-accent">{event.score}</div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                          <Play className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-8">
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

            <Card className="glass-card border-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ListTodo className="h-4 w-4 text-primary" />
                  Processing Queue
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: "LAL vs GSW - Full Game", progress: 100, status: "Completed" },
                  { name: "MIL vs PHX - Highlights", progress: 65, status: "Processing" },
                  { name: "BOS vs MIA - Q1", progress: 0, status: "Pending" },
                ].map((job, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-muted-foreground uppercase truncate w-32">{job.name}</span>
                      <span className={job.status === "Completed" ? "text-accent" : "text-primary"}>{job.status}</span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full transition-all duration-1000",
                          job.status === "Completed" ? "bg-accent" : "bg-primary"
                        )}
                        style={{ width: `${job.progress}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}