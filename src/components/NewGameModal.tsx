import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Plus, 
  UploadCloud, 
  Swords, 
  ShieldCheck, 
  Cpu, 
  AlertCircle,
  CheckCircle2,
  X,
  Palette
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { storageService } from "@/services/storageService";
import { Badge } from "@/components/ui/badge";
import { showBanner } from "@/components/DiagnosticBanner";
import axios from "axios";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formSchema = z.object({
  homeTeam: z.string().min(2, "Home team required"),
  awayTeam: z.string().min(2, "Away team required"),
  homeColor: z.string().default("#f97316"),
  awayColor: z.string().default("#3b82f6"),
});

export function NewGameModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stage, setStage] = useState<'details' | 'upload' | 'igniting'>('details');
  const [teams, setTeams] = useState<any[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      homeTeam: "",
      awayTeam: "",
      homeColor: "#f97316",
      awayColor: "#3b82f6",
    },
  });

  useEffect(() => {
    const fetchTeams = async () => {
      const { data } = await supabase.from('teams').select('id, name');
      if (data) setTeams(data);
    };
    if (isOpen) fetchTeams();
  }, [isOpen]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!file) {
      showBanner("Missing Video Source", "error");
      return;
    }
    setStage('upload');
    setUploading(true);

    try {
      // 1. UPLOAD TO R2 (Multi-part for 8GB Support)
      const videoPath = await storageService.uploadVideo(file, (progress) => {
        setUploadProgress(progress);
      });

      setStage('igniting');
      
      // 2. REGISTER IN SUPABASE (UUID GENERATED)
      const { data: newGame, error: gameError } = await supabase
        .from('games')
        .insert({
          home_team_id: values.homeTeam, // UUID from select
          away_team_id: values.awayTeam, // UUID from select
          home_team_color: values.homeColor,
          away_team_color: values.awayColor,
          video_path: videoPath,
          status: 'pending'
        } as any)
        .select('id')
        .single();

      if (gameError || !newGame) throw new Error("Failed to register game.");

      // 3. TRIGGER STATELESS IGNITION
      await axios.post('/api/process-game', {
        gameId: newGame.id,
        metadata: {
          home: values.homeTeam,
          away: values.awayTeam,
          colors: { home: values.homeColor, away: values.awayColor }
        }
      });

      showBanner("GPU Swarm Ignited", "success");
      setIsOpen(false);
      resetState();
    } catch (err: any) {
      console.error("Scout Initiation Failed:", err);
      showBanner(err.message || "Handshake Failure", "error");
      setStage('details');
      setUploading(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setUploadProgress(0);
    setUploading(false);
    setStage('details');
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => {
      if (!uploading) {
        setIsOpen(val);
        if (!val) resetState();
      }
    }}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-tighter italic h-12 px-6 rounded-none skew-x-[-12deg]">
          <span className="skew-x-[12deg] flex items-center gap-2">
            <Plus className="h-5 w-5" /> Add New Game
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-background border-white/5 max-w-2xl p-0 overflow-hidden rounded-3xl">
        <DialogHeader className="p-8 pb-0">
          <DialogTitle className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3">
            <Cpu className="h-8 w-8 text-primary animate-pulse" />
            Register <span className="text-primary not-italic">New Game</span>
          </DialogTitle>
        </DialogHeader>

        <div className="p-8 space-y-8">
          {stage === 'details' ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="homeTeam"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <ShieldCheck className="h-3 w-3 text-primary" /> Home Roster
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Enter Home Team Name" {...field} className="bg-white/5 border-white/10 rounded-xl h-12 font-bold focus:border-primary/50" />
                          </FormControl>
                          <FormMessage className="text-[10px] uppercase font-bold text-red-500" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="homeColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Palette className="h-3 w-3 text-primary" /> Primary Color
                          </FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-4">
                              <Input type="color" {...field} className="w-12 h-12 p-1 bg-transparent border-none rounded-full cursor-pointer" />
                              <span className="font-mono text-xs uppercase text-muted-foreground tracking-tighter">{field.value}</span>
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="awayTeam"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Swords className="h-3 w-3 text-accent" /> Away Roster
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Enter Away Team Name" {...field} className="bg-white/5 border-white/10 rounded-xl h-12 font-bold focus:border-accent/50" />
                          </FormControl>
                          <FormMessage className="text-[10px] uppercase font-bold text-red-500" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="awayColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Palette className="h-3 w-3 text-accent" /> Primary Color
                          </FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-4">
                              <Input type="color" {...field} className="w-12 h-12 p-1 bg-transparent border-none rounded-full cursor-pointer" />
                              <span className="font-mono text-xs uppercase text-muted-foreground tracking-tighter">{field.value}</span>
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <UploadCloud className="h-3 w-3 text-primary" /> Source Intelligence (Video)
                  </FormLabel>
                  <div 
                    className={`
                      relative group border-2 border-dashed rounded-3xl p-12 transition-all cursor-pointer
                      ${file ? 'border-primary/50 bg-primary/5' : 'border-white/5 hover:border-primary/30 hover:bg-white/5'}
                    `}
                    onClick={() => document.getElementById('video-upload')?.click()}
                  >
                    <input 
                      type="file" 
                      id="video-upload" 
                      className="hidden" 
                      accept="video/*" 
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    <div className="flex flex-col items-center text-center gap-4">
                      <div className={`p-4 rounded-full bg-background border ${file ? 'border-primary/50 text-primary' : 'border-white/10 text-muted-foreground'}`}>
                        <UploadCloud className="h-8 w-8" />
                      </div>
                      {file ? (
                        <div className="space-y-1">
                          <p className="text-white font-bold">{file.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest">{(file.size / (1024 * 1024)).toFixed(2)} MB Ready</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-white font-bold uppercase tracking-tighter">Drop footage or click to browse</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest">Supports 8GB / 1-hour footage</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={uploading || !file}
                  className="w-full h-16 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest italic rounded-2xl group transition-all"
                >
                  {uploading ? "Streaming Intelligence..." : (
                    <span className="flex items-center gap-2 group-hover:scale-105 transition-transform">
                      Ignite AI Analysis <CheckCircle2 className="h-5 w-5" />
                    </span>
                  )}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in duration-500">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
                <Cpu className="h-24 w-24 text-primary relative animate-bounce" />
              </div>
              <div className="space-y-4 max-w-sm">
                <h3 className="text-2xl font-black uppercase tracking-tighter text-white">
                  {stage === 'upload' ? 'Streaming Intelligence' : 'Igniting GPU Swarm'}
                </h3>
                <p className="text-sm text-muted-foreground font-medium">
                  {stage === 'upload' 
                    ? `Injecting 8GB heavy-payload footage into R2 cluster. DO NOT CLOSE THIS WINDOW.` 
                    : `Establishing stateless handshake with Modal.com GPU. Analysis sequence starting.`
                  }
                </p>
                <div className="w-full space-y-2 mt-8">
                  <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest font-black">
                    <span className="text-muted-foreground">Pulse Depth</span>
                    <span className="text-primary">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2 bg-white/5" />
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}