export { SessionMemoryManager } from './session-memory';
export { UserMemoryManager } from './user-memory';
export { getGlobalKnowledge, getBenchmark, getBestPractices, updateKnowledge } from './global-knowledge';
export type {
  SessionMemory,
  PageView,
  UserMemory,
  GlobalKnowledge,
  IndustryBenchmarks,
  BestPractice,
} from './types';

import { SessionMemoryManager } from './session-memory';
import { UserMemoryManager } from './user-memory';
import { getGlobalKnowledge } from './global-knowledge';
import { logger } from '../utils/logger';

export class MemorySystem {
  public session: SessionMemoryManager;
  public user: UserMemoryManager;

  constructor() {
    this.session = new SessionMemoryManager();
    this.user = new UserMemoryManager();
  }

  async initialize(): Promise<void> {
    await this.user.initialize();
    logger.info('MemorySystem initialized');
  }

  async getGlobalKnowledge() {
    return getGlobalKnowledge();
  }
}
