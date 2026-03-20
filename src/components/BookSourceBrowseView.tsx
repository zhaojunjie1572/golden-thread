import { useState, useCallback, useEffect } from 'react';
import { BookSource } from '../types/book';
import { useBooks } from '../context/BookContext';
import { useTheme } from '../context/ThemeContext';

interface BookSourceBrowseViewProps {
  source: BookSource;
  onClose: () => void;
}

export default function BookSourceBrowseView({ source, onClose }: BookSourceBrowseViewProps) {
  const { listBooksFromSource, fetchBookFromSource, addBook } = useBooks();
  const { colors } = useTheme();
  const [books, setBooks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBook, setIsLoadingBook] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBooks = useCallback(async (pageNum: number = 1) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await listBooksFromSource(source.id, pageNum, 20);
      
      if (pageNum === 1) {
        setBooks(result.books);
      } else {
        setBooks(prev => [...prev, ...result.books]);
      }
      setHasMore(result.hasMore);
      setPage(pageNum);
    } catch (error) {
      console.error('获取书籍列表失败:', error);
      setError(error instanceof Error ? error.message : '获取书籍列表失败');
      if (pageNum === 1) {
        setBooks([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [source.id, listBooksFromSource]);

  useEffect(() => {
    loadBooks(1);
  }, [loadBooks]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoading) return;
    loadBooks(page + 1);
  }, [loadBooks, page, hasMore, isLoading]);

  const handleImportBook = useCallback(async (bookId: string) => {
    setIsLoadingBook(bookId);
    try {
      const book = await fetchBookFromSource(source.id, bookId);
      addBook(book);
      alert('书籍导入成功！');
    } catch (error) {
      console.error('导入书籍失败:', error);
      alert(error instanceof Error ? error.message : '导入书籍失败，请检查书源配置');
    } finally {
      setIsLoadingBook(null);
    }
  }, [source.id, fetchBookFromSource, addBook]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">浏览书籍</h2>
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

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
          {error ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">⚠️</div>
              <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
              <button
                onClick={() => loadBooks(1)}
                className="px-4 py-2 rounded-lg text-white"
                style={{ backgroundColor: colors.primary }}
              >
                重试
              </button>
            </div>
          ) : isLoading && page === 1 ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" 
                   style={{ borderColor: `${colors.primary}`, borderTopColor: 'transparent' }} />
              <p className="text-gray-500 dark:text-gray-400">加载中...</p>
            </div>
          ) : books.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📚</div>
              <p className="text-gray-500 dark:text-gray-400">暂无书籍</p>
            </div>
          ) : (
            <div className="space-y-3">
              {books.map((book) => (
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

              {hasMore && (
                <div className="pt-4">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoading}
                    className="w-full py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : (
                      '加载更多'
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p className="font-semibold mb-1">书源列表接口规范：</p>
            <ul className="space-y-1">
              <li>• 列表接口: <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">{`{书源地址}/list?page=页码&limit=数量`}</code></li>
              <li>• 返回格式: <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">{`{"books": [...], "hasMore": true/false}`}</code></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
