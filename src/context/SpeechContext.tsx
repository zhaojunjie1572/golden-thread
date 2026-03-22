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
}

interface SpeechContextType {
  speechState: SpeechState;
  startSpeaking: (bookTitle: string, bookAuthor: string, paragraphs: string[], startIndex: number, onProgress?: (index: number) => void) => void;
  pauseSpeaking: () => void;
  resumeSpeaking: () => void;
  stopSpeaking: () => void;
  nextParagraph: () => void;
  prevParagraph: () => void;
  setSpeechRate: (rate: number) => void;
  setSelectedVoice: (voice: string) => void;
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
};

const SpeechContext = createContext<SpeechContextType | undefined>(undefined);

export function SpeechProvider({ children }: { children: ReactNode }) {
  const [speechState, setSpeechState] = useState<SpeechState>(initialSpeechState);
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

    const utterance = new SpeechSynthesisUtterance(paragraphs[index]);
    utterance.rate = speechState.speechRate;
    utterance.pitch = 1;
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
  }, [paragraphs, speechState.speechRate, speechState.selectedVoice, onProgressCallback]);

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
    
    setSpeechState({
      isPlaying: true,
      isPaused: false,
      bookTitle,
      bookAuthor,
      currentParagraph: newParagraphs[startIndex] || '',
      currentParagraphIndex: startIndex,
      totalParagraphs: newParagraphs.length,
      speechRate: speechState.speechRate,
      selectedVoice: speechState.selectedVoice,
    });

    isSpeakingRef.current = true;
    isPausedRef.current = false;
    speakParagraph(startIndex);
  }, [speechState.speechRate, speechState.selectedVoice, speakParagraph]);

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
    setSpeechState(initialSpeechState);
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

  useEffect(() => {
    isSpeakingRef.current = speechState.isPlaying;
  }, [speechState.isPlaying]);

  useEffect(() => {
    isPausedRef.current = speechState.isPaused;
  }, [speechState.isPaused]);

  return (
    <SpeechContext.Provider value={{
      speechState,
      startSpeaking,
      pauseSpeaking,
      resumeSpeaking,
      stopSpeaking,
      nextParagraph,
      prevParagraph,
      setSpeechRate,
      setSelectedVoice,
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
