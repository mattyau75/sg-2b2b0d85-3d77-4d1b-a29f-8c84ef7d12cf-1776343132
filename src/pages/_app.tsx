import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { UploadProvider } from "@/contexts/UploadContext";
import { GlobalBannerContainer } from "@/components/DiagnosticBanner";
import { AuthGuard } from "@/components/AuthGuard";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <UploadProvider>
        <AuthGuard>
          <GlobalBannerContainer />
          <Component {...pageProps} />
        </AuthGuard>
      </UploadProvider>
    </ThemeProvider>
  );
}
