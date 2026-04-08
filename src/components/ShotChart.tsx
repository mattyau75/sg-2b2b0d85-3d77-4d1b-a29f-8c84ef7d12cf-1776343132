import React from "react";
import { Court } from "./Court";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface Shot {
  id: string;
  x: number; // 0-500
  y: number; // 0-470
  is_made: boolean;
  player_name: string;
  shot_type: string;
  timestamp?: string;
}

interface ShotChartProps {
  shots: Shot[];
  onShotClick?: (shot: Shot) => void;
  className?: string;
}

export function ShotChart({ shots, onShotClick, className }: ShotChartProps) {
  return (
    <div className={cn("relative", className)}>
      <Court>
        <TooltipProvider>
          {shots.map((shot) => (
            <Tooltip key={shot.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onShotClick?.(shot)}
                  className={cn(
                    "absolute h-3 w-3 rounded-full border-2 border-background transform -translate-x-1/2 -translate-y-1/2 transition-all hover:scale-150 z-10",
                    shot.is_made ? "bg-accent shadow-[0_0_8px_rgba(180,100,50,0.6)]" : "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                  )}
                  style={{ left: `${(shot.x / 500) * 100}%`, top: `${(shot.y / 470) * 100}%` }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-card border-border text-xs font-mono">
                <div className="space-y-1">
                  <p className="font-bold text-foreground">{shot.player_name}</p>
                  <p className={shot.is_made ? "text-accent" : "text-destructive"}>
                    {shot.is_made ? "MADE" : "MISSED"} {shot.shot_type}
                  </p>
                  {shot.timestamp && <p className="text-muted-foreground">{shot.timestamp}</p>}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </Court>

      <div className="mt-4 flex items-center justify-center gap-6 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-accent" />
          <span>Made Shot</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-destructive" />
          <span>Missed Shot</span>
        </div>
      </div>
    </div>
  );
}