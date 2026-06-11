import React, { useEffect, useRef } from 'react';
import { useSyncExternalStore } from 'react';
import { activityLogStore } from '../../stores/activity-log-store';
import { Button } from '../../shared/Button';
import type { ActivityLogEntry } from '../../../app/ai/types';

const levelStyles: Record<string, string> = {
  info: 'text-gray-600 border-l-gray-300',
  success: 'text-green-700 border-l-green-400',
  warn: 'text-yellow-700 border-l-yellow-400',
  error: 'text-red-700 border-l-red-400',
  thinking: 'text-blue-600 border-l-blue-400',
};

const sourceLabels: Record<string, string> = {
  system: '系统',
  ai: 'AI',
  page: '页面',
  user: '用户',
};

const sourceColors: Record<string, string> = {
  system: 'bg-gray-100 text-gray-600',
  ai: 'bg-blue-100 text-blue-700',
  page: 'bg-green-100 text-green-700',
  user: 'bg-purple-100 text-purple-700',
};

const LogEntry: React.FC<{ entry: ActivityLogEntry }> = ({ entry }) => {
  const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className={`pl-3 pr-2 py-1.5 border-l-2 ${levelStyles[entry.level] || levelStyles.info} text-xs`}>
      <div className="flex items-center gap-1.5">
        <span className="text-gray-400 font-mono text-[10px]">{time}</span>
        <span className={`px-1 py-0 text-[10px] rounded font-medium ${sourceColors[entry.source] || sourceColors.system}`}>
          {sourceLabels[entry.source] || entry.source}
        </span>
      </div>
      <p className="mt-0.5 leading-relaxed">{entry.message}</p>
      {entry.detail && (
        <p className="text-gray-400 text-[11px] mt-0.5">{entry.detail}</p>
      )}
    </div>
  );
};

export const ActivityLog: React.FC = () => {
  const state = useSyncExternalStore(
    activityLogStore.subscribe,
    () => activityLogStore.getState(),
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    state.loadLogs();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.logs.length]);

  const handleClear = async () => {
    await state.clearLogs();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-800">
          实时日志
          {state.logs.length > 0 && (
            <span className="ml-1.5 text-xs text-gray-400 font-normal">({state.logs.length})</span>
          )}
        </h3>
        <Button onClick={handleClear} size="sm" variant="ghost" disabled={state.logs.length === 0}>
          清空
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {state.logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs">
            暂无日志，打开广告后台页面后将自动显示
          </div>
        ) : (
          <div className="py-1">
            {state.logs.map(entry => (
              <LogEntry key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
