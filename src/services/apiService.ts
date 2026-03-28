interface MessageAttachment {
  id: string;
  name: string;
  type: 'image' | 'file';
  size: number;
  preview?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
  attachments?: MessageAttachment[];
}

interface ApiConfig {
  provider: 'deepseek' | 'custom';
  apiKey: string;
  baseUrl: string;
  model: string;
}

const DEFAULT_CONFIG: ApiConfig = {
  provider: 'deepseek',
  apiKey: '',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
};

class APIService {
  private config!: ApiConfig;

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    try {
      const saved = localStorage.getItem('ai-api-config');
      if (saved) {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      } else {
        this.config = { ...DEFAULT_CONFIG };
        const legacyKey = localStorage.getItem('deepseek-api-key');
        if (legacyKey) {
          this.config.apiKey = legacyKey;
          this.config.provider = 'deepseek';
          this.saveConfig();
          localStorage.removeItem('deepseek-api-key');
        }
      }
    } catch {
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  private saveConfig() {
    localStorage.setItem('ai-api-config', JSON.stringify(this.config));
  }

  setConfig(config: Partial<ApiConfig>) {
    this.config = { ...this.config, ...config };
    this.saveConfig();
  }

  getConfig(): ApiConfig {
    return { ...this.config };
  }

  getApiKey(): string {
    return this.config.apiKey;
  }

  hasApiKey(): boolean {
    return !!this.config.apiKey && this.config.apiKey.trim().length > 0;
  }

  async getModels(): Promise<string[]> {
    if (!this.hasApiKey()) {
      throw new Error('请先设置API密钥');
    }

    if (!this.config.baseUrl) {
      throw new Error('请先设置API基础URL');
    }

    try {
      // 清理 baseUrl
      let baseUrl = this.config.baseUrl.trim();
      while (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
      }
      
      // 尝试多个可能的模型列表端点
      const urls = [
        `${baseUrl}/models`,
        `${baseUrl}/v1/models`,
      ];

      let lastError: Error | null = null;
      
      for (const url of urls) {
        try {
          console.log('尝试获取模型列表:', url);
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
            },
          });

          console.log('响应状态:', response.status);

          if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.log('错误响应:', errorText);
            lastError = new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
            continue;
          }

          const data = await response.json();
          console.log('响应数据:', data);
          
          let models: string[] = [];
          
          if (Array.isArray(data.data)) {
            models = data.data.map((model: any) => model.id || model.name || model.model).filter(Boolean);
          } else if (Array.isArray(data.models)) {
            models = data.models.map((model: any) => model.id || model.name || model.model).filter(Boolean);
          } else if (Array.isArray(data)) {
            models = data.map((model: any) => model.id || model.name || model.model).filter(Boolean);
          }
          
          console.log('解析到的模型:', models);
          
          if (models.length > 0) {
            return models;
          }
        } catch (err) {
          console.log('请求失败:', err);
          lastError = err instanceof Error ? err : new Error('请求失败');
          continue;
        }
      }
      
      if (lastError) {
        throw new Error(`无法获取模型列表 (${lastError.message})，请手动输入模型名称`);
      }
      throw new Error('无法解析响应数据，请手动输入模型名称');
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('获取模型列表失败，请手动输入模型名称');
    }
  }

  private buildApiUrl(endpoint: string): string {
    let baseUrl = this.config.baseUrl.trim();
    
    // 移除末尾的斜杠
    while (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    
    // 确保 endpoint 以 / 开头
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    return `${baseUrl}${normalizedEndpoint}`;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    if (!this.hasApiKey()) {
      throw new Error('请先设置API密钥');
    }

    try {
      const url = this.buildApiUrl('/chat/completions');
      console.log('API 请求 URL:', url);
      console.log('API 请求模型:', this.config.model);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('API 错误响应:', errorText);
        let errorMessage = `请求失败: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorMessage;
        } catch {}
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '抱歉，没有收到回复';
    } catch (error) {
      console.error('API 请求错误:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('网络请求失败，请检查网络连接');
    }
  }

  async streamChat(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    onComplete: (model: string) => void,
    onError: (error: Error) => void,
    signal?: AbortSignal
  ) {
    if (!this.hasApiKey()) {
      onError(new Error('请先设置API密钥'));
      return;
    }

    try {
      // 构建消息内容，支持附件
      const formattedMessages = messages.map(msg => {
        let textContent = msg.content || '';
        
        // 如果有普通文件附件，在文本内容中添加文件信息
        if (msg.attachments && msg.attachments.length > 0) {
          const fileAttachments = msg.attachments.filter(att => att.type === 'file');
          if (fileAttachments.length > 0) {
            const fileInfo = fileAttachments.map(att => 
              `- ${att.name} (${(att.size / 1024).toFixed(1)} KB)`
            ).join('\n');
            
            textContent = textContent 
              ? `${textContent}\n\n【附件文件】\n${fileInfo}`
              : `【附件文件】\n${fileInfo}`;
          }
        }
        
        // 如果有图片附件，使用多模态格式
        if (msg.attachments && msg.attachments.some(att => att.type === 'image' && att.preview)) {
          const content: any[] = [
            { type: 'text', text: textContent }
          ];
          
          // 添加图片附件
          msg.attachments.forEach(att => {
            if (att.type === 'image' && att.preview) {
              // 提取 base64 数据（去掉 data:image/xxx;base64, 前缀）
              const base64Data = att.preview.split(',')[1];
              const mimeType = att.preview.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';
              
              content.push({
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`
                }
              });
            }
          });
          
          return {
            role: msg.role,
            content,
          };
        }
        
        // 普通文本消息（可能包含文件信息）
        return {
          role: msg.role,
          content: textContent,
        };
      });

      const url = this.buildApiUrl('/chat/completions');
      console.log('Stream API 请求 URL:', url);
      console.log('Stream API 请求模型:', this.config.model);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: formattedMessages,
          temperature: 0.7,
          max_tokens: 2000,
          stream: true,
        }),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('Stream API 错误响应:', errorText);
        let errorMessage = `请求失败: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorMessage;
        } catch {}
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let buffer = '';
      let usedModel = this.config.model;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

          if (trimmedLine.startsWith('data: ')) {
            try {
              const jsonStr = trimmedLine.slice(6);
              const data = JSON.parse(jsonStr);
              if (data.model) {
                usedModel = data.model;
              }
              const content = data.choices[0]?.delta?.content;
              if (content) {
                onChunk(content);
              }
            } catch {
            }
          }
        }
      }

      onComplete(usedModel);
    } catch (error) {
      if (error instanceof Error) {
        onError(error);
      } else {
        onError(new Error('网络请求失败，请检查网络连接'));
      }
    }
  }
}

export const apiService = new APIService();
export type { ChatMessage, ApiConfig };
