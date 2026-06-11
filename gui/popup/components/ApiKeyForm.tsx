import React, { useState } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { Button } from '../../shared/Button';

export const ApiKeyForm: React.FC = () => {
  const { apiKey, saveSettings, testApiKey } = useSettings();
  const [key, setKey] = useState(apiKey || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSave = async () => {
    await saveSettings({ apiKey: key.trim() });
  };

  const handleTest = async () => {
    if (!key.trim()) return;
    setTesting(true);
    setTestResult(null);
    const result = await testApiKey(key.trim());
    setTestResult(result);
    setTesting(false);
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">API Key 配置</h3>

      <label className="block text-xs text-gray-500 mb-1">DeepSeek API Key</label>
      <input
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="sk-..."
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none mb-2"
      />

      {testResult && (
        <div
          className={`text-xs p-2 rounded-lg mb-2 ${
            testResult.success
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {testResult.message}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleSave} size="sm" variant="primary">
          保存
        </Button>
        <Button
          onClick={handleTest}
          size="sm"
          variant="secondary"
          loading={testing}
        >
          测试连接
        </Button>
      </div>

      <p className="text-xs text-gray-400 mt-2">
        API Key仅存储在本地浏览器，不会上传
      </p>
    </div>
  );
};
