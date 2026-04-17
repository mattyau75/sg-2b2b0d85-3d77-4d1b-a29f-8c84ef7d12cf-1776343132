import React, { useState } from "react";
import { X, AlertTriangle, Copy, ChevronDown, ChevronUp, Trash2, ExternalLink, CheckCircle } from "lucide-react";
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
  forceVisible?: boolean; // New prop to force button visibility
}

export function ErrorMonitor({ errors, onDismiss, onDismissAll, isOpen, onToggle, forceVisible }: ErrorMonitorProps) {
  // Don't render anything if not forced visible and not open
  if (!forceVisible && !isOpen) return null;

  // Convert to modal-style overlay instead of sidebar
  if (isOpen) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md mt-20 mr-4 bg-card/95 backdrop-blur-xl border border-destructive/20 rounded-2xl shadow-2xl animate-in slide-in-from-right-8 duration-300">
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <h3 className="text-sm font-black uppercase tracking-widest">Diagnostic Log</h3>
              </div>
              <div className="flex items-center gap-2">
                {errors.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onDismissAll}>
                    Clear All
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {errors.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="h-12 w-12 bg-emerald-500/10 rounded-full mx-auto flex items-center justify-center mb-4">
                    <CheckCircle className="h-6 w-6 text-emerald-500" />
                  </div>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">No Errors Detected</p>
                </div>
              ) : (
                errors.map((error) => (
                  <div key={error.id} className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[8px] border-destructive/50 text-destructive">
                            {error.status}
                          </Badge>
                          <span className="text-[10px] font-mono text-muted-foreground">{error.endpoint}</span>
                        </div>
                        <p className="text-xs font-medium text-destructive">{error.error}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {new Date(error.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 hover:bg-destructive/10"
                        onClick={() => onDismiss(error.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    {error.details && (
                      <details className="text-[10px] text-muted-foreground font-mono">
                        <summary className="cursor-pointer hover:text-foreground">Stack Trace</summary>
                        <pre className="mt-2 p-2 bg-black/20 rounded overflow-x-auto">{JSON.stringify(error.details, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}