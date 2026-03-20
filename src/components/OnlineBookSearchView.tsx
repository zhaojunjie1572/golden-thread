import { useState, useCallback } from 'react';
import { BookSource, SearchResult } from '../types/book';
import { useBooks } from '../context/BookContext';
import { useTheme } from '../context/ThemeContext';
import ChapterListView from './ChapterListView';

interface OnlineBookSearchViewProps {
  onClose: () => void;
}

export default function OnlineBookSearchView({ onClose }: OnlineBookSearchViewProps) {
  const { bookSources, searchWithBookSource, importFullBook } = useBooks();
  const { colors } = useTheme();
  const [selectedSource, setSelectedSource] = useState<BookSource | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabledSources = bookSources.filter(s => s.enabled);

  const handleSearch = useCallback(async () => {
    if (!selectedSource || !searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    setError(null);
    try {
      const results = await searchWithBookSource(selectedSource.id, searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('搜索失败:', error);
      setError(error instanceof Error ? error.message : '搜索失败，请检查书源配置');
    } finally {
      setIsSearching(false);
    }
  }, [selectedSource, searchQuery, searchWithBookSource]);

  const handleImportBook = useCallback(async (book: SearchResult) => {
    if (!selectedSource) return;

    setIsImporting(book.id);
    setError(null);
    try {
      const importedBook = await importFullBook(selectedSource.id, book);
      alert(`成功导入书籍：${importedBook.title}`);
      setSearchResults(prev => prev.filter(b => b.id !== book.id));
    } catch (error) {
      console.error('导入书籍失败:', error);
      setError(error instanceof Error ? error.message : '导入书籍失败');
    } finally {
      setIsImporting(null);
    }
  }, [selectedSource, importFullBook]);

  const handleShowChapters = useCallback(async (book: SearchResult) => {
    if (!selectedSource) return;
    setSelectedBook(book);
  }, [selectedSource]);

  if (selectedBook && selectedSource) {
    return (
      <ChapterListView
        sourceId={selectedSource.id}
        book={selectedBook}
        onBack={() => setSelectedBook(null)}
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">选择书源</label>
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
              {enabledSources.length === 0 && (
                <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
                  暂无可启用的书源，请先在书源管理中添加
                </p>
              )}
            </div>

            {selectedSource && (
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
                    disabled={isSearching || !searchQuery.trim()}
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
            )}

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

            {searchResults.length > 0 && (
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
          </div>
        </div>
      </div>
    </div>
  );
}
