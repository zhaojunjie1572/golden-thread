import { useState, useEffect, useCallback } from 'react';
import { SearchResult, Chapter } from '../types/book';
import { useBooks } from '../context/BookContext';
import { useTheme } from '../context/ThemeContext';
import OnlineReaderView from './OnlineReaderView';

interface ChapterListViewProps {
  sourceId: string;
  book: SearchResult;
  onBack: () => void;
  onClose: () => void;
}

export default function ChapterListView({ sourceId, book, onBack, onClose }: ChapterListViewProps) {
  const { getChapterList, importFullBook } = useBooks();
  const { colors } = useTheme();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [readingChapter, setReadingChapter] = useState<Chapter | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChapters();
  }, [sourceId, book.url]);

  const loadChapters = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const chapterList = await getChapterList(sourceId, book.url);
      setChapters(chapterList);
    } catch (error) {
      console.error('加载章节失败:', error);
      setError(error instanceof Error ? error.message : '加载章节失败');
    } finally {
      setIsLoading(false);
    }
  }, [sourceId, book.url, getChapterList]);

  const handleImportBook = useCallback(async () => {
    setIsImporting(true);
    setError(null);
    try {
      const importedBook = await importFullBook(sourceId, book);
      alert(`成功导入书籍：${importedBook.title}`);
      onClose();
    } catch (error) {
      console.error('导入书籍失败:', error);
      setError(error instanceof Error ? error.message : '导入书籍失败');
    } finally {
      setIsImporting(false);
    }
  }, [sourceId, book, importFullBook, onClose]);

  const handleReadChapter = useCallback((chapter: Chapter) => {
    setReadingChapter(chapter);
  }, []);

  if (readingChapter) {
    return (
      <OnlineReaderView
        sourceId={sourceId}
        book={book}
        chapters={chapters}
        initialChapter={readingChapter}
        onBack={() => setReadingChapter(null)}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                {book.title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {book.author}
              </p>
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
          {book.intro && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
              {book.intro}
            </p>
          )}
        </div>

        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
          <div className="flex gap-2">
            <button
              onClick={handleImportBook}
              disabled={isImporting}
              className="flex-1 px-4 py-2 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: colors.primary }}
            >
              {isImporting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
              ) : (
                '导入全本'
              )}
            </button>
            <button
              onClick={loadChapters}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                '刷新'
              )}
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(80vh-180px)]">
          {error && (
            <div className="p-6 text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
              <button
                onClick={loadChapters}
                className="px-4 py-2 rounded-lg text-white"
                style={{ backgroundColor: colors.primary }}
              >
                重试
              </button>
            </div>
          )}

          {isLoading && !error && (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" 
                   style={{ borderColor: `${colors.primary}`, borderTopColor: 'transparent' }} />
              <p className="text-gray-500 dark:text-gray-400">加载章节中...</p>
            </div>
          )}

          {!isLoading && !error && chapters.length === 0 && (
            <div className="p-12 text-center">
              <div className="text-4xl mb-4">📚</div>
              <p className="text-gray-500 dark:text-gray-400">暂无章节</p>
            </div>
          )}

          {!isLoading && !error && chapters.length > 0 && (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {chapters.map((chapter) => (
                <button
                  key={chapter.id}
                  onClick={() => handleReadChapter(chapter)}
                  className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between"
                >
                  <span className="text-gray-900 dark:text-white truncate flex-1">
                    {chapter.title}
                  </span>
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
