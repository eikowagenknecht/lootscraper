import { freemem, totalmem } from "node:os";
import { resolve } from "node:path";
import { DateTime } from "luxon";
import { createLogger, format } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { logger } from "@/utils/logger";
import { getDataPath } from "@/utils/path";

interface MemoryMetrics {
  timestamp: string;
  process: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    arrayBuffers: number;
  };
  system: {
    freeMem: number;
    totalMem: number;
    usedMem: number;
    freeMemPercentage: number;
  };
}

interface MemoryMonitorConfig {
  enabled: boolean;
  intervalMs: number;
  logLevel: string;
}

const DEFAULT_CONFIG: MemoryMonitorConfig = {
  enabled: true,
  intervalMs: 60000, // 1 minute
  logLevel: "info",
};

class MemoryMonitorService {
  private config: MemoryMonitorConfig = DEFAULT_CONFIG;
  private intervalId: NodeJS.Timeout | undefined;
  private metricsLogger: ReturnType<typeof createLogger> | undefined;
  private isInitialized = false;
  private startTime?: DateTime;

  /**
   * Initialize the memory monitor service
   * @param config - Optional configuration overrides for the memory monitor
   */
  initialize(config?: Partial<MemoryMonitorConfig>): void {
    if (this.isInitialized) {
      logger.warn("Memory monitor already initialized");
      return;
    }

    this.config = { ...DEFAULT_CONFIG, ...config };

    if (!this.config.enabled) {
      logger.info("Memory monitoring is disabled");
      return;
    }

    // Create a dedicated logger for memory metrics
    this.metricsLogger = createLogger({
      level: this.config.logLevel,
      format: format.combine(format.timestamp(), format.json()),
      transports: [
        new DailyRotateFile({
          filename: resolve(getDataPath(), "log", "memory-metrics-%DATE%"),
          datePattern: "YYYY-MM-DD",
          extension: ".log",
          zippedArchive: true,
          maxSize: "20m",
          maxFiles: "30d", // Keep 30 days of memory metrics
          level: this.config.logLevel,
        }),
      ],
    });

    this.isInitialized = true;
    logger.info(
      `Memory monitor initialized (interval: ${String(this.config.intervalMs)}ms)`,
    );
  }

  /**
   * Start monitoring memory usage
   */
  start(): void {
    if (!this.isInitialized || !this.config.enabled) {
      logger.debug("Memory monitor not started (disabled or not initialized)");
      return;
    }

    if (this.intervalId) {
      logger.warn("Memory monitor already running");
      return;
    }

    this.startTime = DateTime.now();

    // Log initial metrics immediately
    this.collectAndLogMetrics();

    // Set up periodic collection
    this.intervalId = setInterval(() => {
      this.collectAndLogMetrics();
    }, this.config.intervalMs);

    logger.info("Memory monitoring started");
  }

  /**
   * Stop monitoring memory usage
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info("Memory monitoring stopped");

      // Log final metrics
      this.collectAndLogMetrics();
    }
  }

  /**
   * Collect current memory metrics
   * @returns Current memory metrics including process and system memory
   */
  private collectMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage();
    const freeMem = freemem();
    const totalMem = totalmem();
    const usedMem = totalMem - freeMem;

    return {
      timestamp: DateTime.now().toISO() || "",
      process: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        arrayBuffers: memUsage.arrayBuffers,
      },
      system: {
        freeMem,
        totalMem,
        usedMem,
        freeMemPercentage: (freeMem / totalMem) * 100,
      },
    };
  }

  /**
   * Format memory metrics for human-readable display
   * @param metrics - The memory metrics to format
   * @returns Formatted memory metrics string
   */
  private formatMetrics(metrics: MemoryMetrics): string {
    const formatBytes = (bytes: number): string => {
      const mb = bytes / 1024 / 1024;
      return `${mb.toFixed(2)} MB`;
    };

    const uptime = this.startTime
      ? DateTime.now().diff(this.startTime).toFormat("hh:mm:ss")
      : "unknown";

    return [
      `Memory Metrics (uptime: ${uptime})`,
      "  Process:",
      `    Heap Used:      ${formatBytes(metrics.process.heapUsed)}`,
      `    Heap Total:     ${formatBytes(metrics.process.heapTotal)}`,
      `    RSS:            ${formatBytes(metrics.process.rss)}`,
      `    External:       ${formatBytes(metrics.process.external)}`,
      `    Array Buffers:  ${formatBytes(metrics.process.arrayBuffers)}`,
      "  System:",
      `    Used Memory:    ${formatBytes(metrics.system.usedMem)} / ${formatBytes(metrics.system.totalMem)}`,
      `    Free Memory:    ${formatBytes(metrics.system.freeMem)} (${metrics.system.freeMemPercentage.toFixed(1)}%)`,
    ].join("\n");
  }

  /**
   * Collect and log current memory metrics
   */
  private collectAndLogMetrics(): void {
    const metrics = this.collectMetrics();

    // Log to dedicated metrics file
    if (this.metricsLogger) {
      this.metricsLogger.info("Memory metrics", metrics);
    }

    // Also log to main logger at debug level for immediate visibility
    logger.debug(`\n${this.formatMetrics(metrics)}`);
  }

  /**
   * Get current memory metrics (for API/bot access)
   * @returns Current memory metrics
   */
  getCurrentMetrics(): MemoryMetrics {
    return this.collectMetrics();
  }

  /**
   * Get formatted current metrics as string (for API/bot access)
   * @returns Formatted memory metrics string
   */
  getFormattedMetrics(): string {
    return this.formatMetrics(this.collectMetrics());
  }

  /**
   * Destroy the service and clean up resources
   */
  destroy(): void {
    this.stop();

    if (this.metricsLogger) {
      this.metricsLogger.close();
      this.metricsLogger = undefined;
    }

    this.isInitialized = false;
    logger.info("Memory monitor destroyed");
  }
}

// Export singleton instance
export const memoryMonitorService = new MemoryMonitorService();
