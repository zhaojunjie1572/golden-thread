import { SyncService } from './syncService';

const GIST_FILENAME = 'golden-thread-backup.json';
const GIST_DESCRIPTION = 'Golden Thread 应用数据备份 - 自动同步';
const AUTO_SYNC_INTERVAL = 10 * 60 * 1000; // 10分钟

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
      console.log('[uploadToGist] 开始上传，Gist ID:', gistId);
      // 上传时包含书籍内容，确保同步后可以正常阅读
      const data = SyncService.exportToJSON(true);
      console.log('[uploadToGist] 数据大小:', data.length, '字符（包含书籍内容）');
      
      // 检查文件大小，GitHub Gist 单个文件限制约 100MB
      const sizeInMB = data.length / 1024 / 1024;
      if (sizeInMB > 50) {
        console.warn('[uploadToGist] 警告：数据大小超过 50MB，可能导致上传失败');
      }
      
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
          console.error('[uploadToGist] 更新 Gist 失败:', response.status, errorData);
          if (response.status === 404) {
            return { success: false, error: 'Gist 不存在，请检查 Gist ID 或重新创建' };
          }
          return { success: false, error: errorData.message || `上传失败: HTTP ${response.status}` };
        }

        const result = await response.json();
        console.log('[uploadToGist] 更新 Gist 成功:', result.id);
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
          console.error('[uploadToGist] 创建 Gist 失败:', response.status, errorData);
          return { success: false, error: errorData.message || `创建 Gist 失败: HTTP ${response.status}` };
        }

        const result = await response.json();
        console.log('[uploadToGist] 创建 Gist 成功:', result.id);
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

      let content: string;

      // 如果文件被截断（大于1MB），需要通过 raw_url 获取完整内容
      if (file.truncated) {
        console.log('[downloadFromGist] 文件被截断，通过 raw_url 获取完整内容...');
        console.log('[downloadFromGist] raw_url:', file.raw_url);
        
        // 使用 fetch 获取 raw 内容，不添加 Authorization header 以避免 CORS 问题
        const rawResponse = await fetch(file.raw_url);

        if (!rawResponse.ok) {
          console.error('[downloadFromGist] raw_url 请求失败:', rawResponse.status);
          return { success: false, error: `获取完整内容失败: HTTP ${rawResponse.status}` };
        }

        content = await rawResponse.text();
        console.log('[downloadFromGist] 通过 raw_url 获取内容大小:', content.length, '字符');
      } else {
        content = file.content;
      }

      let jsonData;
      try {
        jsonData = JSON.parse(content);
      } catch (parseError) {
        console.error('[downloadFromGist] JSON 解析失败:', parseError);
        console.error('[downloadFromGist] 文件内容前 200 字符:', content?.substring(0, 200));
        console.error('[downloadFromGist] 文件内容后 200 字符:', content?.substring(content.length - 200));
        console.error('[downloadFromGist] 文件总大小:', content.length, '字符');
        return { success: false, error: '数据格式无效，文件可能超过大小限制' };
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

      // 检查工作流数据冲突
      const localAgents = localData.agentWorkflow?.agents?.length || 0;
      const cloudAgents = cloudData.agentWorkflow?.agents?.length || 0;
      if (localAgents !== cloudAgents) {
        conflicts.agentWorkflowAgents = { local: localAgents, cloud: cloudAgents };
      }

      const localWorkflows = localData.agentWorkflow?.workflows?.length || 0;
      const cloudWorkflows = cloudData.agentWorkflow?.workflows?.length || 0;
      if (localWorkflows !== cloudWorkflows) {
        conflicts.agentWorkflows = { local: localWorkflows, cloud: cloudWorkflows };
      }

      const localInstances = localData.agentWorkflow?.instances?.length || 0;
      const cloudInstances = cloudData.agentWorkflow?.instances?.length || 0;
      if (localInstances !== cloudInstances) {
        conflicts.agentWorkflowInstances = { local: localInstances, cloud: cloudInstances };
      }

      // 检查思维导图数据冲突
      const localMindMaps = localData.mindMaps?.length || 0;
      const cloudMindMaps = cloudData.mindMaps?.length || 0;
      if (localMindMaps !== cloudMindMaps) {
        conflicts.mindMaps = { local: localMindMaps, cloud: cloudMindMaps };
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

    // 显示本地数据概览
    const localData = SyncService.collectData(false);
    console.log('[syncToCloud] 本地数据概览:', {
      books: localData.books?.length || 0,
      protocols: localData.protocols?.length || 0,
      quotes: localData.quotes?.length || 0,
      mindMaps: localData.mindMaps?.length || 0,
      thinkTankModules: localData.thinkTank?.modules?.length || 0,
      agentWorkflowAgents: localData.agentWorkflow?.agents?.length || 0,
      agentWorkflows: localData.agentWorkflow?.workflows?.length || 0,
      chatSessions: localData.aiAssistant?.chatSessions?.length || 0,
    });

    const result = await this.uploadToGist(config.token, config.gistId);
    
    if (result.success && result.gistId) {
      const newConfig: GitHubGistConfig = {
        ...config,
        gistId: result.gistId,
        lastSyncTime: new Date().toISOString()
      };
      this.saveConfig(newConfig);
      return { success: true, message: `上传成功！包含 ${localData.books?.length || 0} 本书籍，${localData.protocols?.length || 0} 个协议，${localData.quotes?.length || 0} 条语录`, gistId: result.gistId };
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

    console.log('[syncFromCloud] 开始下载，Gist ID:', config.gistId);
    const result = await this.downloadFromGist(config.token, config.gistId);

    if (!result.success || !result.data) {
      console.error('[syncFromCloud] 下载失败:', result.error);
      return { success: false, message: result.error || '下载失败' };
    }

    console.log('[syncFromCloud] 下载成功，云端书籍数量:', result.data.books?.length || 0);

    const localData = SyncService.collectData();
    console.log('[syncFromCloud] 本地书籍数量:', localData.books?.length || 0);

    // 直接使用 mergeData 进行智能合并，而不是返回冲突错误
    console.log('[syncFromCloud] 开始智能合并数据...');
    console.log('[syncFromCloud] 云端数据概览:', {
      books: result.data.books?.length || 0,
      protocols: result.data.protocols?.length || 0,
      quotes: result.data.quotes?.length || 0,
      mindMaps: result.data.mindMaps?.length || 0,
      thinkTankModules: result.data.thinkTank?.modules?.length || 0,
      agentWorkflowAgents: result.data.agentWorkflow?.agents?.length || 0,
      agentWorkflows: result.data.agentWorkflow?.workflows?.length || 0,
      chatSessions: result.data.aiAssistant?.chatSessions?.length || 0,
    });
    const mergeResult = SyncService.mergeData(result.data);
    console.log('[syncFromCloud] 合并完成:', {
      books: `${mergeResult.books.added} 新增, ${mergeResult.books.updated} 更新`,
      protocols: `${mergeResult.protocols.added} 新增, ${mergeResult.protocols.updated} 更新`,
      quotes: `${mergeResult.quotes.added} 新增`,
      mindMaps: `${mergeResult.mindMaps.added} 新增`,
      thinkTankModules: `${mergeResult.thinkTankModules.added} 新增`,
      agentWorkflow: `${mergeResult.agentWorkflow.added} 新增`,
      chatSessions: `${mergeResult.aiAssistantChatSessions.added} 新增`,
    });

    // 保存合并后的配置
    const newConfig: GitHubGistConfig = {
      ...config,
      lastSyncTime: new Date().toISOString()
    };
    this.saveConfig(newConfig);

    return { success: true, message: `下载成功！新增 ${mergeResult.books.added} 本书籍，${mergeResult.protocols.added} 个协议，${mergeResult.quotes.added} 条语录，页面即将刷新...` };
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

  static startAutoSync(onSync?: (result: { success: boolean; message: string; type?: 'upload' | 'download' | 'merge' }) => void): void {
    if (autoSyncInterval !== null) {
      this.stopAutoSync();
    }

    const config = this.getConfig();
    if (!config || !config.autoSync || !config.token) {
      return;
    }

    // 立即执行一次同步
    console.log('[自动同步] 立即执行首次同步...');
    this.syncBidirectional().then((syncResult) => {
      if (onSync) {
        onSync(syncResult);
      }
      console.log(`[自动同步] 首次同步 ${syncResult.success ? '✅' : '❌'} ${syncResult.message}`);
    });

    // 然后每10分钟执行一次
    autoSyncInterval = window.setInterval(async () => {
      // 双向同步：先下载合并，再上传
      const syncResult = await this.syncBidirectional();
      if (onSync) {
        onSync(syncResult);
      }
      console.log(`[自动同步] ${syncResult.success ? '✅' : '❌'} ${syncResult.message}`);
    }, AUTO_SYNC_INTERVAL);

    console.log('[自动同步] 已启动，每10分钟双向同步一次');
  }

  /**
   * 双向同步：下载云端数据并合并，然后上传合并后的数据
   */
  static async syncBidirectional(): Promise<{ success: boolean; message: string; type?: 'upload' | 'download' | 'merge' }> {
    const config = this.getConfig();
    if (!config || !config.token) {
      return { success: false, message: '未配置 GitHub Token' };
    }

    try {
      // 1. 获取云端数据
      let cloudData: any = null;
      let hasCloudData = false;

      if (config.gistId) {
        const downloadResult = await this.downloadFromGist(config.token, config.gistId);
        if (downloadResult.success && downloadResult.data) {
          cloudData = downloadResult.data;
          hasCloudData = true;
        }
      }

      // 2. 获取本地数据
      const localData = SyncService.collectData();

      // 3. 如果没有云端数据，直接上传本地数据
      if (!hasCloudData) {
        const uploadResult = await this.syncToCloud();
        return {
          success: uploadResult.success,
          message: uploadResult.success ? '首次同步，已上传本地数据' : uploadResult.message,
          type: 'upload'
        };
      }

      // 4. 检查数据版本时间戳
      const localTime = new Date(localData.timestamp || 0).getTime();
      const cloudTime = new Date(cloudData.timestamp || 0).getTime();
      const timeDiff = Math.abs(cloudTime - localTime);

      // 如果时间差小于5秒，认为数据已经同步，无需操作
      if (timeDiff < 5000) {
        return { success: true, message: '数据已是最新，无需同步', type: 'upload' };
      }

      // 5. 智能合并数据（优先使用云端数据作为基础，合并本地新增内容）
      console.log('[自动同步] 检测到数据差异，开始智能合并...');
      console.log('[自动同步] 云端书籍数量:', cloudData.books?.length || 0);
      console.log('[自动同步] 本地书籍数量:', localData.books?.length || 0);
      
      // 使用 SyncService 的合并功能
      const mergeResult = SyncService.mergeData(cloudData);
      console.log('[自动同步] 合并完成，新增书籍:', mergeResult.books.added);
      
      // 6. 上传合并后的数据
      const data = SyncService.exportToJSON();
      const headers = {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json'
      };

      const response = await fetch(`https://api.github.com/gists/${config.gistId}`, {
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
        return { success: false, message: errorData.message || '上传合并数据失败' };
      }

      // 7. 更新同步时间
      const newConfig: GitHubGistConfig = {
        ...config,
        lastSyncTime: new Date().toISOString()
      };
      this.saveConfig(newConfig);

      // 8. 统计合并结果
      const totalAdded = mergeResult.books.added + mergeResult.protocols.added + 
                        mergeResult.thinkTankModules.added + mergeResult.aiAssistantChatSessions.added +
                        mergeResult.agentWorkflow.added + mergeResult.mindMaps.added;
      const totalUpdated = mergeResult.books.updated + mergeResult.protocols.updated + mergeResult.thinkTankModules.updated + mergeResult.mindMaps.updated;

      return {
        success: true,
        message: `双向同步完成！新增 ${totalAdded} 项，更新 ${totalUpdated} 项`,
        type: 'merge'
      };

    } catch (error) {
      console.error('双向同步失败:', error);
      return { success: false, message: error instanceof Error ? error.message : '同步失败' };
    }
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
