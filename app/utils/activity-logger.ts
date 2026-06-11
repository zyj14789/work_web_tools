import type { ActivityLogEntry, ActivityLogLevel, ThinkingProcess, ThinkingStep, AIConversationEntry } from '../ai/types';
import { generateId } from './throttle';
import { logger as internalLogger } from './logger';

type LogListener = (entry: ActivityLogEntry) => void;
type ThinkingListener = (process: ThinkingProcess) => void;
type ConversationListener = (entry: AIConversationEntry) => void;

class ActivityLogger {
  private logs: ActivityLogEntry[] = [];
  private thinkingProcesses: ThinkingProcess[] = [];
  private conversations: AIConversationEntry[] = [];
  private logListeners: Set<LogListener> = new Set();
  private thinkingListeners: Set<ThinkingListener> = new Set();
  private conversationListeners: Set<ConversationListener> = new Set();
  private maxLogs = 500;
  private maxConversations = 100;

  addEntry(
    level: ActivityLogLevel,
    message: string,
    source: ActivityLogEntry['source'] = 'system',
    detail?: string,
    step?: string,
    duration?: number,
  ): ActivityLogEntry {
    const entry: ActivityLogEntry = {
      id: generateId(),
      timestamp: Date.now(),
      level,
      message,
      detail,
      step,
      duration,
      source,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    internalLogger.debug(`[Activity] ${message}`, { level, source });

    for (const listener of this.logListeners) {
      try { listener(entry); } catch { /* ignore */ }
    }

    return entry;
  }

  info(message: string, source: ActivityLogEntry['source'] = 'system', detail?: string, step?: string): ActivityLogEntry {
    return this.addEntry('info', message, source, detail, step);
  }

  success(message: string, source: ActivityLogEntry['source'] = 'system', detail?: string): ActivityLogEntry {
    return this.addEntry('success', message, source, detail);
  }

  warn(message: string, source: ActivityLogEntry['source'] = 'system', detail?: string): ActivityLogEntry {
    return this.addEntry('warn', message, source, detail);
  }

  error(message: string, source: ActivityLogEntry['source'] = 'system', detail?: string): ActivityLogEntry {
    return this.addEntry('error', message, source, detail);
  }

  thinking(message: string, detail?: string): ActivityLogEntry {
    return this.addEntry('thinking', message, 'ai', detail);
  }

  startThinkingProcess(title: string): ThinkingProcess {
    const process: ThinkingProcess = {
      id: generateId(),
      title,
      startTime: Date.now(),
      steps: [],
      status: 'running',
    };
    this.thinkingProcesses.push(process);
    this.notifyThinkingListeners();

    this.addEntry('thinking', `🧠 ${title}`, 'ai');
    return process;
  }

  addThinkingStep(process: ThinkingProcess, phase: ThinkingStep['phase'], label: string, detail?: string): ThinkingStep {
    const step: ThinkingStep = {
      id: generateId(),
      phase,
      label,
      detail,
      startTime: Date.now(),
    };

    if (phase === 'done' || phase === 'error') {
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      const durationStr = step.duration > 1000
        ? `${(step.duration / 1000).toFixed(1)}s`
        : `${step.duration}ms`;
      this.addEntry('thinking', `${label} (${durationStr})`, 'ai', detail);
    } else {
      this.addEntry('thinking', label, 'ai', detail);
    }

    process.steps.push(step);
    this.notifyThinkingListeners();
    return step;
  }

  completeThinkingProcess(process: ThinkingProcess): void {
    process.endTime = Date.now();
    process.status = 'completed';
    const duration = process.endTime - process.startTime;
    const durationStr = duration > 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`;
    this.success(`✅ ${process.title} 完成 (${durationStr})`, 'ai');
    this.notifyThinkingListeners();
  }

  failThinkingProcess(process: ThinkingProcess, error: string): void {
    process.endTime = Date.now();
    process.status = 'error';
    process.error = error;
    this.error(`❌ ${process.title} 失败: ${error}`, 'ai');
    this.notifyThinkingListeners();
  }

  addConversation(conv: Omit<AIConversationEntry, 'id' | 'timestamp'>): AIConversationEntry {
    const entry: AIConversationEntry = {
      ...conv,
      id: generateId(),
      timestamp: Date.now(),
    };
    this.conversations.push(entry);
    if (this.conversations.length > this.maxConversations) {
      this.conversations = this.conversations.slice(-this.maxConversations);
    }
    for (const listener of this.conversationListeners) {
      try { listener(entry); } catch { /* ignore */ }
    }
    return entry;
  }

  getLogs(limit = 100): ActivityLogEntry[] {
    return this.logs.slice(-limit);
  }

  getConversations(limit = 50): AIConversationEntry[] {
    return this.conversations.slice(-limit);
  }

  getThinkingProcesses(): ThinkingProcess[] {
    return this.thinkingProcesses.slice(-10);
  }

  getLatestThinkingProcess(): ThinkingProcess | undefined {
    return this.thinkingProcesses[this.thinkingProcesses.length - 1];
  }

  onLog(listener: LogListener): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  onThinking(listener: ThinkingListener): () => void {
    this.thinkingListeners.add(listener);
    return () => this.thinkingListeners.delete(listener);
  }

  onConversation(listener: ConversationListener): () => void {
    this.conversationListeners.add(listener);
    return () => this.conversationListeners.delete(listener);
  }

  clearLogs(): void {
    this.logs = [];
    this.thinkingProcesses = [];
    this.conversations = [];
  }

  private notifyThinkingListeners(): void {
    const latest = this.thinkingProcesses[this.thinkingProcesses.length - 1];
    if (!latest) return;
    for (const listener of this.thinkingListeners) {
      try { listener(latest); } catch { /* ignore */ }
    }
  }
}

export const activityLogger = new ActivityLogger();
