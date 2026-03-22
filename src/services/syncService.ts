interface SyncData {
  version: string;
  timestamp: string;
  books: any[];
  bookSources: any[];
  protocols: any[];
  theme: {
    isDarkMode: boolean;
    currentTheme: string;
    backgroundImage: string | null;
    brightness: number;
  };
  music: {
    volume: number;
  };
  thinkTank: {
    modules: any[];
    selectedModule: string | null;
    memoryConfig: any;
    moduleMessages: any;
  };
  customProtocolThemes: any[];
  reader: {
    backgroundColor: string | null;
    textColor: string | null;
    selectedVoice: string | null;
  };
  aiConfig: any | null;
  musicWebsites: any[];
}

const STORAGE_KEYS = {
  books: 'golden-thread-books',
  bookSources: 'golden-thread-book-sources',
  protocols: 'golden-thread-protocols',
  darkMode: 'dark-mode',
  colorTheme: 'color-theme',
  backgroundImage: 'background-image',
  brightness: 'brightness',
  musicVolume: 'music-volume',
  thinkTankModules: 'think-tank-modules',
  thinkTankSelectedModule: 'think-tank-selected-module',
  thinkTankMemoryConfig: 'think-tank-memory-config',
  thinkTankModuleMessages: 'think-tank-module-messages',
  customProtocolThemes: 'custom-protocol-themes',
  readerBgColor: 'reader-bg-color',
  readerTextColor: 'reader-text-color',
  readerSelectedVoice: 'selected-voice',
  aiConfig: 'ai-api-config',
  musicWebsites: 'music-websites',
};

export class SyncService {
  static collectData(): SyncData {
    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      books: this.getFromLocalStorage(STORAGE_KEYS.books, []),
      bookSources: this.getFromLocalStorage(STORAGE_KEYS.bookSources, []),
      protocols: this.getFromLocalStorage(STORAGE_KEYS.protocols, []),
      theme: {
        isDarkMode: this.getFromLocalStorage(STORAGE_KEYS.darkMode, false),
        currentTheme: this.getFromLocalStorage(STORAGE_KEYS.colorTheme, 'golden'),
        backgroundImage: this.getFromLocalStorage(STORAGE_KEYS.backgroundImage, null),
        brightness: this.getFromLocalStorage(STORAGE_KEYS.brightness, 100),
      },
      music: {
        volume: this.getFromLocalStorage(STORAGE_KEYS.musicVolume, 0.5),
      },
      thinkTank: {
        modules: this.getFromLocalStorage(STORAGE_KEYS.thinkTankModules, []),
        selectedModule: this.getFromLocalStorage(STORAGE_KEYS.thinkTankSelectedModule, null),
        memoryConfig: this.getFromLocalStorage(STORAGE_KEYS.thinkTankMemoryConfig, { maxWords: 2000, autoExtract: true }),
        moduleMessages: this.getFromLocalStorage(STORAGE_KEYS.thinkTankModuleMessages, {}),
      },
      customProtocolThemes: this.getFromLocalStorage(STORAGE_KEYS.customProtocolThemes, []),
      reader: {
        backgroundColor: this.getFromLocalStorage(STORAGE_KEYS.readerBgColor, null),
        textColor: this.getFromLocalStorage(STORAGE_KEYS.readerTextColor, null),
        selectedVoice: this.getFromLocalStorage(STORAGE_KEYS.readerSelectedVoice, null),
      },
      aiConfig: this.getFromLocalStorage(STORAGE_KEYS.aiConfig, null),
      musicWebsites: this.getFromLocalStorage(STORAGE_KEYS.musicWebsites, []),
    };
  }

  static restoreData(data: SyncData): void {
    this.saveToLocalStorage(STORAGE_KEYS.books, data.books);
    this.saveToLocalStorage(STORAGE_KEYS.bookSources, data.bookSources);
    this.saveToLocalStorage(STORAGE_KEYS.protocols, data.protocols);
    this.saveToLocalStorage(STORAGE_KEYS.darkMode, data.theme.isDarkMode);
    this.saveToLocalStorage(STORAGE_KEYS.colorTheme, data.theme.currentTheme);
    if (data.theme.backgroundImage) {
      this.saveToLocalStorage(STORAGE_KEYS.backgroundImage, data.theme.backgroundImage);
    } else {
      localStorage.removeItem(STORAGE_KEYS.backgroundImage);
    }
    this.saveToLocalStorage(STORAGE_KEYS.brightness, data.theme.brightness);
    this.saveToLocalStorage(STORAGE_KEYS.musicVolume, data.music.volume);
    
    if (data.thinkTank) {
      this.saveToLocalStorage(STORAGE_KEYS.thinkTankModules, data.thinkTank.modules);
      if (data.thinkTank.selectedModule) {
        this.saveToLocalStorage(STORAGE_KEYS.thinkTankSelectedModule, data.thinkTank.selectedModule);
      }
      this.saveToLocalStorage(STORAGE_KEYS.thinkTankMemoryConfig, data.thinkTank.memoryConfig);
      this.saveToLocalStorage(STORAGE_KEYS.thinkTankModuleMessages, data.thinkTank.moduleMessages);
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
    
    if (data.aiConfig) {
      this.saveToLocalStorage(STORAGE_KEYS.aiConfig, data.aiConfig);
    }
    
    if (data.musicWebsites && data.musicWebsites.length > 0) {
      this.saveToLocalStorage(STORAGE_KEYS.musicWebsites, data.musicWebsites);
    }
  }

  static exportToJSON(): string {
    const data = this.collectData();
    return JSON.stringify(data, null, 2);
  }

  static importFromJSON(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (!data.version || !data.timestamp) {
        throw new Error('无效的同步数据格式');
      }
      this.restoreData(data);
      return true;
    } catch (error) {
      console.error('导入数据失败:', error);
      return false;
    }
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
