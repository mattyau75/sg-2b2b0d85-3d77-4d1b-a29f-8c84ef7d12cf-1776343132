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
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedErrors);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedErrors(newExpanded);
  };

  const copyToClipboard = (error: ErrorLog) => {
    const errorText = `
ERROR LOG DUMP
=============
Timestamp: ${error.timestamp.toISOString()}
Endpoint: ${error.endpoint}
Status: ${error.status}
Error: ${error.error}

Details:
${JSON.stringify(error.details, null, 2)}

Request Body:
${JSON.stringify(error.requestBody, null, 2)}

Stack:
${error.stack || 'No stack trace available'}
    `.trim();
    
    navigator.clipboard.writeText(errorText);
  };

  if (!isOpen && errors.length === 0) return null;

  if (!isOpen) {
    return (
      <Button
        onClick={onToggle}
        variant="destructive"
        className="fixed bottom-4 right-4 z-50 rounded-full h-12 w-12 shadow-2xl flex items-center justify-center p-0"
      >
        <div className="relative">
          <AlertTriangle className="h-6 w-6" />
          {errors.length > 0 && (
            <Badge 
              variant="default" 
              className="absolute -top-3 -right-3 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-white text-destructive font-black"
            >
              {errors.length}
            </Badge>
          )}
        </div>
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-lg animate-in slide-in-from-bottom-4 duration-300">
      <Card className="border-destructive bg-zinc-950/95 backdrop-blur-xl shadow-2xl overflow-hidden border-2">
        <div className="bg-destructive p-3 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <h3 className="text-xs font-black uppercase tracking-widest">System Error Monitor</h3>
            <Badge variant="outline" className="text-[10px] bg-white/20 border-none text-white">
              {errors.length} Active
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {errors.length > 0 && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onDismissAll}
                className="h-6 w-6 hover:bg-white/20"
                title="Clear All"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onToggle}
              className="h-6 w-6 hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
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