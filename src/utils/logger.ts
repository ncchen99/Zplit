type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
  timestamp: string;
}

const isDev = import.meta.env.DEV;

function log(level: LogLevel, module: string, message: string, data?: unknown) {
  const entry: LogEntry = {
    level,
    module,
    message,
    data,
    timestamp: new Date().toISOString(),
  };

  if (isDev) {
    const style = {
      debug: "color: gray",
      info: "color: blue",
      warn: "color: orange",
      error: "color: red; font-weight: bold",
    }[level];
    console[level === "debug" ? "log" : level](
      `%c[Zplit][${entry.timestamp}][${module}] ${message}`,
      style,
      data ?? "",
    );
  } else {
    if (level === "warn" || level === "error") {
      console[level](JSON.stringify(entry));
    }
  }
}

export const logger = {
  debug: (module: string, message: string, data?: unknown) =>
    log("debug", module, message, data),
  info: (module: string, message: string, data?: unknown) =>
    log("info", module, message, data),
  warn: (module: string, message: string, data?: unknown) =>
    log("warn", module, message, data),
  error: (module: string, message: string, data?: unknown) =>
    log("error", module, message, data),
};
