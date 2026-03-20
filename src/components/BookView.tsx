import { useState, useRef, useCallback } from 'react';
import { useBooks } from '../context/BookContext';
import { Book } from '../types/book';
import BookReader from './BookReader';
import { useTheme } from '../context/ThemeContext';
import BookSourceManager from './BookSourceManager';
import OnlineBookSearchView from './OnlineBookSearchView';

export default function BookView() {
  const { books, addBook, updateBook, deleteBook, importBookFromFile, isLoading } = useBooks();
  const { colors } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showSourceManager, setShowSourceManager] = useState(false);
  const [showOnlineSearch, setShowOnlineSearch] = useState(false);

  const handleImportBook = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const book = await importBookFromFile(file);
      addBook(book);
    } catch (error) {
      console.error('Failed to import book:', error);
      alert('导入书籍失败，请检查文件格式');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [importBookFromFile, addBook]);

  const handleReadBook = useCallback((book: Book) => {
    setSelectedBook(book);
  }, []);

  const handleUpdateProgress = useCallback((bookId: string, position: number) => {
    const book = books.find(b => b.id === bookId);
    if (book) {
      updateBook({
        ...book,
        currentPosition: position,
        lastReadAt: new Date().toISOString(),
      });
    }
  }, [books, updateBook]);

  const handleDeleteBook = useCallback((bookId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (confirm('确定要删除这本书吗？')) {
      deleteBook(bookId);
    }
  }, [deleteBook]);

  const handleCloseReader = useCallback(() => {
    setSelectedBook(null);
  }, []);

  if (selectedBook) {
    return (
      <BookReader
        book={selectedBook}
        onUpdateProgress={(position) => handleUpdateProgress(selectedBook.id, position)}
        onClose={handleCloseReader}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold" style={{ color: colors.primary }}>我的书架</h1>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.epub"
                className="hidden"
                onChange={handleImportBook}
              />
              <button
                onClick={() => setShowSourceManager(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                书源管理
              </button>
              <button
                onClick={() => setShowOnlineSearch(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                网络书源
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: colors.primary }}
              >
                {isImporting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                )}
                {isImporting ? '导入中...' : '导入书籍'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {books.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📚</div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">书架空空如也</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">点击上方按钮导入你的第一本书</p>
            <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-4 max-w-md mx-auto">
              <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">支持的格式</h3>
              <ul className="text-sm text-amber-700 dark:text-amber-300 text-left">
                <li>• 文本文件 (.txt)</li>
                <li>• Markdown 文件 (.md)</li>
                <li>• EPUB 电子书 (.epub)</li>
              </ul>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                提示：文件名格式为「作者 - 书名」会自动识别
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map((book) => {
              const progress = book.totalCharacters > 0 
                ? (book.currentPosition / book.totalCharacters) * 100 
                : 0;
              
              return (
                <div
                  key={book.id}
                  onClick={() => handleReadBook(book)}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 truncate">
                        {book.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {book.author}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteBook(book.id, e)}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>阅读进度</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${progress}%`,
                          backgroundColor: colors.primary 
                        }}
                      />
                    </div>
                    
                    {book.lastReadAt && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        上次阅读: {new Date(book.lastReadAt).toLocaleDateString('zh-CN')}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReadBook(book);
                      }}
                      className="w-full py-2 rounded-lg text-sm font-medium transition-colors text-white"
                      style={{ backgroundColor: colors.primary }}
                    >
                      {progress > 0 ? '继续阅读' : '开始阅读'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showSourceManager && (
        <BookSourceManager
          onClose={() => setShowSourceManager(false)}
        />
      )}

      {showOnlineSearch && (
        <OnlineBookSearchView
          onClose={() => setShowOnlineSearch(false)}
        />
      )}
    </div>
  );
}
