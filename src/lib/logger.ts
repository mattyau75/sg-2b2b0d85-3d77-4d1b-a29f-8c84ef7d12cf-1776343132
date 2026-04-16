/**
 * ELITE FORENSIC LOGGER
 * Prevents log leakage in production while providing deep tactical visibility in development.
 */
const isDev = process.env.NODE_ENV === "development";

export const logger = {
  info: (message: string, context?: any) => {
    if (isDev) console.log(`[INFO] ${message}`, context || "");
  },
  warn: (message: string, context?: any) => {
    console.warn(`[WARN] ${message}`, context || "");
  },
  error: (message: string, error?: any) => {
    console.error(`[CRITICAL] ${message}`, error || "");
  },
  debug: (message: string, context?: any) => {
    if (isDev) console.debug(`[DEBUG] ${message}`, context || "");
  }
};