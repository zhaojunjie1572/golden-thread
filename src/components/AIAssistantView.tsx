import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService, ChatMessage, ApiConfig } from '../services/apiService';
import { webSearchService } from '../services/webSearchService';
import { useSpeech } from '../context/SpeechContext';

// 去除标点符号，用停顿代替
function removePunctuationMarks(text: string): string {
  // 定义需要去除的所有标点符号和特殊字符
  const punctuationMarks = /[\u3000-\u303F\uFF00-\uFFEF\u2000-\u206F\u0021-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E\u20A0-\u20CF\u2190-\u21FF\u27F0-\u27FF\u2900-\u297F\u2600-\u26FF\u2700-\u27BF\u1F300-\u1F5FF\u1F600-\u1F64F\u1F680-\u1F6FF\u1F900-\u1F9FF\u2500-\u257F\u2580-\u259F\uE000-\uF8FF]+/gu;

  // 将标点替换为空格（产生停顿效果）
  let cleaned = text.replace(punctuationMarks, ' ');

  // 合并多个空格为一个
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

interface AttachedFile {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'file';
}

function QuickQuestion({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
    >
      {text}
    </button>
  );
}

export default function AIAssistantView() {
  const navigate = useNavigate();
  const { speechState, voices, setSpeechRate, setSelectedVoice: setSelectedVoiceInSpeech, setVolume, setPitch, setRemovePunctuation, testVoice } = useSpeech();
  
  const [backgroundImage, setBackgroundImage] = useState<string | null>(() => {
    try {
      return localStorage.getItem('ai-assistant-background');
    } catch {
      return null;
    }
  });
  const [userTextColor, setUserTextColor] = useState<string>(() => {
    try {
      return localStorage.getItem('ai-assistant-user-text-color') || '#000000';
    } catch {
      return '#000000';
    }
  });
  const [aiTextColor, setAiTextColor] = useState<string>(() => {
    try {
      return localStorage.getItem('ai-assistant-ai-text-color') || '#000000';
    } catch {
      return '#000000';
    }
  });
  const [textScale, setTextScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ai-assistant-text-scale');
      return saved ? parseFloat(saved) : 1;
    } catch {
      return 1;
    }
  });
  const [showColorSettings, setShowColorSettings] = useState(false);
  const [topBarTransparent, setTopBarTransparent] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ai-assistant-topbar-transparent') === 'true';
    } catch {
      return false;
    }
  });
  const [inputBarTransparent, setInputBarTransparent] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ai-assistant-inputbar-transparent') === 'true';
    } catch {
      return false;
    }
  });
  const [bubbleTransparent, setBubbleTransparent] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ai-assistant-bubble-transparent') === 'true';
    } catch {
      return false;
    }
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(!apiService.hasApiKey());
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [apiConfig, setApiConfig] = useState<ApiConfig>(apiService.getConfig());
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const streamingContentRef = useRef('');
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [webSearchEnabled, setWebSearchEnabled] = useState(() => {
    try {
      return localStorage.getItem('web-search-enabled') === 'true';
    } catch {
      return false;
    }
  });
  const [isSearching, setIsSearching] = useState(false);
  const [serpApiKey, setSerpApiKey] = useState(() => {
    try {
      return localStorage.getItem('serp-api-key') || '';
    } catch {
      return '';
    }
  });
  const [openWeatherApiKey, setOpenWeatherApiKey] = useState(() => {
    try {
      return localStorage.getItem('openweather-api-key') || '';
    } catch {
      return '';
    }
  });
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    localStorage.setItem('web-search-enabled', webSearchEnabled.toString());
  }, [webSearchEnabled]);

  useEffect(() => {
    webSearchService.setSerpApiKey(serpApiKey);
    webSearchService.setOpenWeatherApiKey(openWeatherApiKey);
  }, [serpApiKey, openWeatherApiKey]);

  useEffect(() => {
    if (backgroundImage) {
      localStorage.setItem('ai-assistant-background', backgroundImage);
    } else {
      localStorage.removeItem('ai-assistant-background');
    }
  }, [backgroundImage]);

  useEffect(() => {
    localStorage.setItem('ai-assistant-user-text-color', userTextColor);
  }, [userTextColor]);

  useEffect(() => {
    localStorage.setItem('ai-assistant-ai-text-color', aiTextColor);
  }, [aiTextColor]);

  useEffect(() => {
    localStorage.setItem('ai-assistant-text-scale', textScale.toString());
  }, [textScale]);

  useEffect(() => {
    localStorage.setItem('ai-assistant-topbar-transparent', topBarTransparent.toString());
  }, [topBarTransparent]);

  useEffect(() => {
    localStorage.setItem('ai-assistant-inputbar-transparent', inputBarTransparent.toString());
  }, [inputBarTransparent]);

  useEffect(() => {
    localStorage.setItem('ai-assistant-bubble-transparent', bubbleTransparent.toString());
  }, [bubbleTransparent]);

  const handleBackgroundImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        if (file.size > 10 * 1024 * 1024) {
          alert('图片大小不能超过 10MB');
          e.target.value = '';
          return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const dataUrl = event.target?.result as string;
            setBackgroundImage(dataUrl);
          } catch (err) {
            console.error('图片加载失败:', err);
            alert('图片加载失败，请尝试其他图片');
          }
        };
        reader.onerror = () => {
          alert('图片读取失败，请尝试其他图片');
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error('图片处理失败:', err);
        alert('图片处理失败，请尝试其他图片');
      }
    }
    e.target.value = '';
  };

  const removeBackgroundImage = () => {
    setBackgroundImage(null);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleFetchModels = async () => {
    if (!apiService.hasApiKey()) {
      setModelFetchError('请先设置API密钥');
      return;
    }
    setIsLoadingModels(true);
    setModelFetchError(null);
    try {
      const models = await apiService.getModels();
      setAvailableModels(models);
      if (models.length > 0 && !models.includes(apiConfig.model)) {
        setApiConfig({ ...apiConfig, model: models[0] });
      }
    } catch (err) {
      setModelFetchError(err instanceof Error ? err.message : '获取模型列表失败');
    } finally {
      setIsLoadingModels(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    loadChatSessions();
  }, []);

  useEffect(() => {
    if (messages.length > 0 && currentSessionId) {
      saveCurrentSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, currentSessionId]);

  const loadChatSessions = () => {
    try {
      const saved = localStorage.getItem('chat-sessions');
      if (saved) {
        const sessions = JSON.parse(saved);
        setChatSessions(sessions);
        if (sessions.length > 0) {
          const latestSession = sessions[0];
          setCurrentSessionId(latestSession.id);
          setMessages(latestSession.messages);
        } else {
          createNewSession();
        }
      } else {
        createNewSession();
      }
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
      createNewSession();
    }
  };

  const saveChatSessions = (sessions: ChatSession[]) => {
    try {
      localStorage.setItem('chat-sessions', JSON.stringify(sessions));
    } catch (error) {
      console.error('Failed to save chat sessions:', error);
    }
  };

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: '新对话',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCurrentSessionId(newSession.id);
    setMessages([]);
    setChatSessions(prev => [newSession, ...prev]);
  };

  const loadSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setShowChatHistory(false);
  };

  const deleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const filtered = chatSessions.filter(s => s.id !== sessionId);
    setChatSessions(filtered);
    saveChatSessions(filtered); // 保存到 localStorage
    if (sessionId === currentSessionId) {
      if (filtered.length > 0) {
        loadSession(filtered[0]);
      } else {
        createNewSession();
      }
    }
  };

  const saveCurrentSession = () => {
    const updatedSessions = chatSessions.map(session => {
      if (session.id === currentSessionId) {
        const title = messages[0]?.content.slice(0, 30) || '新对话';
        return {
          ...session,
          messages,
          title,
          updatedAt: new Date().toISOString(),
        };
      }
      return session;
    });
    setChatSessions(updatedSessions);
    saveChatSessions(updatedSessions);
  };

  const handleSaveApiConfig = () => {
    apiService.setConfig(apiConfig);
    setShowSettings(false);
    setError(null);
  };

  const handleSpeak = (message: ChatMessage) => {
    if (speakingId === message.id) {
      return;
    }
    handleStopSpeaking();
    setSpeakingId(message.id);
    setIsPaused(false);

    // 根据设置决定是否去除标点符号
    const textToSpeak = speechState.removePunctuation
      ? removePunctuationMarks(message.content)
      : message.content;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'zh-CN';
    utterance.rate = speechState.speechRate;
    utterance.volume = speechState.volume;
    utterance.pitch = speechState.pitch;

    if (speechState.selectedVoice) {
      const voice = voices.find(v => v.name === speechState.selectedVoice);
      if (voice) {
        utterance.voice = voice;
      }
    } else {
      const chineseVoice = voices.find(v => v.lang.includes('zh') || v.lang.includes('CN'));
      if (chineseVoice) {
        utterance.voice = chineseVoice;
      }
    }

    utterance.onend = () => {
      setSpeakingId(null);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
  };

  const handleStopSpeaking = () => {
    speechSynthesis.cancel();
    setSpeakingId(null);
    setIsPaused(false);
    utteranceRef.current = null;
  };

  const handlePauseSpeaking = () => {
    if (isPaused) {
      speechSynthesis.resume();
      setIsPaused(false);
    } else {
      speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      // 检查文件大小 (最大 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert(`文件 "${file.name}" 超过 5MB 限制，已跳过`);
        return;
      }

      const newFile: AttachedFile = {
        id: crypto.randomUUID(),
        file,
        type: file.type.startsWith('image/') ? 'image' : 'file',
      };
      
      if (newFile.type === 'image') {
        const reader = new FileReader();
        reader.onload = (event) => {
          const preview = event.target?.result as string;
          setAttachedFiles(prev => [...prev, { ...newFile, preview }]);
        };
        reader.onerror = () => {
          console.error('图片读取失败:', file.name);
          setAttachedFiles(prev => [...prev, newFile]);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachedFiles(prev => [...prev, newFile]);
      }
    });
    e.target.value = '';
  };

  const removeAttachedFile = (fileId: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'zh-CN';
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        if (finalTranscript) {
          setInput(prev => prev + (prev ? ' ' : '') + finalTranscript);
          setTranscript('');
        } else {
          setTranscript(interimTranscript);
        }
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          setIsListening(false);
          setTranscript('');
        }
      };
      
      recognition.onend = () => {
        setIsListening(false);
        setTranscript('');
      };
      
      recognitionRef.current = recognition;
    }
    
    // 清理函数：组件卸载时停止语音识别
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // 忽略停止时的错误
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
      setTranscript('');
    } else {
      recognitionRef.current.start();
      setIsListening(true);
      setTranscript('');
    }
  };

  const handleSend = async () => {
    if (!input.trim() && attachedFiles.length === 0) return;
    
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      attachments: attachedFiles.map(f => ({
        id: f.id,
        name: f.file.name,
        type: f.type,
        size: f.file.size,
        preview: f.preview,
      })),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachedFiles([]);
    setIsLoading(true);
    setError(null);
    setStreamingContent('');
    streamingContentRef.current = '';
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let isAborted = false;
    
    try {
      let enhancedContext = '';
      
      if (webSearchEnabled) {
        setIsSearching(true);
        try {
          const searchResult = await webSearchService.search(userMessage.content);
          if (searchResult) {
            enhancedContext = searchResult;
          }
        } catch (searchError) {
          console.error('Web search failed:', searchError);
        } finally {
          setIsSearching(false);
        }
      }
      
      const messagesForApi = [...messages, userMessage];
      
      if (enhancedContext) {
        messagesForApi.push({
          id: crypto.randomUUID(),
          role: 'user',
          content: `\n\n【网络搜索信息】\n${enhancedContext}\n\n请基于以上信息回答用户问题。`,
          timestamp: new Date(),
        });
      }
      
      await apiService.streamChat(
        messagesForApi,
        (chunk) => {
          if (abortController.signal.aborted) {
            isAborted = true;
            return;
          }
          streamingContentRef.current += chunk;
          setStreamingContent(streamingContentRef.current);
        },
        (model) => {
          if (isAborted || abortController.signal.aborted) {
            if (streamingContentRef.current) {
              const assistantMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: streamingContentRef.current + ' (已中断)',
                timestamp: new Date(),
                model,
              };
              setMessages(prev => [...prev, assistantMessage]);
            }
          } else {
            const assistantMessage: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: streamingContentRef.current,
              timestamp: new Date(),
              model,
            };
            setMessages(prev => [...prev, assistantMessage]);
          }
          setStreamingContent('');
          streamingContentRef.current = '';
          setIsLoading(false);
          abortControllerRef.current = null;
        },
        (err) => {
          if (err.name !== 'AbortError' && !abortController.signal.aborted) {
            setError(err.message);
          }
          if (streamingContentRef.current) {
            const assistantMessage: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: streamingContentRef.current,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, assistantMessage]);
          }
          setStreamingContent('');
          streamingContentRef.current = '';
          setIsLoading(false);
          abortControllerRef.current = null;
        },
        abortController.signal
      );
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setError((err as Error).message || '发生未知错误');
      }
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading) {
        handleSend();
      }
    }
  };

  if (isFullscreen) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: backgroundImage ? 'transparent' : '#f5f5f5',
        }}
      >
        {!backgroundImage && (
          <div className="absolute inset-0 bg-[#ededed]" />
        )}

        <div className={`relative z-10 flex items-center px-3 py-2 ${
            (topBarTransparent || (bubbleTransparent && backgroundImage)) 
              ? 'bg-transparent border-b border-transparent' 
              : 'bg-white/95 backdrop-blur-sm border-b border-gray-200'
          } shrink-0`}>
          <button
            onClick={() => setIsFullscreen(false)}
            className="p-2 text-gray-700 hover:text-gray-900 transition-colors"
            title="退出全屏"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </svg>
          </button>
          <div className="flex-1 flex items-center justify-center gap-2">
            <span className="text-lg">🤖</span>
            <h1 className="text-base font-semibold text-gray-800">AI 助手</h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowColorSettings(!showColorSettings)}
              className="p-2 text-gray-700 hover:text-gray-900 transition-colors"
              title="显示设置"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </button>
          </div>
        </div>

        {showColorSettings && (
          <div className="relative z-10 bg-white/90 backdrop-blur-sm rounded-b-2xl shadow-sm border border-gray-200 p-4 mx-4 mt-2 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">显示设置</h2>
              <button
                onClick={() => setShowColorSettings(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">背景图片</label>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBackgroundImageUpload}
                    className="hidden"
                    id="ai-bg-upload-fs"
                  />
                  <label
                    htmlFor="ai-bg-upload-fs"
                    className="flex-1 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-center cursor-pointer hover:border-golden hover:bg-golden/5 transition-colors"
                  >
                    <span className="text-gray-500">点击上传背景图片</span>
                  </label>
                  {backgroundImage && (
                    <button
                      onClick={removeBackgroundImage}
                      className="px-4 py-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                    >
                      移除
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">用户文字颜色</label>
                <input
                  type="color"
                  value={userTextColor}
                  onChange={(e) => setUserTextColor(e.target.value)}
                  className="w-full h-12 rounded-xl cursor-pointer"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">AI文字颜色</label>
                <input
                  type="color"
                  value={aiTextColor}
                  onChange={(e) => setAiTextColor(e.target.value)}
                  className="w-full h-12 rounded-xl cursor-pointer"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">文字大小: {(textScale * 100).toFixed(0)}%</label>
                <input
                  type="range"
                  min="0.7"
                  max="1.5"
                  step="0.1"
                  value={textScale}
                  onChange={(e) => setTextScale(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">顶部栏透明</label>
                <button
                  onClick={() => setTopBarTransparent(!topBarTransparent)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    topBarTransparent ? 'bg-golden' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    topBarTransparent ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">输入栏透明</label>
                <button
                  onClick={() => setInputBarTransparent(!inputBarTransparent)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    inputBarTransparent ? 'bg-golden' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    inputBarTransparent ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">气泡透明</label>
                <button
                  onClick={() => setBubbleTransparent(!bubbleTransparent)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    bubbleTransparent ? 'bg-golden' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    bubbleTransparent ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="relative z-10 flex-1 flex flex-col min-h-0">
          <div className={`flex-1 flex flex-col mx-2 my-2 rounded-2xl overflow-hidden ${
            bubbleTransparent && backgroundImage 
              ? 'bg-transparent border-transparent shadow-none' 
              : (backgroundImage ? 'bg-white/80 backdrop-blur-sm border-white/20 shadow-none' : 'bg-white border-gray-100 shadow-sm')
          }`}>
            <div className={`flex-1 overflow-y-auto p-3 space-y-3 ${
              bubbleTransparent && backgroundImage ? 'bg-transparent' : ''
            }`}>
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🤖</div>
                  <h2 className="text-base font-semibold text-gray-800 mb-1.5">你好，我是金线 AI 助手</h2>
                  <p className="text-gray-500 max-w-md mx-auto mb-4 text-sm">
                    我可以帮你：<br />
                    设计行动协议 · 优化习惯养成 · 解决执行卡点
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-center max-w-md mx-auto">
                    <QuickQuestion
                      text="如何设计一个好的行动协议？"
                      onClick={() => setInput('如何设计一个好的行动协议？')}
                    />
                    <QuickQuestion
                      text="连续失败后怎么调整？"
                      onClick={() => setInput('连续失败后怎么调整？')}
                    />
                    <QuickQuestion
                      text="如何养成早起的习惯？"
                      onClick={() => setInput('如何养成早起的习惯？')}
                    />
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} px-1`}
                    >
                      <div className={`max-w-[85%] flex items-start gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        {message.role === 'assistant' && (
                          <div className={`w-10 h-10 rounded-full ${
                            bubbleTransparent && backgroundImage 
                              ? 'bg-transparent' 
                              : (backgroundImage ? 'bg-white/60' : 'bg-white/80')
                          } backdrop-blur-sm flex items-center justify-center text-lg shrink-0 shadow-sm`}>
                            🤖
                          </div>
                        )}
                        <div className={`relative ${message.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                          <div
                            className={`px-3.5 py-2.5 ${
                              backgroundImage
                                ? `shadow-none`
                                : `${message.role === 'user' ? 'bg-[#95ec69] rounded-br-sm' : 'bg-white rounded-bl-sm'} rounded-xl shadow-sm`
                            }`}
                            style={{
                              color: message.role === 'user' ? userTextColor : aiTextColor,
                              backgroundColor: bubbleTransparent && backgroundImage ? 'transparent' : (backgroundImage ? (message.role === 'user' ? 'rgba(149, 236, 105, 0.9)' : 'rgba(255, 255, 255, 0.9)') : undefined),
                            }}
                          >
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mb-2 flex flex-wrap gap-2">
                                {message.attachments.map((attachment) => (
                                  <div
                                    key={attachment.id}
                                    className="bg-white/20 rounded-lg p-2 border border-white/30"
                                  >
                                    {attachment.type === 'image' && attachment.preview ? (
                                      <img
                                        src={attachment.preview}
                                        alt={attachment.name}
                                        className="w-32 h-32 object-cover rounded"
                                      />
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <div>
                                          <p className="text-xs text-gray-700">{attachment.name}</p>
                                          <p className="text-xs text-gray-400">{formatFileSize(attachment.size)}</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            <p className="whitespace-pre-wrap font-medium" style={{ fontSize: `${16 * textScale}px` }}>{message.content}</p>
                          </div>
                          {message.role === 'assistant' && (
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex items-center gap-1">
                                {speakingId === message.id ? (
                                  <>
                                    <button
                                      onClick={handlePauseSpeaking}
                                      className="p-1 text-gray-500 hover:text-gray-700"
                                    >
                                      {isPaused ? (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      )}
                                    </button>
                                    <button
                                      onClick={handleStopSpeaking}
                                      className="p-1 text-gray-500 hover:text-gray-700"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                                      </svg>
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleSpeak(message)}
                                    className="p-1 text-gray-500 hover:text-gray-700"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                              {message.model && (
                                <span className="text-[10px] text-gray-400 ml-1">{message.model}</span>
                              )}
                            </div>
                          )}
                        </div>
                        {message.role === 'user' && (
                          <div className={`w-10 h-10 rounded-full ${backgroundImage ? 'bg-[#95ec69]/60' : 'bg-[#95ec69]/80'} backdrop-blur-sm flex items-center justify-center text-lg shrink-0 shadow-sm`}>
                            👤
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {streamingContent && (
                    <div className="flex justify-start px-1">
                      <div className="max-w-[85%] flex items-start gap-2">
                        <div className={`w-10 h-10 rounded-full ${backgroundImage ? 'bg-white/60' : 'bg-white/80'} backdrop-blur-sm flex items-center justify-center text-lg shrink-0 shadow-sm`}>
                          🤖
                        </div>
                        <div className="relative items-start flex flex-col">
                          <div
                            className={`px-3.5 py-2.5 ${backgroundImage ? 'shadow-none' : 'bg-white rounded-bl-sm rounded-xl shadow-sm'}`}
                            style={{
                              color: aiTextColor,
                              backgroundColor: bubbleTransparent && backgroundImage ? 'transparent' : (backgroundImage ? 'rgba(255, 255, 255, 0.9)' : undefined),
                            }}
                          >
                            <p className="whitespace-pre-wrap font-medium" style={{ fontSize: `${16 * textScale}px` }}>{streamingContent}</p>
                            <span className="inline-block w-1.5 h-4 ml-1 align-middle animate-pulse" style={{ backgroundColor: aiTextColor }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className={`p-3 border-t shrink-0 ${
              (inputBarTransparent || (bubbleTransparent && backgroundImage)) 
                ? 'bg-transparent border-transparent' 
                : (backgroundImage ? 'bg-white/50 border-white/20' : 'bg-white border-gray-100')
            }`}>
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {attachedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg"
                    >
                      {file.type === 'image' && file.preview ? (
                        <img
                          src={file.preview}
                          alt={file.file.name}
                          className="w-8 h-8 object-cover rounded"
                        />
                      ) : (
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                      <span className="text-xs text-gray-700 truncate max-w-[100px]">{file.file.name}</span>
                      <button
                        onClick={() => removeAttachedFile(file.id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {isLoading && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3.5 h-3.5 border-2 border-golden/30 border-t-golden rounded-full animate-spin" />
                  <span className="text-xs text-gray-600">
                    {isSearching ? '搜索网络中...' : '思考中...'}
                  </span>
                  <button
                    onClick={handleStopGeneration}
                    className="ml-auto text-xs text-red-500 hover:text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    中断
                  </button>
                </div>
              )}

              <div className="flex gap-2 items-end">
                <div className="flex gap-1">
                  <input
                    type="file"
                    ref={imageInputRef}
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isLoading}
                    className="p-2.5 text-gray-500 hover:text-golden hover:bg-golden/10 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="上传图片"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="p-2.5 text-gray-500 hover:text-golden hover:bg-golden/10 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="上传文件"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                  <button
                    onClick={toggleListening}
                    disabled={isLoading}
                    className={`p-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isListening
                        ? 'text-red-500 bg-red-50 animate-pulse'
                        : 'text-gray-500 hover:text-golden hover:bg-golden/10'
                    }`}
                    title="语音输入"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1 relative">
                  <textarea
                    value={isListening && transcript ? input + (input ? ' ' : '') + transcript : input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={isListening ? '正在聆听...' : ''}
                    disabled={isLoading || !apiService.hasApiKey()}
                    className={`w-full px-3 py-2.5 rounded-lg outline-none resize-none max-h-28 text-base ${
                      inputBarTransparent
                        ? 'bg-white/80 backdrop-blur-sm border border-white/30 text-black placeholder-gray-500'
                        : 'border border-gray-300 text-black placeholder-gray-500'
                    }`}
                    rows={1}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                  />
                  {isListening && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-xs text-gray-400">聆听中</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={isLoading ? handleStopGeneration : handleSend}
                  disabled={!isLoading && !input.trim() && attachedFiles.length === 0 || !apiService.hasApiKey()}
                  className={`px-4 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-1.5 ${
                    isLoading
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : !input.trim() && attachedFiles.length === 0 || !apiService.hasApiKey()
                      ? 'bg-gray-300 text-gray-50 cursor-not-allowed'
                      : 'bg-[#07c160] text-white hover:opacity-90'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      </svg>
                      中断
                    </>
                  ) : (
                    <>
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      发送
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="max-w-6xl mx-auto px-4 py-8 flex flex-col h-[calc(100vh-140px)] relative"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: backgroundImage ? 'transparent' : '#f5f5f5',
      }}
    >
      
      <div className="relative z-10 flex items-center gap-4 mb-6 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-800">AI 助手</h1>
          <p className="text-gray-500 mt-1">智能对话助手</p>
        </div>
        <div className="flex-1"></div>
        <button
          onClick={() => setShowColorSettings(!showColorSettings)}
          className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
          title="显示设置"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        </button>
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
          title={isFullscreen ? "退出全屏" : "全屏模式"}
        >
          {isFullscreen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
          title="设置"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 0 00-1.066 2.573c-.94 1.543-.826 3.31-2.37 2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {showSettings && (
        <div className="relative z-10 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 shrink-0 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4 sticky top-0 bg-white z-10 pt-1">
            <h2 className="text-lg font-semibold text-gray-800">设置</h2>
            <button
              onClick={() => setShowSettings(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">API 配置</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">API 提供商</label>
                  <select
                    value={apiConfig.provider}
                    onChange={(e) => {
                      const provider = e.target.value as 'deepseek' | 'custom';
                      let newConfig = { ...apiConfig, provider };
                      if (provider === 'deepseek') {
                        newConfig.baseUrl = 'https://api.deepseek.com/v1';
                        newConfig.model = 'deepseek-chat';
                      } else if (provider === 'custom') {
                        newConfig.baseUrl = '';
                        newConfig.model = '';
                      }
                      setApiConfig(newConfig);
                      setAvailableModels([]);
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none"
                  >
                    <option value="deepseek">DeepSeek</option>
                    <option value="custom">自定义 (兼容 OpenAI 格式)</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">API 密钥</label>
                  <input
                    type="password"
                    value={apiConfig.apiKey}
                    onChange={(e) => setApiConfig({ ...apiConfig, apiKey: e.target.value })}
                    placeholder={apiConfig.provider === 'deepseek' ? 'sk-xxxxxxxxxxxxxxxxxxxxxxxx' : '输入 API 密钥'}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none"
                  />
                </div>

                {apiConfig.provider === 'custom' && (
                  <div>
                    <label className="text-sm text-gray-500 mb-2 block">API 基础 URL</label>
                    <input
                      type="text"
                      value={apiConfig.baseUrl}
                      onChange={(e) => setApiConfig({ ...apiConfig, baseUrl: e.target.value })}
                      placeholder="https://api.example.com/v1"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none"
                    />
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-gray-500">模型选择</label>
                    <button
                      onClick={handleFetchModels}
                      disabled={isLoadingModels || !apiConfig.apiKey}
                      className="text-xs px-3 py-1 bg-golden/10 text-golden rounded-lg hover:bg-golden/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {isLoadingModels ? (
                        <>
                          <div className="w-3 h-3 border border-golden/30 border-t-golden rounded-full animate-spin" />
                          加载中...
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          刷新模型
                        </>
                      )}
                    </button>
                  </div>
                  {availableModels.length > 0 ? (
                    <div className="space-y-2">
                      <select
                        value={apiConfig.model}
                        onChange={(e) => setApiConfig({ ...apiConfig, model: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none"
                      >
                        {availableModels.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setAvailableModels([])}
                        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        切换为手动输入
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={apiConfig.model}
                        onChange={(e) => setApiConfig({ ...apiConfig, model: e.target.value })}
                        placeholder={apiConfig.provider === 'deepseek' ? 'deepseek-chat' : '例如：GLM-4, gpt-4, claude-3-opus'}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none"
                      />
                      {modelFetchError && (
                        <p className="text-xs text-red-500">{modelFetchError}</p>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-500">
                  {apiConfig.provider === 'deepseek'
                    ? '获取 API 密钥：<a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" className="text-golden hover:underline">platform.deepseek.com</a>'
                    : '支持所有兼容 OpenAI Chat Completions API 格式的接口'
                  }
                </p>

                <button
                  onClick={handleSaveApiConfig}
                  className="w-full px-4 py-3 bg-golden text-white rounded-xl hover:opacity-90 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  保存 API 配置
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">联网搜索配置</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">启用联网搜索</label>
                    <p className="text-xs text-gray-500 mt-1">搜索网络获取实时信息</p>
                  </div>
                  <button
                    onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      webSearchEnabled ? 'bg-golden' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      webSearchEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                
                {webSearchEnabled && (
                  <>
                    <div>
                      <label className="text-sm text-gray-500 mb-2 block">SerpAPI 密钥</label>
                      <input
                        type="password"
                        value={serpApiKey}
                        onChange={(e) => setSerpApiKey(e.target.value)}
                        placeholder="输入 SerpAPI 密钥"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        获取 SerpAPI 密钥：<a href="https://serpapi.com/" target="_blank" rel="noopener noreferrer" className="text-golden hover:underline">serpapi.com</a>
                      </p>
                    </div>
                    
                    <div>
                      <label className="text-sm text-gray-500 mb-2 block">OpenWeather API 密钥</label>
                      <input
                        type="password"
                        value={openWeatherApiKey}
                        onChange={(e) => setOpenWeatherApiKey(e.target.value)}
                        placeholder="输入 OpenWeather API 密钥"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        获取 OpenWeather API 密钥：<a href="https://openweathermap.org/api" target="_blank" rel="noopener noreferrer" className="text-golden hover:underline">openweathermap.org</a>
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">语音朗读设置</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">语速: {speechState.speechRate.toFixed(1)}x</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.1"
                    value={speechState.speechRate}
                    onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">音量: {Math.round(speechState.volume * 100)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={speechState.volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">音调: {speechState.pitch.toFixed(1)}</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={speechState.pitch}
                    onChange={(e) => setPitch(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">去除标点符号</label>
                    <p className="text-xs text-gray-500 mt-1">用停顿代替标点，朗读更流畅</p>
                  </div>
                  <button
                    onClick={() => setRemovePunctuation(!speechState.removePunctuation)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      speechState.removePunctuation ? 'bg-golden' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      speechState.removePunctuation ? 'translate-x-7' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">选择声音</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={speechState.selectedVoice}
                      onChange={(e) => setSelectedVoiceInSpeech(e.target.value)}
                      className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none"
                    >
                      <option value="">系统默认声音</option>
                      {voices.map((voice) => (
                        <option key={voice.name} value={voice.name}>
                          {voice.name} ({voice.lang})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => testVoice(speechState.selectedVoice)}
                      className="px-4 py-3 bg-golden text-white rounded-xl hover:opacity-90 transition-colors"
                    >
                      测试
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showColorSettings && (
        <div className="relative z-10 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 shrink-0 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4 sticky top-0 bg-white z-10 pt-1">
            <h2 className="text-lg font-semibold text-gray-800">显示设置</h2>
            <button
              onClick={() => setShowColorSettings(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">背景图片</label>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBackgroundImageUpload}
                  className="hidden"
                  id="ai-bg-upload"
                />
                <label
                  htmlFor="ai-bg-upload"
                  className="flex-1 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-center cursor-pointer hover:border-golden hover:bg-golden/5 transition-colors"
                >
                  <span className="text-gray-500">点击上传背景图片</span>
                </label>
                {backgroundImage && (
                  <button
                    onClick={removeBackgroundImage}
                    className="px-4 py-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                  >
                    移除
                  </button>
                )}
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">用户文字颜色</label>
              <input
                type="color"
                value={userTextColor}
                onChange={(e) => setUserTextColor(e.target.value)}
                className="w-full h-12 rounded-xl cursor-pointer"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">AI文字颜色</label>
              <input
                type="color"
                value={aiTextColor}
                onChange={(e) => setAiTextColor(e.target.value)}
                className="w-full h-12 rounded-xl cursor-pointer"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">文字大小: {(textScale * 100).toFixed(0)}%</label>
              <input
                type="range"
                min="0.7"
                max="1.5"
                step="0.1"
                value={textScale}
                onChange={(e) => setTextScale(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">顶部栏透明</label>
              <button
                onClick={() => setTopBarTransparent(!topBarTransparent)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  topBarTransparent ? 'bg-golden' : 'bg-gray-300'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  topBarTransparent ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">输入栏透明</label>
              <button
                onClick={() => setInputBarTransparent(!inputBarTransparent)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  inputBarTransparent ? 'bg-golden' : 'bg-gray-300'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  inputBarTransparent ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">气泡透明</label>
              <button
                onClick={() => setBubbleTransparent(!bubbleTransparent)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  bubbleTransparent ? 'bg-golden' : 'bg-gray-300'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  bubbleTransparent ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="relative z-10 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 shrink-0">
          {error}
        </div>
      )}

      <div className="relative z-10 flex-1 flex flex-col min-h-0">
        <div className={`rounded-2xl shadow-sm border flex flex-col flex-1 min-h-0 ${
          backgroundImage ? 'bg-white/80 backdrop-blur-sm border-white/20' : 'bg-white border-gray-100'
        }`}>
          <div className={`p-3 border-b shrink-0 ${
            topBarTransparent ? 'bg-transparent border-transparent' : (backgroundImage ? 'bg-white/50 border-white/20' : 'bg-white border-gray-100')
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">💬</span>
                <h3 className="font-semibold text-gray-800">对话</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (messages.length > 0) {
                      if (confirm('确定要开启新聊天吗？当前对话内容将被保存到历史记录。')) {
                        createNewSession();
                      }
                    } else {
                      createNewSession();
                    }
                  }}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm flex items-center gap-1.5 hover:bg-gray-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  新聊天
                </button>
                <button
                  onClick={() => setShowChatHistory(!showChatHistory)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm flex items-center gap-1.5 hover:bg-gray-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  聊天历史
                </button>
              </div>
            </div>
          </div>

          {showChatHistory && (
            <div className="bg-white border-b border-gray-200 p-4 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">聊天历史</h2>
                <span className="text-sm text-gray-500">{chatSessions.length} 个对话</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {chatSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => loadSession(session)}
                    className={`p-3 rounded-xl cursor-pointer transition-colors ${
                      session.id === currentSessionId
                        ? 'bg-golden/10 border border-golden/30'
                        : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${
                          session.id === currentSessionId ? 'text-golden' : 'text-gray-800'
                        }`}>
                          {session.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(session.updatedAt).toLocaleDateString('zh-CN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <button
                        onClick={(e) => deleteSession(e, session.id)}
                        className="ml-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">🤖</div>
                <h2 className="text-base font-semibold text-gray-800 mb-1.5">你好，我是金线 AI 助手</h2>
                <p className="text-gray-500 max-w-md mx-auto mb-4 text-sm">
                  我可以帮你：<br />
                  设计行动协议 · 优化习惯养成 · 解决执行卡点
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center max-w-md mx-auto">
                  <QuickQuestion
                    text="如何设计一个好的行动协议？"
                    onClick={() => setInput('如何设计一个好的行动协议？')}
                  />
                  <QuickQuestion
                    text="连续失败后怎么调整？"
                    onClick={() => setInput('连续失败后怎么调整？')}
                  />
                  <QuickQuestion
                    text="如何养成早起的习惯？"
                    onClick={() => setInput('如何养成早起的习惯？')}
                  />
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} px-2`}
                  >
                    <div className={`max-w-[75%] flex items-start gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      {message.role === 'assistant' && (
                        <div className={`w-10 h-10 rounded-full ${backgroundImage ? 'bg-white/60' : 'bg-white/80'} backdrop-blur-sm flex items-center justify-center text-lg shrink-0 shadow-sm`}>
                          🤖
                        </div>
                      )}
                      <div className={`relative ${message.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                        <div
                          className={`px-3.5 py-2.5 ${
                            backgroundImage 
                              ? `shadow-none`
                              : `${message.role === 'user' ? 'bg-[#95ec69] rounded-br-sm' : 'bg-white rounded-bl-sm'} rounded-xl shadow-sm`
                          }`}
                          style={{
                            color: message.role === 'user' ? userTextColor : aiTextColor,
                            backgroundColor: bubbleTransparent && backgroundImage ? 'transparent' : (backgroundImage ? (message.role === 'user' ? 'rgba(149, 236, 105, 0.8)' : 'rgba(255, 255, 255, 0.8)') : undefined),
                          }}
                        >
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-2">
                              {message.attachments.map((attachment) => (
                                <div
                                  key={attachment.id}
                                  className="bg-white/20 rounded-lg p-2 border border-white/30"
                                >
                                  {attachment.type === 'image' && attachment.preview ? (
                                    <img
                                      src={attachment.preview}
                                      alt={attachment.name}
                                      className="w-32 h-32 object-cover rounded"
                                    />
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      <div>
                                        <p className="text-xs text-gray-700">{attachment.name}</p>
                                        <p className="text-xs text-gray-400">{formatFileSize(attachment.size)}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="whitespace-pre-wrap font-medium" style={{ fontSize: `${14 * textScale}px` }}>{message.content}</p>
                        </div>
                        {message.role === 'assistant' && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                              {speakingId === message.id ? (
                                <>
                                  <button
                                    onClick={handlePauseSpeaking}
                                    className="p-1 text-gray-500 hover:text-gray-700"
                                  >
                                    {isPaused ? (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    )}
                                  </button>
                                  <button
                                    onClick={handleStopSpeaking}
                                    className="p-1 text-gray-500 hover:text-gray-700"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                                    </svg>
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleSpeak(message)}
                                  className="p-1 text-gray-500 hover:text-gray-700"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                            {message.model && (
                              <span className="text-[10px] text-gray-400 ml-1">{message.model}</span>
                            )}
                          </div>
                        )}
                      </div>
                      {message.role === 'user' && (
                        <div className={`w-10 h-10 rounded-full ${backgroundImage ? 'bg-[#95ec69]/60' : 'bg-[#95ec69]/80'} backdrop-blur-sm flex items-center justify-center text-lg shrink-0 shadow-sm`}>
                          👤
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {streamingContent && (
                  <div className="flex justify-start px-1">
                    <div className="max-w-[75%] flex items-start gap-2">
                      <div className={`w-10 h-10 rounded-full ${backgroundImage ? 'bg-white/60' : 'bg-white/80'} backdrop-blur-sm flex items-center justify-center text-lg shrink-0 shadow-sm`}>
                        🤖
                      </div>
                      <div className="relative items-start flex flex-col">
                        <div 
                          className={`px-3.5 py-2.5 ${backgroundImage ? 'shadow-none' : 'bg-white rounded-bl-sm rounded-xl shadow-sm'}`}
                          style={{ 
                            color: aiTextColor,
                            backgroundColor: bubbleTransparent && backgroundImage ? 'transparent' : (backgroundImage ? 'rgba(255, 255, 255, 0.8)' : undefined),
                          }}
                        >
                          <p className="whitespace-pre-wrap font-medium" style={{ fontSize: `${14 * textScale}px` }}>{streamingContent}</p>
                          <span className="inline-block w-1.5 h-4 ml-1 align-middle animate-pulse" style={{ backgroundColor: aiTextColor }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className={`p-3 border-t shrink-0 ${
            inputBarTransparent ? 'bg-transparent border-transparent' : (backgroundImage ? 'bg-white/50 border-white/20' : 'bg-white border-gray-100')
          }`}>
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg"
                  >
                    {file.type === 'image' && file.preview ? (
                      <img
                        src={file.preview}
                        alt={file.file.name}
                        className="w-8 h-8 object-cover rounded"
                      />
                    ) : (
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                    <span className="text-xs text-gray-700 truncate max-w-[100px]">{file.file.name}</span>
                    <button
                      onClick={() => removeAttachedFile(file.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {isLoading && (
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3.5 h-3.5 border-2 border-golden/30 border-t-golden rounded-full animate-spin" />
                <span className="text-xs text-gray-600">
                  {isSearching ? '搜索网络中...' : '思考中...'}
                </span>
                <button
                  onClick={handleStopGeneration}
                  className="ml-auto text-xs text-red-500 hover:text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors"
                >
                  中断
                </button>
              </div>
            )}
            
            <div className="flex gap-2 items-end">
              <div className="flex gap-1">
                <input
                  type="file"
                  ref={imageInputRef}
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isLoading}
                  className="p-2.5 text-gray-500 hover:text-golden hover:bg-golden/10 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="上传图片"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="p-2.5 text-gray-500 hover:text-golden hover:bg-golden/10 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="上传文件"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
                
                <button
                  onClick={toggleListening}
                  disabled={isLoading}
                  className={`p-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isListening
                      ? 'text-red-500 bg-red-50 animate-pulse'
                      : 'text-gray-500 hover:text-golden hover:bg-golden/10'
                  }`}
                  title="语音输入"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              </div>
              
              <div className="flex-1 relative">
                <textarea
                  value={isListening && transcript ? input + (input ? ' ' : '') + transcript : input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={isListening ? '正在聆听...' : ''}
                  disabled={isLoading || !apiService.hasApiKey()}
                  className={`w-full px-3 py-2.5 rounded-lg outline-none resize-none max-h-28 text-sm ${
                    inputBarTransparent 
                      ? 'bg-transparent border border-white/30 text-white placeholder-white/50'
                      : 'border border-gray-300 text-black placeholder-gray-500'
                  }`}
                  rows={1}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                {isListening && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-xs text-gray-400">聆听中</span>
                  </div>
                )}
              </div>
              
              <button
                onClick={isLoading ? handleStopGeneration : handleSend}
                disabled={!isLoading && !input.trim() && attachedFiles.length === 0 || !apiService.hasApiKey()}
                className={`px-4 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-1.5 ${
                  isLoading
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : !input.trim() && attachedFiles.length === 0 || !apiService.hasApiKey()
                    ? 'bg-gray-300 text-gray-50 cursor-not-allowed'
                    : 'bg-[#07c160] text-white hover:opacity-90'
                }`}
              >
                {isLoading ? (
                  <>
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                    中断
                  </>
                ) : (
                  <>
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    发送
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
