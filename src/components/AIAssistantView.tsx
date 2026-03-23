import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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

  const loadSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setShowChatHistory(false);
  };

  const deleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const filtered = chatSessions.filter(s => s.id !== sessionId);
    setChatSessions(filtered);
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
    
    const utterance = new SpeechSynthesisUtterance(message.content);
    utterance.lang = 'zh-CN';
    utterance.rate = speechState.speechRate;
    
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
      const newFile: AttachedFile = {
        id: crypto.randomUUID(),
        file,
        type: file.type.startsWith('image/') ? 'image' : 'file',
      };
      
      if (newFile.type === 'image') {
        const reader = new FileReader();
        reader.onload = (event) => {
          newFile.preview = event.target?.result as string;
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
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'zh-CN';
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
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
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
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
      
      const assistantMessageId = crypto.randomUUID();
      
      await apiService.streamChat(
        messagesForApi,
        (content) => {
          streamingContentRef.current += content;
          setStreamingContent(streamingContentRef.current);
        },
        abortController.signal
      );
      
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: streamingContentRef.current,
        timestamp: new Date(),
        model: apiConfig.model,
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
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
      } else {
        setError(err instanceof Error ? err.message : '发送失败');
      }
    } finally {
      setIsLoading(false);
      setStreamingContent('');
      streamingContentRef.current = '';
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col h-[calc(100vh-140px)]">
      <div className="flex items-center gap-4 mb-6 shrink-0">
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 shrink-0">
          <div className="flex items-center justify-between mb-4">
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
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col flex-1 min-h-0">
          <div className="p-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">💬</span>
                <h3 className="font-semibold text-gray-800">对话</h3>
              </div>
              <div className="flex items-center gap-2">
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
                    <div className="max-w-[75%]">
                      <div
                        className={`px-3 py-2.5 rounded-2xl ${
                          message.role === 'user'
                            ? 'bg-[#95ec69] text-[#000000]'
                            : 'bg-gray-100 text-gray-800'
                        }`}
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
                        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {streamingContent && (
                  <div className="flex justify-start">
                    <div className="max-w-[75%]">
                      <div className="px-3 py-2.5 rounded-2xl bg-gray-100 text-gray-800">
                        <p className="whitespace-pre-wrap text-sm">{streamingContent}</p>
                        <span className="inline-block w-1.5 h-4 bg-gray-400 ml-1 align-middle animate-pulse" />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-gray-100 shrink-0">
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
            
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder=""
                disabled={isLoading || !apiService.hasApiKey()}
                className="flex-1 px-3 py-2.5 rounded-lg outline-none resize-none max-h-28 text-sm border border-gray-300 text-black placeholder-gray-500"
                rows={1}
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
              
              <button
                onClick={isLoading ? handleStopGeneration : handleSend}
                disabled={!isLoading && !input.trim() || !apiService.hasApiKey()}
                className={`px-4 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-1.5 ${
                  isLoading
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : !input.trim() || !apiService.hasApiKey()
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
