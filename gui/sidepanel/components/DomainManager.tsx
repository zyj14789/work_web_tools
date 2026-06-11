import React, { useState } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { Button } from '../../shared/Button';
import type { DomainEntry } from '../../../app/ai/types';

export const DomainManager: React.FC = () => {
  const { allowedDomains, saveSettings } = useSettings();
  const [newDomain, setNewDomain] = useState('');
  const [error, setError] = useState('');

  const handleAdd = async () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) return;
    if (!/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i.test(domain)) {
      setError('请输入有效的域名，如: example.com');
      return;
    }
    if (allowedDomains.some(d => d.domain === domain)) {
      setError('该域名已存在');
      return;
    }

    setError('');
    const updated = [...allowedDomains, { domain, enabled: true }];
    await saveSettings({ allowedDomains: updated });
    setNewDomain('');
  };

  const handleToggle = async (domain: string) => {
    const updated = allowedDomains.map(d =>
      d.domain === domain ? { ...d, enabled: !d.enabled } : d,
    );
    await saveSettings({ allowedDomains: updated });
  };

  const handleRemove = async (domain: string) => {
    const updated = allowedDomains.filter(d => d.domain !== domain);
    await saveSettings({ allowedDomains: updated });
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-800 mb-3">域名白名单</h3>
      <p className="text-xs text-gray-500 mb-3">
        设置插件只在指定域名下运行。留空表示在所有页面运行。
      </p>

      <div className="flex gap-2 mb-2">
        <input
          value={newDomain}
          onChange={(e) => { setNewDomain(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="例: ad.example.com"
          className="flex-1 text-sm"
        />
        <Button onClick={handleAdd} size="sm">添加</Button>
      </div>
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      {allowedDomains.length === 0 && (
        <p className="text-xs text-gray-400 py-2">未设置域名白名单，插件将在所有页面运行</p>
      )}

      <div className="space-y-1 max-h-40 overflow-y-auto">
        {allowedDomains.map(d => (
          <div key={d.domain} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={d.enabled}
                onChange={() => handleToggle(d.domain)}
                className="w-3.5 h-3.5 rounded"
              />
              <span className={`text-xs ${d.enabled ? 'text-gray-700' : 'text-gray-400 line-through'}`}>
                {d.domain}
              </span>
            </div>
            <button
              onClick={() => handleRemove(d.domain)}
              className="text-gray-400 hover:text-red-500 text-xs px-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};
