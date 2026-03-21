import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Book, BookSource, parseTextToBook, SearchResult, Chapter } from '../types/book';
import { BookSourceParser } from '../utils/bookSourceParser';
import JSZip from 'jszip';

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
  searchBooksFromSource: (sourceId: string, query: string) => Promise<any[]>;
  fetchBookFromSource: (sourceId: string, bookId: string) => Promise<Book>;
  listBooksFromSource: (sourceId: string, page: number, limit: number) => Promise<{ books: any[]; hasMore: boolean }>;
  testBookSource: (sourceId: string) => Promise<{ success: boolean; message: string }>;
  importBookSourcesFromFile: (file: File) => Promise<number>;
  
  searchWithBookSource: (sourceId: string, keyword: string) => Promise<SearchResult[]>;
  getChapterList: (sourceId: string, bookUrl: string) => Promise<Chapter[]>;
  getChapterContent: (sourceId: string, chapterUrl: string) => Promise<string>;
  importFullBook: (sourceId: string, searchResult: SearchResult) => Promise<Book>;
  testUrl: (url: string, source?: BookSource) => Promise<string>;
}

const BookContext = createContext<BookContextType | undefined>(undefined);
const STORAGE_KEY = 'golden-thread-books';
const SOURCES_STORAGE_KEY = 'golden-thread-book-sources';

const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
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

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function extractDomain(url: string) {
  try {
    const urlObj = new URL(url);
    return urlObj.origin;
  } catch {
    return url;
  }
}

async function fetchWithProxy(url: string, options: RequestInit = {}, timeout = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  const domain = extractDomain(url);
  
  const finalOptions: RequestInit = {
    ...options,
    method: options.method || 'GET',
    signal: controller.signal,
    credentials: 'include',
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
      'DNT': '1',
      'Referer': domain,
      'Origin': domain,
      ...options.headers,
    },
  };

  try {
    try {
      const response = await fetch(url, finalOptions);
      clearTimeout(timeoutId);
      return response;
    } catch (directError) {
      console.log('直接请求失败，尝试使用 CORS 代理:', directError);
      
      for (const proxy of CORS_PROXIES) {
        try {
          const proxyUrl = proxy + encodeURIComponent(url);
          const response = await fetch(proxyUrl, finalOptions);
          clearTimeout(timeoutId);
          return response;
        } catch (proxyError) {
          console.log(`代理 ${proxy} 失败，尝试下一个:`, proxyError);
          continue;
        }
      }
      
      throw directError;
    }
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 30000) {
  return fetchWithProxy(url, options, timeout);
}

function resolveUrl(baseUrl: string, relativeUrl: string): string {
  try {
    return new URL(relativeUrl, baseUrl).toString();
  } catch {
    return relativeUrl;
  }
}

export function BookProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [bookSources, setBookSources] = useState<BookSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const loadBooks = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      console.log('📚 加载书籍数据:', saved);
      if (saved) {
        const parsedBooks = JSON.parse(saved);
        console.log('✅ 解析后的书籍:', parsedBooks);
        if (Array.isArray(parsedBooks)) {
          setBooks(parsedBooks);
        } else {
          console.warn('⚠️ 书籍数据不是数组，重置为空');
          setBooks([]);
        }
      } else {
        console.log('📭 没有找到保存的书籍');
        setBooks([]);
      }
    } catch (error) {
      console.error('❌ 加载书籍失败:', error);
      setBooks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveBooks = () => {
    try {
      console.log('💾 保存书籍数据:', books);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
      console.log('✅ 书籍保存成功');
    } catch (error) {
      console.error('❌ 保存书籍失败:', error);
    }
  };

  const loadBookSources = () => {
    try {
      const saved = localStorage.getItem(SOURCES_STORAGE_KEY);
      if (saved) {
        setBookSources(JSON.parse(saved));
      }
    } catch (error) {
      console.error('加载书源失败:', error);
    }
  };

  const saveBookSources = () => {
    try {
      localStorage.setItem(SOURCES_STORAGE_KEY, JSON.stringify(bookSources));
    } catch (error) {
      console.error('保存书源失败:', error);
    }
  };

  const addBook = (book: Book) => {
    setBooks(prev => {
      const exists = prev.find(b => b.id === book.id || (b.title === book.title && b.author === book.author));
      if (exists) {
        return prev.map(b => b.id === exists.id ? book : b);
      }
      return [...prev, book];
    });
  };

  const updateBook = (book: Book) => {
    setBooks(prev => prev.map(b => b.id === book.id ? book : b));
  };

  const deleteBook = (id: string) => {
    setBooks(prev => prev.filter(b => b.id !== id));
  };

  const getBookById = (id: string) => {
    return books.find(b => b.id === id);
  };

  async function parseEpub(file: File): Promise<{ text: string; title: string; author: string }> {
    try {
      const zip = await JSZip.loadAsync(file);
      
      let opfPath = '';
      const containerXml = await zip.file('META-INF/container.xml')?.async('string');
      if (containerXml) {
        const match = containerXml.match(/full-path="([^"]+)"/);
        if (match) {
          opfPath = match[1];
        }
      }
      
      if (!opfPath) {
        const opfFiles = Object.keys(zip.files).filter(name => name.endsWith('.opf'));
        if (opfFiles.length > 0) {
          opfPath = opfFiles[0];
        }
      }
      
      let title = '未命名书籍';
      let author = '未知作者';
      let spineItems: string[] = [];
      
      if (opfPath) {
        const opfContent = await zip.file(opfPath)?.async('string');
        if (opfContent) {
          const titleMatch = opfContent.match(/<dc:title>([^<]+)<\/dc:title>/i) || 
                           opfContent.match(/<title>([^<]+)<\/title>/i);
          if (titleMatch) {
            title = titleMatch[1];
          }
          
          const authorMatch = opfContent.match(/<dc:creator>([^<]+)<\/dc:creator>/i) || 
                            opfContent.match(/<creator>([^<]+)<\/creator>/i);
          if (authorMatch) {
            author = authorMatch[1];
          }
          
          const itemRefMatches = [...opfContent.matchAll(/<itemref[^>]*idref="([^"]+)"/gi)];
          const itemIds = itemRefMatches.map(m => m[1]);
          
          const manifestMatches = [...opfContent.matchAll(/<item[^>]*id="([^"]+)"[^>]*href="([^"]+)"/gi)];
          const itemMap: { [key: string]: string } = {};
          for (const match of manifestMatches) {
            itemMap[match[1]] = match[2];
          }
          
          const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
          for (const id of itemIds) {
            if (itemMap[id]) {
              spineItems.push(opfDir + itemMap[id]);
            }
          }
        }
      }
      
      if (spineItems.length === 0) {
        const htmlFiles = Object.keys(zip.files).filter(name => 
          name.endsWith('.html') || name.endsWith('.xhtml') || name.endsWith('.htm')
        );
        spineItems = htmlFiles.sort();
      }
      
      let text = '';
      for (const itemPath of spineItems) {
        const file = zip.file(itemPath);
        if (file) {
          const htmlContent = await file.async('string');
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlContent, 'text/html');
          
          const bodyText = doc.body?.textContent || '';
          if (bodyText.trim()) {
            text += bodyText + '\n\n';
          }
        }
      }
      
      if (!text.trim()) {
        const txtFiles = Object.keys(zip.files).filter(name => name.endsWith('.txt'));
        if (txtFiles.length > 0) {
          text = await zip.file(txtFiles[0])?.async('string') || '';
        }
      }
      
      return { text, title, author };
    } catch (error) {
      console.error('EPUB 解析失败:', error);
      throw new Error('EPUB 文件解析失败');
    }
  }

  const importBookFromFile = async (file: File): Promise<Book> => {
    console.log('📖 开始导入文件:', file.name, file.type, file.size);
    try {
      let text = '';
      let title = '未命名书籍';
      let author = '未知作者';

      if (file.name.endsWith('.epub')) {
        console.log('📚 解析 EPUB 文件');
        const epubData = await parseEpub(file);
        text = epubData.text;
        title = epubData.title;
        author = epubData.author;
      } else if (file.name.endsWith('.zip')) {
        console.log('📦 解析 ZIP 文件');
        const zip = await JSZip.loadAsync(file);
        const txtFiles = Object.keys(zip.files).filter(name => name.endsWith('.txt'));
        if (txtFiles.length > 0) {
          text = await zip.file(txtFiles[0])?.async('string') || '';
        } else {
          throw new Error('压缩包中没有找到文本文件');
        }
        title = file.name.replace(/\.zip$/, '');
      } else {
        console.log('📄 解析文本文件');
        text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error('读取文件失败'));
          reader.readAsText(file);
        });

        title = file.name.replace(/\.(txt|md)$/, '');
      }

      console.log('✅ 文件解析完成，长度:', text.length, '标题:', title, '作者:', author);
      const book = parseTextToBook(text, title, author);
      console.log('📖 创建书籍对象:', book);
      return book;
    } catch (error) {
      console.error('❌ 导入书籍失败:', error);
      throw error;
    }
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
    const newSources: BookSource[] = sources.map(source => ({
      ...source,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
    }));
    setBookSources(prev => [...prev, ...newSources]);
  };

  function parseYioveBookSource(jsonData: any): Omit<BookSource, 'id' | 'addedAt'> | null {
    try {
      let name = jsonData.sourceName || jsonData.bookSourceName || jsonData.name || '';
      let url = jsonData.sourceUrl || jsonData.bookSourceUrl || jsonData.url || '';
      
      if (!name || !url) {
        return null;
      }

      name = name.replace(/^`|`$/g, '');
      url = url.replace(/^`|`$/g, '');

      const enabled = jsonData.enabled !== undefined ? jsonData.enabled : 
                     jsonData.启用 !== undefined ? jsonData.启用 : 
                     jsonData.enable !== undefined ? jsonData.enable : true;

      return {
        name,
        url,
        type: 'api',
        enabled: !!enabled,
        searchUrl: jsonData.searchUrl,
        ruleSearch: jsonData.ruleSearch,
        ruleBookInfo: jsonData.ruleBookInfo,
        ruleToc: jsonData.ruleToc,
        ruleContent: jsonData.ruleContent,
        header: jsonData.header,
        bookSourceGroup: jsonData.bookSourceGroup,
        bookSourceComment: jsonData.bookSourceComment,
        bookSourceIcon: jsonData.bookSourceIcon,
      };
    } catch (error) {
      console.error('解析 Yiove 书源失败:', error);
      return null;
    }
  }

  async function importBookSourcesFromFile(file: File): Promise<number> {
    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('读取文件失败'));
        reader.readAsText(file);
      });

      let jsonData;
      try {
        let cleanedText = text;
        cleanedText = cleanedText.replace(/“/g, '"');
        cleanedText = cleanedText.replace(/”/g, '"');
        cleanedText = cleanedText.replace(/‘/g, "'");
        cleanedText = cleanedText.replace(/’/g, "'");
        cleanedText = cleanedText.replace(/，/g, ',');
        cleanedText = cleanedText.replace(/：/g, ':');
        cleanedText = cleanedText.replace(/；/g, ';');
        cleanedText = cleanedText.replace(/（/g, '(');
        cleanedText = cleanedText.replace(/）/g, ')');
        cleanedText = cleanedText.replace(/【/g, '[');
        cleanedText = cleanedText.replace(/】/g, ']');
        
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
      console.error('导入书源失败:', error);
      throw error;
    }
  }

  const updateBookSource = (source: BookSource) => {
    setBookSources(prev => prev.map(s => s.id === source.id ? source : s));
  };

  const deleteBookSource = (id: string) => {
    setBookSources(prev => prev.filter(s => s.id !== id));
  };

  async function searchBooksFromSource(sourceId: string, query: string): Promise<any[]> {
    const source = bookSources.find(s => s.id === sourceId);
    if (!source || !source.enabled) {
      return [];
    }
    try {
      const response = await fetchWithTimeout(`${source.url}/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error(`搜索失败: HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        return data;
      }
      if (data.books && Array.isArray(data.books)) {
        return data.books;
      }
      if (data.list && Array.isArray(data.list)) {
        return data.list;
      }
      if (data.data && Array.isArray(data.data)) {
        return data.data;
      }
      
      return [];
    } catch (error) {
      console.error('搜索书籍失败:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('请求超时，请检查网络连接');
      }
      throw error;
    }
  }

  async function fetchBookFromSource(sourceId: string, bookId: string): Promise<Book> {
    const source = bookSources.find(s => s.id === sourceId);
    if (!source || !source.enabled) {
      throw new Error('书源不可用');
    }
    try {
      const response = await fetchWithTimeout(`${source.url}/book/${bookId}`);
      if (!response.ok) {
        throw new Error(`获取书籍失败: HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      const title = data.title || data.name || '未命名书籍';
      const author = data.author || data.writer || '未知作者';
      const content = data.content || data.text || data.body || '';
      
      if (!content || !content.trim()) {
        throw new Error('书籍内容为空');
      }
      
      const book = parseTextToBook(content, title, author);
      return { ...book, sourceId, sourceUrl: source.url };
    } catch (error) {
      console.error('获取书籍失败:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('请求超时，请检查网络连接或书籍大小');
      }
      throw error;
    }
  }

  async function listBooksFromSource(sourceId: string, page: number = 1, limit: number = 20): Promise<{ books: any[]; hasMore: boolean }> {
    const source = bookSources.find(s => s.id === sourceId);
    if (!source || !source.enabled) {
      return { books: [], hasMore: false };
    }
    try {
      const response = await fetchWithTimeout(`${source.url}/list?page=${page}&limit=${limit}`, {
        headers: source.header,
      });
      if (!response.ok) {
        throw new Error(`获取书籍列表失败: HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      let books: any[] = [];
      let hasMore = false;
      
      if (Array.isArray(data)) {
        books = data;
        hasMore = data.length === limit;
      } else if (data.books && Array.isArray(data.books)) {
        books = data.books;
        hasMore = data.hasMore ?? data.books.length === limit;
      } else if (data.list && Array.isArray(data.list)) {
        books = data.list;
        hasMore = data.hasMore ?? data.list.length === limit;
      } else if (data.data && Array.isArray(data.data)) {
        books = data.data;
        hasMore = data.hasMore ?? data.data.length === limit;
      }
      
      return { books, hasMore };
    } catch (error) {
      console.error('获取书籍列表失败:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('请求超时，请检查网络连接');
      }
      throw error;
    }
  }

  async function testBookSource(sourceId: string): Promise<{ success: boolean; message: string }> {
    const source = bookSources.find(s => s.id === sourceId);
    if (!source) {
      return { success: false, message: '书源不存在' };
    }
    try {
      if (source.searchUrl && source.ruleSearch) {
        const results = await searchWithBookSource(sourceId, '测试');
        if (results.length > 0) {
          return { 
            success: true, 
            message: `测试成功！找到 ${results.length} 个结果` 
          };
        }
        return { 
          success: true, 
          message: '连接成功，但未找到测试结果' 
        };
      }
      
      const result = await listBooksFromSource(sourceId, 1, 5);
      if (result.books.length > 0) {
        return { 
          success: true, 
          message: `测试成功！获取到 ${result.books.length} 本图书` 
        };
      }
      return { 
        success: true, 
        message: '连接成功，但暂无图书数据' 
      };
    } catch (error) {
      console.error('书源测试失败:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : '连接失败，请检查书源配置' 
      };
    }
  }

  async function searchWithBookSource(sourceId: string, keyword: string): Promise<SearchResult[]> {
    const source = bookSources.find(s => s.id === sourceId);
    if (!source || !source.enabled) {
      throw new Error('书源不可用');
    }

    try {
      if (!source.searchUrl || !source.ruleSearch) {
        return await searchBooksFromSource(sourceId, keyword) as SearchResult[];
      }

      const searchUrl = source.searchUrl.replace('{{key}}', encodeURIComponent(keyword))
                                        .replace('{key}', encodeURIComponent(keyword));
      
      const url = resolveUrl(source.url, searchUrl);
      const response = await fetchWithTimeout(url, {
        headers: source.header,
      });
      
      if (!response.ok) {
        throw new Error(`搜索失败: HTTP ${response.status}`);
      }

      const html = await response.text();
      const listRule = source.ruleSearch.list || '';
      const items = BookSourceParser.parseList(html, listRule);

      const results: SearchResult[] = [];
      
      for (let i = 0; i < items.length; i++) {
        const itemHtml = items[i];
        
        const name = BookSourceParser.parseRule(itemHtml, source.ruleSearch.name || '');
        const author = BookSourceParser.parseRule(itemHtml, source.ruleSearch.author || '');
        const coverUrl = BookSourceParser.parseRule(itemHtml, source.ruleSearch.coverUrl || '');
        const intro = BookSourceParser.parseRule(itemHtml, source.ruleSearch.intro || '');
        let bookUrl = BookSourceParser.parseRule(itemHtml, source.ruleSearch.bookUrl || '');
        
        if (bookUrl) {
          bookUrl = resolveUrl(source.url, bookUrl);
        }

        if (name && bookUrl) {
          results.push({
            id: btoa(bookUrl),
            title: name.trim(),
            author: author.trim() || '未知作者',
            coverUrl: coverUrl ? resolveUrl(source.url, coverUrl) : undefined,
            intro: intro.trim(),
            url: bookUrl,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('搜索失败:', error);
      throw error;
    }
  }

  async function getChapterList(sourceId: string, bookUrl: string): Promise<Chapter[]> {
    const source = bookSources.find(s => s.id === sourceId);
    if (!source || !source.enabled) {
      throw new Error('书源不可用');
    }

    try {
      const response = await fetchWithTimeout(bookUrl, {
        headers: source.header,
      });
      
      if (!response.ok) {
        throw new Error(`获取目录失败: HTTP ${response.status}`);
      }

      const html = await response.text();
      
      if (!source.ruleToc) {
        return [];
      }

      let tocUrl = bookUrl;
      if (source.ruleBookInfo?.tocUrl) {
        const parsedTocUrl = BookSourceParser.parseRule(html, source.ruleBookInfo.tocUrl);
        if (parsedTocUrl) {
          tocUrl = resolveUrl(source.url, parsedTocUrl);
          
          if (tocUrl !== bookUrl) {
            const tocResponse = await fetchWithTimeout(tocUrl, {
              headers: source.header,
            });
            if (tocResponse.ok) {
              const tocHtml = await tocResponse.text();
              return parseChapterList(tocHtml, source, tocUrl);
            }
          }
        }
      }

      return parseChapterList(html, source, tocUrl);
    } catch (error) {
      console.error('获取章节列表失败:', error);
      throw error;
    }
  }

  function parseChapterList(html: string, source: BookSource, baseUrl: string): Chapter[] {
    if (!source.ruleToc) return [];

    const listRule = source.ruleToc.list || '';
    const items = BookSourceParser.parseList(html, listRule);

    const chapters: Chapter[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const itemHtml = items[i];
      
      const name = BookSourceParser.parseRule(itemHtml, source.ruleToc.name || '');
      let chapterUrl = BookSourceParser.parseRule(itemHtml, source.ruleToc.chapterUrl || '');
      
      if (chapterUrl) {
        chapterUrl = resolveUrl(baseUrl, chapterUrl);
      }

      if (name && chapterUrl) {
        chapters.push({
          id: btoa(chapterUrl),
          title: name.trim(),
          url: chapterUrl,
        });
      }
    }

    return chapters;
  }

  async function getChapterContent(sourceId: string, chapterUrl: string): Promise<string> {
    const source = bookSources.find(s => s.id === sourceId);
    if (!source || !source.enabled) {
      throw new Error('书源不可用');
    }

    try {
      const response = await fetchWithTimeout(chapterUrl, {
        headers: source.header,
      });
      
      if (!response.ok) {
        throw new Error(`获取内容失败: HTTP ${response.status}`);
      }

      const html = await response.text();
      
      if (!source.ruleContent?.content) {
        return html;
      }

      let content = BookSourceParser.parseRule(html, source.ruleContent.content);
      
      content = content.replace(/\s*[\r\n]+\s*/g, '\n\n');
      
      return content.trim();
    } catch (error) {
      console.error('获取章节内容失败:', error);
      throw error;
    }
  }

  async function importFullBook(sourceId: string, searchResult: SearchResult): Promise<Book> {
    const chapters = await getChapterList(sourceId, searchResult.url);
    
    let fullContent = `《${searchResult.title}》\n\n`;
    fullContent += `作者：${searchResult.author}\n\n`;
    
    if (searchResult.intro) {
      fullContent += `${searchResult.intro}\n\n`;
    }
    
    fullContent += '='.repeat(50) + '\n\n';

    for (const chapter of chapters) {
      try {
        const content = await getChapterContent(sourceId, chapter.url);
        fullContent += `${chapter.title}\n\n`;
        fullContent += `${content}\n\n`;
      } catch (error) {
        console.error(`获取章节失败: ${chapter.title}`, error);
        fullContent += `${chapter.title}\n\n`;
        fullContent += `[本章获取失败]\n\n`;
      }
    }

    const book = parseTextToBook(fullContent, searchResult.title, searchResult.author);
    
    if (searchResult.coverUrl) {
      book.coverImage = searchResult.coverUrl;
    }
    
    book.sourceId = sourceId;
    book.sourceUrl = searchResult.url;
    
    addBook(book);
    return book;
  }

  async function testUrl(url: string, source?: BookSource): Promise<string> {
    try {
      const response = await fetchWithTimeout(url, {
        headers: source?.header,
      });
      
      if (!response.ok) {
        throw new Error(`请求失败: HTTP ${response.status}`);
      }
      
      return await response.text();
    } catch (error) {
      console.error('测试 URL 失败:', error);
      throw error;
    }
  }

  return (
    <BookContext.Provider
      value={{
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
        searchBooksFromSource,
        fetchBookFromSource,
        listBooksFromSource,
        testBookSource,
        importBookSourcesFromFile,
        searchWithBookSource,
        getChapterList,
        getChapterContent,
        importFullBook,
        testUrl,
      }}
    >
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
