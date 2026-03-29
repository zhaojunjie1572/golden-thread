import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { 
  CloudTtsConfig, 
  loadConfig, 
  saveConfig, 
  synthesizeTextToSpeech, 
  playAudio, 
  speakLongText,
  SpeechController
} from '../services/cloudTtsService';

export interface SpeechState {
  isPlaying: boolean;
  isPaused: boolean;
  bookTitle: string;
  bookAuthor: string;
  currentParagraph: string;
  currentParagraphIndex: number;
  totalParagraphs: number;
  speechRate: number;
  selectedVoice: string;
  volume: number;
  pitch: number;
  removePunctuation: boolean;
  cloudTtsConfig: CloudTtsConfig;
}

export interface VoiceWithCategory extends SpeechSynthesisVoice {
  category: 'zh-female' | 'zh-male' | 'zh-other' | 'other';
}

interface SpeechContextType {
  speechState: SpeechState;
  voices: SpeechSynthesisVoice[];
  categorizedVoices: VoiceWithCategory[];
  speechSegmentProgress: { current: number; total: number } | null;
  startSpeaking: (bookTitle: string, bookAuthor: string, paragraphs: string[], startIndex: number, onProgress?: (index: number) => void) => void;
  pauseSpeaking: () => void;
  resumeSpeaking: () => void;
  stopSpeaking: () => void;
  nextParagraph: () => void;
  prevParagraph: () => void;
  setSpeechRate: (rate: number) => void;
  setSelectedVoice: (voice: string) => void;
  setVolume: (volume: number) => void;
  setPitch: (pitch: number) => void;
  setRemovePunctuation: (remove: boolean) => void;
  setCloudTtsConfig: (config: CloudTtsConfig) => void;
  testVoice: (voiceName: string, text?: string) => void;
  testCloudTts: (config: CloudTtsConfig, text?: string) => Promise<void>;
}

const initialSpeechState: SpeechState = {
  isPlaying: false,
  isPaused: false,
  bookTitle: '',
  bookAuthor: '',
  currentParagraph: '',
  currentParagraphIndex: 0,
  totalParagraphs: 0,
  speechRate: 1.5,
  selectedVoice: '',
  volume: 1,
  pitch: 1,
  removePunctuation: true,
  cloudTtsConfig: loadConfig()
};

const SpeechContext = createContext<SpeechContextType | undefined>(undefined);

function removePunctuationMarks(text: string): string {
  // 只移除常见标点符号，保留数字、英文和中文
  const punctuationMarks = /[，。！？、；：""''（）【】《》「」『』.,!?;:"'()\[\]{}<>]+/g;
  let cleaned = text.replace(punctuationMarks, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

function isChineseVoice(voice: SpeechSynthesisVoice): boolean {
  const lang = voice.lang.toLowerCase();
  return lang.includes('zh') || lang.includes('cn') || lang.includes('cmn');
}

function isFemaleVoice(voice: SpeechSynthesisVoice): boolean {
  const name = voice.name.toLowerCase();
  const femaleKeywords = [
    'female', '女', 'xiaoxiao', 'xiaoyi', 'xiaomei', 'xiaofang', 
    'huihui', 'tiantian', 'siri', 'google 普通话', 'microsoft yaoyao',
    'microsoft xiaoxiao', 'xiaoxiao', 'xiaoni', 'xiaohan', 'xiaomeng',
    'xiaoxuan', 'xiaoyan', 'xiaolin', 'xiaoling', 'xiaoxia',
    'alice', 'victoria', 'samantha', 'tessa', 'serena',
    'ting-ting', 'mei-jia', 'sin-ji', 'google 台灣國語'
  ];
  return femaleKeywords.some(keyword => name.includes(keyword));
}

function isMaleVoice(voice: SpeechSynthesisVoice): boolean {
  const name = voice.name.toLowerCase();
  const maleKeywords = [
    'male', '男', 'yunxi', 'yunyang', 'yunfeng', 'yunhao',
    'alex', 'daniel', 'fred', 'jorge', 'juan', 'aaron', 'david',
    'david', 'mark', 'john', 'paul', 'peter', 'richard'
  ];
  return maleKeywords.some(keyword => name.includes(keyword));
}

function categorizeVoice(voice: SpeechSynthesisVoice): VoiceWithCategory {
  let category: 'zh-female' | 'zh-male' | 'zh-other' | 'other' = 'other';
  
  if (isChineseVoice(voice)) {
    if (isFemaleVoice(voice)) {
      category = 'zh-female';
    } else if (isMaleVoice(voice)) {
      category = 'zh-male';
    } else {
      category = 'zh-other';
    }
  } else {
    category = 'other';
  }
  
  return { ...voice, category };
}

function sortVoices(voices: VoiceWithCategory[]): VoiceWithCategory[] {
  const categoryOrder = {
    'zh-female': 0,
    'zh-male': 1,
    'zh-other': 2,
    'other': 3
  };
  
  return [...voices].sort((a, b) => {
    if (!a || !b) return 0;
    
    const categoryDiff = categoryOrder[a.category] - categoryOrder[b.category];
    if (categoryDiff !== 0) return categoryDiff;
    
    const aIsDefault = a.default;
    const bIsDefault = b.default;
    if (aIsDefault !== bIsDefault) return aIsDefault ? -1 : 1;
    
    const nameA = a.name || '';
    const nameB = b.name || '';
    return nameA.localeCompare(nameB, 'zh-CN');
  });
}

export function SpeechProvider({ children }: { children: ReactNode }) {
  const [speechState, setSpeechState] = useState<SpeechState>(initialSpeechState);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const paragraphsRef = useRef<string[]>([]);
  const onProgressRef = useRef<((index: number) => void) | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isCloudPlayingRef = useRef(false);
  const currentCloudIndexRef = useRef(0);
  const isBrowserPlayingRef = useRef(false);
  const currentBrowserIndexRef = useRef(0);
  const speechControllerRef = useRef<SpeechController | null>(null);
  const [speechSegmentProgress, setSpeechSegmentProgress] = useState<{ current: number; total: number } | null>(null);

  const categorizedVoices = useMemo(() => {
    if (!voices || !Array.isArray(voices)) {
      return [];
    }
    try {
      const categorized = voices.map(voice => {
        if (!voice) return null;
        return categorizeVoice(voice);
      }).filter(Boolean) as VoiceWithCategory[];
      return sortVoices(categorized);
    } catch (error) {
      console.error('分类声音时出错:', error);
      return [];
    }
  }, [voices]);

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;

    const loadVoices = () => {
      const availableVoices = synth.getVoices();
      setVoices(availableVoices);
    };

    loadVoices();
    synth.onvoiceschanged = loadVoices;

    return () => {
      synth.onvoiceschanged = null;
    };
  }, []);

  const getSelectedVoice = useCallback(() => {
    // 如果用户在 AI 助手中手动选择了语音，优先使用用户选择的
    if (speechState.selectedVoice !== '') {
      const selectedVoice = voices.find(v => v.name === speechState.selectedVoice);
      if (selectedVoice) {
        return selectedVoice;
      }
    }

    // 否则，自动选择最优中文女声（从原始 voices 数组中获取）
    const zhFemaleVoices = voices.filter(v => {
      const lang = v.lang.toLowerCase();
      const name = v.name.toLowerCase();
      const isChinese = lang.includes('zh') || lang.includes('cn') || lang.includes('cmn');
      const isFemale = [
        'female', '女', 'xiaoxiao', 'xiaoyi', 'xiaomei', 'xiaofang', 
        'huihui', 'tiantian', 'siri', 'google 普通话', 'microsoft yaoyao',
        'microsoft xiaoxiao', 'xiaoxiao', 'xiaoni', 'xiaohan', 'xiaomeng',
        'xiaoxuan', 'xiaoyan', 'xiaolin', 'xiaoling', 'xiaoxia',
        'alice', 'victoria', 'samantha', 'tessa', 'serena',
        'ting-ting', 'mei-jia', 'sin-ji', 'google 台灣國語'
      ].some(keyword => name.includes(keyword));
      return isChinese && isFemale;
    });
    
    if (zhFemaleVoices.length > 0) {
      return zhFemaleVoices[0];
    }
    
    // 尝试其他中文语音
    const zhVoices = voices.filter(v => {
      const lang = v.lang.toLowerCase();
      return lang.includes('zh') || lang.includes('cn') || lang.includes('cmn');
    });
    
    if (zhVoices.length > 0) {
      return zhVoices[0];
    }
    
    // 如果没有中文语音，使用系统默认
    const defaultVoice = voices.find(v => v.default);
    if (defaultVoice) {
      return defaultVoice;
    }
    
    // 如果没有标记为 default 的声音，返回第一个声音
    if (voices.length > 0) {
      return voices[0];
    }
    return null;
  }, [speechState.selectedVoice, voices]);

  const speakParagraph = useCallback((text: string, index?: number) => {
    const synth = window.speechSynthesis;
    if (!synth) {
      console.error('浏览器不支持语音合成');
      return;
    }

    // 先取消之前的朗读
    synth.cancel();
    
    // 清除之前的备用定时器
    if ((window as any).__ttsBackupTimer) {
      clearTimeout((window as any).__ttsBackupTimer);
      (window as any).__ttsBackupTimer = null;
    }
    
    let processedText = text;
    if (speechState.removePunctuation) {
      processedText = removePunctuationMarks(text);
    }

    console.log(`开始朗读段落 ${index ?? currentBrowserIndexRef.current}:`, processedText.substring(0, 50) + '...');

    const utterance = new SpeechSynthesisUtterance(processedText);
    utterance.rate = speechState.speechRate;
    utterance.pitch = speechState.pitch;
    utterance.volume = speechState.volume;
    utterance.lang = 'zh-CN';

    const voice = getSelectedVoice();
    if (voice) {
      try {
        console.log('使用语音:', voice.name);
        utterance.voice = voice;
      } catch (error) {
        console.warn('设置语音时出错，使用默认语言设置:', error);
        // 如果设置 voice 失败，不设置 voice，让浏览器使用默认
      }
    } else {
      console.warn('没有找到合适的语音');
    }

    let hasEnded = false;
    
    // 添加 onend 事件处理，自动播放下一个段落
    utterance.onend = () => {
      if (hasEnded) return;
      hasEnded = true;
      console.log(`段落 ${index ?? currentBrowserIndexRef.current} 朗读结束`);
      
      if (isBrowserPlayingRef.current) {
        const nextIndex = (index ?? currentBrowserIndexRef.current) + 1;
        const paragraphs = paragraphsRef.current;
        
        if (nextIndex < paragraphs.length && isBrowserPlayingRef.current) {
          currentBrowserIndexRef.current = nextIndex;
          setSpeechState(prev => ({
            ...prev,
            currentParagraph: paragraphs[nextIndex],
            currentParagraphIndex: nextIndex
          }));
          onProgressRef.current?.(nextIndex);
          
          // 添加小延迟，避免手机端连续播放问题
          setTimeout(() => {
            if (isBrowserPlayingRef.current) {
              speakParagraph(paragraphs[nextIndex], nextIndex);
            }
          }, 200);
        } else {
          // 播放完成
          console.log('所有段落朗读完成');
          isBrowserPlayingRef.current = false;
          setSpeechState(prev => ({
            ...prev,
            isPlaying: false,
            isPaused: false
          }));
        }
      }
    };

    utterance.onerror = (event) => {
      console.error('语音合成错误:', event.error, '段落:', index ?? currentBrowserIndexRef.current);
      if (hasEnded) return;
      hasEnded = true;
      
      // 发生错误时也尝试继续播放下一个
      if (isBrowserPlayingRef.current && event.error !== 'canceled') {
        const nextIndex = (index ?? currentBrowserIndexRef.current) + 1;
        const paragraphs = paragraphsRef.current;
        
        if (nextIndex < paragraphs.length) {
          currentBrowserIndexRef.current = nextIndex;
          setTimeout(() => {
            if (isBrowserPlayingRef.current) {
              speakParagraph(paragraphs[nextIndex], nextIndex);
            }
          }, 200);
        }
      }
    };

    // 手机端备用机制：使用定时器检查朗读是否卡住
    // 估算朗读时间（假设每秒读 5 个字符）
    const estimatedDuration = Math.max(processedText.length / 5 / speechState.speechRate * 1000, 3000);
    console.log('预计朗读时间:', estimatedDuration, 'ms');
    
    (window as any).__ttsBackupTimer = setTimeout(() => {
      if (!hasEnded && isBrowserPlayingRef.current) {
        console.warn('朗读可能卡住，触发备用机制');
        hasEnded = true;
        const nextIndex = (index ?? currentBrowserIndexRef.current) + 1;
        const paragraphs = paragraphsRef.current;
        
        if (nextIndex < paragraphs.length) {
          currentBrowserIndexRef.current = nextIndex;
          setSpeechState(prev => ({
            ...prev,
            currentParagraph: paragraphs[nextIndex],
            currentParagraphIndex: nextIndex
          }));
          onProgressRef.current?.(nextIndex);
          speakParagraph(paragraphs[nextIndex], nextIndex);
        } else {
          isBrowserPlayingRef.current = false;
          setSpeechState(prev => ({
            ...prev,
            isPlaying: false,
            isPaused: false
          }));
        }
      }
    }, estimatedDuration + 2000); // 给 2 秒缓冲时间

    utteranceRef.current = utterance;
    
    // 手机端需要延迟一点再开始朗读，确保音频上下文已准备就绪
    setTimeout(() => {
      if (isBrowserPlayingRef.current) {
        synth.speak(utterance);
      }
    }, 50);
  }, [speechState.speechRate, speechState.pitch, speechState.volume, speechState.removePunctuation, getSelectedVoice]);

  const speakCloudParagraph = useCallback(async (text: string): Promise<void> => {
    let processedText = text;
    if (speechState.removePunctuation) {
      processedText = removePunctuationMarks(text);
    }

    return new Promise((resolve, reject) => {
      speakLongText(processedText, speechState.cloudTtsConfig, {
        rate: speechState.speechRate,
        pitch: speechState.pitch,
        volume: speechState.volume,
        onProgress: (current, total) => {
          setSpeechSegmentProgress({ current, total });
        },
        onEnded: () => {
          setSpeechSegmentProgress(null);
          resolve();
        },
        onError: (error) => {
          setSpeechSegmentProgress(null);
          reject(error);
        }
      }).then(controller => {
        speechControllerRef.current = controller;
        controller.play();
      }).catch(reject);
    });
  }, [speechState]);

  const startSpeaking = useCallback((
    bookTitle: string, 
    bookAuthor: string, 
    paragraphs: string[], 
    startIndex: number,
    onProgress?: (index: number) => void
  ) => {
    const validParagraphs = paragraphs.filter(p => p.trim().length > 0);
    
    paragraphsRef.current = validParagraphs;
    onProgressRef.current = onProgress || null;
    
    setSpeechState(prev => ({
      ...prev,
      isPlaying: true,
      isPaused: false,
      bookTitle,
      bookAuthor,
      currentParagraph: validParagraphs[startIndex] || '',
      currentParagraphIndex: startIndex,
      totalParagraphs: validParagraphs.length
    }));

    // 检查是否使用 Edge TTS 开关
    const useEdgeTts = speechState.cloudTtsConfig.useEdgeTts === true;
    
    // 检查是否需要使用 Edge TTS
    if (useEdgeTts && speechState.cloudTtsConfig.engine === 'browser') {
      console.log('读书模块使用 Edge TTS 开关');
      // 使用 Edge TTS
      isCloudPlayingRef.current = true;
      currentCloudIndexRef.current = startIndex;
      
      const playNext = () => {
        if (!isCloudPlayingRef.current || currentCloudIndexRef.current >= validParagraphs.length) {
          setSpeechState(prev => ({ ...prev, isPlaying: false, isPaused: false }));
          return;
        }
        
        const text = validParagraphs[currentCloudIndexRef.current];
        let processedText = text;
        if (speechState.removePunctuation) {
          processedText = removePunctuationMarks(text);
        }
        
        setSpeechState(prev => ({
          ...prev,
          currentParagraph: text,
          currentParagraphIndex: currentCloudIndexRef.current
        }));
        onProgressRef.current?.(currentCloudIndexRef.current);
        
        const edgeConfig = {
          ...speechState.cloudTtsConfig,
          engine: 'edge-tts' as const
        };
        
        speakLongText(processedText, edgeConfig, {
          rate: speechState.speechRate,
          pitch: speechState.pitch,
          volume: speechState.volume,
          onProgress: (current, total) => {
            setSpeechSegmentProgress({ current, total });
          },
          onEnded: () => {
            setSpeechSegmentProgress(null);
            currentCloudIndexRef.current++;
            if (isCloudPlayingRef.current) {
              setTimeout(playNext, 100);
            }
          },
          onError: (error) => {
            console.error('读书模块朗读错误:', error);
            setSpeechSegmentProgress(null);
            currentCloudIndexRef.current++;
            if (isCloudPlayingRef.current) {
              setTimeout(playNext, 100);
            }
          }
        }).then(controller => {
          speechControllerRef.current = controller;
          controller.play();
        }).catch(err => {
          console.error('读书模块播放错误:', err);
          currentCloudIndexRef.current++;
          if (isCloudPlayingRef.current) {
            setTimeout(playNext, 100);
          }
        });
      };
      
      playNext();
    } else if (speechState.cloudTtsConfig.engine !== 'browser') {
      // 使用其他云端引擎
      startCloudSpeaking(validParagraphs, startIndex);
    } else {
      // 初始化浏览器 TTS 播放状态
      isBrowserPlayingRef.current = true;
      currentBrowserIndexRef.current = startIndex;
      speakParagraph(validParagraphs[startIndex] || '', startIndex);
    }
  }, [speakParagraph, speechState.cloudTtsConfig, speechState.removePunctuation, speechState.speechRate, speechState.pitch, speechState.volume]);

  const startCloudSpeaking = useCallback(async (paragraphs: string[], startIndex: number) => {
    isCloudPlayingRef.current = true;
    currentCloudIndexRef.current = startIndex;

    try {
      for (let i = startIndex; i < paragraphs.length && isCloudPlayingRef.current; i++) {
        if (!isCloudPlayingRef.current) break;
        
        currentCloudIndexRef.current = i;
        setSpeechState(prev => ({
          ...prev,
          currentParagraph: paragraphs[i],
          currentParagraphIndex: i
        }));
        
        onProgressRef.current?.(i);
        await speakCloudParagraph(paragraphs[i]);
      }
      
      if (isCloudPlayingRef.current) {
        setSpeechState(prev => ({
          ...prev,
          isPlaying: false,
          isPaused: false
        }));
      }
    } catch (error) {
      console.error('云 TTS 播放错误:', error);
      isCloudPlayingRef.current = false;
      setSpeechState(prev => ({
        ...prev,
        isPlaying: false,
        isPaused: false
      }));
    }
  }, [speakCloudParagraph]);

  const pauseSpeaking = useCallback(() => {
    // 暂停长文本朗读控制器
    if (speechControllerRef.current) {
      speechControllerRef.current.pause();
    }
    
    if (speechState.cloudTtsConfig.engine !== 'browser') {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    } else {
      const synth = window.speechSynthesis;
      if (synth) {
        synth.pause();
      }
    }
    
    setSpeechState(prev => ({
      ...prev,
      isPaused: true
    }));
  }, [speechState.cloudTtsConfig]);

  const resumeSpeaking = useCallback(() => {
    // 恢复长文本朗读控制器
    if (speechControllerRef.current) {
      speechControllerRef.current.play();
    }
    
    if (speechState.cloudTtsConfig.engine !== 'browser') {
      if (audioRef.current) {
        audioRef.current.play();
      }
    } else {
      const synth = window.speechSynthesis;
      if (synth) {
        synth.resume();
      }
    }
    
    setSpeechState(prev => ({
      ...prev,
      isPaused: false
    }));
  }, [speechState.cloudTtsConfig]);

  const stopSpeaking = useCallback(() => {
    isCloudPlayingRef.current = false;
    isBrowserPlayingRef.current = false;
    
    // 清除备用定时器
    if ((window as any).__ttsBackupTimer) {
      clearTimeout((window as any).__ttsBackupTimer);
      (window as any).__ttsBackupTimer = null;
    }
    
    // 停止长文本朗读控制器
    if (speechControllerRef.current) {
      speechControllerRef.current.stop();
      speechControllerRef.current = null;
    }
    
    if (speechState.cloudTtsConfig.engine !== 'browser') {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    } else {
      const synth = window.speechSynthesis;
      if (synth) {
        synth.cancel();
      }
      utteranceRef.current = null;
    }
    
    setSpeechSegmentProgress(null);
    
    setSpeechState(prev => ({
      ...prev,
      isPlaying: false,
      isPaused: false
    }));
  }, [speechState.cloudTtsConfig]);

  const nextParagraph = useCallback(() => {
    const paragraphs = paragraphsRef.current;
    const nextIndex = Math.min(speechState.currentParagraphIndex + 1, paragraphs.length - 1);
    
    if (speechState.cloudTtsConfig.engine !== 'browser') {
      isCloudPlayingRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
      }
      startCloudSpeaking(paragraphs, nextIndex);
    } else {
      // 更新浏览器 TTS 播放索引
      currentBrowserIndexRef.current = nextIndex;
      
      setSpeechState(prev => ({
        ...prev,
        currentParagraph: paragraphs[nextIndex],
        currentParagraphIndex: nextIndex
      }));
      
      if (speechState.isPlaying) {
        speakParagraph(paragraphs[nextIndex], nextIndex);
      }
    }
  }, [speechState.currentParagraphIndex, speechState.isPlaying, speechState.cloudTtsConfig, speakParagraph, startCloudSpeaking]);

  const prevParagraph = useCallback(() => {
    const paragraphs = paragraphsRef.current;
    const prevIndex = Math.max(speechState.currentParagraphIndex - 1, 0);
    
    if (speechState.cloudTtsConfig.engine !== 'browser') {
      isCloudPlayingRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
      }
      startCloudSpeaking(paragraphs, prevIndex);
    } else {
      // 更新浏览器 TTS 播放索引
      currentBrowserIndexRef.current = prevIndex;
      
      setSpeechState(prev => ({
        ...prev,
        currentParagraph: paragraphs[prevIndex],
        currentParagraphIndex: prevIndex
      }));
      
      if (speechState.isPlaying) {
        speakParagraph(paragraphs[prevIndex], prevIndex);
      }
    }
  }, [speechState.currentParagraphIndex, speechState.isPlaying, speechState.cloudTtsConfig, speakParagraph, startCloudSpeaking]);

  useEffect(() => {
    if (speechState.cloudTtsConfig.engine !== 'browser') return;
    
    const synth = window.speechSynthesis;
    if (!synth || !utteranceRef.current) return;

    const handleEnd = () => {
      const paragraphs = paragraphsRef.current;
      const nextIndex = speechState.currentParagraphIndex + 1;
      
      if (nextIndex < paragraphs.length) {
        setSpeechState(prev => ({
          ...prev,
          currentParagraph: paragraphs[nextIndex],
          currentParagraphIndex: nextIndex
        }));
        onProgressRef.current?.(nextIndex);
        speakParagraph(paragraphs[nextIndex]);
      } else {
        setSpeechState(prev => ({
          ...prev,
          isPlaying: false,
          isPaused: false
        }));
      }
    };

    const utterance = utteranceRef.current;
    utterance.onend = handleEnd;

    return () => {
      utterance.onend = null;
    };
  }, [speechState.currentParagraphIndex, speakParagraph, speechState.cloudTtsConfig]);

  const setSpeechRate = useCallback((rate: number) => {
    setSpeechState(prev => ({
      ...prev,
      speechRate: rate
    }));
  }, []);

  const setSelectedVoice = useCallback((voice: string) => {
    setSpeechState(prev => ({
      ...prev,
      selectedVoice: voice
    }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setSpeechState(prev => ({
      ...prev,
      volume
    }));
  }, []);

  const setPitch = useCallback((pitch: number) => {
    setSpeechState(prev => ({
      ...prev,
      pitch
    }));
  }, []);

  const setRemovePunctuation = useCallback((remove: boolean) => {
    setSpeechState(prev => ({
      ...prev,
      removePunctuation: remove
    }));
  }, []);

  const setCloudTtsConfig = useCallback((config: CloudTtsConfig) => {
    saveConfig(config);
    setSpeechState(prev => ({
      ...prev,
      cloudTtsConfig: config
    }));
  }, []);

  const testVoice = useCallback((voiceName: string, text: string = '你好，这是测试语音，希望你能喜欢') => {
    const synth = window.speechSynthesis;
    if (!synth) return;

    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speechState.speechRate;
    utterance.pitch = speechState.pitch;
    utterance.volume = speechState.volume;
    utterance.lang = 'zh-CN';

    if (voiceName) {
      const voice = voices.find(v => v.name === voiceName);
      if (voice) {
        utterance.voice = voice;
      }
    } else {
      const voice = getSelectedVoice();
      if (voice) {
        utterance.voice = voice;
      }
    }

    synth.speak(utterance);
  }, [speechState.speechRate, speechState.pitch, speechState.volume, voices, getSelectedVoice]);

  const testCloudTts = useCallback(async (config: CloudTtsConfig, text: string = '你好，这是测试语音') => {
    if (config.engine === 'browser') {
      testVoice('', text);
      return;
    }
    
    const blob = await synthesizeTextToSpeech(text, config, {
      rate: speechState.speechRate,
      pitch: speechState.pitch
    });
    
    await playAudio(blob);
  }, [speechState.speechRate, speechState.pitch, testVoice]);

  return (
    <SpeechContext.Provider value={{
      speechState,
      voices,
      categorizedVoices,
      speechSegmentProgress,
      startSpeaking,
      pauseSpeaking,
      resumeSpeaking,
      stopSpeaking,
      nextParagraph,
      prevParagraph,
      setSpeechRate,
      setSelectedVoice,
      setVolume,
      setPitch,
      setRemovePunctuation,
      setCloudTtsConfig,
      testVoice,
      testCloudTts
    }}>
      {children}
    </SpeechContext.Provider>
  );
}

export function useSpeech() {
  const context = useContext(SpeechContext);
  if (context === undefined) {
    throw new Error('useSpeech must be used within a SpeechProvider');
  }
  return context;
}
