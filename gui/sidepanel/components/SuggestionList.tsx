import React from 'react';
import { useSuggestions } from '../../hooks/useSuggestions';
import { SuggestionCard } from './SuggestionCard';
import { Button } from '../../shared/Button';
import { createMessage, MessageType, sendMessage } from '../../../interface/messaging';

export const SuggestionList: React.FC = () => {
  const { suggestions, loading, loadSuggestions } = useSuggestions();
  const [analyzing, setAnalyzing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadSuggestions();
  }, []);

  const handleAnalyzeNow = async () => {
    setAnalyzing(true);
    setError(null);
    const response = await sendMessage(
      createMessage(MessageType.REQUEST_ANALYSIS, undefined, 'sidepanel'),
    );
    if (!response.success) {
      setError(response.error || '触发分析失败，请确认当前标签页已加载插件');
    } else {
      await loadSuggestions();
    }
    setAnalyzing(false);
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm">
        <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
        加载中...
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-3xl mb-3">📊</div>
        <p className="text-sm text-gray-500 mb-1">暂无建议</p>
        <p className="text-xs text-gray-400">
          浏览广告后台页面，AI将自动分析数据并生成建议
        </p>
        <Button
          onClick={handleAnalyzeNow}
          loading={analyzing}
          size="sm"
          className="mt-4"
        >
          立即分析当前页
        </Button>
        {error && (
          <p className="mt-3 text-xs text-red-500">{error}</p>
        )}
      </div>
    );
  }

  const anomalies = suggestions.filter(s => s.type === 'anomaly');
  const efficiencies = suggestions.filter(s => s.type === 'efficiency');
  const strategies = suggestions.filter(s => s.type === 'strategy');

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400">共 {suggestions.length} 条建议</span>
        <Button onClick={handleAnalyzeNow} loading={analyzing} size="sm" variant="secondary">
          重新分析
        </Button>
      </div>
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}
      {anomalies.length > 0 && (
        <section className="mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase mb-2 px-1">
            ⚠️ 异常预警 ({anomalies.length})
          </h2>
          {anomalies.map(s => (
            <SuggestionCard key={s.id} suggestion={s} />
          ))}
        </section>
      )}

      {efficiencies.length > 0 && (
        <section className="mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase mb-2 px-1">
            ⚡ 效率优化 ({efficiencies.length})
          </h2>
          {efficiencies.map(s => (
            <SuggestionCard key={s.id} suggestion={s} />
          ))}
        </section>
      )}

      {strategies.length > 0 && (
        <section className="mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase mb-2 px-1">
            💡 策略建议 ({strategies.length})
          </h2>
          {strategies.map(s => (
            <SuggestionCard key={s.id} suggestion={s} />
          ))}
        </section>
      )}
    </div>
  );
};
