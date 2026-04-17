import React from "react";
import type { AppProps } from "next/app";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { UploadProvider } from "@/contexts/UploadContext";
import "@/styles/globals.css";
import { Toaster } from "@/components/ui/toaster";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="dribblestats-theme">
      <UploadProvider>
        <Component {...pageProps} />
        <Toaster />
      </UploadProvider>
    </ThemeProvider>
  );
}