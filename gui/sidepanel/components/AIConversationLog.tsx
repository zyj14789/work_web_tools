import React, { useEffect, useRef } from 'react';
import { useSyncExternalStore } from 'react';
import { activityLogStore } from '../../stores/activity-log-store';
import type { AIConversationEntry } from '../../../app/ai/types';

const ConversationCard: React.FC<{ conv: AIConversationEntry }> = ({ conv }) => {
  const time = new Date(conv.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const isSuccess = conv.status === 'success';
  const durationStr = conv.duration
    ? conv.duration > 1000 ? `${(conv.duration / 1000).toFixed(1)}s` : `${conv.duration}ms`
    : '';

  return (
    <div className={`mb-2 rounded-lg border overflow-hidden text-xs ${isSuccess ? 'border-gray-200' : 'border-red-200'}`}>
      <div className={`px-3 py-2 flex items-center justify-between ${isSuccess ? 'bg-gray-50' : 'bg-red-50'}`}>
        <div className="flex items-center gap-1.5">
          <span className={isSuccess ? 'text-green-500' : 'text-red-500'}>
            {isSuccess ? '✅' : '❌'}
          </span>
          <span className="font-medium text-gray-700">{conv.title}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          {conv.tokenUsed != null && conv.tokenUsed > 0 && <span>{conv.tokenUsed} tokens</span>}
          {durationStr && <span>{durationStr}</span>}
          <span className="text-gray-300">{time}</span>
        </div>
      </div>

      <div className="px-3 py-2 space-y-2">
        <div>
          <p className="text-gray-400 mb-0.5">📤 发送 (摘要)</p>
          <p className="text-gray-600 leading-relaxed bg-gray-50 rounded p-1.5">
            {conv.promptSummary}
          </p>
        </div>
        {conv.responseSummary && (
          <div>
            <p className="text-gray-400 mb-0.5">📥 响应 (摘要)</p>
            <p className="text-gray-600 leading-relaxed bg-blue-50 rounded p-1.5">
              {conv.responseSummary}
            </p>
          </div>
        )}
        {conv.error && (
          <div>
            <p className="text-gray-400 mb-0.5">⚠️ 错误</p>
            <p className="text-red-600 leading-relaxed bg-red-50 rounded p-1.5">
              {conv.error}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export const AIConversationLog: React.FC = () => {
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
  }, [state.conversations.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-800">
          AI对话流
          {state.conversations.length > 0 && (
            <span className="ml-1.5 text-xs text-gray-400 font-normal">({state.conversations.length})</span>
          )}
        </h3>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
        {state.conversations.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs">
            <p className="mb-2">暂无AI对话记录</p>
            <p>打开广告后台页面后，AI将分析页面数据并在此展示对话过程</p>
          </div>
        ) : (
          state.conversations.map(conv => (
            <ConversationCard key={conv.id} conv={conv} />
          ))
        )}
      </div>
    </div>
  );
};
