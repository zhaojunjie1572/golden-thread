import { SyncService } from './syncService';

const GIST_FILENAME = 'golden-thread-backup.json';
const GIST_DESCRIPTION = 'Golden Thread 应用数据备份 - 自动同步';
const AUTO_SYNC_INTERVAL = 60000;

export interface GitHubGistConfig {
  token: string;
  gistId?: string;
  autoSync: boolean;
  lastSyncTime?: string;
}

const GITHUB_GIST_STORAGE_KEY = 'golden-thread-gist-config';
let autoSyncInterval: number | null = null;

export class GitHubGistSyncService {
  static saveConfig(config: GitHubGistConfig): void {
    localStorage.setItem(GITHUB_GIST_STORAGE_KEY, JSON.stringify(config));
  }

  static getConfig(): GitHubGistConfig | null {
    try {
      const data = localStorage.getItem(GITHUB_GIST_STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('获取 GitHub Gist 配置失败:', error);
    }
    return null;
  }

  static clearConfig(): void {
    localStorage.removeItem(GITHUB_GIST_STORAGE_KEY);
  }

  static async uploadToGist(token: string, gistId?: string): Promise<{ success: boolean; gistId?: string; error?: string }> {
    try {
      const data = SyncService.exportToJSON();
      
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json'
      };

      if (gistId) {
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            description: GIST_DESCRIPTION,
            files: {
              [GIST_FILENAME]: {
                content: data
              }
            }
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (response.status === 404) {
            return { success: false, error: 'Gist 不存在，请检查 Gist ID 或重新创建' };
          }
          return { success: false, error: errorData.message || `上传失败: HTTP ${response.status}` };
        }

        const result = await response.json();
        return { success: true, gistId: result.id };
      } else {
        const response = await fetch('https://api.github.com/gists', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            description: GIST_DESCRIPTION,
            public: false,
            files: {
              [GIST_FILENAME]: {
                content: data
              }
            }
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          return { success: false, error: errorData.message || `创建失败: HTTP ${response.status}` };
        }

        const result = await response.json();
        return { success: true, gistId: result.id };
      }
    } catch (error) {
      console.error('上传到 GitHub Gist 失败:', error);
      return { success: false, error: error instanceof Error ? error.message : '网络错误' };
    }
  }

  static async downloadFromGist(token: string, gistId: string): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
      const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return { success: false, error: 'Gist 不存在，请检查 Gist ID' };
        }
        const errorData = await response.json();
        return { success: false, error: errorData.message || `下载失败: HTTP ${response.status}` };
      }

      const result = await response.json();
      const file = result.files[GIST_FILENAME];

      if (!file) {
        return { success: false, error: 'Gist 中没有找到备份文件' };
      }

      let jsonData;
      try {
        jsonData = JSON.parse(file.content);
      } catch {
        return { success: false, error: '数据格式无效' };
      }

      return { success: true, data: jsonData };
    } catch (error) {
      console.error('从 GitHub Gist 下载失败:', error);
      return { success: false, error: error instanceof Error ? error.message : '网络错误' };
    }
  }

  static checkConflict(localData: any, cloudData: any): { hasConflict: boolean; details: any } {
    if (!localData || !cloudData) {
      return { hasConflict: false, details: null };
    }

    const localTime = new Date(localData.timestamp || 0).getTime();
    const cloudTime = new Date(cloudData.timestamp || 0).getTime();
    const timeDiff = Math.abs(cloudTime - localTime);
    const CONFLICT_THRESHOLD = 5 * 60 * 1000;

    if (timeDiff < CONFLICT_THRESHOLD) {
      const conflicts: any = {};

      if (localData.books?.length !== cloudData.books?.length) {
        conflicts.books = {
          local: localData.books?.length || 0,
          cloud: cloudData.books?.length || 0
        };
      }

      if (localData.protocols?.length !== cloudData.protocols?.length) {
        conflicts.protocols = {
          local: localData.protocols?.length || 0,
          cloud: cloudData.protocols?.length || 0
        };
      }

      if (localData.thinkTank?.modules?.length !== cloudData.thinkTank?.modules?.length) {
        conflicts.thinkTankModules = {
          local: localData.thinkTank?.modules?.length || 0,
          cloud: cloudData.thinkTank?.modules?.length || 0
        };
      }

      if (localData.bookSources?.length !== cloudData.bookSources?.length) {
        conflicts.bookSources = {
          local: localData.bookSources?.length || 0,
          cloud: cloudData.bookSources?.length || 0
        };
      }

      return {
        hasConflict: Object.keys(conflicts).length > 0,
        details: conflicts
      };
    }

    return { hasConflict: false, details: null };
  }

  static async syncToCloud(): Promise<{ success: boolean; message: string; gistId?: string }> {
    const config = this.getConfig();
    
    if (!config || !config.token) {
      return { success: false, message: '请先配置 GitHub Token' };
    }

    const result = await this.uploadToGist(config.token, config.gistId);
    
    if (result.success && result.gistId) {
      const newConfig: GitHubGistConfig = {
        ...config,
        gistId: result.gistId,
        lastSyncTime: new Date().toISOString()
      };
      this.saveConfig(newConfig);
      return { success: true, message: '上传成功！', gistId: result.gistId };
    }

    return { success: false, message: result.error || '上传失败' };
  }

  static async syncFromCloud(): Promise<{
    success: boolean;
    message: string;
    hasConflict?: boolean;
    conflictDetails?: any;
  }> {
    const config = this.getConfig();

    if (!config || !config.token || !config.gistId) {
      return { success: false, message: '请先配置 GitHub Token 和 Gist ID' };
    }

    const result = await this.downloadFromGist(config.token, config.gistId);

    if (!result.success || !result.data) {
      return { success: false, message: result.error || '下载失败' };
    }

    const localData = SyncService.collectData();
    const conflictCheck = this.checkConflict(localData, result.data);

    if (conflictCheck.hasConflict) {
      return {
        success: false,
        message: '检测到数据冲突，请选择保留哪个版本',
        hasConflict: true,
        conflictDetails: conflictCheck.details
      };
    }

    const importSuccess = SyncService.importFromJSON(JSON.stringify(result.data));
    if (importSuccess) {
      const newConfig: GitHubGistConfig = {
        ...config,
        lastSyncTime: new Date().toISOString()
      };
      this.saveConfig(newConfig);
      return { success: true, message: '下载成功！页面即将刷新...' };
    }

    return { success: false, message: '数据导入失败' };
  }

  static forceSyncFromCloud(): Promise<{ success: boolean; message: string }> {
    const config = this.getConfig();

    if (!config || !config.token || !config.gistId) {
      return Promise.resolve({ success: false, message: '请先配置 GitHub Token 和 Gist ID' });
    }

    return new Promise(async (resolve) => {
      const result = await this.downloadFromGist(config.token, config.gistId);

      if (!result.success || !result.data) {
        resolve({ success: false, message: result.error || '下载失败' });
        return;
      }

      const importSuccess = SyncService.importFromJSON(JSON.stringify(result.data));
      if (importSuccess) {
        const newConfig: GitHubGistConfig = {
          ...config,
          lastSyncTime: new Date().toISOString()
        };
        this.saveConfig(newConfig);
        resolve({ success: true, message: '云端版本已覆盖本地数据！页面即将刷新...' });
      } else {
        resolve({ success: false, message: '数据导入失败' });
      }
    });
  }

  static formatLastSyncTime(time?: string): string {
    if (!time) return '从未同步';

    try {
      const date = new Date(time);
      const now = new Date();
      const diff = now.getTime() - date.getTime();

      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return '刚刚';
      if (minutes < 60) return `${minutes} 分钟前`;
      if (hours < 24) return `${hours} 小时前`;
      if (days < 7) return `${days} 天前`;

      return date.toLocaleDateString('zh-CN');
    } catch {
      return time;
    }
  }

  static startAutoSync(onSync?: (result: { success: boolean; message: string }) => void): void {
    if (autoSyncInterval !== null) {
      this.stopAutoSync();
    }

    const config = this.getConfig();
    if (!config || !config.autoSync || !config.token) {
      return;
    }

    autoSyncInterval = window.setInterval(async () => {
      const result = await this.syncToCloud();
      if (onSync) {
        onSync(result);
      }
      console.log(`[自动同步] ${result.success ? '✅' : '❌'} ${result.message}`);
    }, AUTO_SYNC_INTERVAL);

    console.log('[自动同步] 已启动，每分钟检查一次');
  }

  static stopAutoSync(): void {
    if (autoSyncInterval !== null) {
      clearInterval(autoSyncInterval);
      autoSyncInterval = null;
      console.log('[自动同步] 已停止');
    }
  }

  static isAutoSyncRunning(): boolean {
    return autoSyncInterval !== null;
  }
}
