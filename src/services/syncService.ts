interface SyncData {
  version: string;
  timestamp: string;
  books: any[];
  bookSources: any[];
  protocols: any[];
  protocolExecutionHistory: Record<string, any[]>; // 协议执行历史
  quotes: any[]; // 醒世恒言语录
  music: {
    volume: number;
    tracks: any[]; // 本地音乐元数据
  };
  thinkTank: {
    modules: any[];
    selectedModule: string | null;
    selectedMemoryModules: string[]; // 选中的记忆模块
    memoryConfig: any;
    moduleMessages: any;
    uiSettings: {
      backgroundImage: string | null;
      userTextColor: string;
      aiTextColor: string;
      topbarTransparent: boolean;
      inputbarTransparent: boolean;
      textScale: number;
    };
  };
  customProtocolThemes: any[];
  reader: {
    backgroundColor: string | null;
    textColor: string | null;
    selectedVoice: string | null;
  };
  speech: {
    rate: number;
    selectedVoice: string | null;
  };
  aiConfig: any | null;
  aiAssistant: {
    chatSessions: any[];
    uiSettings: {
      backgroundImage: string | null;
      userTextColor: string;
      aiTextColor: string;
      textScale: number;
      topbarTransparent: boolean;
      inputbarTransparent: boolean;
      bubbleTransparent: boolean;
      webSearchEnabled: boolean;
    };
  };
  musicWebsites: any[];
  agentWorkflow: {
    agents: any[];
    workflows: any[];
    instances: any[];
    memories: any[];
    feedbacks: any[];
    personas: any[];
  };
  protocolUiModules: any[]; // 协议创建界面的 UI 模块
  mindMaps: any[]; // 保存的思维导图历史记录
  currentMindMap: any | null; // 当前正在编辑的思维导图
  mindMapConnections: any[]; // 思维导图自定义连线
}

export interface MergeStats {
  added: number;
  updated: number;
  conflicts: number;
}

export interface MergeResult {
  books: MergeStats;
  bookSources: MergeStats;
  protocols: MergeStats;
  protocolExecutionHistory: MergeStats;
  quotes: MergeStats;
  musicTracks: MergeStats;
  thinkTankModules: MergeStats;
  thinkTankMessages: MergeStats;
  musicWebsites: MergeStats;
  agentWorkflow: MergeStats;
  protocolUiModules: MergeStats;
  mindMaps: MergeStats;
  aiAssistantChatSessions: MergeStats;
}

const STORAGE_KEYS = {
  books: 'golden-thread-books',
  bookSources: 'golden-thread-book-sources',
  protocols: 'golden-thread-protocols',
  protocolExecutionHistory: 'protocol-execution-history',
  quotes: 'golden-thread-quotes',
  darkMode: 'dark-mode',
  colorTheme: 'color-theme',
  backgroundImage: 'background-image',
  brightness: 'brightness',
  musicVolume: 'music-volume',
  musicTracks: 'music-tracks-metadata',
  thinkTankModules: 'think-tank-modules',
  thinkTankSelectedModule: 'think-tank-selected-module',
  thinkTankSelectedMemoryModules: 'think-tank-selected-memory-modules',
  thinkTankMemoryConfig: 'think-tank-memory-config',
  thinkTankModuleMessages: 'think-tank-module-messages',
  thinkTankBackgroundImage: 'think-tank-background-image',
  thinkTankUserTextColor: 'think-tank-user-text-color',
  thinkTankAiTextColor: 'think-tank-ai-text-color',
  thinkTankTopbarTransparent: 'think-tank-topbar-transparent',
  thinkTankInputbarTransparent: 'think-tank-inputbar-transparent',
  thinkTankTextScale: 'think-tank-text-scale',
  customProtocolThemes: 'custom-protocol-themes',
  readerBgColor: 'reader-bg-color',
  readerTextColor: 'reader-text-color',
  readerSelectedVoice: 'selected-voice',
  speechRate: 'speech-rate',
  speechSelectedVoice: 'selected-voice',
  aiConfig: 'ai-api-config',
  musicWebsites: 'music-websites',
  agentModules: 'agent-modules',
  agentWorkflows: 'agent-workflows',
  agentWorkflowInstances: 'agent-workflow-instances',
  agentMemories: 'agent-memories',
  agentFeedbacks: 'agent-feedbacks',
  agentPersonas: 'agent-personas',
  protocolUiModules: 'protocol-ui-modules',
  mindMaps: 'saved-mindmaps',
  currentMindMap: 'simple-mindmap-data',
  mindMapConnections: 'mindmap-custom-connections',
  aiAssistantChatSessions: 'chat-sessions',
  aiAssistantBackground: 'ai-assistant-background',
  aiAssistantUserTextColor: 'ai-assistant-user-text-color',
  aiAssistantAiTextColor: 'ai-assistant-ai-text-color',
  aiAssistantTextScale: 'ai-assistant-text-scale',
  aiAssistantTopbarTransparent: 'ai-assistant-topbar-transparent',
  aiAssistantInputbarTransparent: 'ai-assistant-inputbar-transparent',
  aiAssistantBubbleTransparent: 'ai-assistant-bubble-transparent',
  aiAssistantWebSearchEnabled: 'web-search-enabled',
};

export class SyncService {
  static collectData(): SyncData {
    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      books: this.getFromLocalStorage(STORAGE_KEYS.books, []),
      bookSources: this.getFromLocalStorage(STORAGE_KEYS.bookSources, []),
      protocols: this.getFromLocalStorage(STORAGE_KEYS.protocols, []),
      protocolExecutionHistory: this.getFromLocalStorage(STORAGE_KEYS.protocolExecutionHistory, {}),
      quotes: this.getFromLocalStorage(STORAGE_KEYS.quotes, []),
      music: {
        volume: this.getFromLocalStorage(STORAGE_KEYS.musicVolume, 0.5),
        tracks: this.getFromLocalStorage(STORAGE_KEYS.musicTracks, []),
      },
      thinkTank: {
        modules: this.getFromLocalStorage(STORAGE_KEYS.thinkTankModules, []),
        selectedModule: this.getFromLocalStorage(STORAGE_KEYS.thinkTankSelectedModule, null),
        selectedMemoryModules: this.getFromLocalStorage(STORAGE_KEYS.thinkTankSelectedMemoryModules, []),
        memoryConfig: this.getFromLocalStorage(STORAGE_KEYS.thinkTankMemoryConfig, { maxWords: 2000, autoExtract: true }),
        moduleMessages: this.getFromLocalStorage(STORAGE_KEYS.thinkTankModuleMessages, {}),
        uiSettings: {
          backgroundImage: this.getFromLocalStorage(STORAGE_KEYS.thinkTankBackgroundImage, null),
          userTextColor: this.getFromLocalStorage(STORAGE_KEYS.thinkTankUserTextColor, '#000000'),
          aiTextColor: this.getFromLocalStorage(STORAGE_KEYS.thinkTankAiTextColor, '#ffffff'),
          topbarTransparent: this.getFromLocalStorage(STORAGE_KEYS.thinkTankTopbarTransparent, false),
          inputbarTransparent: this.getFromLocalStorage(STORAGE_KEYS.thinkTankInputbarTransparent, false),
          textScale: this.getFromLocalStorage(STORAGE_KEYS.thinkTankTextScale, 1),
        },
      },
      customProtocolThemes: this.getFromLocalStorage(STORAGE_KEYS.customProtocolThemes, []),
      reader: {
        backgroundColor: this.getFromLocalStorage(STORAGE_KEYS.readerBgColor, null),
        textColor: this.getFromLocalStorage(STORAGE_KEYS.readerTextColor, null),
        selectedVoice: this.getFromLocalStorage(STORAGE_KEYS.readerSelectedVoice, null),
      },
      speech: {
        rate: this.getFromLocalStorage(STORAGE_KEYS.speechRate, 1),
        selectedVoice: this.getFromLocalStorage(STORAGE_KEYS.speechSelectedVoice, null),
      },
      aiConfig: this.getFromLocalStorage(STORAGE_KEYS.aiConfig, null),
      aiAssistant: {
        chatSessions: this.getFromLocalStorage(STORAGE_KEYS.aiAssistantChatSessions, []),
        uiSettings: {
          backgroundImage: this.getFromLocalStorage(STORAGE_KEYS.aiAssistantBackground, null),
          userTextColor: this.getFromLocalStorage(STORAGE_KEYS.aiAssistantUserTextColor, '#000000'),
          aiTextColor: this.getFromLocalStorage(STORAGE_KEYS.aiAssistantAiTextColor, '#000000'),
          textScale: this.getFromLocalStorage(STORAGE_KEYS.aiAssistantTextScale, 1),
          topbarTransparent: this.getFromLocalStorage(STORAGE_KEYS.aiAssistantTopbarTransparent, false),
          inputbarTransparent: this.getFromLocalStorage(STORAGE_KEYS.aiAssistantInputbarTransparent, false),
          bubbleTransparent: this.getFromLocalStorage(STORAGE_KEYS.aiAssistantBubbleTransparent, false),
          webSearchEnabled: this.getFromLocalStorage(STORAGE_KEYS.aiAssistantWebSearchEnabled, false),
        },
      },
      musicWebsites: this.getFromLocalStorage(STORAGE_KEYS.musicWebsites, []),
      agentWorkflow: {
        agents: this.getFromLocalStorage(STORAGE_KEYS.agentModules, []),
        workflows: this.getFromLocalStorage(STORAGE_KEYS.agentWorkflows, []),
        instances: this.getFromLocalStorage(STORAGE_KEYS.agentWorkflowInstances, []),
        memories: this.getFromLocalStorage(STORAGE_KEYS.agentMemories, []),
        feedbacks: this.getFromLocalStorage(STORAGE_KEYS.agentFeedbacks, []),
        personas: this.getFromLocalStorage(STORAGE_KEYS.agentPersonas, []),
      },
      protocolUiModules: this.getFromLocalStorage(STORAGE_KEYS.protocolUiModules, []),
      mindMaps: this.getFromLocalStorage(STORAGE_KEYS.mindMaps, []),
      currentMindMap: this.getFromLocalStorage(STORAGE_KEYS.currentMindMap, null),
      mindMapConnections: this.getFromLocalStorage(STORAGE_KEYS.mindMapConnections, []),
    };
  }

  static restoreData(data: SyncData): void {
    this.saveToLocalStorage(STORAGE_KEYS.books, data.books);
    this.saveToLocalStorage(STORAGE_KEYS.bookSources, data.bookSources);
    this.saveToLocalStorage(STORAGE_KEYS.protocols, data.protocols);
    this.saveToLocalStorage(STORAGE_KEYS.musicVolume, data.music.volume);

    // 恢复协议执行历史
    if (data.protocolExecutionHistory && Object.keys(data.protocolExecutionHistory).length > 0) {
      this.saveToLocalStorage(STORAGE_KEYS.protocolExecutionHistory, data.protocolExecutionHistory);
    }

    // 恢复醒世恒言语录
    if (data.quotes && data.quotes.length > 0) {
      this.saveToLocalStorage(STORAGE_KEYS.quotes, data.quotes);
    }

    // 恢复本地音乐元数据
    if (data.music.tracks && data.music.tracks.length > 0) {
      this.saveToLocalStorage(STORAGE_KEYS.musicTracks, data.music.tracks);
    }

    if (data.thinkTank) {
      this.saveToLocalStorage(STORAGE_KEYS.thinkTankModules, data.thinkTank.modules);
      if (data.thinkTank.selectedModule) {
        this.saveToLocalStorage(STORAGE_KEYS.thinkTankSelectedModule, data.thinkTank.selectedModule);
      }
      if (data.thinkTank.selectedMemoryModules && data.thinkTank.selectedMemoryModules.length > 0) {
        this.saveToLocalStorage(STORAGE_KEYS.thinkTankSelectedMemoryModules, data.thinkTank.selectedMemoryModules);
      }
      this.saveToLocalStorage(STORAGE_KEYS.thinkTankMemoryConfig, data.thinkTank.memoryConfig);
      this.saveToLocalStorage(STORAGE_KEYS.thinkTankModuleMessages, data.thinkTank.moduleMessages);
      
      // 恢复智库 UI 设置
      if (data.thinkTank.uiSettings) {
        if (data.thinkTank.uiSettings.backgroundImage) {
          this.saveToLocalStorage(STORAGE_KEYS.thinkTankBackgroundImage, data.thinkTank.uiSettings.backgroundImage);
        }
        this.saveToLocalStorage(STORAGE_KEYS.thinkTankUserTextColor, data.thinkTank.uiSettings.userTextColor);
        this.saveToLocalStorage(STORAGE_KEYS.thinkTankAiTextColor, data.thinkTank.uiSettings.aiTextColor);
        this.saveToLocalStorage(STORAGE_KEYS.thinkTankTopbarTransparent, data.thinkTank.uiSettings.topbarTransparent);
        this.saveToLocalStorage(STORAGE_KEYS.thinkTankInputbarTransparent, data.thinkTank.uiSettings.inputbarTransparent);
        this.saveToLocalStorage(STORAGE_KEYS.thinkTankTextScale, data.thinkTank.uiSettings.textScale);
      }
    }

    if (data.customProtocolThemes) {
      this.saveToLocalStorage(STORAGE_KEYS.customProtocolThemes, data.customProtocolThemes);
    }
    
    if (data.reader) {
      if (data.reader.backgroundColor) {
        this.saveToLocalStorage(STORAGE_KEYS.readerBgColor, data.reader.backgroundColor);
      }
      if (data.reader.textColor) {
        this.saveToLocalStorage(STORAGE_KEYS.readerTextColor, data.reader.textColor);
      }
      if (data.reader.selectedVoice) {
        this.saveToLocalStorage(STORAGE_KEYS.readerSelectedVoice, data.reader.selectedVoice);
      }
    }

    // 恢复朗读设置
    if (data.speech) {
      this.saveToLocalStorage(STORAGE_KEYS.speechRate, data.speech.rate);
      if (data.speech.selectedVoice) {
        this.saveToLocalStorage(STORAGE_KEYS.speechSelectedVoice, data.speech.selectedVoice);
      }
    }
    
    if (data.aiConfig) {
      this.saveToLocalStorage(STORAGE_KEYS.aiConfig, data.aiConfig);
    }
    
    if (data.musicWebsites && data.musicWebsites.length > 0) {
      this.saveToLocalStorage(STORAGE_KEYS.musicWebsites, data.musicWebsites);
    }

    // 恢复工作流数据
    if (data.agentWorkflow) {
      if (data.agentWorkflow.agents && data.agentWorkflow.agents.length > 0) {
        this.saveToLocalStorage(STORAGE_KEYS.agentModules, data.agentWorkflow.agents);
      }
      if (data.agentWorkflow.workflows && data.agentWorkflow.workflows.length > 0) {
        this.saveToLocalStorage(STORAGE_KEYS.agentWorkflows, data.agentWorkflow.workflows);
      }
      if (data.agentWorkflow.instances && data.agentWorkflow.instances.length > 0) {
        this.saveToLocalStorage(STORAGE_KEYS.agentWorkflowInstances, data.agentWorkflow.instances);
      }
      if (data.agentWorkflow.memories && data.agentWorkflow.memories.length > 0) {
        this.saveToLocalStorage(STORAGE_KEYS.agentMemories, data.agentWorkflow.memories);
      }
      if (data.agentWorkflow.feedbacks && data.agentWorkflow.feedbacks.length > 0) {
        this.saveToLocalStorage(STORAGE_KEYS.agentFeedbacks, data.agentWorkflow.feedbacks);
      }
      if (data.agentWorkflow.personas && data.agentWorkflow.personas.length > 0) {
        this.saveToLocalStorage(STORAGE_KEYS.agentPersonas, data.agentWorkflow.personas);
      }
    }

    // 恢复协议 UI 模块
    if (data.protocolUiModules && data.protocolUiModules.length > 0) {
      this.saveToLocalStorage(STORAGE_KEYS.protocolUiModules, data.protocolUiModules);
    }

    // 恢复思维导图
    if (data.mindMaps && data.mindMaps.length > 0) {
      this.saveToLocalStorage(STORAGE_KEYS.mindMaps, data.mindMaps);
    }
    if (data.currentMindMap) {
      this.saveToLocalStorage(STORAGE_KEYS.currentMindMap, data.currentMindMap);
    }
    if (data.mindMapConnections && data.mindMapConnections.length > 0) {
      this.saveToLocalStorage(STORAGE_KEYS.mindMapConnections, data.mindMapConnections);
    }

    // 恢复 AI 助手数据
    if (data.aiAssistant) {
      if (data.aiAssistant.chatSessions && data.aiAssistant.chatSessions.length > 0) {
        this.saveToLocalStorage(STORAGE_KEYS.aiAssistantChatSessions, data.aiAssistant.chatSessions);
      }
      // 恢复 AI 助手 UI 设置
      if (data.aiAssistant.uiSettings) {
        if (data.aiAssistant.uiSettings.backgroundImage) {
          this.saveToLocalStorage(STORAGE_KEYS.aiAssistantBackground, data.aiAssistant.uiSettings.backgroundImage);
        }
        this.saveToLocalStorage(STORAGE_KEYS.aiAssistantUserTextColor, data.aiAssistant.uiSettings.userTextColor);
        this.saveToLocalStorage(STORAGE_KEYS.aiAssistantAiTextColor, data.aiAssistant.uiSettings.aiTextColor);
        this.saveToLocalStorage(STORAGE_KEYS.aiAssistantTextScale, data.aiAssistant.uiSettings.textScale);
        this.saveToLocalStorage(STORAGE_KEYS.aiAssistantTopbarTransparent, data.aiAssistant.uiSettings.topbarTransparent);
        this.saveToLocalStorage(STORAGE_KEYS.aiAssistantInputbarTransparent, data.aiAssistant.uiSettings.inputbarTransparent);
        this.saveToLocalStorage(STORAGE_KEYS.aiAssistantBubbleTransparent, data.aiAssistant.uiSettings.bubbleTransparent);
        this.saveToLocalStorage(STORAGE_KEYS.aiAssistantWebSearchEnabled, data.aiAssistant.uiSettings.webSearchEnabled);
      }
    }
  }

  static exportToJSON(): string {
    const data = this.collectData();
    return JSON.stringify(data, null, 2);
  }

  static importFromJSON(jsonString: string, mode: 'replace' | 'merge' = 'replace'): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (!data.version || !data.timestamp) {
        throw new Error('无效的同步数据格式');
      }
      
      if (mode === 'merge') {
        this.mergeData(data);
      } else {
        this.restoreData(data);
      }
      return true;
    } catch (error) {
      console.error('导入数据失败:', error);
      return false;
    }
  }

  /**
   * 智能合并数据 - 保留两边的数据，自动去重
   */
  static mergeData(importedData: SyncData): MergeResult {
    const currentData = this.collectData();
    const result: MergeResult = {
      books: { added: 0, updated: 0, conflicts: 0 },
      bookSources: { added: 0, updated: 0, conflicts: 0 },
      protocols: { added: 0, updated: 0, conflicts: 0 },
      protocolExecutionHistory: { added: 0, updated: 0, conflicts: 0 },
      quotes: { added: 0, updated: 0, conflicts: 0 },
      musicTracks: { added: 0, updated: 0, conflicts: 0 },
      thinkTankModules: { added: 0, updated: 0, conflicts: 0 },
      thinkTankMessages: { added: 0, updated: 0, conflicts: 0 },
      musicWebsites: { added: 0, updated: 0, conflicts: 0 },
      agentWorkflow: { added: 0, updated: 0, conflicts: 0 },
      protocolUiModules: { added: 0, updated: 0, conflicts: 0 },
      mindMaps: { added: 0, updated: 0, conflicts: 0 },
      aiAssistantChatSessions: { added: 0, updated: 0, conflicts: 0 },
    };
    
    // 用于内部统计但不显示在 MergeResult 中的临时对象
    const internalStats = {
      themes: { added: 0, updated: 0, conflicts: 0 },
    };

    // 1. 合并书籍 - 按 ID 去重，同名保留最新的
    const mergedBooks = this.mergeArrayById(
      currentData.books,
      importedData.books,
      'id',
      (a, b) => new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime(),
      result.books
    );

    // 2. 合并书源 - 按 URL 去重
    const mergedBookSources = this.mergeArrayByKey(
      currentData.bookSources,
      importedData.bookSources,
      'url',
      result.bookSources
    );

    // 3. 合并协议 - 按 ID 去重，保留执行次数更多的
    const mergedProtocols = this.mergeArrayById(
      currentData.protocols,
      importedData.protocols,
      'id',
      (a, b) => (b.successCount + b.failureCount) - (a.successCount + a.failureCount),
      result.protocols
    );

    // 4. 合并智库模块 - 按 ID 去重，保留最新的
    const mergedModules = this.mergeArrayById(
      currentData.thinkTank.modules,
      importedData.thinkTank?.modules || [],
      'id',
      null,
      result.thinkTankModules
    );

    // 5. 合并智库对话历史 - 按模块合并消息
    const mergedMessages = this.mergeModuleMessages(
      currentData.thinkTank.moduleMessages,
      importedData.thinkTank?.moduleMessages || {},
      result.thinkTankMessages
    );

    // 6. 合并音乐网站 - 按 URL 去重
    const mergedMusicWebsites = this.mergeArrayByKey(
      currentData.musicWebsites,
      importedData.musicWebsites || [],
      'url',
      result.musicWebsites
    );

    // 7. 合并工作流数据
    const mergedAgentWorkflow = this.mergeAgentWorkflow(
      currentData.agentWorkflow,
      importedData.agentWorkflow,
      result.agentWorkflow
    );

    // 8. 合并自定义协议主题
    const mergedThemes = this.mergeArrayById(
      currentData.customProtocolThemes,
      importedData.customProtocolThemes || [],
      'id',
      null,
      internalStats.themes
    );

    // 9. 合并 AI 助手聊天记录 - 按会话 ID 去重
    const mergedChatSessions = this.mergeArrayById(
      currentData.aiAssistant.chatSessions,
      importedData.aiAssistant?.chatSessions || [],
      'id',
      (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
      result.aiAssistantChatSessions
    );

    // 10. 合并协议执行历史 - 合并每一天的记录
    const mergedExecutionHistory = this.mergeExecutionHistory(
      currentData.protocolExecutionHistory,
      importedData.protocolExecutionHistory || {},
      result.protocolExecutionHistory
    );

    // 11. 合并醒世恒言语录 - 按 ID 去重
    const mergedQuotes = this.mergeArrayById(
      currentData.quotes,
      importedData.quotes || [],
      'id',
      null,
      result.quotes
    );

    // 12. 合并本地音乐元数据 - 按 ID 去重
    const mergedMusicTracks = this.mergeArrayById(
      currentData.music.tracks,
      importedData.music?.tracks || [],
      'id',
      null,
      result.musicTracks
    );

    // 13. 合并协议 UI 模块 - 按 ID 去重
    const mergedProtocolUiModules = this.mergeArrayById(
      currentData.protocolUiModules,
      importedData.protocolUiModules || [],
      'id',
      null,
      result.protocolUiModules
    );

    // 14. 合并思维导图 - 按 ID 去重，保留最新的
    const mergedMindMaps = this.mergeArrayById(
      currentData.mindMaps,
      importedData.mindMaps || [],
      'id',
      (a, b) => new Date(b.savedAt || 0).getTime() - new Date(a.savedAt || 0).getTime(),
      result.mindMaps
    );

    // 保存合并后的数据
    this.saveToLocalStorage(STORAGE_KEYS.books, mergedBooks);
    this.saveToLocalStorage(STORAGE_KEYS.bookSources, mergedBookSources);
    this.saveToLocalStorage(STORAGE_KEYS.protocols, mergedProtocols);
    this.saveToLocalStorage(STORAGE_KEYS.protocolExecutionHistory, mergedExecutionHistory);
    this.saveToLocalStorage(STORAGE_KEYS.quotes, mergedQuotes);
    this.saveToLocalStorage(STORAGE_KEYS.musicTracks, mergedMusicTracks);
    this.saveToLocalStorage(STORAGE_KEYS.thinkTankModules, mergedModules);
    this.saveToLocalStorage(STORAGE_KEYS.thinkTankModuleMessages, mergedMessages);
    this.saveToLocalStorage(STORAGE_KEYS.musicWebsites, mergedMusicWebsites);
    this.saveToLocalStorage(STORAGE_KEYS.customProtocolThemes, mergedThemes);

    // 保存工作流数据
    this.saveToLocalStorage(STORAGE_KEYS.agentModules, mergedAgentWorkflow.agents);
    this.saveToLocalStorage(STORAGE_KEYS.agentWorkflows, mergedAgentWorkflow.workflows);
    this.saveToLocalStorage(STORAGE_KEYS.agentWorkflowInstances, mergedAgentWorkflow.instances);
    this.saveToLocalStorage(STORAGE_KEYS.agentMemories, mergedAgentWorkflow.memories);
    this.saveToLocalStorage(STORAGE_KEYS.agentFeedbacks, mergedAgentWorkflow.feedbacks);
    this.saveToLocalStorage(STORAGE_KEYS.agentPersonas, mergedAgentWorkflow.personas);

    // 保存协议 UI 模块
    this.saveToLocalStorage(STORAGE_KEYS.protocolUiModules, mergedProtocolUiModules);

    // 保存思维导图
    this.saveToLocalStorage(STORAGE_KEYS.mindMaps, mergedMindMaps);

    // 保存 AI 助手聊天记录
    this.saveToLocalStorage(STORAGE_KEYS.aiAssistantChatSessions, mergedChatSessions);

    // 音量取平均值
    const mergedVolume = (currentData.music.volume + importedData.music.volume) / 2;
    this.saveToLocalStorage(STORAGE_KEYS.musicVolume, mergedVolume);

    // AI 配置：如果当前没有则使用导入的，否则保留当前的
    if (!currentData.aiConfig && importedData.aiConfig) {
      this.saveToLocalStorage(STORAGE_KEYS.aiConfig, importedData.aiConfig);
    }

    // 阅读器设置：保留当前的，除非当前没有
    if (importedData.reader) {
      if (!currentData.reader.backgroundColor && importedData.reader.backgroundColor) {
        this.saveToLocalStorage(STORAGE_KEYS.readerBgColor, importedData.reader.backgroundColor);
      }
      if (!currentData.reader.textColor && importedData.reader.textColor) {
        this.saveToLocalStorage(STORAGE_KEYS.readerTextColor, importedData.reader.textColor);
      }
      if (!currentData.reader.selectedVoice && importedData.reader.selectedVoice) {
        this.saveToLocalStorage(STORAGE_KEYS.readerSelectedVoice, importedData.reader.selectedVoice);
      }
    }

    // 朗读设置：如果当前没有则使用导入的
    if (importedData.speech) {
      if (!currentData.speech.selectedVoice && importedData.speech.selectedVoice) {
        this.saveToLocalStorage(STORAGE_KEYS.speechSelectedVoice, importedData.speech.selectedVoice);
      }
    }

    return result;
  }

  /**
   * 按 ID 合并数组，自动去重
   */
  private static mergeArrayById<T extends { id: string }>(
    current: T[],
    imported: T[],
    idKey: keyof T,
    compareFn: ((a: T, b: T) => number) | null,
    stats: { added: number; updated: number; conflicts: number }
  ): T[] {
    const map = new Map<string, T>();
    
    // 先添加当前数据
    current.forEach(item => {
      if (item[idKey]) {
        map.set(String(item[idKey]), item);
      }
    });

    // 合并导入的数据
    imported.forEach(item => {
      const id = String(item[idKey]);
      if (!id) return;

      if (map.has(id)) {
        const existing = map.get(id)!;
        stats.conflicts++;
        
        // 如果有比较函数，选择更优的
        if (compareFn) {
          const shouldReplace = compareFn(existing, item) < 0;
          if (shouldReplace) {
            map.set(id, item);
            stats.updated++;
          }
        }
      } else {
        map.set(id, item);
        stats.added++;
      }
    });

    return Array.from(map.values());
  }

  /**
   * 按指定 key 合并数组
   */
  private static mergeArrayByKey<T>(
    current: T[],
    imported: T[],
    key: keyof T,
    stats: { added: number; updated: number; conflicts: number }
  ): T[] {
    const map = new Map<string, T>();
    
    current.forEach(item => {
      const keyValue = String(item[key]);
      if (keyValue) map.set(keyValue, item);
    });

    imported.forEach(item => {
      const keyValue = String(item[key]);
      if (!keyValue) return;

      if (map.has(keyValue)) {
        stats.conflicts++;
        // 保留导入的（假设更新）
        map.set(keyValue, item);
        stats.updated++;
      } else {
        map.set(keyValue, item);
        stats.added++;
      }
    });

    return Array.from(map.values());
  }

  /**
   * 合并智库模块消息
   */
  private static mergeModuleMessages(
    current: Record<string, any[]>,
    imported: Record<string, any[]>,
    stats: { added: number; updated: number; conflicts: number }
  ): Record<string, any[]> {
    const result: Record<string, any[]> = { ...current };

    Object.entries(imported).forEach(([moduleId, messages]) => {
      if (!Array.isArray(messages)) return;

      if (!result[moduleId]) {
        // 当前没有该模块的消息，直接添加
        result[moduleId] = messages;
        stats.added += messages.length;
      } else {
        // 合并消息，按 ID 去重
        const existingIds = new Set(result[moduleId].map(m => m.id));
        const newMessages = messages.filter(m => !existingIds.has(m.id));
        result[moduleId] = [...result[moduleId], ...newMessages];
        stats.added += newMessages.length;
        
        // 按时间排序
        result[moduleId].sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      }
    });

    return result;
  }

  /**
   * 合并工作流数据
   */
  private static mergeAgentWorkflow(
    current: SyncData['agentWorkflow'],
    imported: SyncData['agentWorkflow'] | undefined,
    stats: { added: number; updated: number; conflicts: number }
  ): SyncData['agentWorkflow'] {
    if (!imported) return current;

    const mergeArray = <T extends { id?: string }>(curr: T[], imp: T[]): T[] => {
      const map = new Map<string, T>();
      curr.forEach(item => item.id && map.set(item.id, item));
      imp.forEach(item => {
        if (item.id) {
          if (map.has(item.id)) stats.conflicts++;
          else stats.added++;
          map.set(item.id, item);
        }
      });
      return Array.from(map.values());
    };

    return {
      agents: mergeArray(current.agents, imported.agents || []),
      workflows: mergeArray(current.workflows, imported.workflows || []),
      instances: mergeArray(current.instances, imported.instances || []),
      memories: [...current.memories, ...(imported.memories || [])],
      feedbacks: [...current.feedbacks, ...(imported.feedbacks || [])],
      personas: mergeArray(current.personas, imported.personas || []),
    };
  }

  /**
   * 合并协议执行历史 - 按日期合并每一天的记录
   */
  private static mergeExecutionHistory(
    current: Record<string, any[]>,
    imported: Record<string, any[]>,
    stats: { added: number; updated: 0; conflicts: 0 }
  ): Record<string, any[]> {
    const result: Record<string, any[]> = { ...current };

    Object.entries(imported).forEach(([date, records]) => {
      if (!Array.isArray(records)) return;

      if (!result[date]) {
        // 当前没有该日期的记录，直接添加
        result[date] = records;
        stats.added += records.length;
      } else {
        // 合并同一天的记录，按协议ID去重
        const existingIds = new Set(result[date].map((r: any) => r.protocolId + '-' + r.timestamp));
        const newRecords = records.filter((r: any) => !existingIds.has(r.protocolId + '-' + r.timestamp));
        result[date] = [...result[date], ...newRecords];
        stats.added += newRecords.length;
        
        // 按时间排序
        result[date].sort((a: any, b: any) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      }
    });

    return result;
  }

  static downloadJSON(filename: string = 'golden-thread-backup.json'): void {
    const json = this.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private static getFromLocalStorage(key: string, defaultValue: any): any {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      return JSON.parse(item);
    } catch {
      return defaultValue;
    }
  }

  private static saveToLocalStorage(key: string, value: any): void {
    localStorage.setItem(key, JSON.stringify(value));
  }
}
