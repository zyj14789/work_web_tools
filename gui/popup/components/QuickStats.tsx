import React from 'react';

interface QuickStatsProps {
  suggestionCount: number;
}

export const QuickStats: React.FC<QuickStatsProps> = ({ suggestionCount }) => {
  return (
    <div className="p-4 grid grid-cols-2 gap-3">
      <div className="bg-blue-50 rounded-lg p-3 text-center">
        <div className="text-lg font-bold text-blue-700">
          {suggestionCount > 0 ? suggestionCount : '—'}
        </div>
        <div className="text-xs text-blue-600 mt-0.5">待处理建议</div>
      </div>
      <div className="bg-green-50 rounded-lg p-3 text-center">
        <div className="text-lg font-bold text-green-700">●</div>
        <div className="text-xs text-green-600 mt-0.5">运行中</div>
      </div>
    </div>
  );
};
