import { useState, useCallback } from 'react';
import { BookSource, SearchResult } from '../types/book';
import { useBooks } from '../context/BookContext';
import { useTheme } from '../context/ThemeContext';
import ChapterListView from './ChapterListView';

interface OnlineBookSearchViewProps {
  onClose: () => void;
}

export default function OnlineBookSearchView({ onClose }: OnlineBookSearchViewProps) {
  const { bookSources, searchWithBookSource, importFullBook, searchWithAllSources } = useBooks();
  const { colors } = useTheme();
  const [selectedSource, setSelectedSource] = useState<BookSource | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [allSourceResults, setAllSourceResults] = useState<{ sourceId: string; sourceName: string; results: SearchResult[] }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<'single' | 'all'>('single');
  const [currentSourceForBook, setCurrentSourceForBook] = useState<string | null>(null);

  const enabledSources = bookSources.filter(s => s.enabled);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    setAllSourceResults([]);
    setError(null);
    
    try {
      if (searchMode === 'single' && selectedSource) {
        const results = await searchWithBookSource(selectedSource.id, searchQuery);
        setSearchResults(results);
      } else {
        const results = await searchWithAllSources(searchQuery);
        setAllSourceResults(results);
      }
    } catch (error) {
      console.error('搜索失败:', error);
      setError(error instanceof Error ? error.message : '搜索失败，请检查书源配置');
    } finally {
      setIsSearching(false);
    }
  }, [searchMode, selectedSource, searchQuery, searchWithBookSource, searchWithAllSources]);

  const handleImportBook = useCallback(async (book: SearchResult, sourceId?: string) => {
    const source = sourceId || selectedSource?.id;
    if (!source) return;

    setIsImporting(book.id);
    setError(null);
    try {
      const importedBook = await importFullBook(source, book);
      alert(`成功导入书籍：${importedBook.title}`);
      
      if (searchMode === 'single') {
        setSearchResults(prev => prev.filter(b => b.id !== book.id));
      } else {
        setAllSourceResults(prev => 
          prev.map(item => ({
            ...item,
            results: item.results.filter(b => b.id !== book.id),
          }))
        );
      }
    } catch (error) {
      console.error('导入书籍失败:', error);
      setError(error instanceof Error ? error.message : '导入书籍失败');
    } finally {
      setIsImporting(null);
    }
  }, [selectedSource, importFullBook, searchMode]);

  const handleShowChapters = useCallback(async (book: SearchResult, sourceId?: string) => {
    const source = sourceId || selectedSource?.id;
    if (!source) return;
    setCurrentSourceForBook(source);
    setSelectedBook(book);
  }, [selectedSource]);

  if (selectedBook && currentSourceForBook) {
    return (
      <ChapterListView
        sourceId={currentSourceForBook}
        book={selectedBook}
        onBack={() => {
          setSelectedBook(null);
          setCurrentSourceForBook(null);
        }}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">网络书源搜索</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">搜索模式</label>
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => {
                      setSearchMode('single');
                      setSearchResults([]);
                      setAllSourceResults([]);
                    }}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      searchMode === 'single' 
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    单书源
                  </button>
                  <button
                    onClick={() => {
                      setSearchMode('all');
                      setSearchResults([]);
                      setAllSourceResults([]);
                    }}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      searchMode === 'all' 
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    多书源
                  </button>
                </div>
              </div>
              
              {searchMode === 'single' && (
                <select
                  value={selectedSource?.id || ''}
                  onChange={(e) => {
                    const source = bookSources.find(s => s.id === e.target.value);
                    setSelectedSource(source || null);
                    setSearchResults([]);
                    setError(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">请选择书源</option>
                  {enabledSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </select>
              )}
              
              {enabledSources.length === 0 && (
                <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
                  暂无可启用的书源，请先在书源管理中添加
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">搜索书籍</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="输入书名或作者..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim() || (searchMode === 'single' && !selectedSource)}
                  className="px-4 py-2 rounded-lg text-white disabled:opacity-50"
                  style={{ backgroundColor: colors.primary }}
                >
                  {isSearching ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    '搜索'
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-xl">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">{error}</span>
                </div>
              </div>
            )}

            {searchMode === 'single' && searchResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  搜索结果 ({searchResults.length})
                </h3>
                {searchResults.map((book) => (
                  <div
                    key={book.id}
                    className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                  >
                    <div className="flex gap-4">
                      {book.coverUrl && (
                        <img
                          src={book.coverUrl}
                          alt={book.title}
                          className="w-16 h-24 object-cover rounded-lg"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {book.title}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {book.author}
                        </p>
                        {book.intro && (
                          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 line-clamp-2">
                            {book.intro}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => handleShowChapters(book)}
                        className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        查看章节
                      </button>
                      <button
                        onClick={() => handleImportBook(book)}
                        disabled={isImporting === book.id}
                        className="flex-1 px-4 py-2 rounded-lg text-white disabled:opacity-50"
                        style={{ backgroundColor: colors.primary }}
                      >
                        {isImporting === book.id ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                        ) : (
                          '导入书籍'
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchMode === 'all' && allSourceResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  多书源搜索结果 ({allSourceResults.reduce((sum, item) => sum + item.results.length, 0)})
                </h3>
                {allSourceResults.map((sourceResult) => (
                  <div key={sourceResult.sourceId} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: colors.primary }}>
                        📖 {sourceResult.sourceName}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({sourceResult.results.length} 个结果)
                      </span>
                    </div>
                    {sourceResult.results.map((book) => (
                      <div
                        key={`${sourceResult.sourceId}-${book.id}`}
                        className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl ml-4 border-l-4"
                        style={{ borderLeftColor: colors.primary }}
                      >
                        <div className="flex gap-4">
                          {book.coverUrl && (
                            <img
                              src={book.coverUrl}
                              alt={book.title}
                              className="w-16 h-24 object-cover rounded-lg"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              {book.title}
                            </h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {book.author}
                            </p>
                            {book.intro && (
                              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 line-clamp-2">
                                {book.intro}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => handleShowChapters(book, sourceResult.sourceId)}
                            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            查看章节
                          </button>
                          <button
                            onClick={() => handleImportBook(book, sourceResult.sourceId)}
                            disabled={isImporting === book.id}
                            className="flex-1 px-4 py-2 rounded-lg text-white disabled:opacity-50"
                            style={{ backgroundColor: colors.primary }}
                          >
                            {isImporting === book.id ? (
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                            ) : (
                              '导入书籍'
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {searchMode === 'all' && !isSearching && searchQuery && allSourceResults.length === 0 && (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">🔍</div>
                <p className="text-gray-500 dark:text-gray-400">未找到相关书籍</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
