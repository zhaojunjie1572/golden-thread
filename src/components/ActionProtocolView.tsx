import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService, ChatMessage } from '../services/apiService';

interface PromptModule {
  id: string;
  name: string;
  icon: string;
  prompt: string;
}

const DEFAULT_MODULES: PromptModule[] = [
  {
    id: 'needs-analysis',
    name: '需求解析',
    icon: '🎯',
    prompt: `你是一个专业的需求解析专家。请帮助用户：
1. 分析用户的模糊需求
2. 拆解成具体、可执行的问题
3. 提供标准化的思考建议
4. 给出明确的行动方向

请用简洁、实用的方式回答，重点关注具体的行动建议。`,
  },
  {
    id: 'problem-extraction',
    name: '问题提取',
    icon: '🔍',
    prompt: `你是一个专业的问题提取专家。请帮助用户：
1. 从用户的描述中提取核心问题
2. 区分表面问题和深层问题
3. 分析问题的成因和影响
4. 把复杂问题拆解成简单问题

请用结构化的方式回答，让问题清晰可见。`,
  },
  {
    id: 'task-breakdown',
    name: '任务拆解',
    icon: '📋',
    prompt: `你是一个专业的任务拆解专家。请帮助用户：
1. 把目标拆解成可执行的小任务
2. 确定任务的优先级和顺序
3. 预估每个任务的时间和资源
4. 设定明确的检查点和验收标准

请用列表形式呈现，每个任务要具体、可执行。`,
  },
  {
    id: 'action-plan',
    name: '行动方案',
    icon: '🚀',
    prompt: `你是一个专业的行动规划专家。请帮助用户：
1. 制定具体的执行计划
2. 明确每日/每周的行动项
3. 设定里程碑和时间节点
4. 预判风险并给出应对方案

请用时间表或 checklist 形式呈现，方便用户执行。`,
  },
  {
    id: 'thinking-framework',
    name: '思维框架',
    icon: '🧠',
    prompt: `你是一个专业的思维框架专家。请帮助用户：
1. 提供结构化的思考框架
2. 从多个维度分析问题
3. 建立系统的思维模式
4. 培养深度思考的习惯

请用清晰的框架和步骤呈现。`,
  },
  {
    id: 'resource-planning',
    name: '资源规划',
    icon: '📦',
    prompt: `你是一个专业的资源规划专家。请帮助用户：
1. 盘点现有资源（时间、金钱、人脉、技能）
2. 识别资源缺口
3. 优化资源配置
4. 制定资源获取计划

请用清单和表格形式呈现，清晰明了。`,
  },
  {
    id: 'risk-assessment',
    name: '风险评估',
    icon: '⚠️',
    prompt: `你是一个专业的风险评估专家。请帮助用户：
1. 识别潜在风险和挑战
2. 评估风险的概率和影响
3. 制定风险应对策略
4. 建立预警和止损机制

请用风险矩阵和应对方案的形式呈现。`,
  },
  {
    id: 'execution-review',
    name: '执行复盘',
    icon: '📊',
    prompt: `你是一个专业的执行复盘专家。请帮助用户：
1. 回顾执行过程和结果
2. 分析成功和失败的原因
3. 总结经验和教训
4. 提出改进和优化建议

请用客观、建设性的方式进行复盘。`,
  },
];

export default function ActionProtocolView() {
  const navigate = useNavigate();
  
  const [modules, setModules] = useState<PromptModule[]>(() => {
    try {
      const saved = localStorage.getItem('think-tank-modules');
      if (saved) {
        return JSON.parse(saved) as PromptModule[];
      }
      return DEFAULT_MODULES;
    } catch {
      return DEFAULT_MODULES;
    }
  });
  
  const [selectedModuleId, setSelectedModuleId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('think-tank-selected-module');
      return saved || DEFAULT_MODULES[0].id;
    } catch {
      return DEFAULT_MODULES[0].id;
    }
  });
  const [showModuleEditor, setShowModuleEditor] = useState<string | null>(null);
  const [editModuleName, setEditModuleName] = useState('');
  const [editModulePrompt, setEditModulePrompt] = useState('');
  const [longPressModule, setLongPressModule] = useState<PromptModule | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressingRef = useRef(false);
  const [showMemorySettings, setShowMemorySettings] = useState(false);
  const [memoryConfig, setMemoryConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('think-tank-memory-config');
      return saved ? JSON.parse(saved) : { maxWords: 2000, autoExtract: true };
    } catch {
      return { maxWords: 2000, autoExtract: true };
    }
  });
  const [moduleMessages, setModuleMessages] = useState<Record<string, ChatMessage[]>>(() => {
    try {
      const saved = localStorage.getItem('think-tank-module-messages');
      if (saved) {
        const data = JSON.parse(saved);
        for (const moduleId in data) {
          data[moduleId] = data[moduleId].map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
        }
        return data;
      }
      return {};
    } catch {
      return {};
    }
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(!apiService.hasApiKey());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingContentRef = useRef('');
  const [streamingContent, setStreamingContent] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedModule = modules.find(m => m.id === selectedModuleId) || modules[0];
  const currentMessages = moduleMessages[selectedModuleId] || [];

  const setCurrentMessages = useCallback((newMessages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setModuleMessages(prev => {
      const updated = { ...prev };
      if (typeof newMessages === 'function') {
        updated[selectedModuleId] = newMessages(prev[selectedModuleId] || []);
      } else {
        updated[selectedModuleId] = newMessages;
      }
      return updated;
    });
  }, [selectedModuleId]);

  useEffect(() => {
    localStorage.setItem('think-tank-modules', JSON.stringify(modules));
  }, [modules]);

  useEffect(() => {
    localStorage.setItem('think-tank-selected-module', selectedModuleId);
  }, [selectedModuleId]);

  useEffect(() => {
    localStorage.setItem('think-tank-memory-config', JSON.stringify(memoryConfig));
  }, [memoryConfig]);

  useEffect(() => {
    localStorage.setItem('think-tank-module-messages', JSON.stringify(moduleMessages));
  }, [moduleMessages]);

  const prepareConversationHistory = (userMessage: ChatMessage): ChatMessage[] => {
    const history: ChatMessage[] = [
      {
        id: crypto.randomUUID(),
        role: 'system',
        content: selectedModule.prompt,
        timestamp: new Date(),
      } as ChatMessage,
      ...currentMessages,
      userMessage,
    ];
    
    return history;
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, streamingContent]);

  const handleEditModule = (module: PromptModule) => {
    setShowModuleEditor(module.id);
    setEditModuleName(module.name);
    setEditModulePrompt(module.prompt);
    setLongPressModule(null);
  };

  const handleLongPressStart = (module: PromptModule) => {
    isLongPressingRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressingRef.current = true;
      setLongPressModule(module);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchStart = (module: PromptModule) => {
    handleLongPressStart(module);
  };

  const handleTouchEnd = () => {
    handleLongPressEnd();
  };

  const handleMouseDown = (module: PromptModule) => {
    handleLongPressStart(module);
  };

  const handleMouseUp = () => {
    handleLongPressEnd();
  };

  const handleMouseLeave = () => {
    handleLongPressEnd();
  };

  const handleModuleClick = (module: PromptModule) => {
    if (!isLongPressingRef.current) {
      setSelectedModuleId(module.id);
    }
    isLongPressingRef.current = false;
  };

  const handleSaveModule = () => {
    if (!showModuleEditor) return;
    setModules(prev => prev.map(m => 
      m.id === showModuleEditor 
        ? { ...m, name: editModuleName, prompt: editModulePrompt }
        : m
    ));
    setShowModuleEditor(null);
  };

  const handleAddModule = () => {
    const newModule: PromptModule = {
      id: crypto.randomUUID(),
      name: '新模块',
      icon: '✨',
      prompt: '请自定义这个模块的提示词...',
    };
    setModules(prev => [...prev, newModule]);
    setShowModuleEditor(newModule.id);
    setEditModuleName(newModule.name);
    setEditModulePrompt(newModule.prompt);
  };

  const handleDeleteModule = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (modules.length <= 1) {
      alert('至少保留一个模块');
      return;
    }
    setModules(prev => prev.filter(m => m.id !== id));
    if (selectedModuleId === id) {
      setSelectedModuleId(modules[0].id);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    if (isLoading) return;

    if (!apiService.hasApiKey()) {
      setShowSettings(true);
      return;
    }

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      moduleId: selectedModuleId,
      moduleName: selectedModule.name,
    } as ChatMessage;

    setCurrentMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');
    streamingContentRef.current = '';

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let isAborted = false;

    try {
      const conversationHistory = prepareConversationHistory(userMessage);

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
            setCurrentMessages(prev => [...prev, assistantMessage]);
          } else {
            const assistantMessage: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: streamingContentRef.current,
              timestamp: new Date(),
              model,
            };
            setCurrentMessages(prev => [...prev, assistantMessage]);
          }
          setStreamingContent('');
          streamingContentRef.current = '';
          setIsLoading(false);
          abortControllerRef.current = null;
        },
        (err) => {
          if (err.name !== 'AbortError' && !abortController.signal.aborted) {
            alert('发生错误：' + err.message);
          }
          if (streamingContentRef.current) {
            const assistantMessage: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: streamingContentRef.current,
              timestamp: new Date(),
            };
            setCurrentMessages(prev => [...prev, assistantMessage]);
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
        alert('发生未知错误');
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-800">智库</h1>
          <p className="text-gray-500 mt-1">当前模块：{selectedModule.icon} {selectedModule.name}</p>
        </div>
        <div className="flex-1"></div>
        <button
          onClick={() => setShowMemorySettings(!showMemorySettings)}
          className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
          title="记忆设置"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        </button>
        {currentMessages.length > 0 && (
          <button
            onClick={() => {
              if (confirm('确定要清空当前模块的对话内容吗？')) {
                setCurrentMessages([]);
              }
            }}
            className="p-3 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            title="清空对话"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
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

      {showSettings && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">API 设置</h2>
            <button
              onClick={() => setShowSettings(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            请先在「AI 助手」页面配置 API 密钥，然后返回这里使用。
          </p>
          <button
            onClick={() => navigate('/ai')}
            className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
          >
            前往设置 API
          </button>
        </div>
      )}

      {showMemorySettings && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">记忆设置</h2>
            <button
              onClick={() => setShowMemorySettings(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">最大记忆字数</label>
                <span className="text-sm text-gray-500">{memoryConfig.maxWords} 字</span>
              </div>
              <input
                type="range"
                min="500"
                max="5000"
                step="100"
                value={memoryConfig.maxWords}
                onChange={(e) => setMemoryConfig((prev: any) => ({ ...prev, maxWords: parseInt(e.target.value) }))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>500字</span>
                <span>2000字</span>
                <span>5000字</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">自动提取重要信息</label>
                <p className="text-xs text-gray-500 mt-1">从对话中自动提取关键点作为摘要</p>
              </div>
              <button
                onClick={() => setMemoryConfig((prev: any) => ({ ...prev, autoExtract: !prev.autoExtract }))}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  memoryConfig.autoExtract ? 'bg-amber-500' : 'bg-gray-300'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  memoryConfig.autoExtract ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-80 flex flex-col">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col" style={{ maxHeight: '60vh' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧠</span>
                <h3 className="font-semibold text-gray-800">模块</h3>
              </div>
              <button
                onClick={handleAddModule}
                className="p-2 text-gray-400 hover:text-golden hover:bg-golden/10 rounded-lg transition-colors"
                title="添加模块"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              点击选择模块，长按编辑/删除
            </p>
            
            <div className="space-y-2 overflow-y-auto flex-1">
              {modules.map((module) => (
                <div key={module.id} className="group relative">
                  <div
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 cursor-pointer select-none ${
                      selectedModuleId === module.id
                        ? 'bg-golden/10 border-2 border-golden text-golden'
                        : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100 text-gray-700'
                    }`}
                    onClick={() => handleModuleClick(module)}
                    onTouchStart={() => handleTouchStart(module)}
                    onTouchEnd={handleTouchEnd}
                    onMouseDown={() => handleMouseDown(module)}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                  >
                    <span className="text-xl">{module.icon}</span>
                    <span className="font-medium flex-1 truncate pr-2">{module.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditModule(module);
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="编辑"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleDeleteModule(module.id, e)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col" style={{ minHeight: '60vh' }}>
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">💬</span>
                  <h3 className="font-semibold text-gray-800">对话</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">当前使用：</span>
                  <span className="px-3 py-1 bg-golden/10 text-golden rounded-lg text-sm font-medium">
                    {selectedModule.icon} {selectedModule.name}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {currentMessages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">🧠</div>
                  <h2 className="text-lg font-semibold text-gray-800 mb-2">选择模块开始对话</h2>
                  <p className="text-gray-500 max-w-md mx-auto mb-6">
                    从左侧选择一个模块，或创建新模块，然后开始对话
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                    {modules.map((module) => (
                      <button
                        key={module.id}
                        onClick={() => setSelectedModuleId(module.id)}
                        className={`px-4 py-2 rounded-xl text-sm transition-all ${
                          selectedModuleId === module.id
                            ? 'bg-golden text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {module.icon} {module.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {currentMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="max-w-[80%]">
                        {(message as any).moduleName && message.role === 'user' && (
                          <div className="text-xs text-gray-400 mb-1 ml-2">
                            {(message as any).moduleName}
                          </div>
                        )}
                        <div
                          className={`px-4 py-3 rounded-2xl ${
                            message.role === 'user'
                              ? 'bg-golden text-white'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          <p className={`text-xs mt-2 ${message.role === 'user' ? 'text-white/70' : 'text-gray-500'}`}>
                            {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {streamingContent && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%]">
                        <div className="px-4 py-3 rounded-2xl bg-gray-100 text-gray-800">
                          <p className="whitespace-pre-wrap">{streamingContent}</p>
                          <span className="inline-block w-2 h-5 bg-gray-400 ml-1 align-middle animate-pulse" />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                {currentMessages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-gray-400">切换模块：</span>
                    {modules.map((module) => (
                      <button
                        key={module.id}
                        onClick={() => setSelectedModuleId(module.id)}
                        className={`px-3 py-1 rounded-lg text-xs transition-all ${
                          selectedModuleId === module.id
                            ? 'bg-golden text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {module.icon} {module.name}
                      </button>
                    ))}
                  </div>
                )}
                {currentMessages.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm('确定要开启新聊天吗？当前对话内容将被清空。')) {
                        setCurrentMessages([]);
                      }
                    }}
                    className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    新聊天
                  </button>
                )}
              </div>

              {isLoading && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-4 h-4 border-2 border-golden/30 border-t-golden rounded-full animate-spin" />
                  <span className="text-sm text-gray-600">思考中...</span>
                  <button
                    onClick={handleStopGeneration}
                    className="ml-auto text-sm text-red-500 hover:text-red-600 hover:bg-red-50 px-3 py-1 rounded-lg transition-colors"
                  >
                    中断
                  </button>
                </div>
              )}
              <div className="flex gap-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={`使用「${selectedModule.name}」模块，输入你的需求...`}
                  disabled={isLoading || !apiService.hasApiKey()}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none resize-none max-h-32 text-base"
                  rows={1}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                <button
                  onClick={isLoading ? handleStopGeneration : handleSend}
                  disabled={!isLoading && !input.trim() || !apiService.hasApiKey()}
                  className={`px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2 ${
                    isLoading
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : !input.trim() || !apiService.hasApiKey()
                      ? 'bg-gray-300 text-gray-50 cursor-not-allowed'
                      : 'bg-golden text-white hover:opacity-90'
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
        </div>
      </div>

      {longPressModule && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setLongPressModule(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{longPressModule.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-800">{longPressModule.name}</h3>
                  <p className="text-xs text-gray-500">选择操作</p>
                </div>
                <button
                  onClick={() => setLongPressModule(null)}
                  className="ml-auto p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-2">
              <button
                onClick={() => handleEditModule(longPressModule)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-800">编辑模块</div>
                  <div className="text-xs text-gray-500">修改模块名称和提示词</div>
                </div>
              </button>
              <button
                onClick={(e) => {
                  handleDeleteModule(longPressModule.id, e as any);
                  setLongPressModule(null);
                }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-50 rounded-xl transition-colors"
              >
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium text-red-600">删除模块</div>
                  <div className="text-xs text-red-500">删除这个模块</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {showModuleEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] sm:max-h-none flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
              <h3 className="text-lg font-semibold text-gray-800">编辑模块</h3>
              <button
                onClick={() => setShowModuleEditor(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">模块名称</label>
                <input
                  type="text"
                  value={editModuleName}
                  onChange={(e) => setEditModuleName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none"
                  placeholder="输入模块名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">提示词</label>
                <textarea
                  value={editModulePrompt}
                  onChange={(e) => setEditModulePrompt(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none resize-none text-sm min-h-[200px]"
                  placeholder="输入模块提示词..."
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 shrink-0">
              <button
                onClick={handleSaveModule}
                className="w-full px-4 py-3 bg-golden text-white rounded-xl font-semibold hover:opacity-90 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
