import { useState, useCallback } from 'react';
import { BookSource } from '../types/book';
import { BookSourceParser } from '../utils/bookSourceParser';
import { useTheme } from '../context/ThemeContext';

interface BookSourceDebuggerProps {
  source: BookSource;
  onClose: () => void;
  onTestUrl?: (url: string) => Promise<string>;
}

export default function BookSourceDebugger({ source, onClose, onTestUrl }: BookSourceDebuggerProps) {
  const { colors, isDarkMode } = useTheme();
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState<string>('');
  const [testRule, setTestRule] = useState('');
  const [ruleResult, setRuleResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'url' | 'rule'>('url');

  const handleTestUrl = useCallback(async () => {
    if (!testUrl || !onTestUrl) return;
    setIsLoading(true);
    setLogs([]);
    try {
      const result = await onTestUrl(testUrl);
      setTestResult(result);
    } catch (error) {
      console.error('测试 URL 失败:', error);
      setTestResult(error instanceof Error ? error.message : '请求失败');
    } finally {
      setIsLoading(false);
    }
  }, [testUrl, onTestUrl]);

  const handleTestRule = useCallback(() => {
    if (!testRule || !testResult) return;
    
    BookSourceParser.clearLogs();
    const result = BookSourceParser.parseRule(testResult, testRule);
    setRuleResult(result);
    setLogs(BookSourceParser.getLogs());
  }, [testRule, testResult]);

  const handleTestSearch = useCallback(async () => {
    if (!source.searchUrl || !onTestUrl) return;
    
    const testKeyword = '测试';
    const searchUrl = source.searchUrl.replace('{{key}}', encodeURIComponent(testKeyword))
                                      .replace('{key}', encodeURIComponent(testKeyword));
    
    setTestUrl(searchUrl);
    setIsLoading(true);
    setLogs([]);
    try {
      const result = await onTestUrl(searchUrl);
      setTestResult(result);
      
      const listRule = source.ruleSearch?.bookList || source.ruleSearch?.list;
      const nameRule = source.ruleSearch?.name;
      
      if (listRule) {
        BookSourceParser.clearLogs();
        const listHtml = BookSourceParser.parseList(result, listRule);
        
        if (listHtml.length > 0 && nameRule) {
          const firstItem = listHtml[0];
          BookSourceParser.clearLogs();
          const name = BookSourceParser.parseRule(firstItem, nameRule);
          setRuleResult(name);
          setLogs(BookSourceParser.getLogs());
        }
      }
    } catch (error) {
      console.error('测试搜索失败:', error);
      setTestResult(error instanceof Error ? error.message : '请求失败');
    } finally {
      setIsLoading(false);
    }
  }, [source, onTestUrl]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">书源调试器</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{source.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('url')}
                className={`px-4 py-2 font-medium ${
                  activeTab === 'url' 
                    ? 'border-b-2' 
                    : 'text-gray-500'
                }`}
                style={{ 
                  borderColor: activeTab === 'url' ? colors.primary : 'transparent',
                  color: activeTab === 'url' ? colors.primary : undefined,
                }}
              >
                URL 测试
              </button>
              <button
                onClick={() => setActiveTab('rule')}
                className={`px-4 py-2 font-medium ${
                  activeTab === 'rule' 
                    ? 'border-b-2' 
                    : 'text-gray-500'
                }`}
                style={{ 
                  borderColor: activeTab === 'rule' ? colors.primary : 'transparent',
                  color: activeTab === 'rule' ? colors.primary : undefined,
                }}
              >
                规则测试
              </button>
            </div>

            {activeTab === 'url' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    测试 URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={testUrl}
                      onChange={(e) => setTestUrl(e.target.value)}
                      placeholder="输入要测试的 URL"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
                    />
                    <button
                      onClick={handleTestUrl}
                      disabled={isLoading || !testUrl}
                      className="px-4 py-2 rounded-lg text-white disabled:opacity-50"
                      style={{ backgroundColor: colors.primary }}
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        '请求'
                      )}
                    </button>
                    {source.searchUrl && (
                      <button
                        onClick={handleTestSearch}
                        disabled={isLoading}
                        className="px-4 py-2 rounded-lg border text-sm"
                        style={{ 
                          borderColor: colors.primary,
                          color: colors.primary,
                        }}
                      >
                        测试搜索
                      </button>
                    )}
                  </div>
                </div>

                {testResult && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        响应内容
                      </label>
                      <span className="text-xs text-gray-500">
                        {testResult.length} 字符
                      </span>
                    </div>
                    <textarea
                      value={testResult}
                      readOnly
                      className="w-full h-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-300 font-mono text-xs"
                    />
                  </div>
                )}
              </div>
            )}

            {activeTab === 'rule' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    解析规则
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={testRule}
                      onChange={(e) => setTestRule(e.target.value)}
                      placeholder="输入解析规则，如: .title@text || h1"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
                    />
                    <button
                      onClick={handleTestRule}
                      disabled={!testRule || !testResult}
                      className="px-4 py-2 rounded-lg text-white disabled:opacity-50"
                      style={{ backgroundColor: colors.primary }}
                    >
                      解析
                    </button>
                  </div>
                </div>

                {ruleResult !== '' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      解析结果
                    </label>
                    <div 
                      className="p-4 rounded-lg border font-mono text-sm"
                      style={{ 
                        backgroundColor: isDarkMode ? '#1a2a3a' : '#f0f8ff',
                        borderColor: ruleResult ? '#10b981' : '#ef4444',
                        color: ruleResult ? (isDarkMode ? '#6ee7b7' : '#059669') : (isDarkMode ? '#fca5a5' : '#dc2626'),
                      }}
                    >
                      {ruleResult || '(空结果)'}
                    </div>
                  </div>
                )}

                {logs.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      解析日志
                    </label>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {logs.map((log, index) => (
                        <div 
                          key={index}
                          className="p-2 rounded text-xs font-mono"
                          style={{ 
                            backgroundColor: isDarkMode 
                              ? (log.success ? '#1a3320' : '#331a1a') 
                              : (log.success ? '#f0fdf4' : '#fef2f2'),
                            color: log.success 
                              ? (isDarkMode ? '#86efac' : '#166534') 
                              : (isDarkMode ? '#fca5a5' : '#991b1b'),
                          }}
                        >
                          <span className="font-bold">[{log.step}]</span> {log.rule}
                          {log.output && (
                            <div className="mt-1 opacity-70">
                              → {log.output.substring(0, 100)}{log.output.length > 100 ? '...' : ''}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p className="font-semibold mb-1">规则语法示例：</p>
            <ul className="space-y-1">
              <li><code>.title</code> - CSS 类选择器</li>
              <li><code>#title</code> - ID 选择器</li>
              <li><code>h1@text</code> - 标签加属性/text</li>
              <li><code>@href</code> - 当前元素的 href 属性</li>
              <li><code>.title@text || h1</code> - 多个规则备选</li>
              <li><code>.title&&replace:, ,</code> - 多个规则串联</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
