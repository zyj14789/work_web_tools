import React, { useState } from 'react';
import { Button } from '../../shared/Button';
import { Toast } from '../../shared/Toast';
import { createMessage, MessageType, sendMessage } from '../../../interface/messaging';
import type { ExportData, ExportScope, MergeStrategy } from '../../../app/storage/adapter';

type ImportPreview = {
  fileName: string;
  data: ExportData;
  itemCount: number;
};

export const DataManager: React.FC = () => {
  const [exportScope, setExportScope] = useState<ExportScope>('all');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [conflictResolution, setConflictResolution] = useState<MergeStrategy['conflictResolution']>('latest');
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleClearData = async () => {
    if (!window.confirm('确定要清除所有本地数据吗？此操作不可撤销。')) return;

    setClearing(true);
    const response = await sendMessage(
      createMessage(MessageType.CLEAR_DATA, undefined, 'sidepanel'),
    );
    if (response.success) {
      setToast({ message: '数据已清除', type: 'success' });
      setImportPreview(null);
    } else {
      setToast({ message: response.error || '清除数据失败', type: 'error' });
    }
    setClearing(false);
  };

  const handleExport = async () => {
    setExporting(true);
    const response = await sendMessage(
      createMessage(MessageType.EXPORT_DATA, { scope: exportScope }, 'sidepanel'),
    );
    if (response.success && response.data) {
      const exportData = response.data as ExportData;
      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-ad-assistant-${exportScope}-${new Date().toISOString().slice(0, 10)}.admemory`;
      a.click();
      URL.revokeObjectURL(url);
      setToast({ message: '数据导出成功', type: 'success' });
    } else {
      setToast({ message: response.error || '导出失败', type: 'error' });
    }
    setExporting(false);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.admemory,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text) as ExportData;
        setImportPreview({
          fileName: file.name,
          data,
          itemCount: countExportItems(data.userMemory),
        });
        setToast({ message: '文件解析完成，请确认后导入', type: 'success' });
      } catch (error) {
        setToast({ message: `导入失败: ${String(error)}`, type: 'error' });
      }
    };
    input.click();
  };

  const executeImport = async () => {
    if (!importPreview) return;

    setImporting(true);
    const response = await sendMessage(
      createMessage(MessageType.IMPORT_DATA, {
        data: importPreview.data,
        strategy: {
          deduplicateBy: ['id', 'campaignId', 'date', 'metricType'],
          conflictResolution,
        } satisfies MergeStrategy,
      }, 'sidepanel'),
    );

    if (response.success) {
      const result = response.data as {
        added: number;
        updated: number;
        skipped: number;
        conflicts: number;
      };
      setToast({
        message: `导入完成: 新增${result.added}条, 更新${result.updated}条, 跳过${result.skipped}条, 冲突${result.conflicts}条`,
        type: 'success',
      });
      setImportPreview(null);
    } else {
      setToast({ message: response.error || '导入失败', type: 'error' });
    }
    setImporting(false);
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
        <h3 className="text-sm font-semibold text-gray-800 mb-3">数据管理</h3>
        <p className="text-xs text-gray-500 mb-4">
          您的所有数据存储在浏览器本地。可通过导入导出来实现多设备同步。
        </p>

        <div className="space-y-2">
          <div className="p-3 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-1">导出数据</h4>
            <p className="text-xs text-gray-500 mb-2">
              将历史数据、配置和模式导出为带校验和的 .admemory 文件
            </p>
            <select
              value={exportScope}
              onChange={(e) => setExportScope(e.target.value as ExportScope)}
              className="mb-2 w-full text-sm"
            >
              <option value="all">全部数据</option>
              <option value="config">仅配置</option>
              <option value="data">仅业务数据</option>
            </select>
            <Button onClick={handleExport} size="sm" variant="primary" loading={exporting}>
              导出数据
            </Button>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-1">导入数据</h4>
            <p className="text-xs text-gray-500 mb-2">
              从之前导出的文件恢复数据（智能合并排重）
            </p>
            <Button onClick={handleImport} size="sm" variant="secondary">
              选择文件
            </Button>
            {importPreview && (
              <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
                <div className="text-xs text-gray-600 space-y-1">
                  <p>文件: {importPreview.fileName}</p>
                  <p>来源设备: {importPreview.data.sourceDeviceId || '未知'}</p>
                  <p>导出时间: {new Date(importPreview.data.exportedAt).toLocaleString()}</p>
                  <p>数据项: {importPreview.itemCount}</p>
                  <p className="break-all">校验和: {importPreview.data.checksum.slice(0, 16)}...</p>
                </div>
                <select
                  value={conflictResolution}
                  onChange={(e) => setConflictResolution(e.target.value as MergeStrategy['conflictResolution'])}
                  className="mt-3 w-full text-sm"
                >
                  <option value="latest">冲突时保留最新</option>
                  <option value="client-wins">冲突时保留本机</option>
                  <option value="server-wins">冲突时使用导入文件</option>
                  <option value="manual">仅标记冲突</option>
                </select>
                <div className="mt-3 flex gap-2">
                  <Button onClick={executeImport} size="sm" loading={importing}>
                    确认导入
                  </Button>
                  <Button onClick={() => setImportPreview(null)} size="sm" variant="ghost">
                    取消
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 bg-red-50 rounded-lg">
            <h4 className="text-sm font-medium text-red-700 mb-1">清除数据</h4>
            <p className="text-xs text-red-500 mb-2">
              删除所有本地存储的数据（不可撤销）
            </p>
            <Button onClick={handleClearData} size="sm" variant="danger" loading={clearing}>
              清除数据
            </Button>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">关于</h3>
        <div className="text-xs text-gray-500 space-y-1">
          <p>版本: 1.0.0</p>
          <p>数据存储: 浏览器本地 (IndexedDB)</p>
          <p>AI引擎: DeepSeek Chat API</p>
          <p>隐私保护: 业务数据不上传第三方服务器</p>
        </div>
      </section>
    </div>
  );
};

function countExportItems(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  if (Array.isArray(value)) return value.length;
  return Object.keys(value as Record<string, unknown>).length;
}
