import React, { useState } from 'react';
import type { Suggestion } from '../../../app/ai/types';
import { useSuggestions } from '../../hooks/useSuggestions';
import { Badge } from '../../shared/Badge';
import { Button } from '../../shared/Button';

interface SuggestionCardProps {
  suggestion: Suggestion;
}

const priorityBadgeVariant: Record<string, 'high' | 'medium' | 'low'> = {
  high: 'high',
  medium: 'medium',
  low: 'low',
};

const typeLabels: Record<string, string> = {
  anomaly: '异常',
  opportunity: '机会',
  efficiency: '效率',
  strategy: '策略',
};

export const SuggestionCard: React.FC<SuggestionCardProps> = ({ suggestion }) => {
  const { dismissSuggestion } = useSuggestions();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-2 bg-white border border-gray-200 rounded-lg overflow-hidden transition-shadow hover:shadow-sm">
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${
              suggestion.priority === 'high' ? 'bg-red-500' :
              suggestion.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
            }`} />
            <Badge variant={priorityBadgeVariant[suggestion.priority] || 'info'}>
              {typeLabels[suggestion.type] || suggestion.type}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            {suggestion.confidence > 0 && (
              <span className="text-xs text-gray-400">
                {Math.round(suggestion.confidence * 100)}%
              </span>
            )}
            <button
              onClick={() => dismissSuggestion(suggestion.id)}
              className="text-gray-300 hover:text-gray-500 text-xs px-1"
            >
              ✕
            </button>
          </div>
        </div>

        <h3 className="text-sm font-medium text-gray-800 mt-2 mb-1">
          {suggestion.title}
        </h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          {suggestion.description}
        </p>

        {suggestion.actionHint && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:text-blue-700 mt-2 font-medium"
          >
            {expanded ? '收起' : '查看建议操作'}
          </button>
        )}

        {expanded && suggestion.actionHint && (
          <div className="mt-2 p-2 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">{suggestion.actionHint}</p>
          </div>
        )}
      </div>
    </div>
  );
};
