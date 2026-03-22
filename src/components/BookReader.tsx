import { useState, useEffect, useRef, useCallback } from 'react';
import { Book } from '../types/book';
import { useSpeech } from '../context/SpeechContext';

interface BookReaderProps {
  book: Book;
  onUpdateProgress: (position: number) => void;
  onClose: () => void;
}

interface Chapter {
  title: string;
  startIndex: number;
  endIndex: number;
}

export default function BookReader({ book, onUpdateProgress, onClose }: BookReaderProps) {
  const { 
    speechState, 
    startSpeaking, 
    pauseSpeaking, 
    resumeSpeaking, 
    nextParagraph: speechNextParagraph,
    prevParagraph: speechPrevParagraph,
    setSpeechRate,
    setSelectedVoice: setSelectedVoiceInSpeech 
  } = useSpeech();
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechRate, setSpeechRateLocal] = useState(1.5);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState(() => {
    return localStorage.getItem('reader-bg-color') || '#f9fafb';
  });
  const [textColor, setTextColor] = useState(() => {
    return localStorage.getItem('reader-text-color') || '#1f2937';
  });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoiceLocal] = useState<string>(() => {
    return localStorage.getItem('selected-voice') || '';
  });
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [_isDraggingProgress, setIsDraggingProgress] = useState(false);
  
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsSpeaking(speechState.isPlaying);
    setIsPaused(speechState.isPaused);
    setSpeechRateLocal(speechState.speechRate);
    
    if (speechState.bookTitle === book.title && speechState.isPlaying) {
      setCurrentParagraphIndex(speechState.currentParagraphIndex);
    }
  }, [speechState, book.title]);

  useEffect(() => {
    localStorage.setItem('reader-bg-color', backgroundColor);
  }, [backgroundColor]);

  useEffect(() => {
    localStorage.setItem('reader-text-color', textColor);
  }, [textColor]);

  useEffect(() => {
    localStorage.setItem('selected-voice', selectedVoice);
  }, [selectedVoice]);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    loadVoices();
    
    const timer1 = setTimeout(() => loadVoices(), 500);
    const timer2 = setTimeout(() => loadVoices(), 2000);

    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  useEffect(() => {
    console.log('=== BookReader 收到书籍数据 ===');
    console.log('书名:', book.title);
    console.log('内容长度:', book.content.length);
    console.log('总字符数:', book.totalCharacters);
    console.log('当前位置:', book.currentPosition);
    console.log('内容前200字符:', book.content.substring(0, 200));
    
    const parsedParagraphs = book.content.split(/\n\n+/).filter(p => p.trim());
    console.log('段落数:', parsedParagraphs.length);
    
    setParagraphs(parsedParagraphs);
    extractChapters(parsedParagraphs);
    
    if (parsedParagraphs.length > 0 && book.totalCharacters > 0) {
      const savedProgress = Math.floor(book.currentPosition / (book.totalCharacters / parsedParagraphs.length));
      if (savedProgress > 0 && savedProgress < parsedParagraphs.length) {
        setCurrentParagraphIndex(savedProgress);
      }
    }
  }, [book]);

  const extractChapters = (parsedParagraphs: string[]) => {
    const extractedChapters: Chapter[] = [];
    let currentStart = 0;
    
    parsedParagraphs.forEach((paragraph, index) => {
      if (paragraph.length < 50 && (
        paragraph.includes('第') && (paragraph.includes('章') || paragraph.includes('节') || paragraph.includes('卷')) ||
        /^第\s*\d+\s*[章节卷篇]/.test(paragraph) ||
        /^[一二三四五六七八九十百千万]+[章节卷篇]/.test(paragraph)
      )) {
        if (currentStart < index) {
          extractedChapters.push({
            title: parsedParagraphs[currentStart] || '未命名章节',
            startIndex: currentStart,
            endIndex: index - 1
          });
        }
        currentStart = index;
      }
    });
    
    if (currentStart < parsedParagraphs.length) {
      extractedChapters.push({
        title: parsedParagraphs[currentStart] || '未命名章节',
        startIndex: currentStart,
        endIndex: parsedParagraphs.length - 1
      });
    }
    
    if (extractedChapters.length === 0) {
      extractedChapters.push({
        title: '正文',
        startIndex: 0,
        endIndex: parsedParagraphs.length - 1
      });
    }
    
    setChapters(extractedChapters);
  };

  const goToChapter = useCallback((chapter: Chapter) => {
    setCurrentParagraphIndex(chapter.startIndex);
    const progress = Math.floor((chapter.startIndex / paragraphs.length) * book.totalCharacters);
    onUpdateProgress(progress);
    setShowChapters(false);
  }, [paragraphs, book.totalCharacters, onUpdateProgress]);

  const toggleSpeaking = useCallback(() => {
    if (isSpeaking) {
      if (isPaused) {
        resumeSpeaking();
      } else {
        pauseSpeaking();
      }
    } else {
      const handleProgress = (index: number) => {
        setCurrentParagraphIndex(index);
        const progress = Math.floor((index / paragraphs.length) * book.totalCharacters);
        onUpdateProgress(progress);
      };
      
      startSpeaking(book.title, book.author, paragraphs, currentParagraphIndex, handleProgress);
    }
  }, [isSpeaking, isPaused, startSpeaking, resumeSpeaking, pauseSpeaking, book.title, book.author, paragraphs, currentParagraphIndex, onUpdateProgress]);

  const nextParagraph = useCallback(() => {
    if (currentParagraphIndex < paragraphs.length - 1) {
      const newIndex = currentParagraphIndex + 1;
      setCurrentParagraphIndex(newIndex);
      const progress = Math.floor((newIndex / paragraphs.length) * book.totalCharacters);
      onUpdateProgress(progress);
      
      if (isSpeaking) {
        speechNextParagraph();
      }
    }
  }, [currentParagraphIndex, isSpeaking, speechNextParagraph, book.totalCharacters, onUpdateProgress, paragraphs]);

  const prevParagraph = useCallback(() => {
    if (currentParagraphIndex > 0) {
      const newIndex = currentParagraphIndex - 1;
      setCurrentParagraphIndex(newIndex);
      const progress = Math.floor((newIndex / paragraphs.length) * book.totalCharacters);
      onUpdateProgress(progress);
      
      if (isSpeaking) {
        speechPrevParagraph();
      }
    }
  }, [currentParagraphIndex, isSpeaking, speechPrevParagraph, book.totalCharacters, onUpdateProgress, paragraphs]);

  const handleProgressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = Math.floor((parseFloat(e.target.value) / 100) * paragraphs.length);
    setCurrentParagraphIndex(Math.min(Math.max(0, newIndex), paragraphs.length - 1));
  }, [paragraphs]);

  const handleProgressMouseUp = useCallback((e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
    const target = 'target' in e ? e.target as HTMLInputElement : (e as any).target as HTMLInputElement;
    const newIndex = Math.floor((parseFloat(target.value) / 100) * paragraphs.length);
    const clampedIndex = Math.min(Math.max(0, newIndex), paragraphs.length - 1);
    setCurrentParagraphIndex(clampedIndex);
    const progress = Math.floor((clampedIndex / paragraphs.length) * book.totalCharacters);
    onUpdateProgress(progress);
  }, [paragraphs, book.totalCharacters, onUpdateProgress]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log('无法进入全屏:', err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const currentParagraphs = paragraphs.slice(currentParagraphIndex, currentParagraphIndex + 3);
  const progress = paragraphs.length > 0 
    ? ((currentParagraphIndex + 1) / paragraphs.length) * 100 
    : 0;

  const bgPresets = [
    { color: '#f9fafb', name: '护眼白' },
    { color: '#fef3c7', name: '护眼黄' },
    { color: '#fce7f3', name: '护眼粉' },
    { color: '#dbeafe', name: '护眼蓝' },
    { color: '#1f2937', name: '夜间黑', textColor: '#f9fafb' },
  ];

  useEffect(() => {
    if ('mediaSession' in navigator && 'MediaMetadata' in window) {
      try {
        const metadata = new MediaMetadata({
          title: book.title,
          artist: book.author,
          album: '读书',
        });
        navigator.mediaSession.metadata = metadata;
      } catch (error) {
        console.error('Media Session API error:', error);
      }
    }
  }, [book.title, book.author]);

  return (
    <div className="fixed inset-0 z-50" style={{ backgroundColor }}>
      <header className="sticky top-0 z-50 bg-opacity-95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700" style={{ backgroundColor }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            style={{ color: textColor }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-lg font-semibold truncate" style={{ color: textColor }}>{book.title}</h1>
            <p className="text-sm opacity-60" style={{ color: textColor }}>{book.author}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowChapters(!showChapters)}
              className={`p-2 rounded-lg transition-colors ${showChapters ? 'bg-amber-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              style={{ color: showChapters ? undefined : textColor }}
              title="目录"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-amber-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              style={{ color: showSettings ? undefined : textColor }}
              title="设置"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              style={{ color: textColor }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isFullscreen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pb-56 pt-8 overflow-y-auto" style={{ height: 'calc(100vh - 200px)', color: textColor }} ref={contentRef}>
        {paragraphs.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📄</div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: textColor }}>无法读取书籍内容</h2>
            <p className="opacity-60 mb-6" style={{ color: textColor }}>这本书的内容可能没有正确解析</p>
            <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-4 max-w-md mx-auto text-left">
              <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">建议</h3>
              <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                <li>• 删除这本书后重新导入</li>
                <li>• 尝试使用 TXT 或 MD 格式的文件</li>
                <li>• 确保 EPUB 文件没有损坏</li>
              </ul>
            </div>
          </div>
        ) : (
          <article className="prose prose-lg dark:prose-invert max-w-none">
            {currentParagraphs.map((paragraph, index) => {
              const globalIndex = currentParagraphIndex + index;
              const isHighlighted = isSpeaking && globalIndex === speechState.currentParagraphIndex;
              return (
                <p 
                  key={index}
                  onClick={() => {
                    setCurrentParagraphIndex(globalIndex);
                    const progress = Math.floor((globalIndex / paragraphs.length) * book.totalCharacters);
                    onUpdateProgress(progress);
                  }}
                  className={`text-lg leading-relaxed mb-6 transition-all duration-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg px-2 py-1 ${
                    index === 0 ? 'text-xl font-medium' : ''
                  } ${
                    isHighlighted 
                      ? 'bg-amber-100 dark:bg-amber-900/50 px-4 py-2 border-l-4 border-amber-500' 
                      : ''
                  }`}
                >
                  {isHighlighted && (
                    <span className="inline-block mr-2 text-amber-500">
                      <svg className="w-5 h-5 inline align-text-bottom" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  )}
                  {paragraph}
                </p>
              );
            })}
          </article>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-700 shadow-lg z-50" style={{ backgroundColor }}>
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="mb-4">
            <div className="flex justify-between text-sm opacity-60 mb-2" style={{ color: textColor }}>
              <span>阅读进度</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={handleProgressChange}
              onMouseDown={() => setIsDraggingProgress(true)}
              onMouseUp={handleProgressMouseUp}
              onTouchStart={() => setIsDraggingProgress(true)}
              onTouchEnd={handleProgressMouseUp}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          <div className="flex items-center justify-center gap-6">
            <button
              onClick={prevParagraph}
              disabled={currentParagraphIndex === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
              style={{ color: textColor }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>上一页</span>
            </button>

            <button
              onClick={toggleSpeaking}
              className={`flex items-center gap-2 px-8 py-4 rounded-xl text-white transition-all font-bold shadow-lg ${
                isSpeaking 
                  ? (isPaused ? 'bg-green-500 hover:bg-green-600' : 'bg-amber-500 hover:bg-amber-600')
                  : 'bg-amber-500 hover:bg-amber-600'
              }`}
            >
              {isSpeaking ? (
                isPaused ? (
                  <>
                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <span>继续朗读</span>
                  </>
                ) : (
                  <>
                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M10 9H6v6h4V9zm8 0h-4v6h4V9z" />
                    </svg>
                    <span>暂停朗读</span>
                  </>
                )
              ) : (
                <>
                  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>开始朗读</span>
                </>
              )}
            </button>

            <button
              onClick={nextParagraph}
              disabled={currentParagraphIndex >= paragraphs.length - 1}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
              style={{ color: textColor }}
            >
              <span>下一页</span>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {showSettings && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-t-2xl p-6 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} style={{ backgroundColor }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold" style={{ color: textColor }}>阅读设置</h3>
              <button onClick={() => setShowSettings(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: textColor }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="font-semibold mb-4" style={{ color: textColor }}>背景颜色</h4>
                <div className="flex flex-wrap gap-3">
                  {bgPresets.map((preset) => (
                    <button
                      key={preset.color}
                      onClick={() => {
                        setBackgroundColor(preset.color);
                        if (preset.textColor) {
                          setTextColor(preset.textColor);
                        } else {
                          setTextColor('#1f2937');
                        }
                      }}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        backgroundColor === preset.color ? 'border-amber-500' : 'border-transparent hover:border-gray-300'
                      }`}
                      style={{ backgroundColor: preset.color }}
                    >
                      <div className="w-10 h-10 rounded-lg border" style={{ backgroundColor: preset.color, borderColor: preset.textColor || '#1f2937' }} />
                      <span className="text-xs font-medium" style={{ color: preset.textColor || '#1f2937' }}>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-4" style={{ color: textColor }}>朗读设置</h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm opacity-70 mb-2 block" style={{ color: textColor }}>
                      语速: <span className="font-medium">{speechRate.toFixed(1)}x</span>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={speechRate}
                      onChange={(e) => {
                        const rate = parseFloat(e.target.value);
                        setSpeechRateLocal(rate);
                        setSpeechRate(rate);
                      }}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <div className="flex justify-between text-xs opacity-50 mt-1" style={{ color: textColor }}>
                      <span>慢速</span>
                      <span>正常</span>
                      <span>快速</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm opacity-70" style={{ color: textColor }}>声音选择</label>
                      <span className="text-xs opacity-50" style={{ color: textColor }}>可用声音: {voices.length} 种</span>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl p-2">
                      <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name="voice"
                          value=""
                          checked={selectedVoice === ''}
                          onChange={() => {
                            setSelectedVoiceLocal('');
                            setSelectedVoiceInSpeech('');
                          }}
                          className="w-4 h-4 text-amber-500"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium" style={{ color: textColor }}>自动选择中文</p>
                        </div>
                      </label>
                      {voices.map((voice) => (
                        <label
                          key={voice.name}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                            voice.lang.includes('zh') || voice.lang.includes('CN') ? 'hover:bg-gray-50 dark:hover:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 opacity-60'
                          }`}
                        >
                          <input
                            type="radio"
                            name="voice"
                            value={voice.name}
                            checked={selectedVoice === voice.name}
                            onChange={() => {
                              setSelectedVoiceLocal(voice.name);
                              setSelectedVoiceInSpeech(voice.name);
                            }}
                            className="w-4 h-4 text-amber-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: textColor }}>{voice.name}</p>
                            <p className="text-xs opacity-50" style={{ color: textColor }}>{voice.lang}</p>
                          </div>
                          {(voice.lang.includes('zh') || voice.lang.includes('CN')) && (
                            <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">中文</span>
                          )}
                          {selectedVoice === voice.name && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const utterance = new SpeechSynthesisUtterance('你好，这是当前选中的声音');
                                utterance.voice = voice;
                                utterance.rate = speechRate;
                                window.speechSynthesis.speak(utterance);
                              }}
                              className="text-xs px-2 py-1 bg-amber-500/10 text-amber-500 rounded hover:bg-amber-500/20 transition-colors flex-shrink-0"
                            >
                              试听
                            </button>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showChapters && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={() => setShowChapters(false)}>
          <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-t-2xl p-6 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} style={{ backgroundColor }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold" style={{ color: textColor }}>目录</h3>
              <button onClick={() => setShowChapters(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: textColor }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-2">
              {chapters.map((chapter, index) => {
                const isActive = currentParagraphIndex >= chapter.startIndex && currentParagraphIndex <= chapter.endIndex;
                return (
                  <button
                    key={index}
                    onClick={() => goToChapter(chapter)}
                    className={`w-full text-left p-4 rounded-xl transition-colors ${
                      isActive 
                        ? 'bg-amber-500 text-white' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    style={{ color: isActive ? undefined : textColor }}
                  >
                    <p className="font-medium truncate">{chapter.title}</p>
                    <p className="text-xs opacity-60 mt-1">
                      {chapter.startIndex + 1} - {chapter.endIndex + 1} 段
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
