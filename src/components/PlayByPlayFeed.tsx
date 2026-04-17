import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Clock, Target, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

interface PlayEvent {
  id: string;
  game_id: string;
  event_type: string;
  description: string;
  player_name: string | null;
  team: "home" | "away";
  period: number;
  game_time: string;
  created_at: string;
}

interface PlayByPlayFeedProps {
  gameId: string;
}

export function PlayByPlayFeed({ gameId }: PlayByPlayFeedProps) {
  const [events, setEvents] = useState<PlayEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (gameId) {
      fetchPlayByPlay();
      
      // Real-time subscription
      const channel = supabase
        .channel(`play_by_play_${gameId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'play_by_play',
          filter: `game_id=eq.${gameId}`
        }, (payload) => {
          setEvents(prev => [payload.new as PlayEvent, ...prev]);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [gameId]);

  const fetchPlayByPlay = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("play_by_play")
        .select("*")
        .eq("game_id", gameId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      if (data) setEvents(data as PlayEvent[]);
    } catch (err: any) {
      logger.error("[PlayByPlay] Fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "shot_made":
      case "shot_missed":
        return Target;
      case "assist":
        return TrendingUp;
      default:
        return Activity;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "shot_made":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "shot_missed":
        return "text-red-400 bg-red-500/10 border-red-500/20";
      case "assist":
        return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      default:
        return "text-muted-foreground bg-muted/10 border-white/5";
    }
  };

  return (
    <Card className="glass-card border-none h-full">
      <CardHeader>
        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> Live Play Feed
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          {events.length === 0 ? (
            <div className="py-12 text-center">
              <div className="h-12 w-12 bg-muted/10 rounded-full mx-auto flex items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-muted-foreground/20" />
              </div>
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
                Awaiting Live Events
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event, idx) => {
                const Icon = getEventIcon(event.event_type);
                return (
                  <div 
                    key={event.id} 
                    className={cn(
                      "p-4 rounded-xl border transition-all animate-in slide-in-from-top-2",
                      getEventColor(event.event_type)
                    )}
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">
                            {event.player_name || "Unknown Player"}
                          </span>
                          <Badge variant="outline" className="text-[8px] border-white/10">
                            Q{event.period} {event.game_time}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium">
                          {event.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}