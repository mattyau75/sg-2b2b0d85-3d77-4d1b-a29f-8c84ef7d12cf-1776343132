import { useState, useCallback } from "react";

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

export function useErrorMonitor() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);

  const logError = useCallback((
    endpoint: string,
    status: number,
    error: string,
    details?: any,
    requestBody?: any,
    stack?: string
  ) => {
    const newError: ErrorLog = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      endpoint,
      status,
      error,
      details,
      requestBody,
      stack,
    };

    setErrors((prev) => [...prev, newError]);

    // Also log to console for developer tools
    console.error("[ErrorMonitor]", {
      endpoint,
      status,
      error,
      details,
      requestBody,
      stack,
    });
  }, []);

  const dismissError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setErrors([]);
  }, []);

  return {
    errors,
    logError,
    dismissError,
    dismissAll,
  };
}