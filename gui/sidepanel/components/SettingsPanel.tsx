import React, { useState } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { Button } from '../../shared/Button';
import { Toast } from '../../shared/Toast';
import { DomainManager } from './DomainManager';

export const SettingsPanel: React.FC = () => {
  const {
    apiKey,
    suggestionsEnabled,
    anomalyAlertsEnabled,
    efficiencyTipsEnabled,
    strategyAdviceEnabled,
    checkFrequency,
    sensitivity,
    anomalyThresholds,
    saveSettings,
    testApiKey,
  } = useSettings();

  const [key, setKey] = useState(apiKey || '');
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const frequencies: Array<{ value: string; label: string }> = [
    { value: 'realtime', label: '实时' },
    { value: '5min', label: '每5分钟' },
    { value: '15min', label: '每15分钟' },
    { value: 'manual', label: '手动触发' },
  ];

  const sensitivities: Array<{ value: string; label: string }> = [
    { value: 'low', label: '低（减少提醒）' },
    { value: 'medium', label: '中（推荐）' },
    { value: 'high', label: '高（更多提醒）' },
  ];

  const handleSaveApiKey = async () => {
    await saveSettings({ apiKey: key.trim() });
    setToast({ message: 'API Key已保存', type: 'success' });
  };

  const handleTestApiKey = async () => {
    setTesting(true);
    const result = await testApiKey(key.trim());
    setToast({
      message: result.message,
      type: result.success ? 'success' : 'error',
    });
    setTesting(false);
  };

  return (
    <div className="p-4 space-y-5">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">API连接</h3>
        <div className="space-y-2">
          <label className="block text-xs text-gray-500">DeepSeek API Key</label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-..."
            className="w-full"
          />
          <div className="flex gap-2">
            <Button onClick={handleSaveApiKey} size="sm">
              保存
            </Button>
            <Button onClick={handleTestApiKey} size="sm" variant="secondary" loading={testing}>
              测试连接
            </Button>
          </div>
          <p className="text-xs text-gray-400">API Key仅存储在本地，不会上传</p>
        </div>
      </section>

      <DomainManager />

      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">建议开关</h3>
        <div className="space-y-2">
          <ToggleRow
            label="总开关"
            checked={suggestionsEnabled}
            onChange={(v) => saveSettings({ suggestionsEnabled: v })}
          />
          <div className="ml-4 space-y-2 border-l-2 border-gray-100 pl-3">
            <ToggleRow
              label="异常预警"
              checked={anomalyAlertsEnabled}
              disabled={!suggestionsEnabled}
              onChange={(v) => saveSettings({ anomalyAlertsEnabled: v })}
            />
            <ToggleRow
              label="效率优化"
              checked={efficiencyTipsEnabled}
              disabled={!suggestionsEnabled}
              onChange={(v) => saveSettings({ efficiencyTipsEnabled: v })}
            />
            <ToggleRow
              label="策略建议"
              checked={strategyAdviceEnabled}
              disabled={!suggestionsEnabled}
              onChange={(v) => saveSettings({ strategyAdviceEnabled: v })}
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">检查频率</h3>
        <select
          value={checkFrequency}
          onChange={(e) => saveSettings({ checkFrequency: e.target.value as never })}
          className="w-full"
        >
          {frequencies.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">敏感度</h3>
        <select
          value={sensitivity}
          onChange={(e) => saveSettings({ sensitivity: e.target.value as never })}
          className="w-full"
        >
          {sensitivities.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">异常阈值</h3>
        <div className="space-y-2">
          <ThresholdInput
            label="CTR下降阈值(%)"
            value={anomalyThresholds.ctrDropPercent}
            onChange={(v) => saveSettings({
              anomalyThresholds: { ...anomalyThresholds, ctrDropPercent: v },
            })}
          />
          <ThresholdInput
            label="消耗波动阈值(%)"
            value={anomalyThresholds.costSpikePercent}
            onChange={(v) => saveSettings({
              anomalyThresholds: { ...anomalyThresholds, costSpikePercent: v },
            })}
          />
          <ThresholdInput
            label="CPA上涨阈值(%)"
            value={anomalyThresholds.cpaSurgePercent}
            onChange={(v) => saveSettings({
              anomalyThresholds: { ...anomalyThresholds, cpaSurgePercent: v },
            })}
          />
          <ThresholdInput
            label="转化下降阈值(%)"
            value={anomalyThresholds.conversionDropPercent}
            onChange={(v) => saveSettings({
              anomalyThresholds: { ...anomalyThresholds, conversionDropPercent: v },
            })}
          />
        </div>
      </section>
    </div>
  );
};

const ToggleRow: React.FC<{
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}> = ({ label, checked, disabled, onChange }) => (
  <label className={`flex items-center justify-between py-1.5 ${disabled ? 'opacity-50' : ''}`}>
    <span className="text-xs text-gray-600">{label}</span>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 rounded"
    />
  </label>
);

const ThresholdInput: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between">
    <label className="text-xs text-gray-600">{label}</label>
    <input
      type="number"
      value={value}
      min={5}
      max={90}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-20 text-sm text-right"
    />
  </div>
);
