import React, { useState } from "react";
import { X, AlertTriangle, Copy, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface ErrorLog {
  id: string;
  timestamp: Date;
  endpoint: string;
  status: number;
  error: string;
  details?: any;
  requestBody?: any;
  stack?: string;
}

interface ErrorMonitorProps {
  errors: ErrorLog[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function ErrorMonitor({ errors, onDismiss, onDismissAll, isOpen, onToggle }: ErrorMonitorProps) {
  const [isSticky, setIsSticky] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!isOpen && !isSticky) return null;

  return (
    <div className={cn(
      "fixed z-[90] transition-all duration-300",
      isSticky 
        ? "top-24 right-4 bottom-24 w-96" 
        : "bottom-4 right-4 w-96 max-h-[600px]"
    )}>
      <Card className="h-full bg-zinc-950/90 border-destructive/30 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
        <CardHeader className="p-4 border-b border-white/5 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              System Logs <Badge variant="destructive" className="text-[10px] h-4 px-1">{errors.length}</Badge>
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn("h-7 w-7", isSticky && "bg-white/10")} 
              onClick={() => setIsSticky(!isSticky)}
              title={isSticky ? "Unstick panel" : "Stick to side"}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", isSticky && "rotate-180")} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDismissAll} title="Clear all logs">
              <Copy className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <ScrollArea className="h-[400px]">
          <CardContent className="p-2 space-y-2">
            {errors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-30">
                <AlertTriangle className="h-10 w-10 mb-2" />
                <p className="text-[10px] font-mono uppercase tracking-widest">No active errors detected</p>
              </div>
            ) : (
              errors.slice().reverse().map((error) => {
                const isExpanded = expandedErrors.has(error.id);
                return (
                  <div 
                    key={error.id} 
                    className="border border-destructive/30 bg-destructive/5 rounded-lg overflow-hidden transition-all hover:border-destructive/60"
                  >
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="destructive" className="text-[10px] h-4">
                              {error.status}
                            </Badge>
                            <span className="text-[10px] font-mono font-bold truncate text-zinc-400">
                              {error.endpoint}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-destructive line-clamp-2">
                            {error.error}
                          </p>
                          <p className="text-[10px] text-zinc-500 mt-1">
                            {error.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => copyToClipboard(error)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => toggleExpand(error.id)}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-destructive" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-500 hover:text-white"
                            onClick={() => onDismiss(error.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 space-y-2 border-t border-destructive/20 pt-3 animate-in fade-in duration-200">
                          {error.details && (
                            <div className="space-y-1">
                              <p className="text-[9px] font-black uppercase text-zinc-500 tracking-tighter">Response Data</p>
                              <pre className="text-[10px] bg-black p-2 rounded border border-white/5 overflow-x-auto font-mono text-zinc-300">
                                {JSON.stringify(error.details, null, 2)}
                              </pre>
                            </div>
                          )}
                          
                          {error.requestBody && (
                            <div className="space-y-1">
                              <p className="text-[9px] font-black uppercase text-zinc-500 tracking-tighter">Request Payload</p>
                              <pre className="text-[10px] bg-black p-2 rounded border border-white/5 overflow-x-auto font-mono text-zinc-300">
                                {JSON.stringify(error.requestBody, null, 2)}
                              </pre>
                            </div>
                          )}
                          
                          {error.stack && (
                            <div className="space-y-1">
                              <p className="text-[9px] font-black uppercase text-zinc-500 tracking-tighter">Stack Trace</p>
                              <pre className="text-[10px] bg-black p-2 rounded border border-white/5 overflow-x-auto font-mono text-zinc-500 italic">
                                {error.stack}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </ScrollArea>
      </Card>
    </div>
  );
}