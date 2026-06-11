import type { UserAction, Suggestion } from '../ai/types';
import { generateId } from '../utils/throttle';

export function analyzeEfficiency(actions: UserAction[]): Suggestion[] {
  const suggestions: Suggestion[] = [];

  const repeatedActions = detectRepeatedActions(actions);
  if (repeatedActions.length > 0) {
    for (const action of repeatedActions) {
      suggestions.push({
        id: generateId(),
        type: 'efficiency',
        priority: 'medium',
        title: '重复操作检测',
        description: `检测到您频繁执行"${action.target}"操作（${action.count}次），可考虑使用批量操作或自动化来提升效率`,
        confidence: 0.75,
        actionHint: '查看是否有批量操作功能或设置自动化规则',
        createdAt: Date.now(),
      });
    }
  }

  const filterPatterns = detectFilterPatterns(actions);
  if (filterPatterns.length > 0) {
    suggestions.push({
      id: generateId(),
      type: 'efficiency',
      priority: 'low',
      title: '常用筛选条件',
      description: `您频繁使用以下筛选条件: ${filterPatterns.join('、')}。建议保存为快捷筛选方案`,
      confidence: 0.8,
      actionHint: '保存常用的筛选条件组合',
      createdAt: Date.now(),
    });
  }

  const navigationPatterns = detectNavigationPatterns(actions);
  if (navigationPatterns.length > 0) {
    suggestions.push({
      id: generateId(),
      type: 'efficiency',
      priority: 'low',
      title: '页面切换优化',
      description: `您在以下页面间频繁切换: ${navigationPatterns.join(' ↔ ')}。建议使用多标签页同时查看`,
      confidence: 0.7,
      actionHint: '使用浏览器多标签页功能',
      createdAt: Date.now(),
    });
  }

  return suggestions;
}

function detectRepeatedActions(actions: UserAction[]): UserAction[] {
  const actionCountMap = new Map<string, UserAction>();

  for (const action of actions) {
    const key = `${action.type}:${action.target}`;
    const existing = actionCountMap.get(key);
    if (!existing || (action.count || 1) > (existing.count || 1)) {
      actionCountMap.set(key, action);
    }
  }

  return Array.from(actionCountMap.values())
    .filter(a => (a.count || 1) >= 5);
}

function detectFilterPatterns(actions: UserAction[]): string[] {
  const filterActions = actions.filter(
    a => a.type === 'filter' || a.type === 'input',
  );

  const patterns = new Set<string>();
  const actionCount = new Map<string, number>();

  for (const action of filterActions) {
    const key = action.value || action.target;
    actionCount.set(key, (actionCount.get(key) || 0) + 1);
  }

  for (const [key, count] of actionCount.entries()) {
    if (count >= 3) {
      patterns.add(key);
    }
  }

  return Array.from(patterns).slice(0, 5);
}

function detectNavigationPatterns(actions: UserAction[]): string[] {
  const navigateActions = actions.filter(a => a.type === 'navigate');
  const pageTransitions = new Map<string, number>();

  for (let i = 0; i < navigateActions.length - 1; i++) {
    const from = navigateActions[i].pageUrl;
    const to = navigateActions[i + 1].pageUrl;
    const key = `${from} → ${to}`;
    pageTransitions.set(key, (pageTransitions.get(key) || 0) + 1);
  }

  const frequentTransitions = Array.from(pageTransitions.entries())
    .filter(([_, count]) => count >= 3)
    .map(([transition]) => transition);

  return frequentTransitions.slice(0, 3);
}
