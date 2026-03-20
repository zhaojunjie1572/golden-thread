import { useState, useEffect, useCallback, useRef } from 'react';
import { SearchResult, Chapter, Book } from '../types/book';
import { useBooks } from '../context/BookContext';
import { useTheme } from '../context/ThemeContext';

interface OnlineReaderViewProps {
  sourceId: string;
  book: SearchResult;
  chapters: Chapter[];
  initialChapter: Chapter;
  onBack: () => void;
  onClose: () => void;
}

export default function OnlineReaderView({ sourceId, book, chapters, initialChapter, onBack, onClose }: OnlineReaderViewProps) {
  const { getChapterContent, addBook } = useBooks();
  const { colors, isDarkMode } = useTheme();
  const [currentChapter, setCurrentChapter] = useState(initialChapter);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [lineSpacing, setLineSpacing] = useState(1.8);
  const [collectedChapters, setCollectedChapters] = useState<{ [key: string]: string }>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChapter(initialChapter);
  }, [initialChapter]);

  const loadChapter = useCallback(async (chapter: Chapter) => {
    if (collectedChapters[chapter.id]) {
      setContent(collectedChapters[chapter.id]);
      setCurrentChapter(chapter);
      setError(null);
      scrollRef.current?.scrollTo(0, 0);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const chapterContent = await getChapterContent(sourceId, chapter.url);
      setContent(chapterContent);
      setCurrentChapter(chapter);
      setCollectedChapters(prev => ({ ...prev, [chapter.id]: chapterContent }));
      scrollRef.current?.scrollTo(0, 0);
    } catch (error) {
      console.error('加载章节失败:', error);
      setError(error instanceof Error ? error.message : '加载章节失败');
    } finally {
      setIsLoading(false);
    }
  }, [sourceId, getChapterContent, collectedChapters]);

  const handlePrevChapter = useCallback(() => {
    const currentIndex = chapters.findIndex(c => c.id === currentChapter.id);
    if (currentIndex > 0) {
      loadChapter(chapters[currentIndex - 1]);
    }
  }, [chapters, currentChapter, loadChapter]);

  const handleNextChapter = useCallback(() => {
    const currentIndex = chapters.findIndex(c => c.id === currentChapter.id);
    if (currentIndex < chapters.length - 1) {
      loadChapter(chapters[currentIndex + 1]);
    }
  }, [chapters, currentChapter, loadChapter]);

  const handleSaveBook = useCallback(async () => {
    if (Object.keys(collectedChapters).length === 0) {
      alert('请先阅读一些章节再保存');
      return;
    }

    setIsSaving(true);
    try {
      let fullContent = `《${book.title}》\n\n`;
      fullContent += `作者：${book.author}\n\n`;
      
      if (book.intro) {
        fullContent += `${book.intro}\n\n`;
      }
      
      fullContent += '='.repeat(50) + '\n\n';

      const startIndex = chapters.findIndex(c => c.id === initialChapter.id);
      const endIndex = chapters.findIndex(c => c.id === currentChapter.id);
      const minIndex = Math.min(startIndex, endIndex);
      const maxIndex = Math.max(startIndex, endIndex);

      for (let i = minIndex; i <= maxIndex; i++) {
        const chapter = chapters[i];
        const chapterContent = collectedChapters[chapter.id];
        if (chapterContent) {
          fullContent += `${chapter.title}\n\n`;
          fullContent += `${chapterContent}\n\n`;
        }
      }

      const newBook: Book = {
        id: crypto.randomUUID(),
        title: book.title,
        author: book.author,
        content: fullContent,
        coverImage: book.coverUrl,
        addedAt: new Date().toISOString(),
        currentPosition: 0,
        totalCharacters: fullContent.length,
        sourceId,
        sourceUrl: book.url,
      };

      addBook(newBook);
      alert(`成功保存书籍：${book.title}\n已保存从 ${chapters[minIndex].title} 到 ${chapters[maxIndex].title} 的内容`);
    } catch (error) {
      console.error('保存书籍失败:', error);
      alert('保存书籍失败');
    } finally {
      setIsSaving(false);
    }
  }, [book, sourceId, initialChapter, currentChapter, chapters, collectedChapters, addBook]);

  const toggleMenu = useCallback(() => {
    setShowMenu(prev => !prev);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    if (x < width / 3) {
      handlePrevChapter();
    } else if (x > width * 2 / 3) {
      handleNextChapter();
    } else {
      toggleMenu();
    }
  }, [handlePrevChapter, handleNextChapter, toggleMenu]);

  const currentIndex = chapters.findIndex(c => c.id === currentChapter.id);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: isDarkMode ? '#1a1a2e' : '#f5f5f0' }}>
      {showMenu && (
        <div 
          className="absolute inset-0 z-40"
          onClick={() => setShowMenu(false)}
        />
      )}

      {showMenu && (
        <div 
          className="absolute top-0 left-0 right-0 z-50 border-b"
          style={{ 
            backgroundColor: isDarkMode ? '#16213e' : '#ffffff',
            borderColor: isDarkMode ? '#2a2a4e' : '#e0e0e0'
          }}
        >
          <div className="p-4 flex items-center justify-between">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:opacity-70"
              style={{ color: isDarkMode ? '#eaeaea' : '#333' }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 text-center">
              <h1 className="text-lg font-bold truncate" style={{ color: isDarkMode ? '#eaeaea' : '#333' }}>
                {book.title}
              </h1>
              <p className="text-sm truncate" style={{ color: isDarkMode ? '#aaa' : '#666' }}>
                {currentChapter.title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:opacity-70"
              style={{ color: isDarkMode ? '#eaeaea' : '#333' }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto cursor-pointer"
        onClick={handleClick}
      >
        <div className="max-w-3xl mx-auto px-6 py-8 md:px-12 md:py-12">
          {error ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">⚠️</div>
              <p className="mb-4" style={{ color: isDarkMode ? '#e74c3c' : '#c0392b' }}>
                {error}
              </p>
              <button
                onClick={() => loadChapter(currentChapter)}
                className="px-6 py-2 rounded-lg text-white"
                style={{ backgroundColor: colors.primary }}
              >
                重试
              </button>
            </div>
          ) : isLoading ? (
            <div className="text-center py-12">
              <div 
                className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-4"
                style={{ borderColor: colors.primary, borderTopColor: 'transparent' }}
              />
              <p style={{ color: isDarkMode ? '#aaa' : '#666' }}>加载中...</p>
            </div>
          ) : (
            <>
              <h2 
                className="text-xl font-bold mb-6 text-center"
                style={{ color: isDarkMode ? '#eaeaea' : '#333' }}
              >
                {currentChapter.title}
              </h2>
              <div 
                className="whitespace-pre-wrap leading-relaxed"
                style={{ 
                  color: isDarkMode ? '#d1d1e0' : '#444',
                  fontSize: `${fontSize}px`,
                  lineHeight: lineSpacing,
                }}
              >
                {content}
              </div>
            </>
          )}
        </div>
      </div>

      {showMenu && (
        <div 
          className="absolute bottom-0 left-0 right-0 z-50 border-t"
          style={{ 
            backgroundColor: isDarkMode ? '#16213e' : '#ffffff',
            borderColor: isDarkMode ? '#2a2a4e' : '#e0e0e0'
          }}
        >
          <div className="p-4">
            <div className="mb-4">
              <p className="text-sm mb-2" style={{ color: isDarkMode ? '#aaa' : '#666' }}>
                字体大小: {fontSize}px
              </p>
              <input
                type="range"
                min="14"
                max="28"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="mb-4">
              <p className="text-sm mb-2" style={{ color: isDarkMode ? '#aaa' : '#666' }}>
                行间距: {lineSpacing}
              </p>
              <input
                type="range"
                min="1.4"
                max="2.5"
                step="0.1"
                value={lineSpacing}
                onChange={(e) => setLineSpacing(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePrevChapter}
                disabled={currentIndex <= 0}
                className="flex-1 px-4 py-3 rounded-lg text-white disabled:opacity-50"
                style={{ backgroundColor: colors.primary }}
              >
                上一章
              </button>
              <button
                onClick={handleSaveBook}
                disabled={isSaving}
                className="px-4 py-3 rounded-lg border text-sm"
                style={{ 
                  borderColor: colors.primary,
                  color: colors.primary,
                }}
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto" />
                ) : (
                  '保存到书架'
                )}
              </button>
              <button
                onClick={handleNextChapter}
                disabled={currentIndex >= chapters.length - 1}
                className="flex-1 px-4 py-3 rounded-lg text-white disabled:opacity-50"
                style={{ backgroundColor: colors.primary }}
              >
                下一章
              </button>
            </div>
          </div>
        </div>
      )}

      {!showMenu && !isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div 
            className="text-2xl opacity-20 pointer-events-none"
            style={{ color: isDarkMode ? '#fff' : '#000' }}
          >
            点击屏幕中间显示菜单
          </div>
        </div>
      )}
    </div>
  );
}
