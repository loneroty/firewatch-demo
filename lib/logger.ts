type LogValue = string | number | boolean | null | undefined;
export type LogContext = Record<string, LogValue>;

function formatContext(context?: LogContext): string {
  if (!context) {
    return "";
  }

  const pairs = Object.entries(context)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`);

  return pairs.length > 0 ? ` ${pairs.join(" ")}` : "";
}

export const logger = {
  info(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[firewatch] ${message}${formatContext(context)}`);
    }
  },
  warn(message: string, context?: LogContext): void {
    console.warn(`[firewatch] ${message}${formatContext(context)}`);
  },
  error(message: string, context?: LogContext): void {
    console.error(`[firewatch] ${message}${formatContext(context)}`);
  }
};
