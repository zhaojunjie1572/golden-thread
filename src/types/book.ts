export interface Book {
  id: string;
  title: string;
  author: string;
  content: string;
  coverImage?: string;
  addedAt: string;
  lastReadAt?: string;
  currentPosition: number;
  totalCharacters: number;
  sourceId?: string;
  sourceUrl?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  intro?: string;
  url: string;
}

export interface Chapter {
  id: string;
  title: string;
  url: string;
}

export interface BookSource {
  id: string;
  name: string;
  url: string;
  type: 'api' | 'rss' | 'custom';
  enabled: boolean;
  addedAt: string;
  
  bookSourceUrl?: string;
  bookSourceName?: string;
  bookSourceGroup?: string;
  bookSourceComment?: string;
  bookSourceIcon?: string;
  
  searchUrl?: string;
  ruleSearch?: {
    list?: string;
    bookList?: string;
    name?: string;
    author?: string;
    coverUrl?: string;
    intro?: string;
    bookUrl?: string;
    kind?: string;
    lastChapter?: string;
  };
  
  ruleBookInfo?: {
    name?: string;
    author?: string;
    coverUrl?: string;
    intro?: string;
    tocUrl?: string;
    kind?: string;
    lastChapter?: string;
  };
  
  ruleToc?: {
    list?: string;
    chapterList?: string;
    name?: string;
    chapterName?: string;
    chapterUrl?: string;
  };
  
  ruleContent?: {
    content?: string;
    nextUrl?: string;
  };
  
  header?: Record<string, string>;
}

export interface ReadingProgress {
  bookId: string;
  currentParagraph: number;
  currentWord: number;
  totalWords: number;
}

export function createEmptyBook(): Book {
  return {
    id: crypto.randomUUID(),
    title: '',
    author: '',
    content: '',
    addedAt: new Date().toISOString(),
    currentPosition: 0,
    totalCharacters: 0,
  };
}

export function parseTextToBook(text: string, title: string = '未命名书籍', author: string = '未知作者'): Book {
  return {
    id: crypto.randomUUID(),
    title,
    author,
    content: text,
    addedAt: new Date().toISOString(),
    currentPosition: 0,
    totalCharacters: text.length,
  };
}
