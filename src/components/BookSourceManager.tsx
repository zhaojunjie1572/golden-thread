import { useState, useCallback, useRef } from 'react';
import { BookSource } from '../types/book';
import { useBooks } from '../context/BookContext';
import { useTheme } from '../context/ThemeContext';
import BookSourceBrowseView from './BookSourceBrowseView';
import BookSourceDebugger from './BookSourceDebugger';

interface BookSourceManagerProps {
  onClose: () => void;
  onSelectSource?: (source: BookSource) => void;
}

export default function BookSourceManager({ onClose, onSelectSource }: BookSourceManagerProps) {
  const { 
    bookSources, 
    addBookSource, 
    addBookSourcesBatch, 
    updateBookSource, 
    deleteBookSource, 
    testBookSource, 
    importBookSourcesFromFile, 
    importBookSourcesFromUrl,
    testUrl,
    resetToDefaultSources,
  } = useBooks();
  const { colors } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSource, setEditingSource] = useState<BookSource | null>(null);
  const [browsingSource, setBrowsingSource] = useState<BookSource | null>(null);
  const [testingSource, setTestingSource] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ [key: string]: { success: boolean; message: string } }>({});
  const [isImporting, setIsImporting] = useState(false);
  const [debuggingSource, setDebuggingSource] = useState<BookSource | null>(null);
  const [showPasteImport, setShowPasteImport] = useState(false);
  const [pasteJson, setPasteJson] = useState('');
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [formData, setFormData] = useState<{
    name: string;
    url: string;
    type: 'api' | 'rss' | 'custom';
    enabled: boolean;
  }>({
    name: '',
    url: '',
    type: 'api',
    enabled: true,
  });

  const handleTestSource = useCallback(async (source: BookSource) => {
    setTestingSource(source.id);
    try {
      const result = await testBookSource(source.id);
      setTestResult(prev => ({ ...prev, [source.id]: result }));
    } catch (error) {
      setTestResult(prev => ({ 
        ...prev, 
        [source.id]: { success: false, message: '测试失败' } 
      }));
    } finally {
      setTestingSource(null);
    }
  }, [testBookSource]);

  const handleImportSources = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const count = await importBookSourcesFromFile(file);
      if (count > 0) {
        alert(`成功导入 ${count} 个书源！`);
      } else {
        alert('未找到有效的书源');
      }
    } catch (error) {
      console.error('导入书源失败:', error);
      alert(error instanceof Error ? error.message : '导入书源失败');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [importBookSourcesFromFile]);

  const handleUrlImport = useCallback(async () => {
    if (!urlInput.trim()) {
      alert('请输入书源URL');
      return;
    }

    let importUrl = urlInput.trim();
    const urlMatch = importUrl.match(/src=([^&]+)/);
    if (urlMatch) {
      importUrl = decodeURIComponent(urlMatch[1]);
    }

    setIsImporting(true);
    try {
      const count = await importBookSourcesFromUrl(importUrl);
      if (count > 0) {
        alert(`成功从URL导入 ${count} 个书源！`);
        setUrlInput('');
        setShowUrlImport(false);
      } else {
        alert('未找到有效的书源，请确认URL是否正确');
      }
    } catch (error) {
      console.error('从URL导入书源失败:', error);
      alert(error instanceof Error ? error.message : '从URL导入书源失败');
    } finally {
      setIsImporting(false);
    }
  }, [urlInput, importBookSourcesFromUrl]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (editingSource) {
      updateBookSource({
        ...editingSource,
        ...formData,
      });
    } else {
      addBookSource(formData);
    }
    setShowAddForm(false);
    setEditingSource(null);
    setFormData({
      name: '',
      url: '',
      type: 'api',
      enabled: true,
    });
  }, [formData, editingSource, addBookSource, updateBookSource]);

  const handleEdit = useCallback((source: BookSource) => {
    setEditingSource(source);
    setFormData({
      name: source.name,
      url: source.url,
      type: source.type,
      enabled: source.enabled,
    });
    setShowAddForm(true);
  }, []);

  const handleDelete = useCallback((id: string) => {
    if (confirm('确定要删除这个书源吗？')) {
      deleteBookSource(id);
    }
  }, [deleteBookSource]);

  const handlePasteImport = useCallback(async () => {
    if (!pasteJson.trim()) {
      alert('请输入 JSON 内容');
      return;
    }

    setIsImporting(true);
    try {
      let cleanedText = pasteJson;
      cleanedText = cleanedText.replace(/“/g, '"');
      cleanedText = cleanedText.replace(/”/g, '"');
      cleanedText = cleanedText.replace(/‘/g, "'");
      cleanedText = cleanedText.replace(/’/g, "'");
      cleanedText = cleanedText.replace(/，/g, ',');
      cleanedText = cleanedText.replace(/：/g, ':');
      cleanedText = cleanedText.replace(/；/g, ';');
      cleanedText = cleanedText.replace(/（/g, '(');
      cleanedText = cleanedText.replace(/）/g, ')');
      cleanedText = cleanedText.replace(/【/g, '[');
      cleanedText = cleanedText.replace(/】/g, ']');
      
      const jsonData = JSON.parse(cleanedText);
      
      let sources: Array<Omit<BookSource, 'id' | 'addedAt'>> = [];
      
      const parseSingleSource = (item: any): Omit<BookSource, 'id' | 'addedAt'> | null => {
        try {
          let name = item.sourceName || item.bookSourceName || item.name || '';
          let url = item.sourceUrl || item.bookSourceUrl || item.url || '';
          
          if (!name || !url) {
            return null;
          }

          name = name.replace(/^`|`$/g, '');
          url = url.replace(/^`|`$/g, '');

          const enabled = item.enabled !== undefined ? item.enabled : 
                         item.启用 !== undefined ? item.启用 : 
                         item.enable !== undefined ? item.enable : true;

          return {
            name,
            url,
            type: 'api',
            enabled: !!enabled,
            searchUrl: item.searchUrl,
            ruleSearch: item.ruleSearch,
            ruleBookInfo: item.ruleBookInfo,
            ruleToc: item.ruleToc,
            ruleContent: item.ruleContent,
            header: item.header,
            bookSourceGroup: item.bookSourceGroup,
            bookSourceComment: item.bookSourceComment,
            bookSourceIcon: item.bookSourceIcon,
          };
        } catch (error) {
          console.error('解析单个书源失败:', error);
          return null;
        }
      };

      if (Array.isArray(jsonData)) {
        for (const item of jsonData) {
          const parsed = parseSingleSource(item);
          if (parsed) {
            sources.push(parsed);
          }
        }
      } else {
        const parsed = parseSingleSource(jsonData);
        if (parsed) {
          sources.push(parsed);
        }
      }

      if (sources.length > 0) {
        addBookSourcesBatch(sources);
        alert(`成功导入 ${sources.length} 个书源！`);
        setShowPasteImport(false);
        setPasteJson('');
      } else {
        alert('未找到有效的书源');
      }
    } catch (error) {
      console.error('粘贴导入书源失败:', error);
      alert(error instanceof SyntaxError ? 'JSON 格式错误，请检查格式' : '导入书源失败');
    } finally {
      setIsImporting(false);
    }
  }, [pasteJson, addBookSourcesBatch]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">书源管理</h2>
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
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-700">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📚</span>
              <div className="flex-1">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">实现读书自由</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                  1. 点击"书源仓库"获取可用的书源
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                  2. 下载书源 JSON 文件或复制内容
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  3. 使用"导入文件"或"粘贴 JSON"导入
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end mb-4 gap-2 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportSources}
            />
            <button
              onClick={() => {
                window.open('https://github.com/yiove/booksource', '_blank');
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
              title="打开书源仓库"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              书源仓库
            </button>
            <button
              onClick={resetToDefaultSources}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30"
              title="恢复默认书源"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              恢复默认
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {isImporting ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              )}
              导入文件
            </button>
            <button
              onClick={() => setShowPasteImport(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              粘贴 JSON
            </button>
            <button
              onClick={() => setShowUrlImport(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-green-300 dark:border-green-600 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/30"
              title="从URL导入书源"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              网络导入
            </button>
            <button
              onClick={() => {
                setShowAddForm(true);
                setEditingSource(null);
                setFormData({
                  name: '',
                  url: '',
                  type: 'api',
                  enabled: true,
                });
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white"
              style={{ backgroundColor: colors.primary }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              添加书源
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                {editingSource ? '编辑书源' : '添加书源'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">书源名称</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="例如：我的书源"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">书源地址</label>
                  <input
                    type="url"
                    required
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="https://example.com/api"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">书源类型</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="api">API 书源</option>
                    <option value="rss">RSS 书源</option>
                    <option value="custom">自定义</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enabled"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="enabled" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    启用书源
                  </label>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingSource(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 rounded-lg text-white"
                    style={{ backgroundColor: colors.primary }}
                  >
                    {editingSource ? '保存' : '添加'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {bookSources.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📚</div>
              <p className="text-gray-500 dark:text-gray-400">还没有添加任何书源</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">点击上方按钮添加你的第一个书源</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookSources.map((source) => (
                <div key={source.id}>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                          {source.name}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            source.enabled
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {source.enabled ? '已启用' : '已禁用'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                        {source.url}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          类型: {source.type === 'api' ? 'API' : source.type === 'rss' ? 'RSS' : '自定义'}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          添加于: {new Date(source.addedAt).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <button
                        onClick={() => handleTestSource(source)}
                        disabled={testingSource === source.id}
                        className="p-2 rounded-lg text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 disabled:opacity-50"
                        title="测试书源"
                      >
                        {testingSource === source.id ? (
                          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => setDebuggingSource(source)}
                        className="p-2 rounded-lg text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30"
                        title="调试书源"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                      </button>
                      {source.enabled && !source.searchUrl && (
                        <button
                          onClick={() => setBrowsingSource(source)}
                          className="p-2 rounded-lg text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                          title="浏览书籍"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012-2v2M7 7h10" />
                          </svg>
                        </button>
                      )}
                      {onSelectSource && (
                        <button
                          onClick={() => onSelectSource(source)}
                          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                          title="使用此书源"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(source)}
                        className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                        title="编辑"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(source.id)}
                        className="p-2 rounded-lg text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                        title="删除"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {testResult[source.id] && (
                    <div className={`mt-2 p-2 rounded-lg text-sm ${
                      testResult[source.id].success 
                        ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    }`}>
                      {testResult[source.id].message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex-shrink-0">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p className="font-semibold mb-1">API 书源接口规范：</p>
            <ul className="space-y-1">
              <li>• 列表接口: <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">{`{书源地址}/list?page=页码&limit=数量`}</code></li>
              <li>• 搜索接口: <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">{`{书源地址}/search?q=关键词`}</code></li>
              <li>• 获取书籍: <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">{`{书源地址}/book/{书籍ID}`}</code></li>
            </ul>
            <p className="font-semibold mt-2 mb-1">支持的书源格式：</p>
            <ul className="space-y-1">
              <li>• Yiove 书源仓库格式 (JSON)</li>
              <li>• 支持多种字段名（sourceName/sourceUrl, bookSourceName/bookSourceUrl 等）</li>
              <li>• 自动识别中英文标点符号</li>
            </ul>
          </div>
        </div>
      </div>

      {browsingSource && (
        <BookSourceBrowseView
          source={browsingSource}
          onClose={() => setBrowsingSource(null)}
        />
      )}

      {debuggingSource && (
        <BookSourceDebugger
          source={debuggingSource}
          onClose={() => setDebuggingSource(null)}
          onTestUrl={(url) => testUrl(url, debuggingSource)}
        />
      )}

      {showPasteImport && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">粘贴 JSON 导入书源</h2>
              <button
                onClick={() => {
                  setShowPasteImport(false);
                  setPasteJson('');
                }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    粘贴书源 JSON 内容
                  </label>
                  <textarea
                    value={pasteJson}
                    onChange={(e) => setPasteJson(e.target.value)}
                    placeholder="粘贴你的书源 JSON 内容..."
                    className="w-full h-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
                  />
                </div>

                <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl">
                  <p className="font-semibold mb-2">支持的 JSON 格式：</p>
                  <pre className="bg-white dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto">
{`[
  {
    "sourceName": "书源名称",
    "sourceUrl": "https://example.com",
    "enabled": true,
    "searchUrl": "...",
    "ruleSearch": {...},
    ...
  }
]`}
                  </pre>
                  <p className="mt-2 text-xs">支持 Yiove 书源仓库格式，支持单个或多个书源</p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 flex-shrink-0">
              <button
                onClick={() => {
                  setShowPasteImport(false);
                  setPasteJson('');
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                取消
              </button>
              <button
                onClick={handlePasteImport}
                disabled={isImporting || !pasteJson.trim()}
                className="flex-1 px-4 py-2 rounded-lg text-white disabled:opacity-50"
                style={{ backgroundColor: colors.primary }}
              >
                {isImporting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                ) : (
                  '导入书源'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUrlImport && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">网络导入书源</h2>
              <button
                onClick={() => {
                  setShowUrlImport(false);
                  setUrlInput('');
                }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    输入书源 JSON 的 URL 地址
                  </label>
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUrlImport()}
                    placeholder="https://example.com/booksource.json"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="text-sm text-gray-500 dark:text-gray-400 bg-green-50 dark:bg-green-900/30 p-4 rounded-xl border border-green-200 dark:border-green-700">
                  <p className="font-semibold mb-2 text-green-800 dark:text-green-200">💡 使用说明</p>
                  <p className="mb-2">支持两种导入方式：</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>直接输入书源 JSON 文件的 URL 地址</li>
                    <li>粘贴阅读App的书源导入链接（包含 src= 参数）</li>
                  </ol>
                  <p className="mt-3 text-xs bg-white dark:bg-gray-800 p-2 rounded">
                    <strong>示例链接：</strong><br />
                    yuedu://rsssource/importonline?src=https%3A%2F%2Fexample.com%2Fsub.json
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 flex-shrink-0">
              <button
                onClick={() => {
                  setShowUrlImport(false);
                  setUrlInput('');
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                取消
              </button>
              <button
                onClick={handleUrlImport}
                disabled={isImporting || !urlInput.trim()}
                className="flex-1 px-4 py-2 rounded-lg text-white disabled:opacity-50"
                style={{ backgroundColor: colors.primary }}
              >
                {isImporting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                ) : (
                  '导入书源'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddForm && (
        <AddBookSourceForm
          source={editingSource}
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowAddForm(false);
            setEditingSource(null);
          }}
        />
      )}

      {browsingSource && (
        <BookSourceBrowseView
          source={browsingSource}
          onClose={() => setBrowsingSource(null)}
        />
      )}

      {debuggingSource && (
        <BookSourceDebugger
          source={debuggingSource}
          onClose={() => setDebuggingSource(null)}
        />
      )}
    </div>
  );
}
