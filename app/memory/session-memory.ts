import type { PageView, SessionMemory } from './types';
import type { UserAction, ExtractedData } from '../ai/types';
import { generateId } from '../utils/throttle';

export class SessionMemoryManager {
  private memory: SessionMemory;

  constructor() {
    this.memory = {
      pageHistory: [],
      actionSequence: [],
      extractedData: [],
    };
  }

  startPageView(url: string, title: string): PageView {
    const view: PageView = {
      url,
      title,
      entryTime: Date.now(),
      actions: [],
    };
    this.memory.pageHistory.push(view);
    return view;
  }

  endPageView(url: string): void {
    const view = this.memory.pageHistory.find(
      v => v.url === url && !v.exitTime,
    );
    if (view) {
      view.exitTime = Date.now();
      view.duration = view.exitTime - view.entryTime;
    }
  }

  recordAction(
    type: UserAction['type'],
    target: string,
    pageUrl: string,
    value?: string,
  ): UserAction {
    const existing = this.memory.actionSequence.find(
      a => a.type === type && a.target === target && a.pageUrl === pageUrl,
    );

    if (existing) {
      existing.count = (existing.count || 1) + 1;
      existing.timestamp = Date.now();
      return existing;
    }

    const action: UserAction = {
      id: generateId(),
      type,
      target,
      value,
      timestamp: Date.now(),
      pageUrl,
      count: 1,
    };

    this.memory.actionSequence.push(action);

    const currentView = this.getCurrentPageView(pageUrl);
    if (currentView) {
      currentView.actions.push(action);
    }

    return action;
  }

  addExtractedData(data: ExtractedData): void {
    this.memory.extractedData.push(data);
    if (this.memory.extractedData.length > 50) {
      this.memory.extractedData = this.memory.extractedData.slice(-30);
    }
  }

  getSessionData(): SessionMemory {
    return { ...this.memory };
  }

  getCurrentPageView(url: string): PageView | undefined {
    return this.memory.pageHistory.find(
      v => v.url === url && !v.exitTime,
    );
  }

  getRecentActions(limit = 20): UserAction[] {
    return this.memory.actionSequence.slice(-limit);
  }

  getLatestExtractedData(): ExtractedData | null {
    return this.memory.extractedData[this.memory.extractedData.length - 1] || null;
  }

  clearSession(): void {
    this.memory = {
      pageHistory: [],
      actionSequence: [],
      extractedData: [],
    };
  }
}
