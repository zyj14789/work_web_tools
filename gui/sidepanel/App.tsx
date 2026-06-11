import React, { useEffect } from 'react';
import { useSyncExternalStore } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useSuggestions } from '../hooks/useSuggestions';
import { useChromeMessage } from '../hooks/useChromeMessage';
import { activityLogStore } from '../stores/activity-log-store';
import { SuggestionList } from './components/SuggestionList';
import { SettingsPanel } from './components/SettingsPanel';
import { DataManager } from './components/DataManager';
import { ActivityLog } from './components/ActivityLog';
import { AIConversationLog } from './components/AIConversationLog';
import { ThinkingIndicator } from './components/ThinkingIndicator';
import { Badge } from '../shared/Badge';

type Tab = 'suggestions' | 'ai-conversation' | 'activity' | 'settings' | 'data';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<Tab>('suggestions');
  const { apiKey, suggestionsEnabled, loadSettings } = useSettings();
  const { suggestions, loadSuggestions } = useSuggestions();
  const thinkingState = useSyncExternalStore(
    activityLogStore.subscribe,
    () => activityLogStore.getState(),
  );

  useChromeMessage();

  useEffect(() => {
    loadSettings();
    loadSuggestions();
    thinkingState.loadLogs();
  }, []);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'suggestions', label: '建议' },
    { key: 'ai-conversation', label: 'AI对话' },
    { key: 'activity', label: '日志' },
    { key: 'settings', label: '设置' },
    { key: 'data', label: '数据' },
  ];

  const anomalyCount = suggestions.filter(s => s.type === 'anomaly').length;
  const isThinking = thinkingState.latestThinking?.status === 'running';
  const convCount = thinkingState.conversations.length;

  return (
    <div
      className="h-full flex flex-col bg-white"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}
    >
      <header className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-bold text-gray-900">AI广告助手</h1>
          <div className="flex items-center gap-2">
            {isThinking && (
              <span className="inline-block w-2.5 h-2.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            <span className={`w-2 h-2 rounded-full ${apiKey ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-xs text-gray-400">
              {apiKey ? '已连接' : '未配置'}
            </span>
          </div>
        </div>

        <nav className="flex gap-1 mt-3 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-3 py-1.5 text-xs rounded-lg transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {tab.label}
              {tab.key === 'suggestions' && anomalyCount > 0 && (
                <Badge
                  variant="high"
                  className="absolute -top-1 -right-1 px-1.5 py-0 text-[10px]"
                >
                  {anomalyCount}
                </Badge>
              )}
              {tab.key === 'ai-conversation' && convCount > 0 && (
                <Badge
                  variant="info"
                  className="absolute -top-1 -right-1 px-1.5 py-0 text-[10px]"
                >
                  {convCount}
                </Badge>
              )}
              {tab.key === 'activity' && isThinking && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </nav>
      </header>

      {(activeTab === 'suggestions' || activeTab === 'ai-conversation') && <ThinkingIndicator />}

      <main className="flex-1 overflow-y-auto">
        {activeTab === 'suggestions' && <SuggestionList />}
        {activeTab === 'ai-conversation' && <AIConversationLog />}
        {activeTab === 'activity' && <ActivityLog />}
        {activeTab === 'settings' && <SettingsPanel />}
        {activeTab === 'data' && <DataManager />}
      </main>
    </div>
  );
};

export default App;
