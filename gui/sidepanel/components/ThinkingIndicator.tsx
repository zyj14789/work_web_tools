import React from 'react';
import { useSyncExternalStore } from 'react';
import { activityLogStore } from '../../stores/activity-log-store';
import type { ThinkingProcess, ThinkingStep } from '../../../app/ai/types';

const phaseIcons: Record<string, string> = {
  preparing: '📋',
  calling: '📡',
  processing: '⚙️',
  done: '✅',
  error: '❌',
};

const ThinkingStepItem: React.FC<{ step: ThinkingStep }> = ({ step }) => {
  const isActive = step.phase === 'calling' || step.phase === 'processing';
  const isDone = step.phase === 'done';
  const isError = step.phase === 'error';

  return (
    <div className={`flex items-start gap-2 py-1.5 text-xs ${isError ? 'text-red-600' : isDone ? 'text-green-600' : 'text-gray-600'}`}>
      <span className="mt-0.5">
        {isActive ? (
          <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <span>{phaseIcons[step.phase] || '•'}</span>
        )}
      </span>
      <div className="flex-1 min-w-0">
        <span>{step.label}</span>
        {step.duration && (
          <span className="ml-1 text-gray-400">
            ({step.duration > 1000 ? `${(step.duration / 1000).toFixed(1)}s` : `${step.duration}ms`})
          </span>
        )}
        {step.detail && (
          <p className="text-gray-400 text-[11px] mt-0.5">{step.detail}</p>
        )}
        {isError && step.error && (
          <p className="text-red-500 text-[11px] mt-0.5">{step.error}</p>
        )}
      </div>
    </div>
  );
};

export const ThinkingIndicator: React.FC = () => {
  const state = useSyncExternalStore(
    activityLogStore.subscribe,
    () => activityLogStore.getState(),
  );

  const latest = state.latestThinking;
  if (!latest) return null;

  const isRunning = latest.status === 'running';
  const totalDuration = latest.endTime
    ? latest.endTime - latest.startTime
    : Date.now() - latest.startTime;
  const durationStr = totalDuration > 1000
    ? `${(totalDuration / 1000).toFixed(1)}s`
    : `${totalDuration}ms`;

  return (
    <div className={`mx-3 mb-3 rounded-lg border overflow-hidden transition-all ${isRunning ? 'border-blue-200 bg-blue-50/50' : latest.status === 'error' ? 'border-red-200 bg-red-50/50' : 'border-green-200 bg-green-50/50'}`}>
      <div className="px-3 py-2 border-b border-inherit flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          {isRunning ? (
            <span className="inline-block w-2.5 h-2.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : latest.status === 'error' ? (
            <span>❌</span>
          ) : (
            <span>✅</span>
          )}
          <span className={isRunning ? 'text-blue-700' : latest.status === 'error' ? 'text-red-700' : 'text-green-700'}>
            {latest.title}
          </span>
        </div>
        <span className="text-[11px] text-gray-400">{durationStr}</span>
      </div>

      <div className="px-3 py-1">
        {latest.steps.map(step => (
          <ThinkingStepItem key={step.id} step={step} />
        ))}
      </div>

      {isRunning && (
        <div className="px-3 py-1.5 text-[11px] text-blue-500 bg-blue-50/80 border-t border-blue-100">
          AI思考中...
        </div>
      )}

      {latest.error && (
        <div className="px-3 py-1.5 text-[11px] text-red-600 bg-red-50/80 border-t border-red-100">
          {latest.error}
        </div>
      )}
    </div>
  );
};
