import React from "react";
import { Court } from "./Court";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface Shot {
  id: string;
  x: number;
  y: number;
  is_make: boolean;
  player_name: string;
  shot_type: string;
}

interface ShotChartProps {
  shots: Shot[];
}

export function ShotChart({ shots }: ShotChartProps) {
  return (
    <Court className="bg-muted/10">
      <TooltipProvider>
        {shots.map((shot) => (
          <Tooltip key={shot.id}>
            <TooltipTrigger asChild>
              <div
                className={`absolute w-3 h-3 rounded-full border-2 cursor-help transition-transform hover:scale-150 ${
                  shot.is_make 
                    ? "bg-green-500 border-green-200" 
                    : "bg-accent border-accent/30"
                }`}
                style={{ 
                  left: `${(shot.x / 50) * 100}%`, 
                  top: `${(shot.y / 47) * 100}%`,
                  transform: "translate(-50%, -50%)"
                }}
              />
            </TooltipTrigger>
            <TooltipContent className="bg-card border-border p-2">
              <div className="text-xs font-mono">
                <p className="font-bold text-primary">{shot.player_name}</p>
                <p className="text-muted-foreground">{shot.shot_type}</p>
                <p className={shot.is_make ? "text-green-500" : "text-accent"}>
                  {shot.is_make ? "MADE" : "MISSED"}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
      
      <div className="absolute bottom-4 left-4 flex gap-4 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" /> Made
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-accent" /> Missed
        </div>
      </div>
    </Court>
  );
}