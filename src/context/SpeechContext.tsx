import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';

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
}

interface SpeechContextType {
  speechState: SpeechState;
  voices: SpeechSynthesisVoice[];
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
  testVoice: (voiceName: string, text?: string) => void;
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
};

const SpeechContext = createContext<SpeechContextType | undefined>(undefined);

// 去除标点符号，用停顿代替
function removePunctuationMarks(text: string): string {
  // 定义需要去除的标点符号
  const punctuationMarks = /[，。！？、；：""''（）【】《》〈〉「」『』〔〕［］｛｝＼｜．·…—～｀@#￥%……&*（）——+｛｝｜：""《》？｛｝｜]+/g;

  // 将标点替换为空格（产生停顿效果）
  let cleaned = text.replace(punctuationMarks, ' ');

  // 合并多个空格为一个
  cleaned = cleaned.replace(/\s+/g, ' ');

  // 去除英文标点
  cleaned = cleaned.replace(/[,\.!?;:"'()\[\]{}]+/g, ' ');

  // 再次合并空格
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

export function SpeechProvider({ children }: { children: ReactNode }) {
  const [speechState, setSpeechState] = useState<SpeechState>(() => {
    const savedRate = localStorage.getItem('speech-rate');
    const savedVoice = localStorage.getItem('selected-voice');
    const savedVolume = localStorage.getItem('speech-volume');
    const savedPitch = localStorage.getItem('speech-pitch');
    const savedRemovePunctuation = localStorage.getItem('speech-remove-punctuation');
    return {
      ...initialSpeechState,
      speechRate: savedRate ? parseFloat(savedRate) : 1.5,
      selectedVoice: savedVoice || '',
      volume: savedVolume ? parseFloat(savedVolume) : 1,
      pitch: savedPitch ? parseFloat(savedPitch) : 1,
      removePunctuation: savedRemovePunctuation !== null ? savedRemovePunctuation === 'true' : true,
    };
  });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [onProgressCallback, setOnProgressCallback] = useState<((index: number) => void) | null>(null);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentSpeechIndexRef = useRef(0);
  const isSpeakingRef = useRef(false);
  const isPausedRef = useRef(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const lastSpeechRateRef = useRef(1.5);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      voicesRef.current = availableVoices;
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
    localStorage.setItem('speech-rate', speechState.speechRate.toString());
  }, [speechState.speechRate]);

  useEffect(() => {
    localStorage.setItem('selected-voice', speechState.selectedVoice);
  }, [speechState.selectedVoice]);

  useEffect(() => {
    localStorage.setItem('speech-volume', speechState.volume.toString());
  }, [speechState.volume]);

  useEffect(() => {
    localStorage.setItem('speech-pitch', speechState.pitch.toString());
  }, [speechState.pitch]);

  useEffect(() => {
    localStorage.setItem('speech-remove-punctuation', speechState.removePunctuation.toString());
  }, [speechState.removePunctuation]);

  const testVoice = useCallback((voiceName: string, text = '你好，这是当前选中的声音') => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const testText = speechState.removePunctuation ? removePunctuationMarks(text) : text;
    const utterance = new SpeechSynthesisUtterance(testText);
    utterance.rate = speechState.speechRate;
    utterance.pitch = speechState.pitch;
    utterance.volume = speechState.volume;
    utterance.lang = 'zh-CN';

    if (voiceName) {
      const voice = voicesRef.current.find(v => v.name === voiceName);
      if (voice) {
        utterance.voice = voice;
      }
    } else {
      const chineseVoice = voicesRef.current.find(voice =>
        voice.lang.includes('zh') || voice.lang.includes('CN')
      );
      if (chineseVoice) {
        utterance.voice = chineseVoice;
      }
    }

    window.speechSynthesis.speak(utterance);
  }, [speechState.speechRate, speechState.volume, speechState.pitch, speechState.removePunctuation]);

  const speakParagraph = useCallback((index: number) => {
    if (!('speechSynthesis' in window) || index >= paragraphs.length) {
      if (index >= paragraphs.length) {
        setSpeechState(prev => ({ ...prev, isPlaying: false, isPaused: false }));
      }
      return;
    }

    currentSpeechIndexRef.current = index;

    setSpeechState(prev => ({
      ...prev,
      currentParagraph: paragraphs[index],
      currentParagraphIndex: index,
    }));

    if (onProgressCallback) {
      onProgressCallback(index);
    }

    // 处理文本：去除标点符号
    const rawText = paragraphs[index];
    const textToSpeak = speechState.removePunctuation ? removePunctuationMarks(rawText) : rawText;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = speechState.speechRate;
    utterance.pitch = speechState.pitch;
    utterance.volume = speechState.volume;
    utterance.lang = 'zh-CN';

    if (speechState.selectedVoice) {
      const voice = voicesRef.current.find(v => v.name === speechState.selectedVoice);
      if (voice) {
        utterance.voice = voice;
      }
    } else {
      const chineseVoice = voicesRef.current.find(voice =>
        voice.lang.includes('zh') || voice.lang.includes('CN')
      );
      if (chineseVoice) {
        utterance.voice = chineseVoice;
      }
    }

    utterance.onend = () => {
      if (currentSpeechIndexRef.current === index && isSpeakingRef.current && !isPausedRef.current) {
        speakParagraph(index + 1);
      }
    };

    utterance.onerror = () => {
      setSpeechState(prev => ({ ...prev, isPlaying: false, isPaused: false }));
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [paragraphs, speechState.speechRate, speechState.selectedVoice, speechState.volume, speechState.pitch, speechState.removePunctuation, onProgressCallback]);

  const startSpeaking = useCallback((
    bookTitle: string,
    bookAuthor: string,
    newParagraphs: string[],
    startIndex: number,
    onProgress?: (index: number) => void
  ) => {
    if (!('speechSynthesis' in window)) {
      alert('您的浏览器不支持语音合成功能');
      return;
    }

    window.speechSynthesis.cancel();
    setParagraphs(newParagraphs);
    setOnProgressCallback(() => onProgress || null);

    setSpeechState(prev => ({
      ...prev,
      isPlaying: true,
      isPaused: false,
      bookTitle,
      bookAuthor,
      currentParagraph: newParagraphs[startIndex] || '',
      currentParagraphIndex: startIndex,
      totalParagraphs: newParagraphs.length,
    }));

    isSpeakingRef.current = true;
    isPausedRef.current = false;
    speakParagraph(startIndex);
  }, [speakParagraph]);

  const pauseSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.pause();
    }
    isPausedRef.current = true;
    setSpeechState(prev => ({ ...prev, isPaused: true }));
  }, []);

  const resumeSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }
    isPausedRef.current = false;
    setSpeechState(prev => ({ ...prev, isPaused: false }));
  }, []);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;
    isPausedRef.current = false;
    setSpeechState(prev => ({
      ...initialSpeechState,
      speechRate: prev.speechRate,
      selectedVoice: prev.selectedVoice,
      volume: prev.volume,
      pitch: prev.pitch,
      removePunctuation: prev.removePunctuation,
    }));
    setParagraphs([]);
    setOnProgressCallback(null);
  }, []);

  const nextParagraph = useCallback(() => {
    if (speechState.currentParagraphIndex < paragraphs.length - 1) {
      const newIndex = speechState.currentParagraphIndex + 1;
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      speakParagraph(newIndex);
    }
  }, [speechState.currentParagraphIndex, paragraphs.length, speakParagraph]);

  const prevParagraph = useCallback(() => {
    if (speechState.currentParagraphIndex > 0) {
      const newIndex = speechState.currentParagraphIndex - 1;
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      speakParagraph(newIndex);
    }
  }, [speechState.currentParagraphIndex, speakParagraph]);

  const setSpeechRate = useCallback((rate: number) => {
    setSpeechState(prev => ({ ...prev, speechRate: rate }));
    if (speechState.isPlaying && !speechState.isPaused && rate !== lastSpeechRateRef.current) {
      lastSpeechRateRef.current = rate;
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      speakParagraph(speechState.currentParagraphIndex);
    }
  }, [speechState.isPlaying, speechState.isPaused, speechState.currentParagraphIndex, speakParagraph]);

  const setSelectedVoice = useCallback((voice: string) => {
    setSpeechState(prev => ({ ...prev, selectedVoice: voice }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setSpeechState(prev => ({ ...prev, volume }));
  }, []);

  const setPitch = useCallback((pitch: number) => {
    setSpeechState(prev => ({ ...prev, pitch }));
  }, []);

  const setRemovePunctuation = useCallback((remove: boolean) => {
    setSpeechState(prev => ({ ...prev, removePunctuation: remove }));
  }, []);

  useEffect(() => {
    isSpeakingRef.current = speechState.isPlaying;
  }, [speechState.isPlaying]);

  useEffect(() => {
    isPausedRef.current = speechState.isPaused;
  }, [speechState.isPaused]);

  return (
    <SpeechContext.Provider value={{
      speechState,
      voices,
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
      testVoice,
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
