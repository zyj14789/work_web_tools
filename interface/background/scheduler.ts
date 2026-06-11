import { logger } from '../../app/utils/logger';
import { getStorageManager } from '../../app/storage/manager';

type ScheduledTask = {
  name: string;
  intervalMs: number;
  lastRun: number;
  fn: () => Promise<void>;
};

export class BackgroundScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private running = false;

  registerTask(name: string, intervalMs: number, fn: () => Promise<void>): void {
    this.tasks.set(name, {
      name,
      intervalMs,
      lastRun: 0,
      fn,
    });
    logger.info(`Task registered: ${name}, interval: ${intervalMs}ms`);
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    for (const task of this.tasks.values()) {
      const timer = setInterval(async () => {
        try {
          await task.fn();
          task.lastRun = Date.now();
        } catch (error) {
          logger.error(`Task ${task.name} failed`, error);
        }
      }, task.intervalMs);

      this.timers.set(task.name, timer);
    }

    logger.info(`Scheduler started with ${this.tasks.size} tasks`);
  }

  stop(): void {
    this.running = false;
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
    logger.info('Scheduler stopped');
  }

  getTaskStatus(name: string): { lastRun: number; nextRun: number } | null {
    const task = this.tasks.get(name);
    if (!task) return null;
    return {
      lastRun: task.lastRun,
      nextRun: task.lastRun + task.intervalMs,
    };
  }

  getAllStatus(): Array<{ name: string; lastRun: number; nextRun: number }> {
    return Array.from(this.tasks.values()).map(task => ({
      name: task.name,
      lastRun: task.lastRun,
      nextRun: task.lastRun + task.intervalMs,
    }));
  }
}

export function createDataPruningTask(): () => Promise<void> {
  return async () => {
    const storage = getStorageManager().getAdapter();
    const allData = await storage.getAll();

    const userMemoryKeys = Object.keys(allData).filter(k => k.startsWith('userMemory:'));
    if (userMemoryKeys.length > 2000) {
      logger.info(`Pruning old data: ${userMemoryKeys.length} entries`);
      // Keep most recent entries
      const sorted = userMemoryKeys.sort();
      const toRemove = sorted.slice(0, sorted.length - 1000);
      for (const key of toRemove) {
        await storage.remove(key);
      }
      logger.info(`Pruned ${toRemove.length} old entries`);
    }
  };
}
