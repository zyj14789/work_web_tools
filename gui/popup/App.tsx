import React, { useEffect, useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useSuggestions } from '../hooks/useSuggestions';
import { ApiKeyForm } from './components/ApiKeyForm';
import { SuggestionToggle } from './components/SuggestionToggle';
import { QuickStats } from './components/QuickStats';
import { Button } from '../shared/Button';

const App: React.FC = () => {
  const { apiKey, loadSettings } = useSettings();
  const { suggestions, loadSuggestions } = useSuggestions();
  const [showSettings, setShowSettings] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      await loadSettings();
      await loadSuggestions();
      setInitialized(true);
    };
    init();
  }, []);

  if (!initialized) {
    return (
      <div className="w-80 p-4 text-center text-gray-500 text-sm">
        加载中...
      </div>
    );
  }

  return (
    <div className="w-80 bg-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-bold text-gray-900">AI广告助手</h1>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            {showSettings ? '返回' : '设置'}
          </button>
        </div>
      </div>

      {showSettings ? (
        <div className="p-4">
          <ApiKeyForm />
          <div className="mt-4">
            <SuggestionToggle />
          </div>
        </div>
      ) : (
        <>
          {!apiKey ? (
            <div className="p-4 text-center">
              <p className="text-sm text-gray-500 mb-3">请先配置API Key以启用AI功能</p>
              <Button onClick={() => setShowSettings(true)} size="sm">
                配置API Key
              </Button>
            </div>
          ) : (
            <>
              <QuickStats suggestionCount={suggestions.length} />
              {suggestions.length > 0 && (
                <div className="p-4 border-t border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    最新建议 ({suggestions.length})
                  </h3>
                  {suggestions.slice(0, 3).map((s) => (
                    <div
                      key={s.id}
                      className="mb-2 p-2 bg-gray-50 rounded-lg text-xs"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          s.priority === 'high' ? 'bg-red-500' :
                          s.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                        }`} />
                        <span className="font-medium text-gray-800">{s.title}</span>
                      </div>
                      <p className="text-gray-500 leading-relaxed">{s.description}</p>
                    </div>
                  ))}
                  <p className="text-xs text-gray-400 text-center mt-2">
                    打开侧边栏查看完整建议列表
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}

      <div className="p-3 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400">AI广告助手 v1.0.0</p>
      </div>
    </div>
  );
};

export default App;
