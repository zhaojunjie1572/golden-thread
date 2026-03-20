interface MessageAttachment {
  id: string;
  name: string;
  type: 'image' | 'file';
  size: number;
  preview?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
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
      const baseUrl = this.config.baseUrl.endsWith('/') 
        ? this.config.baseUrl.slice(0, -1) 
        : this.config.baseUrl;
      
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

  async chat(messages: ChatMessage[]): Promise<string> {
    if (!this.hasApiKey()) {
      throw new Error('请先设置API密钥');
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `请求失败: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '抱歉，没有收到回复';
    } catch (error) {
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
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
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
          stream: true,
        }),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `请求失败: ${response.status}`);
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
