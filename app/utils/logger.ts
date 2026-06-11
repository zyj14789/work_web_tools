export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LOG_PREFIX = '[AI-Ad-Assistant]';
let CURRENT_LEVEL: LogLevel = LogLevel.DEBUG;

function formatMessage(level: string, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString();
  const base = `${LOG_PREFIX} [${timestamp}] [${level}] ${message}`;
  if (data !== undefined) {
    try {
      return `${base} ${JSON.stringify(data, null, 2)}`;
    } catch {
      return `${base} ${String(data)}`;
    }
  }
  return base;
}

function shouldLog(level: LogLevel): boolean {
  return level >= CURRENT_LEVEL;
}

export const logger = {
  debug(message: string, data?: unknown): void {
    if (shouldLog(LogLevel.DEBUG)) {
      console.debug(formatMessage('DEBUG', message, data));
    }
  },

  info(message: string, data?: unknown): void {
    if (shouldLog(LogLevel.INFO)) {
      console.info(formatMessage('INFO', message, data));
    }
  },

  warn(message: string, data?: unknown): void {
    if (shouldLog(LogLevel.WARN)) {
      console.warn(formatMessage('WARN', message, data));
    }
  },

  error(message: string, error?: unknown): void {
    if (shouldLog(LogLevel.ERROR)) {
      console.error(formatMessage('ERROR', message, error));
    }
  },

  setLevel(level: LogLevel): void {
    CURRENT_LEVEL = level;
  },
};
