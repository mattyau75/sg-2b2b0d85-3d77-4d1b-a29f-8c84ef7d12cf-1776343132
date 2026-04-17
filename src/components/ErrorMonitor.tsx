import React, { useState } from "react";
import { X, AlertTriangle, Copy, ChevronDown, ChevronUp, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Sheet } from "@/components/ui/sheet";

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
  const { toast } = useToast();
  const [isSticky, setIsSticky] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedIds(newSet);
  };

  const copyToClipboard = (error: ErrorLog) => {
    const text = JSON.stringify(error, null, 2);
    navigator.clipboard.writeText(text);
    toast({
      title: "Log Copied",
      description: "Error details copied to clipboard.",
    });
  };

  if (!isOpen && !isSticky) return null;

  return (
    <div className={cn(
      "fixed z-[90] transition-all duration-300",
      isSticky 
        ? "top-20 right-4 bottom-4 w-[400px]" 
        : "bottom-4 right-4 w-96 max-h-[600px]"
    )}>
      <Card className="h-full bg-zinc-950/95 border-destructive/30 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
        <CardHeader className="p-4 border-b border-white/5 flex flex-row items-center justify-between space-y-0 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              System Console <Badge variant="destructive" className="text-[10px] h-4 px-1">{errors.length}</Badge>
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn("h-7 w-7 hover:bg-white/10", isSticky && "bg-white/10")} 
              onClick={() => setIsSticky(!isSticky)}
              title={isSticky ? "Minimize panel" : "Dock to side"}
            >
              <ExternalLink className={cn("h-3.5 w-3.5 transition-transform", isSticky && "rotate-180")} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 hover:bg-destructive/10 text-muted-foreground hover:text-destructive" 
              onClick={onDismissAll} 
              title="Clear all logs"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/10" onClick={onToggle}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <ScrollArea className="flex-1">
          <CardContent className="p-3 space-y-3">
            {errors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-30 text-center">
                <AlertTriangle className="h-10 w-10 mb-4" />
                <p className="text-[10px] font-mono uppercase tracking-widest">No critical events recorded</p>
                <p className="text-[9px] mt-1">Ready for next AI scout run</p>
              </div>
            ) : (
              [...errors].reverse().map((error) => {
                const isExpanded = expandedIds.has(error.id);
                return (
                  <div 
                    key={error.id} 
                    className={cn(
                      "border rounded-xl overflow-hidden transition-all duration-200",
                      error.status >= 500 ? "bg-red-500/5 border-red-500/20" : "bg-orange-500/5 border-orange-500/20"
                    )}
                  >
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0" onClick={() => toggleExpand(error.id)} role="button">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={cn(
                              "text-[9px] font-black h-4 px-1.5",
                              error.status >= 500 ? "bg-red-500 hover:bg-red-600" : "bg-orange-500 hover:bg-orange-600"
                            )}>
                              {error.status}
                            </Badge>
                            <span className="text-[10px] font-mono font-bold truncate text-zinc-400">
                              {error.endpoint}
                            </span>
                          </div>
                          <p className="text-xs font-bold leading-tight break-words">
                            {error.error}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <p className="text-[9px] font-mono text-zinc-500">
                              {error.timestamp.toLocaleTimeString()}
                            </p>
                            {error.details && (
                              <Badge variant="outline" className="text-[8px] h-3 px-1 border-white/5 text-zinc-500">
                                Metadata Attached
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-white/10"
                            onClick={() => copyToClipboard(error)}
                            title="Copy payload"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-white/10"
                            onClick={() => toggleExpand(error.id)}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-600 hover:text-white hover:bg-white/5"
                            onClick={() => onDismiss(error.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 space-y-4 border-t border-white/5 pt-4 animate-in slide-in-from-top-2 duration-300">
                          {error.details && (
                            <div className="space-y-1.5">
                              <p className="text-[9px] font-black uppercase text-zinc-500 tracking-tighter">API Response Object</p>
                              <pre className="text-[10px] bg-black/50 p-3 rounded-lg border border-white/5 overflow-x-auto font-mono text-zinc-300 leading-relaxed">
                                {JSON.stringify(error.details, null, 2)}
                              </pre>
                            </div>
                          )}
                          
                          {error.requestBody && (
                            <div className="space-y-1.5">
                              <p className="text-[9px] font-black uppercase text-zinc-500 tracking-tighter">Outgoing Request Body</p>
                              <pre className="text-[10px] bg-black/50 p-3 rounded-lg border border-white/5 overflow-x-auto font-mono text-zinc-300 leading-relaxed">
                                {JSON.stringify(error.requestBody, null, 2)}
                              </pre>
                            </div>
                          )}
                          
                          {error.stack && (
                            <div className="space-y-1.5">
                              <p className="text-[9px] font-black uppercase text-zinc-500 tracking-tighter">Stack Trace / Diagnostics</p>
                              <pre className="text-[10px] bg-black/50 p-3 rounded-lg border border-white/5 overflow-x-auto font-mono text-zinc-500 italic leading-relaxed">
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