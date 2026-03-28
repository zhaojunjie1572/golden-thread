import { useState, useMemo } from 'react';
import { Book } from '../types/book';

interface BookBatchManagerProps {
  books: Book[];
  onClose: () => void;
  onDeleteBooks: (bookIds: string[]) => void;
  onExportBooks: (bookIds: string[]) => void;
}

export default function BookBatchManager({ 
  books, 
  onClose, 
  onDeleteBooks,
  onExportBooks 
}: BookBatchManagerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'author' | 'addedAt' | 'progress'>('addedAt');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 过滤和排序书籍
  const filteredBooks = useMemo(() => {
    let result = books;
    
    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(book => 
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query)
      );
    }
    
    // 排序
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'author':
          return a.author.localeCompare(b.author);
        case 'addedAt':
          return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
        case 'progress':
          const progressA = a.totalCharacters > 0 ? a.currentPosition / a.totalCharacters : 0;
          const progressB = b.totalCharacters > 0 ? b.currentPosition / b.totalCharacters : 0;
          return progressB - progressA;
        default:
          return 0;
      }
    });
    
    return result;
  }, [books, searchQuery, sortBy]);

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredBooks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredBooks.map(b => b.id)));
    }
  };

  // 选择/取消选择单个书籍
  const toggleSelectBook = (bookId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(bookId)) {
      newSelected.delete(bookId);
    } else {
      newSelected.add(bookId);
    }
    setSelectedIds(newSelected);
  };

  // 执行批量删除
  const handleDelete = () => {
    if (selectedIds.size === 0) return;
    onDeleteBooks(Array.from(selectedIds));
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
  };

  // 执行批量导出
  const handleExport = () => {
    if (selectedIds.size === 0) return;
    onExportBooks(Array.from(selectedIds));
  };

  // 计算选中书籍的总大小（估算）
  const selectedSize = useMemo(() => {
    const selectedBooks = books.filter(b => selectedIds.has(b.id));
    const totalChars = selectedBooks.reduce((sum, b) => sum + (b.content?.length || 0), 0);
    return (totalChars / 1024 / 1024).toFixed(2);
  }, [books, selectedIds]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">批量管理书籍</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              共 {books.length} 本书，已选择 {selectedIds.size} 本
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 工具栏 */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          {/* 搜索和排序 */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="搜索书名或作者..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="addedAt">按添加时间</option>
              <option value="title">按书名</option>
              <option value="author">按作者</option>
              <option value="progress">按阅读进度</option>
            </select>
          </div>

          {/* 批量操作按钮 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={selectedIds.size === filteredBooks.length && filteredBooks.length > 0 ? "M20 12H4" : "M4 6h16M4 12h16M4 18h16"} />
                </svg>
                {selectedIds.size === filteredBooks.length && filteredBooks.length > 0 ? '取消全选' : '全选'}
              </button>
              
              {selectedIds.size > 0 && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  已选 {selectedIds.size} 本 ({selectedSize} MB)
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleExport}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                导出选中
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                删除选中
              </button>
            </div>
          </div>
        </div>

        {/* 书籍列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredBooks.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p>没有找到匹配的书籍</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredBooks.map((book) => {
                const progress = book.totalCharacters > 0 
                  ? (book.currentPosition / book.totalCharacters) * 100 
                  : 0;
                const isSelected = selectedIds.has(book.id);
                const sizeMB = ((book.content?.length || 0) / 1024 / 1024).toFixed(2);
                
                return (
                  <div
                    key={book.id}
                    onClick={() => toggleSelectBook(book.id)}
                    className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {/* 复选框 */}
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected 
                        ? 'bg-blue-500 border-blue-500' 
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    
                    {/* 书籍信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {book.title}
                        </h3>
                        {book.fileName && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {book.fileName}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {book.author} · {sizeMB} MB · {Math.round(progress)}% 已读
                      </p>
                    </div>
                    
                    {/* 阅读进度条 */}
                    <div className="w-24 hidden sm:block">
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    
                    {/* 添加时间 */}
                    <div className="text-xs text-gray-400 dark:text-gray-500 hidden md:block">
                      {new Date(book.addedAt).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">确认删除</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  确定要删除选中的 {selectedIds.size} 本书吗？
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              此操作不可撤销，书籍数据将被永久删除。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
