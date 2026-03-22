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
    name: '使用说明',
    url: 'https://github.com/yiove/booksource',
    type: 'api' as const,
    enabled: false,
    bookSourceGroup: '说明',
    bookSourceComment: '请点击"书源仓库"获取真实可用的书源',
  },
  {
    name: '🔞漫蛙可直连',
    url: 'https://manwaai.cc/',
    type: 'api' as const,
    enabled: false,
    bookSourceGroup: '漫画',
    bookSourceComment: '漫蛙漫画-暂时禁用，先测试其他书源',
    searchUrl: 'https://manwaai.cc/search?keyword={{key}}',
    ruleSearch: {
      bookList: '.book-list li||$.books',
      name: '.book-list-info-title@text||$.book_name',
      author: '.book-list-info-bottom-item@text||$.author_name@js:result.replace("作者：","")',
      coverUrl: '.book-list-cover-img@data-original||$.cover_url',
      bookUrl: 'tag.a.0@href||$.id@js:"https://manwaai.cc/book/"+result.match(/\\d+/)',
      kind: '.book-list-info-bottom-right-font@text||$.tags',
      lastChapter: '$.last_chapter.chapter_name||$.last_chapter',
    },
    ruleBookInfo: {
      name: '.detail-main-info-title@text',
      author: '.detail-main-info-value@text',
      coverUrl: '.detail-main-cover img@data-original',
      intro: '.detail-desc@text',
      kind: '.detail-main-info-class a@text',
      lastChapter: 'id.detail-list-select@tag.a.-1@text',
    },
    ruleToc: {
      chapterList: 'id.detail-list-select@tag.a',
      chapterName: 'text',
      chapterUrl: 'href',
    },
    ruleContent: {
      content: '.content-img@data-r-src',
      imageStyle: 'FULL',
    },
  },
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
  
  const directOptions: RequestInit = {
    ...options,
    method: options.method || 'GET',
    signal: controller.signal,
    credentials: 'omit',
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
      'Referer': domain,
      ...options.headers,
    },
  };

  const proxyOptions: RequestInit = {
    ...options,
    method: options.method || 'GET',
    signal: controller.signal,
    credentials: 'omit',
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Accept': '*/*',
      'Cache-Control': 'no-cache',
      ...options.headers,
    },
  };

  try {
    try {
      console.log('🌐 直接请求:', url);
      const response = await fetch(url, directOptions);
      clearTimeout(timeoutId);
      console.log('✅ 直接请求成功');
      return response;
    } catch (directError) {
      console.log('❌ 直接请求失败，尝试使用 CORS 代理:', directError);
      
      for (const proxy of CORS_PROXIES) {
        try {
          const proxyUrl = proxy + encodeURIComponent(url);
          console.log('🔄 使用代理:', proxy);
          const response = await fetch(proxyUrl, proxyOptions);
          clearTimeout(timeoutId);
          console.log('✅ 代理请求成功');
          return response;
        } catch (proxyError) {
          console.log(`❌ 代理 ${proxy} 失败，尝试下一个:`, proxyError);
          continue;
        }
      }
      
      throw directError;
    }
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('💥 所有请求方式都失败:', error);
    throw error;
  }
}

const DEMO_DATA = {
  books: [
    {
      id: 'book1',
      title: '小王子',
      author: '安托万·德·圣-埃克苏佩里',
      coverUrl: 'https://picsum.photos/seed/book1/200/300',
      intro: '这是一本写给大人的童话。故事讲述了一位来自B-612星球的小王子在宇宙中的旅行和他与狐狸、玫瑰、飞行员等人的相遇。',
    },
    {
      id: 'book2',
      title: '活着',
      author: '余华',
      coverUrl: 'https://picsum.photos/seed/book2/200/300',
      intro: '《活着》讲述了农村人福贵悲惨的人生遭遇。福贵嗜赌成性，终于赌光了家业，一贫如洗。',
    },
    {
      id: 'book3',
      title: '三体',
      author: '刘慈欣',
      coverUrl: 'https://picsum.photos/seed/book3/200/300',
      intro: '文化大革命如火如荼进行的同时，军方探寻外星文明的绝秘计划"红岸工程"取得了突破性进展。',
    },
  ],
  getBook: (id: string) => ({
    id,
    title: id === 'book1' ? '小王子' : id === 'book2' ? '活着' : '三体',
    author: id === 'book1' ? '安托万·德·圣-埃克苏佩里' : id === 'book2' ? '余华' : '刘慈欣',
    coverUrl: `https://picsum.photos/seed/${id}/200/300`,
    intro: '这是一本很棒的书。',
    chapters: [
      { id: `${id}-ch1`, title: '第一章 开始' },
      { id: `${id}-ch2`, title: '第二章 发展' },
      { id: `${id}-ch3`, title: '第三章 高潮' },
      { id: `${id}-ch4`, title: '第四章 结局' },
    ],
  }),
  getChapter: (id: string) => ({
    id,
    title: id.includes('ch1') ? '第一章 开始' : id.includes('ch2') ? '第二章 发展' : id.includes('ch3') ? '第三章 高潮' : '第四章 结局',
    content: `这是${id}的内容。

在很久很久以前，有一个美丽的故事。故事的主人公经历了许多冒险和挑战。

第一章讲述了故事的开始。一切都从这里开始，主人公踏上了未知的旅程。

这一章的内容非常精彩，引人入胜。读者可以从中感受到故事的魅力。

继续阅读，你会发现更多有趣的内容。`,
  }),
};

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 30000) {
  if (url.startsWith('local://demo')) {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (url.includes('/search?')) {
      const keyword = new URLSearchParams(url.split('?')[1]).get('keyword') || '';
      const filteredBooks = DEMO_DATA.books.filter(book => 
        book.title.includes(keyword) || book.author.includes(keyword)
      );
      const books = filteredBooks.length > 0 ? filteredBooks : DEMO_DATA.books;
      
      const jsonData = { books: books };
      return new Response(`<!DOCTYPE html><html><body><script type="application/json">${JSON.stringify(jsonData)}</script></body></html>`);
    }
    
    if (url.includes('/book/')) {
      const bookId = url.split('/book/')[1];
      const bookData = DEMO_DATA.getBook(bookId);
      return new Response(`<!DOCTYPE html><html><body><script type="application/json">${JSON.stringify(bookData)}</script></body></html>`);
    }
    
    if (url.includes('/chapter/')) {
      const chapterId = url.split('/chapter/')[1];
      const chapterData = DEMO_DATA.getChapter(chapterId);
      return new Response(`<!DOCTYPE html><html><body><script type="application/json">${JSON.stringify(chapterData)}</script></body></html>`);
    }
    
    const jsonData = { books: DEMO_DATA.books };
    return new Response(`<!DOCTYPE html><html><body><script type="application/json">${JSON.stringify(jsonData)}</script></body></html>`);
  }
  
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
      } else {
        setBookSources(DEFAULT_BOOK_SOURCES.map(source => ({
          ...source,
          id: crypto.randomUUID(),
          addedAt: new Date().toISOString(),
        })));
      }
    } catch (error) {
      console.error('加载书源失败:', error);
      setBookSources(DEFAULT_BOOK_SOURCES.map(source => ({
        ...source,
        id: crypto.randomUUID(),
        addedAt: new Date().toISOString(),
      })));
    }
  };

  const resetToDefaultSources = () => {
    if (confirm('确定要恢复默认书源吗？这会删除所有自定义书源。')) {
      setBookSources(DEFAULT_BOOK_SOURCES.map(source => ({
        ...source,
        id: crypto.randomUUID(),
        addedAt: new Date().toISOString(),
      })));
      alert('默认书源已恢复！');
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
    
    if (source.url === 'local://demo') {
      await new Promise(resolve => setTimeout(resolve, 300));
      return { 
        success: true, 
        message: `测试成功！找到 ${DEMO_DATA.books.length} 本演示图书` 
      };
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
      const listRule = source.ruleSearch.bookList || source.ruleSearch.list || '';
      const items = BookSourceParser.parseList(html, listRule);

      const results: SearchResult[] = [];
      
      for (let i = 0; i < items.length; i++) {
        const itemData = items[i];
        
        let parseText = itemData;
        try {
          JSON.parse(itemData);
        } catch {}
        
        const name = BookSourceParser.parseRule(parseText, source.ruleSearch.name || '');
        const author = BookSourceParser.parseRule(parseText, source.ruleSearch.author || '');
        const coverUrl = BookSourceParser.parseRule(parseText, source.ruleSearch.coverUrl || '');
        const intro = BookSourceParser.parseRule(parseText, source.ruleSearch.intro || '');
        let bookUrl = BookSourceParser.parseRule(parseText, source.ruleSearch.bookUrl || '');
        
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

    const listRule = source.ruleToc.chapterList || source.ruleToc.list || '';
    const items = BookSourceParser.parseList(html, listRule);

    const chapters: Chapter[] = [];
    
    for (let i = 0; i < items.length; i++) {
      const itemHtml = items[i];
      
      const name = BookSourceParser.parseRule(itemHtml, source.ruleToc.chapterName || source.ruleToc.name || '');
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

  async function searchWithAllSources(keyword: string): Promise<{ sourceId: string; sourceName: string; results: SearchResult[] }[]> {
    const enabledSources = bookSources.filter(s => s.enabled);
    const results: { sourceId: string; sourceName: string; results: SearchResult[] }[] = [];
    
    const searchPromises = enabledSources.map(async (source) => {
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
        console.error(`书源 ${source.name} 搜索失败:`, error);
      }
    });
    
    await Promise.all(searchPromises);
    return results;
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
        resetToDefaultSources,
        searchBooksFromSource,
        fetchBookFromSource,
        listBooksFromSource,
        testBookSource,
        importBookSourcesFromFile,
        searchWithBookSource,
        searchWithAllSources,
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
