import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { Book, BookSource, parseTextToBook, SearchResult, Chapter } from '../types/book';
import { BookSourceParser } from '../utils/bookSourceParser';
import { parseEpubFile, isEpubFile } from '../utils/epubParser';

/**
 * 清洗 JSON 文本，将中文标点转换为英文标点
 * 用于处理从网络获取的可能包含中文标点的 JSON 数据
 */
function cleanJsonText(text: string): string {
  return text
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/'/g, "'")
    .replace(/，/g, ',')
    .replace(/：/g, ':')
    .replace(/；/g, ';')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/【/g, '[')
    .replace(/】/g, ']');
}

/**
 * 检测文本是否包含乱码（简单的启发式检测）
 */
function containsGarbledText(text: string): boolean {
  // 检测常见的乱码特征
  const garbledPatterns = [
    /[\uFFFD\u0000-\u0008\u000B-\u000C\u000E-\u001F]/, // 替换字符和控制字符
  ];

  // 如果文本中包含大量连续的非中文字符和非英文字符，可能是乱码
  const suspiciousChars = text.match(/[^\u4e00-\u9fa5a-zA-Z0-9\s\p{P}]/gu);
  if (suspiciousChars && suspiciousChars.length > text.length * 0.3) {
    return true;
  }

  return garbledPatterns.some(pattern => pattern.test(text));
}

/**
 * 使用 FileReader 读取文件，尝试多种编码
 */
function readFileWithEncoding(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const encodings = ['UTF-8', 'GBK', 'GB2312', 'GB18030', 'Big5'];
    let currentIndex = 0;

    const tryNextEncoding = () => {
      if (currentIndex >= encodings.length) {
        // 如果所有编码都失败，使用默认的 UTF-8
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          resolve(result);
        };
        reader.onerror = () => reject(new Error('读取文件失败'));
        reader.readAsText(file, 'UTF-8');
        return;
      }

      const encoding = encodings[currentIndex];
      const reader = new FileReader();

      reader.onload = (e) => {
        const result = e.target?.result as string;

        // 检查是否是乱码
        if (!containsGarbledText(result) || currentIndex === encodings.length - 1) {
          resolve(result);
        } else {
          currentIndex++;
          tryNextEncoding();
        }
      };

      reader.onerror = () => {
        currentIndex++;
        tryNextEncoding();
      };

      reader.readAsText(file, encoding);
    };

    tryNextEncoding();
  });
}

interface BookContextType {
  books: Book[];
  addBook: (book: Book) => void;
  updateBook: (book: Book) => void;
  deleteBook: (id: string) => void;
  getBookById: (id: string) => Book | undefined;
  importBookFromFile: (file: File) => Promise<Book>;
  isLoading: boolean;
  bookSources: BookSource[];
  addBookSource: (source: Omit<BookSource, 'id' | 'addedAt'>) => void;
  addBookSourcesBatch: (sources: Array<Omit<BookSource, 'id' | 'addedAt'>>) => void;
  updateBookSource: (source: BookSource) => void;
  deleteBookSource: (id: string) => void;
  resetToDefaultSources: () => void;
  searchBooksFromSource: (sourceId: string, query: string) => Promise<any[]>;
  fetchBookFromSource: (sourceId: string, bookId: string) => Promise<Book>;
  listBooksFromSource: (sourceId: string, page: number, limit: number) => Promise<{ books: any[]; hasMore: boolean }>;
  testBookSource: (sourceId: string) => Promise<{ success: boolean; message: string }>;
  importBookSourcesFromFile: (file: File) => Promise<number>;
  
  searchWithBookSource: (sourceId: string, keyword: string) => Promise<SearchResult[]>;
  searchWithAllSources: (keyword: string) => Promise<{ sourceId: string; sourceName: string; results: SearchResult[] }[]>;
  getChapterList: (sourceId: string, bookUrl: string) => Promise<Chapter[]>;
  getChapterContent: (sourceId: string, chapterUrl: string) => Promise<string>;
  importFullBook: (sourceId: string, searchResult: SearchResult) => Promise<Book>;
  testUrl: (url: string, source?: BookSource) => Promise<string>;
  importBookSourcesFromUrl: (url: string) => Promise<number>;
}

const BookContext = createContext<BookContextType | undefined>(undefined);
const STORAGE_KEY = 'golden-thread-books';
const SOURCES_STORAGE_KEY = 'golden-thread-book-sources';

const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://thingproxy.freeboard.io/fetch/',
  'https://cors-anywhere.herokuapp.com/',
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
];

const DEFAULT_BOOK_SOURCES = [
  {
    name: '📚 本地演示书源',
    url: 'local://demo',
    type: 'api' as const,
    enabled: true,
    bookSourceGroup: '演示',
    bookSourceComment: '本地演示书源-100%可用',
    searchUrl: 'local://demo/search?keyword={{key}}',
    ruleSearch: {
      bookList: '$.books',
      name: '$.title',
      author: '$.author',
      coverUrl: '$.coverUrl',
      bookUrl: '$.id@js:"local://demo/book/"+result',
      intro: '$.intro',
    },
    ruleBookInfo: {
      name: '$.title',
      author: '$.author',
      coverUrl: '$.coverUrl',
      intro: '$.intro',
    },
    ruleToc: {
      chapterList: '$.chapters',
      chapterName: '$.title',
      chapterUrl: '$.id@js:"local://demo/chapter/"+result',
    },
    ruleContent: {
      content: '$.content',
    },
  },
  {
    name: '📖 JSON格式测试书源',
    url: 'local://demo-json',
    type: 'api' as const,
    enabled: true,
    bookSourceGroup: '测试',
    bookSourceComment: '测试JSON路径解析',
    searchUrl: 'local://demo/search?keyword={{key}}',
    ruleSearch: {
      bookList: '$.books',
      name: '$.title',
      author: '$.author',
      coverUrl: '$.coverUrl',
      bookUrl: '$.id@js:"local://demo/book/"+result',
      intro: '$.intro',
    },
    ruleBookInfo: {
      name: '$.title',
      author: '$.author',
      coverUrl: '$.coverUrl',
      intro: '$.intro',
    },
    ruleToc: {
      chapterList: '$.chapters',
      chapterName: '$.title',
      chapterUrl: '$.id@js:"local://demo/chapter/"+result',
    },
    ruleContent: {
      content: '$.content',
    },
  },
  {
    name: '📰 RSS格式测试书源',
    url: 'local://demo-rss',
    type: 'rss' as const,
    enabled: true,
    bookSourceGroup: '测试',
    bookSourceComment: '测试RSS解析',
    searchUrl: 'local://demo/search?keyword={{key}}',
    ruleSearch: {
      bookList: '$.books',
      name: '$.title',
      author: '$.author',
      coverUrl: '$.coverUrl',
      bookUrl: '$.id@js:"local://demo/book/"+result',
      intro: '$.intro',
    },
    ruleBookInfo: {
      name: '$.title',
      author: '$.author',
      coverUrl: '$.coverUrl',
      intro: '$.intro',
    },
    ruleToc: {
      chapterList: '$.chapters',
      chapterName: '$.title',
      chapterUrl: '$.id@js:"local://demo/chapter/"+result',
    },
    ruleContent: {
      content: '$.content',
    },
  },
];

export function BookProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bookSources, setBookSources] = useState<BookSource[]>([]);
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentBook(books.find(b => b.id === currentBookId) || null);
  }, [currentBookId, books]);

  const setCurrentBook = (book: Book | null) => {
    setCurrentBookId(book?.id || null);
  };

  useEffect(() => {
    loadBooks();
    loadBookSources();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      saveBooks();
    }
  }, [books, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      saveBookSources();
    }
  }, [bookSources, isLoading]);

  function loadBooks() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setBooks(parsed.map((book: any) => ({
          ...book,
          addedAt: new Date(book.addedAt),
        })));
      }
    } catch (error) {
      console.error('加载书籍失败:', error);
    }
  }

  function saveBooks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
    } catch (error) {
      console.error('保存书籍失败:', error);
    }
  }

  function loadBookSources() {
    try {
      const saved = localStorage.getItem(SOURCES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setBookSources(parsed.map((source: any) => ({
          ...source,
          addedAt: typeof source.addedAt === 'string' ? source.addedAt : new Date(source.addedAt).toISOString(),
        })));
      } else {
        const defaultSources: BookSource[] = DEFAULT_BOOK_SOURCES.map(source => ({
          ...source,
          id: crypto.randomUUID(),
          addedAt: new Date().toISOString(),
        }));
        setBookSources(defaultSources);
      }
    } catch (error) {
      console.error('加载书源失败:', error);
      const defaultSources: BookSource[] = DEFAULT_BOOK_SOURCES.map(source => ({
        ...source,
        id: crypto.randomUUID(),
        addedAt: new Date().toISOString(),
      }));
      setBookSources(defaultSources);
    }
    setIsLoading(false);
  }

  function saveBookSources() {
    try {
      localStorage.setItem(SOURCES_STORAGE_KEY, JSON.stringify(bookSources));
    } catch (error) {
      console.error('保存书源失败:', error);
    }
  }

  const addBook = (book: Book) => {
    setBooks(prev => {
      const newBooks = [book, ...prev];
      // 立即保存到 localStorage，不依赖 useEffect
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newBooks));
      } catch (error) {
        console.error('保存书籍失败:', error);
      }
      return newBooks;
    });
  };

  const updateBook = (updatedBook: Book) => {
    setBooks(prev => {
      const newBooks = prev.map(book => 
        book.id === updatedBook.id ? updatedBook : book
      );
      // 立即保存到 localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newBooks));
      } catch (error) {
        console.error('保存书籍失败:', error);
      }
      return newBooks;
    });
  };

  const deleteBook = (id: string) => {
    setBooks(prev => {
      const newBooks = prev.filter(book => book.id !== id);
      // 立即保存到 localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newBooks));
      } catch (error) {
        console.error('保存书籍失败:', error);
      }
      return newBooks;
    });
  };

  const getBookById = (id: string) => {
    return books.find(book => book.id === id);
  };

  const importBookFromFile = async (file: File): Promise<Book> => {
    let book: Book;

    // 根据文件类型选择解析方式
    if (isEpubFile(file)) {
      // 解析 EPUB 文件
      const epubContent = await parseEpubFile(file);
      book = {
        id: crypto.randomUUID(),
        title: epubContent.title,
        author: epubContent.author,
        content: epubContent.content,
        fileName: file.name,
        addedAt: new Date().toISOString(),
        currentPosition: 0,
        totalCharacters: epubContent.content.length,
      };
    } else {
      // 解析 TXT 文件，尝试多种编码
      const content = await readFileWithEncoding(file);
      book = parseTextToBook(content);
      book.fileName = file.name;
    }

    addBook(book);
    return book;
  };

  const addBookSource = (source: Omit<BookSource, 'id' | 'addedAt'>) => {
    const newSource: BookSource = {
      ...source,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
    };
    setBookSources(prev => [...prev, newSource]);
  };

  const addBookSourcesBatch = (sources: Array<Omit<BookSource, 'id' | 'addedAt'>>) => {
    const newSources = sources.map(source => ({
      ...source,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
    }));
    setBookSources(prev => [...prev, ...newSources]);
  };

  const updateBookSource = (updatedSource: BookSource) => {
    setBookSources(prev => prev.map(source => 
      source.id === updatedSource.id ? updatedSource : source
    ));
  };

  const deleteBookSource = (id: string) => {
    setBookSources(prev => prev.filter(source => source.id !== id));
  };

  const resetToDefaultSources = () => {
    const defaultSources = DEFAULT_BOOK_SOURCES.map(source => ({
      ...source,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
    }));
    setBookSources(defaultSources);
  };

  const fetchWithProxy = async (url: string, options: RequestInit = {}, retryCount = 0): Promise<Response> => {
    const maxRetries = CORS_PROXIES.length;
    
    if (retryCount >= maxRetries) {
      throw new Error('所有代理都失败了');
    }

    const proxyUrl = CORS_PROXIES[retryCount] + encodeURIComponent(url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(proxyUrl, {
        ...options,
        signal: controller.signal,
        headers: {
          ...options.headers,
          'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
        },
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (retryCount < maxRetries - 1) {
        console.warn(`代理 ${retryCount + 1} 失败，尝试下一个...`);
        return fetchWithProxy(url, options, retryCount + 1);
      }
      
      throw error;
    }
  };

  const searchBooksFromSource = async (sourceId: string, query: string): Promise<any[]> => {
    const source = bookSources.find(s => s.id === sourceId);
    if (!source) throw new Error('书源不存在');

    try {
      let searchUrl = source.searchUrl?.replace('{{key}}', encodeURIComponent(query));
      
      if (source.type === 'rss' || !searchUrl) {
        searchUrl = source.url;
      }

      const response = await fetchWithProxy(searchUrl);
      const text = await response.text();
      
      return BookSourceParser.parseSearchResults(text, source.ruleSearch?.list || '');
    } catch (error) {
      console.error('搜索失败:', error);
      throw error;
    }
  };

  const fetchBookFromSource = async (sourceId: string, bookId: string): Promise<Book> => {
    const source = bookSources.find(s => s.id === sourceId);
    if (!source) throw new Error('书源不存在');

    try {
      const response = await fetchWithProxy(bookId);
      const text = await response.text();
      
      const bookInfo = BookSourceParser.parseBookInfo(text, source.ruleBookInfo || {});
      
      return {
        id: crypto.randomUUID(),
        title: bookInfo.name || '未知书名',
        author: bookInfo.author || '未知作者',
        content: '',
        currentPosition: 0,
        totalCharacters: 0,
        addedAt: new Date().toISOString(),
        fileName: '',
      };
    } catch (error) {
      console.error('获取书籍信息失败:', error);
      throw error;
    }
  };

  const listBooksFromSource = async (sourceId: string, page: number, limit: number): Promise<{ books: any[]; hasMore: boolean }> => {
    const source = bookSources.find(s => s.id === sourceId);
    if (!source) throw new Error('书源不存在');

    try {
      const response = await fetchWithProxy(source.url);
      const text = await response.text();
      
      const books = BookSourceParser.parseBookList(text, source.ruleSearch?.list || '');
      
      const start = (page - 1) * limit;
      const end = start + limit;
      
      return {
        books: books.slice(start, end),
        hasMore: end < books.length,
      };
    } catch (error) {
      console.error('获取书籍列表失败:', error);
      throw error;
    }
  };

  const testBookSource = async (sourceId: string): Promise<{ success: boolean; message: string }> => {
    const source = bookSources.find(s => s.id === sourceId);
    if (!source) return { success: false, message: '书源不存在' };

    try {
      const response = await fetchWithProxy(source.url);
      if (response.ok) {
        return { success: true, message: '连接成功' };
      } else {
        return { success: false, message: `HTTP ${response.status}` };
      }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : '连接失败' };
    }
  };

  const importBookSourcesFromFile = async (file: File): Promise<number> => {
    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('读取文件失败'));
        reader.readAsText(file);
      });

      let jsonData;
      try {
        const cleanedText = cleanJsonText(text);
        jsonData = JSON.parse(cleanedText);
      } catch (e) {
        throw new Error('JSON 格式解析失败');
      }

      const sources: Array<Omit<BookSource, 'id' | 'addedAt'>> = [];

      if (Array.isArray(jsonData)) {
        for (const item of jsonData) {
          const parsed = parseYioveBookSource(item);
          if (parsed) {
            sources.push(parsed);
          }
        }
      } else {
        const parsed = parseYioveBookSource(jsonData);
        if (parsed) {
          sources.push(parsed);
        }
      }

      if (sources.length > 0) {
        addBookSourcesBatch(sources);
      }

      return sources.length;
    } catch (error) {
      console.error('导入书源文件失败:', error);
      throw error;
    }
  };

  const importBookSourcesFromUrl = async (url: string): Promise<number> => {
    try {
      const response = await fetchWithProxy(url);
      const text = await response.text();
      
      let jsonData;
      try {
        const cleanedText = cleanJsonText(text);
        jsonData = JSON.parse(cleanedText);
      } catch (e) {
        throw new Error('JSON 格式解析失败，请确认URL返回的是有效的书源JSON');
      }

      const sources: Array<Omit<BookSource, 'id' | 'addedAt'>> = [];

      if (Array.isArray(jsonData)) {
        for (const item of jsonData) {
          const parsed = parseYioveBookSource(item);
          if (parsed) {
            sources.push(parsed);
          }
        }
      } else {
        const parsed = parseYioveBookSource(jsonData);
        if (parsed) {
          sources.push(parsed);
        }
      }

      if (sources.length > 0) {
        addBookSourcesBatch(sources);
      }

      return sources.length;
    } catch (error) {
      console.error('从URL导入书源失败:', error);
      throw error;
    }
  };

  const searchWithBookSource = async (sourceId: string, keyword: string): Promise<SearchResult[]> => {
    const source = bookSources.find(s => s.id === sourceId);
    if (!source) throw new Error('书源不存在');

    try {
      const searchUrl = source.searchUrl?.replace('{{key}}', encodeURIComponent(keyword));
      if (!searchUrl) throw new Error('书源缺少搜索URL');
      const response = await fetchWithProxy(searchUrl);
      const html = await response.text();
      
      const books = BookSourceParser.parseSearchResults(html, source.ruleSearch?.list || '');
      
      return books.map((book: any) => ({
        ...book,
        sourceId: source.id,
        sourceName: source.name,
      }));
    } catch (error) {
      console.error('搜索失败:', error);
      throw error;
    }
  };

  const searchWithAllSources = async (keyword: string): Promise<{ sourceId: string; sourceName: string; results: SearchResult[] }[]> => {
    const enabledSources = bookSources.filter(s => s.enabled !== false);
    const results: { sourceId: string; sourceName: string; results: SearchResult[] }[] = [];

    for (const source of enabledSources) {
      try {
        const searchResults = await searchWithBookSource(source.id, keyword);
        if (searchResults.length > 0) {
          results.push({
            sourceId: source.id,
            sourceName: source.name,
            results: searchResults,
          });
        }
      } catch (error) {
        console.warn(`书源 ${source.name} 搜索失败:`, error);
      }
    }

    return results;
  };

  const getChapterList = async (sourceId: string, bookUrl: string): Promise<Chapter[]> => {
    const source = bookSources.find(s => s.id === sourceId);
    if (!source) throw new Error('书源不存在');

    try {
      const response = await fetchWithProxy(bookUrl);
      const html = await response.text();
      
      const chapters = BookSourceParser.parseChapterList(html, source.ruleToc?.chapterList || source.ruleToc?.list || '');
      
      return chapters.map((chapter: any, index: number) => ({
        ...chapter,
        id: `${sourceId}-${index}`,
      }));
    } catch (error) {
      console.error('获取章节列表失败:', error);
      throw error;
    }
  };

  const getChapterContent = async (sourceId: string, chapterUrl: string): Promise<string> => {
    const source = bookSources.find(s => s.id === sourceId);
    if (!source) throw new Error('书源不存在');

    try {
      const response = await fetchWithProxy(chapterUrl);
      const html = await response.text();
      
      const result = BookSourceParser.parseChapterContent(html, source.ruleContent?.content || '');
      return result.content;
    } catch (error) {
      console.error('获取章节内容失败:', error);
      throw error;
    }
  };

  const importFullBook = async (sourceId: string, searchResult: SearchResult): Promise<Book> => {
    const source = bookSources.find(s => s.id === sourceId);
    if (!source) throw new Error('书源不存在');

    try {
      const bookResponse = await fetchWithProxy(searchResult.url);
      const bookHtml = await bookResponse.text();
      
      const bookInfo = BookSourceParser.parseBookInfo(bookHtml, source.ruleBookInfo || {});
      
      const chapters = await getChapterList(sourceId, searchResult.url);
      
      let fullContent = '';
      for (let i = 0; i < Math.min(chapters.length, 10); i++) {
        try {
          const content = await getChapterContent(sourceId, chapters[i].url);
          fullContent += `\n\n${chapters[i].title}\n\n${content}`;
        } catch (error) {
          console.warn(`获取章节 ${chapters[i].title} 失败:`, error);
        }
      }

      const book: Book = {
        id: crypto.randomUUID(),
        title: bookInfo.name || searchResult.title,
        author: bookInfo.author || searchResult.author,
        content: fullContent,
        currentPosition: 0,
        totalCharacters: fullContent.length,
        addedAt: new Date().toISOString(),
        fileName: '',
      };

      addBook(book);
      return book;
    } catch (error) {
      console.error('导入完整书籍失败:', error);
      throw error;
    }
  };

  const testUrl = async (url: string, source?: BookSource): Promise<string> => {
    try {
      const response = await fetchWithProxy(url);
      const text = await response.text();
      
      if (source) {
        const chapters = BookSourceParser.parseChapterList(text, source.ruleToc?.chapterList || source.ruleToc?.list || '');
        return JSON.stringify(chapters.slice(0, 3), null, 2);
      }
      
      return text.slice(0, 1000);
    } catch (error) {
      throw new Error(`测试失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  function parseYioveBookSource(item: any): Omit<BookSource, 'id' | 'addedAt'> | null {
    if (!item || typeof item !== 'object') return null;

    const bookSourceUrl = item.bookSourceUrl || item.url || '';
    if (!bookSourceUrl) return null;

    return {
      name: item.bookSourceName || item.name || '未命名书源',
      url: bookSourceUrl,
      type: (item.bookSourceType || item.type || 'api').toLowerCase(),
      enabled: item.enabled !== false,
      bookSourceGroup: item.bookSourceGroup || item.group || '',
      bookSourceComment: item.bookSourceComment || item.comment || '',
      searchUrl: item.searchUrl || '',
      ruleSearch: item.ruleSearch || {},
      ruleBookInfo: item.ruleBookInfo || {},
      ruleToc: item.ruleToc || {},
      ruleContent: item.ruleContent || {},
    };
  }

  // 使用 useMemo 缓存 context value，避免不必要的重新渲染
  const contextValue = useMemo(() => ({
    books,
    addBook,
    updateBook,
    deleteBook,
    getBookById,
    importBookFromFile,
    isLoading,
    bookSources,
    addBookSource,
    addBookSourcesBatch,
    updateBookSource,
    deleteBookSource,
    resetToDefaultSources,
    searchBooksFromSource,
    fetchBookFromSource,
    listBooksFromSource,
    testBookSource,
    importBookSourcesFromFile,
    importBookSourcesFromUrl,
    searchWithBookSource,
    searchWithAllSources,
    getChapterList,
    getChapterContent,
    importFullBook,
    testUrl,
  }), [
    books,
    isLoading,
    bookSources,
    addBook,
    updateBook,
    deleteBook,
    getBookById,
    importBookFromFile,
    addBookSource,
    addBookSourcesBatch,
    updateBookSource,
    deleteBookSource,
    resetToDefaultSources,
    searchBooksFromSource,
    fetchBookFromSource,
    listBooksFromSource,
    testBookSource,
    importBookSourcesFromFile,
    importBookSourcesFromUrl,
    searchWithBookSource,
    searchWithAllSources,
    getChapterList,
    getChapterContent,
    importFullBook,
    testUrl,
  ]);

  return (
    <BookContext.Provider value={contextValue}>
      {children}
    </BookContext.Provider>
  );
}

export function useBooks() {
  const context = useContext(BookContext);
  if (!context) {
    throw new Error('useBooks must be used within a BookProvider');
  }
  return context;
}