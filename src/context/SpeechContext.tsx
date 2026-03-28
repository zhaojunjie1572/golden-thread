import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { 
  CloudTtsConfig, 
  loadConfig, 
  saveConfig, 
  synthesizeTextToSpeech, 
  playAudio 
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
  const punctuationMarks = /[\u3000-\u303F\uFF00-\uFFEF\u2000-\u206F\u0021-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E\u20A0-\u20CF\u2190-\u21FF\u27F0-\u27FF\u2900-\u297F\u2600-\u26FF\u2700-\u27BF\u1F300-\u1F5FF\u1F600-\u1F64F\u1F680-\u1F6FF\u1F900-\u1F9FF\u2500-\u257F\u2580-\u259F\uE000-\uF8FF]+/gu;
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
    if (speechState.selectedVoice === '') {
      const zhFemaleVoices = categorizedVoices.filter(v => v.category === 'zh-female');
      if (zhFemaleVoices.length > 0) {
        return zhFemaleVoices[0];
      }
      
      const zhVoices = categorizedVoices.filter(v => v.category.startsWith('zh'));
      if (zhVoices.length > 0) {
        return zhVoices[0];
      }
      
      if (voices.length > 0) {
        return voices.find(v => v.default) || voices[0];
      }
      return null;
    }
    
    return voices.find(v => v.name === speechState.selectedVoice) || null;
  }, [speechState.selectedVoice, voices, categorizedVoices]);

  const speakParagraph = useCallback((text: string) => {
    const synth = window.speechSynthesis;
    if (!synth) return;

    synth.cancel();
    
    let processedText = text;
    if (speechState.removePunctuation) {
      processedText = removePunctuationMarks(text);
    }

    const utterance = new SpeechSynthesisUtterance(processedText);
    utterance.rate = speechState.speechRate;
    utterance.pitch = speechState.pitch;
    utterance.volume = speechState.volume;
    utterance.lang = 'zh-CN';

    const voice = getSelectedVoice();
    if (voice) {
      utterance.voice = voice;
    }

    utteranceRef.current = utterance;
    synth.speak(utterance);
  }, [speechState.speechRate, speechState.pitch, speechState.volume, speechState.removePunctuation, getSelectedVoice]);

  const speakCloudParagraph = useCallback(async (text: string): Promise<void> => {
    let processedText = text;
    if (speechState.removePunctuation) {
      processedText = removePunctuationMarks(text);
    }

    const blob = await synthesizeTextToSpeech(processedText, speechState.cloudTtsConfig, {
      rate: speechState.speechRate,
      pitch: speechState.pitch
    });

    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      
      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        resolve();
      };
      
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        reject(new Error('音频播放失败'));
      };
      
      audio.play().catch(reject);
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

    if (speechState.cloudTtsConfig.engine !== 'browser') {
      startCloudSpeaking(validParagraphs, startIndex);
    } else {
      speakParagraph(validParagraphs[startIndex] || '');
    }
  }, [speakParagraph, speechState.cloudTtsConfig]);

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
      setSpeechState(prev => ({
        ...prev,
        currentParagraph: paragraphs[nextIndex],
        currentParagraphIndex: nextIndex
      }));
      
      if (speechState.isPlaying) {
        speakParagraph(paragraphs[nextIndex]);
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
      setSpeechState(prev => ({
        ...prev,
        currentParagraph: paragraphs[prevIndex],
        currentParagraphIndex: prevIndex
      }));
      
      if (speechState.isPlaying) {
        speakParagraph(paragraphs[prevIndex]);
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
