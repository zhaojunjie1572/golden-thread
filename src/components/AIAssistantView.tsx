import React, { useState, useEffect, useRef } from 'react';
import { apiService, ChatMessage, ApiConfig } from '../services/apiService';
import { webSearchService } from '../services/webSearchService';

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
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    return localStorage.getItem('selected-voice') || '';
  });
  const [speechRate, setSpeechRate] = useState<number>(() => {
    return parseFloat(localStorage.getItem('speech-rate') || '1');
  });
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

  useEffect(() => {
    localStorage.setItem('web-search-enabled', webSearchEnabled.toString());
  }, [webSearchEnabled]);

  useEffect(() => {
    webSearchService.setSerpApiKey(serpApiKey);
    webSearchService.setOpenWeatherApiKey(openWeatherApiKey);
  }, [serpApiKey, openWeatherApiKey]);

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
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      console.log('加载声音数量:', availableVoices.length);
      setVoices(availableVoices);
    };

    loadVoices();
    
    const timer1 = setTimeout(() => {
      loadVoices();
    }, 500);
    
    const timer2 = setTimeout(() => {
      loadVoices();
    }, 2000);

    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('speech-rate', speechRate.toString());
  }, [speechRate]);

  useEffect(() => {
    localStorage.setItem('selected-voice', selectedVoice);
  }, [selectedVoice]);

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
    utterance.rate = speechRate;
    utterance.pitch = 1;

    if (selectedVoice) {
      const voice = voices.find(v => v.name === selectedVoice);
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
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col h-[calc(100vh-120px)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">AI 助手</h1>
          <p className="text-gray-500 mt-1">实时解答你的疑问</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!isLoading) {
                createNewSession();
              }
            }}
            disabled={isLoading}
            className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
            title="新建对话"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={() => setShowChatHistory(!showChatHistory)}
            className={`p-3 rounded-xl transition-colors ${
              showChatHistory 
                ? 'text-golden bg-golden/10' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title="聊天历史"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            title="设置"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.065c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
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
                    语速: <span className="text-golden font-medium">{speechRate.toFixed(1)}x</span>
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={speechRate}
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
                        checked={selectedVoice === ''}
                        onChange={() => setSelectedVoice('')}
                        className="w-4 h-4 text-golden"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">自动选择中文</p>
                      </div>
                      {selectedVoice === '' && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const utterance = new SpeechSynthesisUtterance('你好，这是当前选中的声音');
                            utterance.lang = 'zh-CN';
                            utterance.rate = speechRate;
                            window.speechSynthesis.speak(utterance);
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
                          checked={selectedVoice === voice.name}
                          onChange={() => setSelectedVoice(voice.name)}
                          className="w-4 h-4 text-golden"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{voice.name}</p>
                          <p className="text-xs text-gray-500">{voice.lang}</p>
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
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto mb-6 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-6">🤖</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">你好，我是金线 AI 助手</h2>
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
            <div className="flex flex-col gap-3 max-w-md mx-auto">
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
              <ChatBubble
                key={message.id}
                message={message}
                isSpeaking={speakingId === message.id}
                isPaused={isPaused && speakingId === message.id}
                onSpeak={() => handleSpeak(message)}
                onStop={handleStopSpeaking}
                onPause={handlePauseSpeaking}
              />
            ))}
            {streamingContent && (
              <ChatBubble
                message={{
                  id: 'streaming',
                  role: 'assistant',
                  content: streamingContent,
                  timestamp: new Date(),
                }}
                isStreaming
              />
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        {isLoading && (
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-golden/30 border-t-golden rounded-full animate-spin" />
              <span className="text-sm text-gray-600">
                {isSearching ? '搜索网络中...' : '思考中...'}
              </span>
            </div>
            <button
              onClick={handleStopGeneration}
              className="text-sm text-red-500 hover:text-red-600 hover:bg-red-50 px-3 py-1 rounded-lg transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              中断
            </button>
          </div>
        )}
        
        {attachedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachedFiles.map((file) => (
              <div
                key={file.id}
                className="relative group bg-gray-50 rounded-lg p-2 border border-gray-200"
              >
                {file.type === 'image' && file.preview ? (
                  <div className="relative">
                    <img
                      src={file.preview}
                      alt={file.file.name}
                      className="w-20 h-20 object-cover rounded"
                    />
                  </div>
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
        
        <div className="flex gap-2 mb-2">
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
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm">图片</span>
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
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm">文件</span>
          </button>
        </div>
        
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={isListening ? "正在听你说话..." : "输入你的问题..."}
            disabled={isLoading || !apiService.hasApiKey()}
            className={`flex-1 px-4 py-3 rounded-xl border transition-colors focus:ring-2 focus:ring-golden/20 outline-none resize-none max-h-32 ${
              isListening 
                ? 'border-red-400 bg-red-50 focus:border-red-400' 
                : 'border-gray-200 focus:border-golden'
            }`}
            rows={1}
          />
          {(typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) && (
            <button
              onClick={toggleListening}
              disabled={isLoading}
              className={`px-4 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                isListening
                  ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
          <button
            onClick={isLoading ? handleStopGeneration : handleSend}
            disabled={!isLoading && (!input.trim() && attachedFiles.length === 0) || !apiService.hasApiKey()}
            className={`px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2 ${
              isLoading
                ? 'bg-red-500 text-white hover:bg-red-600'
                : (!input.trim() && attachedFiles.length === 0) || !apiService.hasApiKey()
                ? 'bg-gray-300 text-gray-50 cursor-not-allowed'
                : 'bg-golden text-white hover:bg-golden-dark'
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
                发送
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickQuestion({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-700 transition-colors"
    >
      {text}
    </button>
  );
}

function ChatBubble({ 
  message, 
  isStreaming = false, 
  isSpeaking = false, 
  isPaused = false, 
  onSpeak, 
  onStop, 
  onPause 
}: { 
  message: ChatMessage; 
  isStreaming?: boolean; 
  isSpeaking?: boolean; 
  isPaused?: boolean; 
  onSpeak?: () => void; 
  onStop?: () => void; 
  onPause?: () => void; 
}) {
  const isUser = message.role === 'user';

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-golden text-white'
            : 'bg-white border border-gray-100 shadow-sm'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`text-2xl ${isUser ? 'order-2' : 'order-1'}`}>
            {isUser ? '👤' : '🤖'}
          </div>
          <div className={`flex-1 ${isUser ? 'text-right' : 'text-left'} order-1`}>
            {message.attachments && message.attachments.length > 0 && (
              <div className={`mb-2 flex flex-wrap gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {message.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className={`${isUser ? 'bg-white/20' : 'bg-gray-50'} rounded-lg p-2 border ${isUser ? 'border-white/30' : 'border-gray-200'}`}
                  >
                    {attachment.type === 'image' && attachment.preview ? (
                      <img
                        src={attachment.preview}
                        alt={attachment.name}
                        className="w-32 h-32 object-cover rounded"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <svg className={`w-6 h-6 ${isUser ? 'text-white/70' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                          <p className={`text-xs ${isUser ? 'text-white/90' : 'text-gray-700'}`}>{attachment.name}</p>
                          <p className={`text-xs ${isUser ? 'text-white/70' : 'text-gray-400'}`}>{formatFileSize(attachment.size)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div
              className={`text-sm ${isUser ? 'text-white/95' : 'text-gray-800'} whitespace-pre-wrap`}
            >
              {message.content}
            </div>
            {isStreaming && <span className="inline-block w-2 h-4 bg-golden animate-pulse ml-1" />}
            
            {!isUser && !isStreaming && message.model && (
              <div className="mt-2">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  isUser ? 'bg-white/20 text-white/80' : 'bg-gray-100 text-gray-500'
                }`}>
                  模型: {message.model}
                </span>
              </div>
            )}
            
            {!isUser && !isStreaming && onSpeak && (
              <div className="flex items-center gap-2 mt-3">
                {!isSpeaking ? (
                  <button
                    onClick={onSpeak}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isUser
                        ? 'bg-white/20 hover:bg-white/30 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                    朗读
                  </button>
                ) : (
                  <>
                    <button
                      onClick={onPause}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isUser
                          ? 'bg-white/20 hover:bg-white/30 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {isPaused ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          继续
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          暂停
                        </>
                      )}
                    </button>
                    <button
                      onClick={onStop}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isUser
                          ? 'bg-white/20 hover:bg-white/30 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        </div>
      </div>
    </div>
  );
}
