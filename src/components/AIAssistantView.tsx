import React, { useState, useEffect, useRef } from 'react';
import { apiService, ChatMessage, ApiConfig } from '../services/apiService';
import { webSearchService } from '../services/webSearchService';
import { useSpeech } from '../context/SpeechContext';

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

export default function AIAssistantView() {
  const { speechState, voices, setSpeechRate, setSelectedVoice: setSelectedVoiceInSpeech, testVoice } = useSpeech();
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
    return localStorage.getItem('web-search-enabled') === 'true';
  });
  const [isSearching, setIsSearching] = useState(false);
  const [serpApiKey, setSerpApiKey] = useState(() => {
    return localStorage.getItem('serp-api-key') || '';
  });
  const [openWeatherApiKey, setOpenWeatherApiKey] = useState(() => {
    return localStorage.getItem('openweather-api-key') || '';
  });
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [backgroundImage, setBackgroundImage] = useState<string>(() => {
    return localStorage.getItem('ai-assistant-background') || '';
  });
  const [userTextColor, setUserTextColor] = useState<string>(() => {
    return localStorage.getItem('ai-assistant-user-text-color') || '#000000';
  });
  const [aiTextColor, setAiTextColor] = useState<string>(() => {
    return localStorage.getItem('ai-assistant-ai-text-color') || '#000000';
  });
  const [textScale, setTextScale] = useState<number>(() => {
    const saved = localStorage.getItem('ai-assistant-text-scale');
    return saved ? parseFloat(saved) : 1;
  });
  const [showColorSettings, setShowColorSettings] = useState(false);

  const topBarTransparent = !!backgroundImage;
  const inputBarTransparent = !!backgroundImage;

  useEffect(() => {
    localStorage.setItem('web-search-enabled', webSearchEnabled.toString());
  }, [webSearchEnabled]);

  useEffect(() => {
    webSearchService.setSerpApiKey(serpApiKey);
    webSearchService.setOpenWeatherApiKey(openWeatherApiKey);
  }, [serpApiKey, openWeatherApiKey]);

  useEffect(() => {
    localStorage.setItem('ai-assistant-background', backgroundImage);
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

  const handleBackgroundImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setBackgroundImage(dataUrl);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const removeBackgroundImage = () => {
    setBackgroundImage('');
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
  }, [messages]);

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

  const saveCurrentSession = () => {
    setChatSessions(prev => {
      const updated = prev.map(session => {
        if (session.id === currentSessionId) {
          const title = messages.length > 0 
            ? messages[0].content.substring(0, 30) + (messages[0].content.length > 30 ? '...' : '')
            : '新对话';
          return {
            ...session,
            messages,
            title,
            updatedAt: new Date().toISOString(),
          };
        }
        return session;
      });
      saveChatSessions(updated);
      return updated;
    });
  };

  const initSpeechRecognition = () => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'zh-CN';
        
        recognition.onstart = () => {
          setIsListening(true);
        };
        
        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          setInput(transcript);
        };
        
        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };
        
        recognition.onend = () => {
          setIsListening(false);
        };
        
        recognitionRef.current = recognition;
      }
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      initSpeechRecognition();
    }
    
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const isImage = file.type.startsWith('image/');
      const attachedFile: AttachedFile = {
        id: crypto.randomUUID(),
        file,
        type: isImage ? 'image' : 'file',
      };
      
      if (isImage) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setAttachedFiles(prev => [
            ...prev,
            { ...attachedFile, preview: event.target?.result as string }
          ]);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachedFiles(prev => [...prev, attachedFile]);
      }
    });
    e.target.value = '';
  };

  const removeAttachedFile = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const loadSession = (session: ChatSession) => {
    if (isLoading) return;
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setShowChatHistory(false);
    setStreamingContent('');
    streamingContentRef.current = '';
  };

  const deleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setChatSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      saveChatSessions(updated);
      if (sessionId === currentSessionId && updated.length > 0) {
        setCurrentSessionId(updated[0].id);
        setMessages(updated[0].messages);
      } else if (updated.length === 0) {
        createNewSession();
      }
      return updated;
    });
  };

  const handleSaveApiConfig = () => {
    apiService.setConfig(apiConfig);
    setShowSettings(false);
    setError(null);
  };

  const handleSend = async () => {
    if (!input.trim() && attachedFiles.length === 0) return;
    if (isLoading) return;

    if (!apiService.hasApiKey()) {
      setShowSettings(true);
      return;
    }

    setError(null);
    
    let messageContent = input.trim();
    
    if (attachedFiles.length > 0) {
      const fileInfos = attachedFiles.map(f => 
        `[${f.type === 'image' ? '图片' : '文件'}: ${f.file.name} (${formatFileSize(f.file.size)})]`
      ).join('\n');
      
      if (messageContent) {
        messageContent = fileInfos + '\n\n' + messageContent;
      } else {
        messageContent = fileInfos;
      }
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageContent,
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
    setStreamingContent('');
    streamingContentRef.current = '';

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let isAborted = false;

    try {
      let conversationHistory: ChatMessage[];
      
      if (webSearchEnabled) {
        setIsSearching(true);
        let searchContext = '';
        
        try {
          const searchResults = await webSearchService.searchWeb(userMessage.content);
          console.log('=== 搜索结果调试 ===');
          console.log('搜索结果数量:', searchResults.length);
          console.log('搜索结果详情:', searchResults);
          
          searchContext = webSearchService.buildSearchContext(userMessage.content, searchResults);
          
          const lowerQuery = userMessage.content.toLowerCase();
          if (lowerQuery.includes('币') || lowerQuery.includes('crypto') || lowerQuery.includes('比特币') || lowerQuery.includes('以太')) {
            const cryptoData = await webSearchService.getCryptoPrices();
            const cryptoContext = webSearchService.buildCryptoContext(cryptoData);
            if (cryptoContext) {
              searchContext += '\n\n' + cryptoContext;
            }
          }
        } catch (searchErr) {
          console.error('Search error:', searchErr);
        } finally {
          setIsSearching(false);
        }

        let systemPrompt = searchContext 
          ? '你是一个专业的信息助手。请严格按照以下搜索结果来回答用户的问题。'
          : '你是一个专业的习惯养成和行动规划助手，专门帮助用户把认知转化为可执行系统。请用简洁、实用的方式回答问题，重点关注具体的行动建议。';
        
        if (searchContext) {
          systemPrompt = searchContext;
        }

        conversationHistory = [
          {
            id: crypto.randomUUID(),
            role: 'user',
            content: systemPrompt,
            timestamp: new Date(),
          } as ChatMessage,
          ...messages,
          userMessage,
        ];
      } else {
        const systemPrompt = '你是一个专业的习惯养成和行动规划助手，专门帮助用户把认知转化为可执行系统。请用简洁、实用的方式回答问题，重点关注具体的行动建议。';
        conversationHistory = [
          {
            id: crypto.randomUUID(),
            role: 'user',
            content: systemPrompt,
            timestamp: new Date(),
          } as ChatMessage,
          ...messages,
          userMessage,
        ];
      }

      await apiService.streamChat(
        conversationHistory,
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
            const assistantMessage: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: streamingContentRef.current + ' (已中断)',
              timestamp: new Date(),
              model,
            };
            setMessages(prev => [...prev, assistantMessage]);
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
          if (err.name === 'AbortError' || abortController.signal.aborted) {
            if (streamingContentRef.current) {
              const assistantMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: streamingContentRef.current + ' (已中断)',
                timestamp: new Date(),
                model: apiConfig.model,
              };
              setMessages(prev => [...prev, assistantMessage]);
            }
          } else {
            setError(err.message);
            if (streamingContentRef.current) {
              const assistantMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: streamingContentRef.current,
                timestamp: new Date(),
                model: apiConfig.model,
              };
              setMessages(prev => [...prev, assistantMessage]);
            }
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
        setError(err instanceof Error ? err.message : '发生未知错误');
      }
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTextForSpeech = (text: string) => {
    return text
      .replace(/[。！？!?…]/g, '$& ')
      .replace(/[，,；;：:]/g, '$& ')
      .replace(/[、「」『』（）［］【】《》〈〉\(\)\[\]{}<>\"'\/#$%^&*\-_=+`~|]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const handleSpeak = (message: ChatMessage) => {
    if (!('speechSynthesis' in window)) {
      alert('您的浏览器不支持语音朗读功能');
      return;
    }

    window.speechSynthesis.cancel();

    const formattedText = formatTextForSpeech(message.content);
    const utterance = new SpeechSynthesisUtterance(formattedText);
    utterance.lang = 'zh-CN';
    utterance.rate = speechState.speechRate;
    utterance.pitch = 1;

    if (speechState.selectedVoice) {
      const voice = voices.find(v => v.name === speechState.selectedVoice);
      if (voice) {
        utterance.voice = voice;
      }
    } else {
      const chineseVoice = voices.find(voice => 
        voice.lang.includes('zh') || voice.lang.includes('CN')
      );
      if (chineseVoice) {
        utterance.voice = chineseVoice;
      }
    }

    utterance.onstart = () => {
      setSpeakingId(message.id);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setSpeakingId(null);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setSpeakingId(null);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handleStopSpeaking = () => {
    window.speechSynthesis.cancel();
    setSpeakingId(null);
    setIsPaused(false);
  };

  const handlePauseSpeaking = () => {
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-[#ededed]" style={{
      backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      {!backgroundImage && (
        <div className="absolute inset-0 bg-[#ededed]" />
      )}
      
      <div className={`relative z-10 flex items-center px-3 py-2 ${topBarTransparent ? 'bg-transparent border-b border-transparent' : 'bg-white/95 backdrop-blur-sm border-b border-gray-200'} shrink-0`}>
        <div className="flex-1 flex items-center justify-center gap-2">
          <span className="text-lg">🤖</span>
          <h1 className="text-base font-semibold text-gray-800">AI 助手</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowColorSettings(!showColorSettings)}
            className="p-2 text-gray-700 hover:text-gray-900 transition-colors"
            title="文字颜色"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </button>
          <button
            onClick={() => document.getElementById('ai-bg-image-upload')?.click()}
            className="p-2 text-gray-700 hover:text-gray-900 transition-colors"
            title="设置背景"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </button>
          <input
            id="ai-bg-image-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleBackgroundImageUpload}
          />
          {backgroundImage && (
            <button
              onClick={removeBackgroundImage}
              className="p-2 text-gray-700 hover:text-gray-900 transition-colors"
              title="移除背景"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-700 hover:text-gray-900 transition-colors"
            title="设置"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>

      {showChatHistory && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
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

      {showSettings && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 max-h-[70vh] overflow-y-auto">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">设置</h2>
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
                  <label className="text-sm text-gray-500 mb-2 block">
                    API 密钥
                  </label>
                  <input
                    type="password"
                    value={apiConfig.apiKey}
                    onChange={(e) => setApiConfig({ ...apiConfig, apiKey: e.target.value })}
                    placeholder={apiConfig.provider === 'deepseek' ? 'sk-xxxxxxxxxxxxxxxxxxxxxxxx' : '输入 API 密钥'}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none"
                  />
                </div>

                <>
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
                </>

                <p className="text-sm text-gray-500">
                  {apiConfig.provider === 'deepseek' 
                    ? '获取 API 密钥：<a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" className="text-golden hover:underline">platform.deepseek.com</a>'
                    : '支持所有兼容 OpenAI Chat Completions API 格式的接口'
                  }
                </p>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">联网搜索</h3>
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">启用联网搜索</p>
                    <p className="text-xs text-gray-500">AI 可以搜索网络获取最新信息</p>
                  </div>
                  <button
                    onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      webSearchEnabled ? 'bg-golden' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        webSearchEnabled ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-500 mb-2 block">
                      SerpAPI 密钥
                    </label>
                    <input
                      type="password"
                      value={serpApiKey}
                      onChange={(e) => {
                        const key = e.target.value;
                        setSerpApiKey(key);
                        webSearchService.setSerpApiKey(key);
                      }}
                      placeholder="输入 SerpAPI 密钥..."
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      获取密钥：<a href="https://serpapi.com/" target="_blank" rel="noopener noreferrer" className="text-golden hover:underline">serpapi.com</a>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 mb-2 block">
                      OpenWeather API 密钥（可选）
                    </label>
                    <input
                      type="password"
                      value={openWeatherApiKey}
                      onChange={(e) => {
                        const key = e.target.value;
                        setOpenWeatherApiKey(key);
                        webSearchService.setOpenWeatherApiKey(key);
                      }}
                      placeholder="输入 OpenWeather API 密钥..."
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      获取密钥：<a href="https://openweathermap.org/api" target="_blank" rel="noopener noreferrer" className="text-golden hover:underline">openweathermap.org</a>
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-xs text-blue-800">
                    <strong>功能说明：</strong><br />
                    • {serpApiKey ? '✅ 已接入 SerpAPI - 真实 Google 搜索' : '⚠️ 未配置 SerpAPI - 使用模拟/免费搜索'}<br />
                    • {openWeatherApiKey ? '✅ 已接入 OpenWeather - 真实天气数据' : '⚠️ 未配置天气API - 使用模拟天气'}<br />
                    • 查询天气（问"今天天气"）<br />
                    • 查询黄金价格（问"黄金克价"）<br />
                    • 查询虚拟币行情（自动检测关键词）<br />
                    • {serpApiKey ? '使用真实搜索结果' : '模拟数据仅供参考，配置 API 密钥获取真实数据'}
                  </p>
                </div>
              </div>

              <h3 className="text-sm font-medium text-gray-700 mb-3">朗读设置</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-500 mb-2 block">
                    语速: <span className="text-golden font-medium">{speechState.speechRate.toFixed(1)}x</span>
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={speechState.speechRate}
                    onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-golden"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>慢速</span>
                    <span>正常</span>
                    <span>快速</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-gray-500">声音选择</label>
                    <span className="text-xs text-gray-400">可用声音: {voices.length} 种</span>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2">
                    <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="voice"
                        value=""
                        checked={speechState.selectedVoice === ''}
                        onChange={() => setSelectedVoiceInSpeech('')}
                        className="w-4 h-4 text-golden"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">自动选择中文</p>
                      </div>
                      {speechState.selectedVoice === '' && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            testVoice('');
                          }}
                          className="text-xs px-2 py-1 bg-golden/10 text-golden rounded hover:bg-golden/20 transition-colors"
                        >
                          试听
                        </button>
                      )}
                    </label>
                    {voices.map((voice) => (
                      <label
                        key={voice.name}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          voice.lang.includes('zh') || voice.lang.includes('CN') ? 'hover:bg-gray-50' : 'hover:bg-gray-50 opacity-60'
                        }`}
                      >
                        <input
                          type="radio"
                          name="voice"
                          value={voice.name}
                          checked={speechState.selectedVoice === voice.name}
                          onChange={() => setSelectedVoiceInSpeech(voice.name)}
                          className="w-4 h-4 text-golden"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{voice.name}</p>
                          <p className="text-xs text-gray-500">{voice.lang}</p>
                        </div>
                        {(voice.lang.includes('zh') || voice.lang.includes('CN')) && (
                          <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">中文</span>
                        )}
                        {speechState.selectedVoice === voice.name && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              testVoice(voice.name);
                            }}
                            className="text-xs px-2 py-1 bg-golden/10 text-golden rounded hover:bg-golden/20 transition-colors flex-shrink-0"
                          >
                            试听
                          </button>
                        )}
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                    <p className="text-xs text-yellow-800">
                      <strong>提示：</strong>浏览器自带的朗读功能只能使用系统提供的语音。
                      <br />
                      想要使用高德小团团等特殊声音？需要安装对应语音包到系统中，或使用外部 TTS 服务。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveApiConfig}
              className="w-full bg-golden text-white py-3 rounded-xl font-semibold hover:bg-golden-dark transition-colors"
            >
              保存设置
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="relative z-10 bg-red-50/90 backdrop-blur-sm border border-red-200 text-red-700 px-4 py-3 rounded-xl m-3">
          {error}
        </div>
      )}

      <div className="relative z-10 flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🤖</div>
            <h2 className="text-lg font-semibold text-gray-700 mb-2">你好，我是金线 AI 助手</h2>
            <p className="text-gray-500 mb-4">
              我可以帮你：<br />
              设计行动协议 · 优化习惯养成 · 解决执行卡点
            </p>
            {webSearchEnabled && (
              <div className="mb-6 p-3 bg-golden/10 border border-golden/20 rounded-xl">
                <p className="text-sm text-golden-dark">
                  🌐 联网搜索已开启 - {serpApiKey ? '已接入 SerpAPI 真实搜索' : '使用免费搜索'}
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
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
                      {!message.role === 'user' && !isStreaming && message.model && (
                        <div className="mt-2">
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                            模型: {message.model}
                          </span>
                        </div>
                      )}
                    </div>
                    {!message.role === 'user' && !isStreaming && onSpeak && (
                      <div className="flex items-center gap-2 mt-2">
                        {!isSpeaking ? (
                          <button
                            onClick={() => handleSpeak(message)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors bg-gray-100 hover:bg-gray-200 text-gray-700"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                            朗读
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={isPaused ? handlePauseSpeaking : handlePauseSpeaking}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors bg-gray-100 hover:bg-gray-200 text-gray-700"
                            >
                              {isPaused ? (
                                <>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  继续
                                </>
                              ) : (
                                <>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  暂停
                                </>
                              )}
                            </button>
                            <button
                              onClick={handleStopSpeaking}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors bg-gray-100 hover:bg-gray-200 text-gray-700"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                              </svg>
                              停止
                            </button>
                          </>
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
                      style={{ color: aiTextColor }}
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

      <div className={`relative z-10 ${inputBarTransparent ? 'bg-transparent border-t border-transparent' : 'bg-white border-t border-gray-200'} shrink-0 px-3 py-2.5`}>
        {isLoading && (
          <div className="flex items-center gap-2 mb-2 py-1">
            <div className="w-4 h-4 border-2 border-golden/30 border-t-golden rounded-full animate-spin" />
            <span className={`text-sm ${inputBarTransparent ? 'text-white' : 'text-gray-600'}`}>
              {isSearching ? '搜索网络中...' : '思考中...'}
            </span>
            <button
              onClick={handleStopGeneration}
              className={`ml-auto text-sm ${inputBarTransparent ? 'text-white hover:text-white/80 hover:bg-white/20' : 'text-red-500 hover:text-red-600 hover:bg-red-50'} px-2.5 py-1 rounded-lg transition-colors`}
            >
              中断
            </button>
          </div>
        )}
        
        {attachedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachedFiles.map((file) => (
              <div
                key={file.id}
                className="relative group bg-white/80 backdrop-blur-sm rounded-lg p-2 border border-gray-200"
              >
                {file.type === 'image' && file.preview ? (
                  <img
                    src={file.preview}
                    alt={file.file.name}
                    className="w-20 h-20 object-cover rounded"
                  />
                ) : (
                  <div className="flex items-center gap-2 w-32">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 truncate">{file.file.name}</p>
                      <p className="text-xs text-gray-400">{formatFileSize(file.file.size)}</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => removeAttachedFile(file.id)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={isLoading}
            className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          
          {(typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) && (
            <button
              onClick={toggleListening}
              disabled={isLoading}
              className={`p-2.5 rounded-lg transition-colors ${
                isListening
                  ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                  : 'text-gray-600 hover:bg-gray-100'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={isListening ? "停止录音" : "语音输入"}
            >
              <svg className="w-5 h-5" fill={isListening ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                {isListening ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                )}
              </svg>
            </button>
          )}
          
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder=""
            disabled={isLoading || !apiService.hasApiKey()}
            className={`flex-1 px-3 py-2.5 rounded-lg outline-none resize-none max-h-28 text-base ${
              inputBarTransparent 
                ? 'bg-white/80 backdrop-blur-sm border border-white/30 text-black placeholder-gray-500' 
                : 'border border-gray-300 text-black placeholder-gray-500'
            }`}
            rows={1}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
          
          <button
            onClick={isLoading ? handleStopGeneration : handleSend}
            disabled={!isLoading && !input.trim() || !apiService.hasApiKey()}
            className={`px-4 py-2.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              isLoading
                ? 'bg-red-500 text-white hover:bg-red-600'
                : !input.trim() || !apiService.hasApiKey()
                ? 'bg-gray-300 text-gray-50 cursor-not-allowed'
                : 'bg-[#07c160] text-white hover:opacity-90'
            }`}
          >
            {isLoading ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                中断
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>

      {showColorSettings && (
        <ColorSettingsPanel
          userTextColor={userTextColor}
          setUserTextColor={setUserTextColor}
          aiTextColor={aiTextColor}
          setAiTextColor={setAiTextColor}
          textScale={textScale}
          setTextScale={setTextScale}
          onClose={() => setShowColorSettings(false)}
        />
      )}
    </div>
  );
}

function QuickQuestion({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-lg bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white transition-all shadow-sm text-sm"
    >
      {text}
    </button>
  );
}

function ColorSettingsPanel({
  userTextColor,
  setUserTextColor,
  aiTextColor,
  setAiTextColor,
  textScale,
  setTextScale,
  onClose
}: {
  userTextColor: string;
  setUserTextColor: (color: string) => void;
  aiTextColor: string;
  setAiTextColor: (color: string) => void;
  textScale: number;
  setTextScale: (scale: number) => void;
  onClose: () => void;
}) {
  const presetColors = [
    '#000000', '#FFFFFF', '#333333', '#666666', 
    '#DAA520', '#07C160', '#1AAD19', '#07C160',
    '#FF5722', '#E91E63', '#9C27B0', '#673AB7',
    '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
    '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
    '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] sm:max-h-none flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
          <h3 className="text-lg font-semibold text-gray-800">文字颜色设置</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-6 overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <span className="text-lg">👤</span>
                我的文字颜色
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={userTextColor}
                  onChange={(e) => setUserTextColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />
                <span className="text-xs text-gray-500 font-mono">{userTextColor}</span>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {presetColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setUserTextColor(color)}
                  className={`w-full aspect-square rounded-lg transition-all ${
                    userTextColor === color ? 'ring-2 ring-golden scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <span className="text-lg">🤖</span>
                AI 文字颜色
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={aiTextColor}
                  onChange={(e) => setAiTextColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />
                <span className="text-xs text-gray-500 font-mono">{aiTextColor}</span>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {presetColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setAiTextColor(color)}
                  className={`w-full aspect-square rounded-lg transition-all ${
                    aiTextColor === color ? 'ring-2 ring-golden scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                文字大小
              </label>
              <span className="text-xs text-golden font-medium">{textScale.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.8"
              step="0.1"
              value={textScale}
              onChange={(e) => setTextScale(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-golden"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>小</span>
              <span>中</span>
              <span>大</span>
            </div>
          </div>

          <button
            onClick={() => {
              setUserTextColor('#000000');
              setAiTextColor('#000000');
              setTextScale(1);
            }}
            className="w-full py-2.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
          >
            恢复默认
          </button>
        </div>
      </div>
    </div>
  );
}
