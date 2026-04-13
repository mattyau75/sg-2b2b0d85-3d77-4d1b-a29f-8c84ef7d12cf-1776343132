import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
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
  PlusCircle, 
  UploadCloud, 
  Swords, 
  ShieldCheck, 
  Cpu, 
  CheckCircle2,
  X,
  Palette,
  MapPin,
  Check,
  Calendar as CalendarIcon,
  HardDrive
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { storageService } from "@/services/storageService";
import { showBanner } from "@/components/DiagnosticBanner";
import axios from "axios";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUploads } from "@/contexts/UploadContext";
import { useRouter } from "next/router";

const formSchema = z.object({
  homeTeam: z.string().min(2, "Home team required"),
  awayTeam: z.string().min(2, "Away team required"),
  gameDate: z.date({
    required_error: "Game date is required",
  }),
  venueId: z.string().min(1, "Venue selection required"),
  homeScore: z.coerce.number().min(0).default(0),
  awayScore: z.coerce.number().min(0).default(0),
});

export function NewGameModal() {
  const [isOpen, setIsOpen] = useState(false);
  const { startUpload } = useUploads();
  const router = useRouter();
  const [stage, setStage] = useState<'details' | 'upload' | 'igniting'>('details');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [teams, setTeams] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [newVenueName, setNewVenueName] = useState("");
  const [isAddingVenue, setIsAddingVenue] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      homeTeam: "",
      awayTeam: "",
      gameDate: new Date(),
      venueId: "",
      homeScore: 0,
      awayScore: 0,
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: teamsData }, { data: venuesData }] = await Promise.all([
        supabase.from('teams').select('*').order('name'),
        supabase.from('venues').select('*').order('name')
      ]);
      if (teamsData) setTeams(teamsData);
      if (venuesData) setVenues(venuesData);
    };
    fetchData();
  }, []);

  const handleAddVenue = async () => {
    if (!newVenueName.trim()) return;
    try {
      const { data, error } = await supabase
        .from('venues')
        .insert({ name: newVenueName.trim() })
        .select()
        .single();
      
      if (error) throw error;
      if (data) {
        setVenues(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
        form.setValue("venueId", data.id);
        setNewVenueName("");
        setIsAddingVenue(false);
        showBanner("Venue Registered", "success");
      }
    } catch (error) {
      showBanner("Failed to register venue", "error");
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!file) {
      showBanner("Missing Video Source", "error");
      return;
    }

    try {
      await startUpload(file, values);
      showBanner("Upload Initiated - Tracking in Directory", "success");
      setIsOpen(false);
      resetState();
      
      if (router.pathname !== "/games") {
        router.push("/games");
      }
    } catch (err: any) {
      console.error("Initiation Failed:", err);
      showBanner("Failed to start upload", "error");
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest italic h-14 px-8 rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95">
          <PlusCircle className="mr-2 h-5 w-5" /> New Game Analysis
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-background border-white/5 max-w-2xl p-0 overflow-hidden rounded-3xl max-h-[90vh] flex flex-col">
        <DialogHeader className="p-8 pb-4 shrink-0 text-left">
          <DialogTitle className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3">
            <Cpu className="h-8 w-8 text-primary animate-pulse" /> Mission Initiation
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest">
            Register new game assets for GPU-accelerated intelligence processing
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="px-8 pb-8 space-y-8">
            {stage === 'details' && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FormField
                      control={form.control}
                      name="homeTeam"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <ShieldCheck className="h-3 w-3 text-primary" /> Home Roster
                          </FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-white/5 border-white/10 rounded-xl h-12 font-bold focus:ring-primary/20">
                                <SelectValue placeholder="Select Home Team" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background border-white/10">
                              {teams.map((team) => (
                                <SelectItem key={team.id} value={team.id}>
                                  {team.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-[10px] uppercase font-bold text-red-500" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="awayTeam"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Swords className="h-3 w-3 text-accent" /> Away Roster
                          </FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-white/5 border-white/10 rounded-xl h-12 font-bold focus:ring-accent/20">
                                <SelectValue placeholder="Select Away Team" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background border-white/10">
                              {teams.map((team) => (
                                <SelectItem key={team.id} value={team.id}>
                                  {team.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-[10px] uppercase font-bold text-red-500" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FormField
                      control={form.control}
                      name="gameDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <CalendarIcon className="h-3 w-3 text-primary" /> Game Date
                          </FormLabel>
                          <Popover modal={true}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full h-12 bg-white/5 border-white/10 rounded-xl font-bold text-left justify-start px-4",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent 
                              className="w-auto p-0 bg-background border-white/10 z-[130]" 
                              align="start"
                              side="bottom"
                              sideOffset={4}
                            >
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date > new Date() || date < new Date("1900-01-01")
                                }
                                className="rounded-xl border border-white/10"
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage className="text-[10px] uppercase font-bold text-red-500" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="venueId"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3 w-3 text-primary" /> Venue
                            </div>
                            {!isAddingVenue && (
                              <button 
                                type="button"
                                onClick={() => setIsAddingVenue(true)}
                                className="text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                              >
                                <PlusCircle className="h-3 w-3" /> New Venue
                              </button>
                            )}
                          </FormLabel>
                          
                          {isAddingVenue ? (
                            <div className="flex gap-2">
                              <Input 
                                placeholder="New Venue Name"
                                value={newVenueName}
                                onChange={(e) => setNewVenueName(e.target.value)}
                                className="bg-white/5 border-white/10 rounded-xl h-12 font-bold flex-1"
                                autoFocus
                              />
                              <Button 
                                type="button"
                                variant="ghost" 
                                onClick={() => setIsAddingVenue(false)}
                                className="h-12 w-12 rounded-xl text-muted-foreground hover:bg-white/5"
                              >
                                <X className="h-5 w-5" />
                              </Button>
                              <Button 
                                type="button"
                                onClick={handleAddVenue}
                                className="h-12 w-12 rounded-xl bg-primary hover:bg-primary/90 text-white"
                              >
                                <Check className="h-5 w-5" />
                              </Button>
                            </div>
                          ) : (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-white/5 border-white/10 rounded-xl h-12 font-bold focus:ring-primary/20">
                                  <SelectValue placeholder="Select Venue / Stadium" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-background border-white/10">
                                {venues.map((venue) => (
                                  <SelectItem key={venue.id} value={venue.id}>
                                    {venue.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <FormMessage className="text-[10px] uppercase font-bold text-red-500" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Palette className="h-3 w-3 text-primary" /> Truth Scoreboard (Calibration)
                    </FormLabel>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="homeScore"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Home Final</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} className="bg-white/5 border-white/10 rounded-xl h-12 font-mono text-xl text-center focus:ring-primary/20" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="awayScore"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Away Final</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} className="bg-white/5 border-white/10 rounded-xl h-12 font-mono text-xl text-center focus:ring-accent/20" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <p className="text-[9px] text-muted-foreground italic">Ground-truth scores are used to calibrate AI detection accuracy for this game.</p>
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

                  <div className="pt-4">
                    <Button 
                      type="submit" 
                      disabled={uploading || !file}
                      className="w-full h-16 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest italic rounded-2xl group transition-all"
                    >
                      {uploading ? "Streaming Intelligence..." : (
                        <span className="flex items-center gap-2 group-hover:scale-105 transition-transform">
                          Add Game <CheckCircle2 className="h-5 w-5" />
                        </span>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {(stage === 'upload' || stage === 'igniting') && (
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}