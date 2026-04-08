import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { UploadProvider } from "@/contexts/UploadContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <UploadProvider>
        <Component {...pageProps} />
      </UploadProvider>
    </ThemeProvider>
  );
}
