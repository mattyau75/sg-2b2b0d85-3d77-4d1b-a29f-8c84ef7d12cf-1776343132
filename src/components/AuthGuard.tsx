import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      // 🔓 DEVELOPMENT BYPASS: Skip auth in Softgen preview for faster testing
      if (process.env.NODE_ENV === 'development') {
        setAuthenticated(true);
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Public pages that don't need auth
        const publicPages = ["/login", "/help"];
        if (!publicPages.includes(router.pathname)) {
          router.push("/login");
        } else {
          setLoading(false);
        }
      } else {
        setAuthenticated(true);
        setLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setAuthenticated(false);
        if (process.env.NODE_ENV !== 'development') {
          router.push("/login");
        }
      } else if (session) {
        setAuthenticated(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090D] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto" />
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">
            Verifying Tactical Credentials...
          </p>
        </div>
      </div>
    );
  }

  // If not authenticated and not on a public page, we've already triggered a redirect
  const isPublicPage = ["/login", "/help"].includes(router.pathname);
  if (!authenticated && !isPublicPage && process.env.NODE_ENV !== 'development') return null;

  return <>{children}</>;
}