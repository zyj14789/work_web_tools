import React from 'react';
import { useSettings } from '../../hooks/useSettings';

export const SuggestionToggle: React.FC = () => {
  const {
    suggestionsEnabled,
    anomalyAlertsEnabled,
    efficiencyTipsEnabled,
    strategyAdviceEnabled,
    checkFrequency,
    saveSettings,
  } = useSettings();

  const frequencies: Array<{ value: string; label: string }> = [
    { value: 'realtime', label: '实时' },
    { value: '5min', label: '5分钟' },
    { value: '15min', label: '15分钟' },
    { value: 'manual', label: '手动' },
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">建议设置</h3>

      <div className="space-y-2">
        <label className="flex items-center justify-between py-1">
          <span className="text-xs text-gray-600">总开关</span>
          <input
            type="checkbox"
            checked={suggestionsEnabled}
            onChange={(e) => saveSettings({ suggestionsEnabled: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded"
          />
        </label>

        <div className="border-t border-gray-100 pt-2 space-y-2">
          <label className="flex items-center justify-between py-1">
            <span className="text-xs text-gray-600 ml-4">异常预警</span>
            <input
              type="checkbox"
              checked={anomalyAlertsEnabled}
              disabled={!suggestionsEnabled}
              onChange={(e) => saveSettings({ anomalyAlertsEnabled: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between py-1">
            <span className="text-xs text-gray-600 ml-4">效率优化</span>
            <input
              type="checkbox"
              checked={efficiencyTipsEnabled}
              disabled={!suggestionsEnabled}
              onChange={(e) => saveSettings({ efficiencyTipsEnabled: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between py-1">
            <span className="text-xs text-gray-600 ml-4">策略建议</span>
            <input
              type="checkbox"
              checked={strategyAdviceEnabled}
              disabled={!suggestionsEnabled}
              onChange={(e) => saveSettings({ strategyAdviceEnabled: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded"
            />
          </label>
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-xs text-gray-500 mb-1">检查频率</label>
        <select
          value={checkFrequency}
          onChange={(e) => saveSettings({ checkFrequency: e.target.value as never })}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        >
          {frequencies.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
