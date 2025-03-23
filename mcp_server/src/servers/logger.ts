import util from "util";
import { LogLevel } from "../types/types.js";

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = "info") {
    this.level = level;
  }

  private shouldLog(messageLevel: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };

    return levels[messageLevel] <= levels[this.level];
  }

  private formatArgs(args: any[]): string {
    return args
      .map((arg) => {
        if (typeof arg === "string") {
          return arg;
        }

        // Better formatting for objects and errors
        return util.inspect(arg, {
          depth: 5,
          colors: true,
          maxArrayLength: 20,
          compact: false,
        });
      })
      .join(" ");
  }

  error(...args: any[]): void {
    if (this.shouldLog("error")) {
      console.error(`[ERROR] ${this.formatArgs(args)}`);
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog("warn")) {
      console.warn(`[WARN] ${this.formatArgs(args)}`);
    }
  }

  info(...args: any[]): void {
    if (this.shouldLog("info")) {
      console.info(`[INFO] ${this.formatArgs(args)}`);
    }
  }

  debug(...args: any[]): void {
    if (this.shouldLog("debug")) {
      console.debug(`[DEBUG] ${this.formatArgs(args)}`);
    }
  }

  // Helper method to temporarily increase log level for a specific operation
  withLogLevel<T>(tempLevel: LogLevel, fn: () => T): T {
    const originalLevel = this.level;
    this.level = tempLevel;
    try {
      return fn();
    } finally {
      this.level = originalLevel;
    }
  }
}
