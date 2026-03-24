import { useState, useRef, useCallback } from 'react';
import { useBooks } from '../context/BookContext';
import { Book } from '../types/book';
import BookReader from './BookReader';
import { useTheme } from '../context/ThemeContext';
import BookSourceManager from './BookSourceManager';
import OnlineBookSearchView from './OnlineBookSearchView';
import { BuiltInLibrary } from './BuiltInLibrary';

export default function BookView() {
  const { books, addBook, updateBook, deleteBook, importBookFromFile, isLoading } = useBooks();
  const { colors } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [showSourceManager, setShowSourceManager] = useState(false);
  const [showOnlineSearch, setShowOnlineSearch] = useState(false);
  const [showBuiltInLibrary, setShowBuiltInLibrary] = useState(false);

  const handleImportBook = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          // importBookFromFile 内部已经调用了 addBook，这里不需要再调用
          await importBookFromFile(file);
          successCount++;
        } catch (error) {
          console.error(`导入书籍失败: ${file.name}`, error);
          failCount++;
        }
        setImportProgress(Math.round(((i + 1) / files.length) * 100));
      }

      const message = `导入完成！成功: ${successCount} 本，失败: ${failCount} 本`;
      alert(message);
    } catch (error) {
      console.error('批量导入失败:', error);
      alert('批量导入过程中发生错误');
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [importBookFromFile]);

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
                multiple
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
                onClick={() => setShowBuiltInLibrary(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-300 dark:border-green-600 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/30"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                📖 公版书库
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: colors.primary }}
              >
                {isImporting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{importProgress}%</span>
                  </>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                )}
                {isImporting ? `导入中 (${importProgress}%)` : '导入书籍'}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {books.map((book) => {
              const progress = book.totalCharacters > 0 
                ? (book.currentPosition / book.totalCharacters) * 100 
                : 0;
              
              const bookColors = [
                { spine: '#8B4513', cover: '#CD853F' },
                { spine: '#4A0080', cover: '#8B5CF6' },
                { spine: '#006400', cover: '#22C55E' },
                { spine: '#8B0000', cover: '#EF4444' },
                { spine: '#1E3A5F', cover: '#3B82F6' },
                { spine: '#704214', cover: '#D97706' },
                { spine: '#581845', cover: '#EC4899' },
              ];
              const colorIndex = book.id.charCodeAt(0) % bookColors.length;
              const bookColor = bookColors[colorIndex];
              
              return (
                <div
                  key={book.id}
                  className="group"
                >
                  <div
                    onClick={() => handleReadBook(book)}
                    className="relative cursor-pointer transition-all duration-300 hover:-translate-y-2"
                  >
                    <div className="relative">
                      <div 
                        className="absolute left-0 top-0 bottom-0 w-3 rounded-l-lg shadow-inner"
                        style={{ backgroundColor: bookColor.spine }}
                      />
                      
                      <div 
                        className="ml-3 rounded-r-lg shadow-lg overflow-hidden transition-transform duration-300 group-hover:shadow-xl"
                        style={{ backgroundColor: bookColor.cover }}
                      >
                        {book.coverImage ? (
                          <div className="aspect-[2/3] relative">
                            <img 
                              src={book.coverImage} 
                              alt={book.title}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                          </div>
                        ) : (
                          <div className="aspect-[2/3] flex flex-col items-center justify-center p-4">
                            <div className="text-4xl mb-3">📖</div>
                            <div className="text-center">
                              <h3 className="font-bold text-white text-sm leading-tight mb-1 line-clamp-2 drop-shadow-md">
                                {book.title}
                              </h3>
                              <p className="text-white/80 text-xs drop-shadow-md">
                                {book.author}
                              </p>
                            </div>
                          </div>
                        )}
                        
                        <div className="absolute bottom-0 left-0 right-0">
                          <div className="h-1.5 bg-black/30">
                            <div 
                              className="h-full bg-white/80 transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => handleDeleteBook(book.id, e)}
                      className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:scale-110 shadow-lg"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="mt-3 text-center">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm truncate">
                      {book.title}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-xs truncate">
                      {book.author}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {Math.round(progress)}%
                    </p>
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

      {showBuiltInLibrary && (
        <BuiltInLibrary
          onClose={() => setShowBuiltInLibrary(false)}
          onSelectBook={(book) => {
            setSelectedBook(book);
            setShowBuiltInLibrary(false);
          }}
        />
      )}
    </div>
  );
}
