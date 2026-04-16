import React, { useState, useEffect } from "react";
import { X, AlertTriangle, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ErrorLog {
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
}

export function ErrorMonitor({ errors, onDismiss, onDismissAll }: ErrorMonitorProps) {
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

  if (errors.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-2xl space-y-2">
      <div className="flex items-center justify-between mb-2">
        <Badge variant="destructive" className="text-xs">
          {errors.length} Active Error{errors.length !== 1 ? 's' : ''}
        </Badge>
        {errors.length > 1 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onDismissAll}
            className="h-6 text-xs"
          >
            Dismiss All
          </Button>
        )}
      </div>
      
      {errors.map((error) => {
        const isExpanded = expandedErrors.has(error.id);
        return (
          <Card 
            key={error.id} 
            className="border-destructive bg-destructive/10 backdrop-blur-sm shadow-2xl"
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-destructive font-bold">
                        {error.status}
                      </span>
                      <span className="text-sm font-medium text-foreground truncate">
                        {error.endpoint}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {error.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(error)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleExpand(error.id)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onDismiss(error.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <p className="text-sm text-destructive mb-2">{error.error}</p>
                  
                  {isExpanded && (
                    <div className="space-y-2 mt-3 border-t border-destructive/20 pt-3">
                      {error.details && (
                        <div>
                          <p className="text-xs font-mono text-muted-foreground mb-1">RESPONSE DETAILS:</p>
                          <pre className="text-xs bg-black/20 p-2 rounded overflow-x-auto">
                            {JSON.stringify(error.details, null, 2)}
                          </pre>
                        </div>
                      )}
                      
                      {error.requestBody && (
                        <div>
                          <p className="text-xs font-mono text-muted-foreground mb-1">REQUEST BODY:</p>
                          <pre className="text-xs bg-black/20 p-2 rounded overflow-x-auto">
                            {JSON.stringify(error.requestBody, null, 2)}
                          </pre>
                        </div>
                      )}
                      
                      {error.stack && (
                        <div>
                          <p className="text-xs font-mono text-muted-foreground mb-1">STACK TRACE:</p>
                          <pre className="text-xs bg-black/20 p-2 rounded overflow-x-auto">
                            {error.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}