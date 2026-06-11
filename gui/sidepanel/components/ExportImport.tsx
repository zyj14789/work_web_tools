import React, { useState } from 'react';

interface ExportImportProps {
  onComplete?: (stats: { added: number; updated: number; skipped: number }) => void;
}

export const ExportImport: React.FC<ExportImportProps> = ({ onComplete }) => {
  const [mode, setMode] = useState<'idle' | 'preview' | 'merging' | 'done'>('idle');
  const [previewData, setPreviewData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">导入导出</h3>

      <p className="text-xs text-gray-500 mb-4">
        通过导入导出功能，您可以在不同设备间同步使用AI广告助手。
        导出文件包含您的历史数据、配置和发现的优化模式。
      </p>

      <div className="space-y-3">
        <div className="p-3 bg-blue-50 rounded-lg">
          <h4 className="text-sm font-medium text-blue-700 mb-1">导出格式说明</h4>
          <ul className="text-xs text-blue-600 space-y-1">
            <li>• 文件格式: .admemory (JSON)</li>
            <li>• 包含SHA-256校验和，防止数据损坏</li>
            <li>• 可选择导出范围：全部/仅配置/仅数据</li>
            <li>• 导入时自动合并排重</li>
          </ul>
        </div>

        <div className="p-3 bg-yellow-50 rounded-lg">
          <h4 className="text-sm font-medium text-yellow-700 mb-1">注意事项</h4>
          <ul className="text-xs text-yellow-600 space-y-1">
            <li>• 导入不会覆盖现有数据，会智能合并</li>
            <li>• 重复数据以时间戳最新的为准</li>
            <li>• 请妥善保管导出文件</li>
          </ul>
        </div>
      </div>

      {error && (
        <div className="mt-3 p-2 bg-red-50 text-red-700 text-xs rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
};
