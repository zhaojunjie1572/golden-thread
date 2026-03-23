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
  const [isMaximized, setIsMaximized] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(() => {
    try {
      return localStorage.getItem('think-tank-background-image');
    } catch {
      return null;
    }
  });
  const [userTextColor, setUserTextColor] = useState<string>(() => {
    try {
      return localStorage.getItem('think-tank-user-text-color') || '#000000';
    } catch {
      return '#000000';
    }
  });
  const [aiTextColor, setAiTextColor] = useState<string>(() => {
    try {
      return localStorage.getItem('think-tank-ai-text-color') || '#ffffff';
    } catch {
      return '#ffffff';
    }
  });
  const [showColorSettings, setShowColorSettings] = useState(false);
  const [topBarTransparent, setTopBarTransparent] = useState<boolean>(() => {
    try {
      return localStorage.getItem('think-tank-topbar-transparent') === 'true';
    } catch {
      return false;
    }
  });
  const [inputBarTransparent, setInputBarTransparent] = useState<boolean>(() => {
    try {
      return localStorage.getItem('think-tank-inputbar-transparent') === 'true';
    } catch {
      return false;
    }
  });
  const [textScale, setTextScale] = useState<number>(() => {
    try {
      return parseFloat(localStorage.getItem('think-tank-text-scale') || '1');
    } catch {
      return 1;
    }
  });
  
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
  const [showMemorySettings, setShowMemorySettings] = useState(false);
  const [draggedModuleId, setDraggedModuleId] = useState<string | null>(null);
  const [dragOverModuleId, setDragOverModuleId] = useState<string | null>(null);
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
  const [selectedMemoryModuleIds, setSelectedMemoryModuleIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('think-tank-selected-memory-modules');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showMemorySelector, setShowMemorySelector] = useState(false);

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

  useEffect(() => {
    localStorage.setItem('think-tank-user-text-color', userTextColor);
  }, [userTextColor]);

  useEffect(() => {
    localStorage.setItem('think-tank-ai-text-color', aiTextColor);
  }, [aiTextColor]);

  useEffect(() => {
    localStorage.setItem('think-tank-topbar-transparent', topBarTransparent.toString());
  }, [topBarTransparent]);

  useEffect(() => {
    localStorage.setItem('think-tank-inputbar-transparent', inputBarTransparent.toString());
  }, [inputBarTransparent]);

  useEffect(() => {
    localStorage.setItem('think-tank-text-scale', textScale.toString());
  }, [textScale]);

  useEffect(() => {
    localStorage.setItem('think-tank-selected-memory-modules', JSON.stringify(selectedMemoryModuleIds));
  }, [selectedMemoryModuleIds]);

  const prepareConversationHistory = (userMessage: ChatMessage): ChatMessage[] => {
    const history: ChatMessage[] = [
      {
        id: crypto.randomUUID(),
        role: 'system',
        content: selectedModule.prompt,
        timestamp: new Date(),
      } as ChatMessage,
    ];

    selectedMemoryModuleIds.forEach(moduleId => {
      if (moduleId === selectedModuleId) return;
      const module = modules.find(m => m.id === moduleId);
      const moduleMsgs = moduleMessages[moduleId];
      if (module && moduleMsgs && moduleMsgs.length > 0) {
        history.push({
          id: crypto.randomUUID(),
          role: 'system',
          content: `--- 来自「${module.icon} ${module.name}」模块的记忆 ---`,
          timestamp: new Date(),
        } as ChatMessage);
        
        // 根据配置限制记忆字数
        let memoryContent = '';
        moduleMsgs.forEach(msg => {
          memoryContent += `${msg.role === 'user' ? '用户' : 'AI'}: ${msg.content}\n`;
        });
        
        // 如果超过最大字数，截取最近的内容
        if (memoryContent.length > memoryConfig.maxWords) {
          memoryContent = memoryContent.slice(-memoryConfig.maxWords);
          memoryContent = '...(前面内容已省略)\n' + memoryContent;
        }
        
        history.push({
          id: crypto.randomUUID(),
          role: 'system',
          content: memoryContent,
          timestamp: new Date(),
        } as ChatMessage);
      }
    });

    history.push(...currentMessages);
    history.push(userMessage);
    
    return history;
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, streamingContent]);

  const handleEditModule = (module: PromptModule) => {
    setShowModuleEditor(module.id);
    setEditModuleName(module.name);
    setEditModulePrompt(module.prompt);
  };

  const handleModuleClick = (module: PromptModule) => {
    setSelectedModuleId(module.id);
    setIsMaximized(true);
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

  const handleDragStart = (e: React.DragEvent, moduleId: string) => {
    setDraggedModuleId(moduleId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', moduleId);
  };

  const handleDragOver = (e: React.DragEvent, moduleId: string) => {
    e.preventDefault();
    if (draggedModuleId && draggedModuleId !== moduleId) {
      setDragOverModuleId(moduleId);
    }
  };

  const handleDragLeave = () => {
    setDragOverModuleId(null);
  };

  const handleDrop = (e: React.DragEvent, targetModuleId: string) => {
    e.preventDefault();
    if (draggedModuleId && draggedModuleId !== targetModuleId) {
      const draggedIndex = modules.findIndex(m => m.id === draggedModuleId);
      const targetIndex = modules.findIndex(m => m.id === targetModuleId);
      
      const newModules = [...modules];
      const [draggedModule] = newModules.splice(draggedIndex, 1);
      newModules.splice(targetIndex, 0, draggedModule);
      
      setModules(newModules);
    }
    setDraggedModuleId(null);
    setDragOverModuleId(null);
  };

  const handleDragEnd = () => {
    setDraggedModuleId(null);
    setDragOverModuleId(null);
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

  const handleBackgroundImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setBackgroundImage(result);
        localStorage.setItem('think-tank-background-image', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeBackgroundImage = () => {
    setBackgroundImage(null);
    localStorage.removeItem('think-tank-background-image');
  };

  return (
    <>
      {!isMaximized && (
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col h-[calc(100vh-140px)]">
          <div className="flex items-center gap-4 mb-6 shrink-0">
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 0 00-1.066 2.573c-.94 1.543-.826 3.31-2.37 2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          </div>

      {showSettings && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 shrink-0">
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 shrink-0">
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

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        <div className="lg:w-64 flex flex-col shrink-0 hidden lg:flex">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">🧠</span>
                <h3 className="font-semibold text-gray-800 text-sm">模块</h3>
              </div>
              <button
                onClick={handleAddModule}
                className="p-1.5 text-gray-400 hover:text-golden hover:bg-golden/10 rounded-lg transition-colors"
                title="添加模块"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2 shrink-0">
              点击选择模块，拖拽排序
            </p>
            
            <div className="space-y-1.5 overflow-y-auto flex-1">
              {modules.map((module) => (
                <div 
                  key={module.id} 
                  className="group relative"
                  draggable
                  onDragStart={(e) => handleDragStart(e, module.id)}
                  onDragOver={(e) => handleDragOver(e, module.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, module.id)}
                  onDragEnd={handleDragEnd}
                >
                  <div
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-2.5 cursor-pointer select-none ${
                      selectedModuleId === module.id
                        ? 'bg-golden/10 border-2 border-golden text-golden'
                        : draggedModuleId === module.id
                        ? 'opacity-50 bg-gray-200 border-2 border-dashed border-gray-400'
                        : dragOverModuleId === module.id
                        ? 'border-2 border-dashed border-golden bg-golden/5'
                        : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100 text-gray-700'
                    }`}
                    onClick={() => handleModuleClick(module)}
                  >
                    <span className="text-lg">{module.icon}</span>
                    <span className="font-medium flex-1 truncate pr-1 text-sm">{module.name}</span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditModule(module);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                        title="编辑"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleDeleteModule(module.id, e)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="删除"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        <div className="flex-1 flex flex-col min-h-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col flex-1 min-h-0">
            <div className="p-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💬</span>
                  <h3 className="font-semibold text-gray-800">对话</h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="lg:hidden">
                    <button
                      onClick={() => setShowModuleEditor('mobile-select')}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm flex items-center gap-1.5 hover:bg-gray-200"
                    >
                      <span>{selectedModule.icon}</span>
                      <span className="truncate max-w-[100px]">{selectedModule.name}</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  <div className="hidden lg:flex items-center gap-2">
                    <span className="text-xs text-gray-500">当前使用：</span>
                    <span className="px-2.5 py-1 bg-golden/10 text-golden rounded-lg text-xs font-medium">
                      {selectedModule.icon} {selectedModule.name}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {currentMessages.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🧠</div>
                  <h2 className="text-base font-semibold text-gray-800 mb-1.5">选择模块开始对话</h2>
                  <p className="text-gray-500 max-w-md mx-auto mb-4 text-sm">
                    从左侧选择一个模块，或创建新模块，然后开始对话
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-center max-w-md mx-auto">
                    {modules.map((module) => (
                      <button
                        key={module.id}
                        onClick={() => setSelectedModuleId(module.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
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
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} px-2`}
                    >
                      <div className="max-w-[75%]">
                        {(message as any).moduleName && message.role === 'user' && (
                          <div className="text-xs text-gray-400 mb-1 ml-1">
                            {(message as any).moduleName}
                          </div>
                        )}
                        <div
                          className={`px-3 py-2.5 rounded-2xl ${
                            message.role === 'user'
                              ? 'bg-golden text-white'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                          <div className={`flex items-center justify-between gap-2 mt-1.5 ${message.role === 'user' ? 'text-white/70' : 'text-gray-500'}`}>
                            <p className="text-xs">
                              {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                            {message.role === 'assistant' && message.model && (
                              <p className="text-[10px] opacity-70">{message.model}</p>
                            )}
                          </div>
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
              <div className="flex items-center justify-between mb-2">
                {currentMessages.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm('确定要开启新聊天吗？当前对话内容将被清空。')) {
                        setCurrentMessages([]);
                      }
                    }}
                    className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    新聊天
                  </button>
                )}
                <div className="flex-1"></div>
                <button
                  onClick={() => setShowMemorySelector(!showMemorySelector)}
                  className="px-2.5 py-1 text-xs rounded-lg transition-colors flex items-center gap-1"
                  style={{
                    backgroundColor: selectedMemoryModuleIds.length > 0 ? '#DAA520' : '#F3F4F6',
                    color: selectedMemoryModuleIds.length > 0 ? '#FFF' : '#6B7280'
                  }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                  引用记忆
                  {selectedMemoryModuleIds.length > 0 && (
                    <span className="bg-white/30 px-1.5 rounded-full text-[10px]">
                      {selectedMemoryModuleIds.length}
                    </span>
                  )}
                </button>
              </div>

              {showMemorySelector && (
                <div className="mb-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-700">选择要引用的模块记忆：</p>
                    <button
                      onClick={() => setSelectedMemoryModuleIds([])}
                      className="text-xs text-red-500 hover:text-red-600"
                    >
                      清空
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {modules.filter(m => m.id !== selectedModuleId).map(module => {
                      const hasMessages = (moduleMessages[module.id]?.length || 0) > 0;
                      const isSelected = selectedMemoryModuleIds.includes(module.id);
                      return (
                        <button
                          key={module.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedMemoryModuleIds(prev => prev.filter(id => id !== module.id));
                            } else {
                              setSelectedMemoryModuleIds(prev => [...prev, module.id]);
                            }
                          }}
                          disabled={!hasMessages}
                          className={`px-2 py-1 rounded-lg text-xs transition-all flex items-center gap-1 ${
                            isSelected
                              ? 'bg-golden text-white'
                              : hasMessages
                                ? 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          <span>{module.icon}</span>
                          <span>{module.name}</span>
                          {hasMessages && (
                            <span className={`text-[10px] px-1 rounded-full ${
                              isSelected ? 'bg-white/30' : 'bg-gray-300 text-gray-600'
                            }`}>
                              {moduleMessages[module.id]?.length || 0}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {modules.filter(m => m.id !== selectedModuleId && (moduleMessages[m.id]?.length || 0) > 0).length === 0 && (
                    <p className="text-xs text-gray-500 mt-2">暂无其他模块的记忆可以引用</p>
                  )}
                </div>
              )}

              {isLoading && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3.5 h-3.5 border-2 border-golden/30 border-t-golden rounded-full animate-spin" />
                  <span className="text-xs text-gray-600">思考中...</span>
                  <button
                    onClick={handleStopGeneration}
                    className="ml-auto text-xs text-red-500 hover:text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    中断
                  </button>
                </div>
              )}
              <div className="flex gap-2.5">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={`使用「${selectedModule.name}」模块...`}
                  disabled={isLoading || !apiService.hasApiKey()}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none resize-none max-h-28 text-sm"
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
                      : 'bg-golden text-white hover:opacity-90'
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
      </div>
      )}
      
      {isMaximized && (
        <div 
          className="fixed inset-0 z-40 flex flex-col"
          style={{
            backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {!backgroundImage && (
            <div className="absolute inset-0 bg-[#ededed]" />
          )}
          
          <div className={`relative z-10 flex items-center px-3 py-2 ${topBarTransparent ? 'bg-transparent border-b border-transparent' : 'bg-white/95 backdrop-blur-sm border-b border-gray-200'} shrink-0`}>
            <button
              onClick={() => setIsMaximized(false)}
              className="p-2 text-gray-700 hover:text-gray-900 transition-colors"
              title="返回"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 flex items-center justify-center gap-2">
              <span className="text-lg">{selectedModule.icon}</span>
              <h1 className="text-base font-semibold text-gray-800">{selectedModule.name}</h1>
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
                onClick={() => document.getElementById('bg-image-upload')?.click()}
                className="p-2 text-gray-700 hover:text-gray-900 transition-colors"
                title="设置背景"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <input
                id="bg-image-upload"
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
                onClick={() => setShowModuleEditor('mobile-select')}
                className="p-2 text-gray-700 hover:text-gray-900 transition-colors"
                title="更多"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="relative z-10 flex-1 overflow-y-auto p-3 space-y-3">
            {currentMessages.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">🧠</div>
                <h2 className="text-lg font-semibold text-gray-700 mb-2">选择模块开始对话</h2>
                <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                  {modules.map((module) => (
                    <button
                      key={module.id}
                      onClick={() => setSelectedModuleId(module.id)}
                      className="px-4 py-2 rounded-lg bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white transition-all shadow-sm"
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
                          <p className="whitespace-pre-wrap font-medium" style={{ fontSize: `${14 * textScale}px` }}>{message.content}</p>
                        </div>
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
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setShowMemorySelector(!showMemorySelector)}
                className="px-2.5 py-1 text-xs rounded-lg transition-colors flex items-center gap-1"
                style={{
                  backgroundColor: selectedMemoryModuleIds.length > 0 ? '#DAA520' : '#F3F4F6',
                  color: selectedMemoryModuleIds.length > 0 ? '#FFF' : '#6B7280'
                }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                引用记忆
                {selectedMemoryModuleIds.length > 0 && (
                  <span className="bg-white/30 px-1.5 rounded-full text-[10px]">
                    {selectedMemoryModuleIds.length}
                  </span>
                )}
              </button>
            </div>

            {showMemorySelector && (
              <div className="mb-3 p-3 bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-700">选择要引用的模块记忆：</p>
                  <button
                    onClick={() => setSelectedMemoryModuleIds([])}
                    className="text-xs text-red-500 hover:text-red-600"
                  >
                    清空
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {modules.filter(m => m.id !== selectedModuleId).map(module => {
                    const hasMessages = (moduleMessages[module.id]?.length || 0) > 0;
                    const isSelected = selectedMemoryModuleIds.includes(module.id);
                    return (
                      <button
                        key={module.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedMemoryModuleIds(prev => prev.filter(id => id !== module.id));
                          } else {
                            setSelectedMemoryModuleIds(prev => [...prev, module.id]);
                          }
                        }}
                        disabled={!hasMessages}
                        className={`px-2 py-1 rounded-lg text-xs transition-all flex items-center gap-1 ${
                          isSelected
                            ? 'bg-golden text-white'
                            : hasMessages
                              ? 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <span>{module.icon}</span>
                        <span>{module.name}</span>
                        {hasMessages && (
                          <span className={`text-[10px] px-1 rounded-full ${
                            isSelected ? 'bg-white/30' : 'bg-gray-300 text-gray-600'
                          }`}>
                            {moduleMessages[module.id]?.length || 0}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {modules.filter(m => m.id !== selectedModuleId && (moduleMessages[m.id]?.length || 0) > 0).length === 0 && (
                  <p className="text-xs text-gray-500 mt-2">暂无其他模块的记忆可以引用</p>
                )}
              </div>
            )}

            {isLoading && (
              <div className="flex items-center gap-2 mb-2 py-1">
                <div className="w-4 h-4 border-2 border-golden/30 border-t-golden rounded-full animate-spin" />
                <span className={`text-sm ${inputBarTransparent ? 'text-white' : 'text-gray-600'}`}>思考中...</span>
                <button
                  onClick={handleStopGeneration}
                  className={`ml-auto text-sm ${inputBarTransparent ? 'text-white hover:text-white/80 hover:bg-white/20' : 'text-red-500 hover:text-red-600 hover:bg-red-50'} px-2.5 py-1 rounded-lg transition-colors`}
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
                    发送
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showColorSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setShowColorSettings(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] sm:max-h-none flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
              <h3 className="text-lg font-semibold text-gray-800">文字颜色设置</h3>
              <button
                onClick={() => setShowColorSettings(false)}
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
                    <span>👤</span>
                    用户文字颜色
                  </label>
                  <div 
                    className="w-8 h-8 rounded-full border-2 border-gray-200"
                    style={{ backgroundColor: userTextColor }}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={userTextColor}
                    onChange={(e) => setUserTextColor(e.target.value)}
                    className="w-12 h-10 rounded-lg border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={userTextColor}
                    onChange={(e) => setUserTextColor(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['#000000', '#ffffff', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#fd79a8', '#a29bfe'].map((color) => (
                    <button
                      key={color}
                      onClick={() => setUserTextColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        userTextColor === color ? 'border-gray-800 scale-110' : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <span>🤖</span>
                    AI 文字颜色
                  </label>
                  <div 
                    className="w-8 h-8 rounded-full border-2 border-gray-200"
                    style={{ backgroundColor: aiTextColor }}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={aiTextColor}
                    onChange={(e) => setAiTextColor(e.target.value)}
                    className="w-12 h-10 rounded-lg border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={aiTextColor}
                    onChange={(e) => setAiTextColor(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['#ffffff', '#000000', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#fd79a8', '#a29bfe'].map((color) => (
                    <button
                      key={color}
                      onClick={() => setAiTextColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        aiTextColor === color ? 'border-gray-800 scale-110' : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <span>📐</span>
                    顶部栏透明
                  </label>
                  <button
                    onClick={() => setTopBarTransparent(!topBarTransparent)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      topBarTransparent ? 'bg-golden' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      topBarTransparent ? 'translate-x-7' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <span>📝</span>
                    输入栏透明
                  </label>
                  <button
                    onClick={() => setInputBarTransparent(!inputBarTransparent)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      inputBarTransparent ? 'bg-golden' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      inputBarTransparent ? 'translate-x-7' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <span>🔍</span>
                    文字大小
                  </label>
                  <span className="text-sm text-gray-500">{(textScale * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="2"
                  step="0.1"
                  value={textScale}
                  onChange={(e) => setTextScale(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>80%</span>
                  <span>100%</span>
                  <span>150%</span>
                  <span>200%</span>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 shrink-0">
              <button
                onClick={() => setShowColorSettings(false)}
                className="w-full px-4 py-3 bg-golden text-white rounded-xl font-semibold hover:opacity-90 transition-colors"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showModuleEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] sm:max-h-none flex flex-col">
            {showModuleEditor === 'mobile-select' ? (
              <>
                <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
                  <h3 className="text-lg font-semibold text-gray-800">选择模块</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAddModule}
                      className="p-2 text-gray-400 hover:text-golden hover:bg-golden/10 rounded-lg transition-colors"
                      title="添加模块"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setShowModuleEditor(null)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="p-3 space-y-2 overflow-y-auto flex-1">
                  {modules.map((module) => (
                    <div key={module.id} className="relative">
                      <div
                        className={`w-full px-4 py-3 rounded-xl transition-all flex items-center gap-3 cursor-pointer ${
                          selectedModuleId === module.id
                            ? 'bg-golden/10 border-2 border-golden text-golden'
                            : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100 text-gray-700'
                        }`}
                        onClick={() => {
                          setSelectedModuleId(module.id);
                          setShowModuleEditor(null);
                          setIsMaximized(true);
                        }}
                      >
                        <span className="text-xl">{module.icon}</span>
                        <span className="font-medium flex-1">{module.name}</span>
                        {selectedModuleId === module.id && (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditModule(module);
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                            title="编辑"
                          >
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleDeleteModule(module.id, e)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="删除"
                          >
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
