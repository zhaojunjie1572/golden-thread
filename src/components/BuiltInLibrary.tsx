import React, { useState } from 'react';
import { BUILT_IN_BOOKS, convertBuiltInBookToBook } from '../data/builtInBooks';
import { Book } from '../types/book';
import { useBooks } from '../context/BookContext';

interface BuiltInLibraryProps {
  onClose: () => void;
  onSelectBook: (book: Book) => void;
}

export const BuiltInLibrary: React.FC<BuiltInLibraryProps> = ({ onClose, onSelectBook }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const { addBook } = useBooks();
  const [importingBookId, setImportingBookId] = useState<string | null>(null);

  const categories = ['全部', ...Array.from(new Set(BUILT_IN_BOOKS.map(b => b.category)))];

  const filteredBooks = selectedCategory === '全部'
    ? BUILT_IN_BOOKS
    : BUILT_IN_BOOKS.filter(b => b.category === selectedCategory);

  const handleImport = async (builtInBook: typeof BUILT_IN_BOOKS[0]) => {
    setImportingBookId(builtInBook.id);
    try {
      const book = convertBuiltInBookToBook(builtInBook);
      await addBook(book);
      alert(`《${builtInBook.title}》已导入到书架！`);
    } catch (error) {
      console.error('导入书籍失败:', error);
      alert('导入失败，请重试');
    } finally {
      setImportingBookId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">📚 公版书库</h1>
        <div className="w-10" />
      </div>

      {/* 分类标签 */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              selectedCategory === category
                ? 'bg-golden text-white'
                : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* 书籍列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {filteredBooks.map(book => (
            <div
              key={book.id}
              className="flex gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"
            >
              {/* 封面 */}
              <img
                src={book.coverUrl}
                alt={book.title}
                className="w-20 h-28 object-cover rounded-lg shadow-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="112" viewBox="0 0 80 112"><rect fill="%23e5e5e5" width="80" height="112"/><text x="40" y="60" text-anchor="middle" fill="%23999" font-size="12">📖</text></svg>';
                }}
              />

              {/* 信息 */}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-gray-800 dark:text-white truncate">
                  {book.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {book.author}
                </p>
                <p className="text-xs text-golden mt-1">{book.category}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                  {book.intro}
                </p>

                {/* 操作按钮 */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => onSelectBook(convertBuiltInBookToBook(book))}
                    className="flex-1 px-3 py-2 text-sm bg-golden text-white rounded-lg hover:opacity-90 transition-opacity"
                  >
                    直接阅读
                  </button>
                  <button
                    onClick={() => handleImport(book)}
                    disabled={importingBookId === book.id}
                    className="flex-1 px-3 py-2 text-sm border border-golden text-golden rounded-lg hover:bg-golden/10 transition-colors disabled:opacity-50"
                  >
                    {importingBookId === book.id ? (
                      <div className="w-4 h-4 border-2 border-golden border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : (
                      '导入书架'
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredBooks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">该分类下暂无书籍</p>
          </div>
        )}
      </div>

      {/* 底部说明 */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          📚 公版图书，永久免费阅读
        </p>
      </div>
    </div>
  );
};
