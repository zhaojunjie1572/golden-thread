import { useState, useCallback } from 'react';
import { BookSource } from '../types/book';
import { useBooks } from '../context/BookContext';
import { useTheme } from '../context/ThemeContext';
import BookSourceBrowseView from './BookSourceBrowseView';

interface BookSearchViewProps {
  onClose: () => void;
}

export default function BookSearchView({ onClose }: BookSearchViewProps) {
  const { bookSources, searchBooksFromSource, fetchBookFromSource, addBook } = useBooks();
  const { colors } = useTheme();
  const [selectedSource, setSelectedSource] = useState<BookSource | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingBook, setIsLoadingBook] = useState<string | null>(null);
  const [browsingSource, setBrowsingSource] = useState<BookSource | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!selectedSource || !searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    setSearchError(null);
    try {
      const results = await searchBooksFromSource(selectedSource.id, searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('搜索失败:', error);
      setSearchError(error instanceof Error ? error.message : '搜索失败，请检查书源配置');
    } finally {
      setIsSearching(false);
    }
  }, [selectedSource, searchQuery, searchBooksFromSource]);

  const handleImportBook = useCallback(async (bookId: string) => {
    if (!selectedSource) return;

    setIsLoadingBook(bookId);
    try {
      const book = await fetchBookFromSource(selectedSource.id, bookId);
      addBook(book);
      alert('书籍导入成功！');
    } catch (error) {
      console.error('导入书籍失败:', error);
      alert(error instanceof Error ? error.message : '导入书籍失败，请检查书源配置');
    } finally {
      setIsLoadingBook(null);
    }
  }, [selectedSource, fetchBookFromSource, addBook]);

  const enabledSources = bookSources.filter(s => s.enabled);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">从书源搜索</h2>
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
          {enabledSources.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🔍</div>
              <p className="text-gray-500 dark:text-gray-400 mb-4">没有可用的书源</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">请先在书源管理中添加并启用书源</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">选择书源</label>
                <div className="grid grid-cols-1 gap-2">
                  {enabledSources.map((source) => (
                    <button
                      key={source.id}
                      onClick={() => setSelectedSource(source)}
                      className={`p-3 rounded-xl text-left transition-all ${
                        selectedSource?.id === source.id
                          ? 'ring-2'
                          : 'border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      style={{
                        backgroundColor: selectedSource?.id === source.id ? `${colors.primary}15` : undefined,
                        borderColor: selectedSource?.id === source.id ? colors.primary : undefined,
                      }}
                    >
                      <div className="font-semibold text-gray-900 dark:text-white">{source.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{source.url}</div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedSource && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">搜索书籍</label>
                    <button
                      onClick={() => setBrowsingSource(selectedSource)}
                      className="text-sm px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      浏览全部
                    </button>
                  </div>
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

              {searchError && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 rounded-xl">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">{searchError}</span>
                  </div>
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">搜索结果</h3>
                  {searchResults.map((book) => (
                    <div
                      key={book.id}
                      className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                          {book.title}
                        </h4>
                        {book.author && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {book.author}
                          </p>
                        )}
                        {book.description && (
                          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 line-clamp-2">
                            {book.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleImportBook(book.id)}
                        disabled={isLoadingBook === book.id}
                        className="ml-4 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                        style={{ backgroundColor: colors.primary }}
                      >
                        {isLoadingBook === book.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          '导入'
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {browsingSource && (
        <BookSourceBrowseView
          source={browsingSource}
          onClose={() => setBrowsingSource(null)}
        />
      )}
    </div>
  );
}
