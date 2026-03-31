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
  provider: 'deepseek' | 'custom' | 'google' | 'websocket' | 'proxy';
  apiKey: string;
  baseUrl: string;
  model: string;
  proxyKey?: string; // 反代服务的密码/密钥
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
    // 反代服务不需要 API 密钥
    if (!this.hasApiKey() && this.config.provider !== 'proxy') {
      throw new Error('请先设置API密钥');
    }

    if (!this.config.baseUrl) {
      throw new Error('请先设置API基础URL');
    }

    try {
      // 反代服务特殊处理
      if (this.config.provider === 'proxy') {
        let baseUrl = this.config.baseUrl.trim();
        while (baseUrl.endsWith('/')) {
          baseUrl = baseUrl.slice(0, -1);
        }
        // 移除 /v1/chat/completions 如果存在
        if (baseUrl.endsWith('/chat/completions')) {
          baseUrl = baseUrl.slice(0, -'/chat/completions'.length);
        }
        if (baseUrl.endsWith('/v1')) {
          baseUrl = baseUrl.slice(0, -3);
        }
        
        const url = `${baseUrl}/v1/models`;
        console.log('尝试从反代服务获取模型列表:', url);
        
        const headers: Record<string, string> = {};
        if (this.config.proxyKey) {
          headers['Authorization'] = `Bearer ${this.config.proxyKey}`;
        }
        
        const response = await fetch(url, {
          method: 'GET',
          headers,
        });

        console.log('反代服务响应状态:', response.status);

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.log('反代服务错误响应:', errorText);
          throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }

        const data = await response.json();
        console.log('反代服务响应数据:', data);
        
        let models: string[] = [];
        
        if (Array.isArray(data.data)) {
          models = data.data.map((model: any) => model.id || model.name || model.model).filter(Boolean);
        } else if (Array.isArray(data.models)) {
          models = data.models.map((model: any) => model.id || model.name || model.model).filter(Boolean);
        } else if (Array.isArray(data)) {
          models = data.map((model: any) => model.id || model.name || model.model).filter(Boolean);
        }
        
        console.log('从反代服务解析到的模型:', models);
        
        if (models.length > 0) {
          return models;
        }
        throw new Error('反代服务返回的模型列表为空');
      }

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
    // Google AI Studio 使用特殊的端点
    if (this.config.provider === 'google') {
      const baseUrl = this.config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
      let trimmedBaseUrl = baseUrl.trim();
      while (trimmedBaseUrl.endsWith('/')) {
        trimmedBaseUrl = trimmedBaseUrl.slice(0, -1);
      }
      const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      return `${trimmedBaseUrl}${normalizedEndpoint}?key=${this.config.apiKey}`;
    }

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
      // Google AI Studio 特殊处理
      if (this.config.provider === 'google') {
        const url = this.buildApiUrl(`/models/${this.config.model}:generateContent`);
        console.log('Google API 请求 URL:', url);
        console.log('Google API 请求模型:', this.config.model);
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: messages.map(msg => ({
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: msg.content }],
            })),
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2000,
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.error('Google API 错误响应:', errorText);
          let errorMessage = `请求失败: ${response.status}`;
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error?.message || errorMessage;
          } catch {}
          throw new Error(errorMessage);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '抱歉，没有收到回复';
      }

      // 其他 Provider 正常处理
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
    if (!this.hasApiKey() && this.config.provider !== 'websocket' && this.config.provider !== 'proxy') {
      onError(new Error('请先设置API密钥'));
      return;
    }

    try {
      // HTTP 反代服务特殊处理 (类似 SillyTavern 的反向代理)
      if (this.config.provider === 'proxy') {
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

        const proxyUrl = this.config.baseUrl || 'http://127.0.0.1:8889';
        // 确保 URL 以 /v1/chat/completions 结尾
        let url = proxyUrl.trim();
        while (url.endsWith('/')) {
          url = url.slice(0, -1);
        }
        if (!url.endsWith('/chat/completions')) {
          if (!url.endsWith('/v1')) {
            url = url + '/v1';
          }
          url = url + '/chat/completions';
        }
        
        console.log('反代服务请求 URL:', url);
        console.log('反代服务请求模型:', this.config.model);
        
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        // 如果设置了反代密钥，添加到请求头
        if (this.config.proxyKey) {
          headers['Authorization'] = `Bearer ${this.config.proxyKey}`;
        }
        
        const response = await fetch(url, {
          method: 'POST',
          headers,
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
          console.error('反代服务错误响应:', errorText);
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
                const content = data.choices?.[0]?.delta?.content || data.choices?.[0]?.message?.content;
                if (content) {
                  onChunk(content);
                }
              } catch {
                // 忽略解析错误的行
              }
            } else {
              // 尝试直接解析（某些反代服务可能不使用 data: 前缀）
              try {
                const data = JSON.parse(trimmedLine);
                if (data.choices) {
                  const content = data.choices?.[0]?.delta?.content || data.choices?.[0]?.message?.content;
                  if (content) {
                    onChunk(content);
                  }
                }
              } catch {
                // 忽略解析错误的行
              }
            }
          }
        }

        onComplete(usedModel);
        return;
      }

      // WebSocket 特殊处理
      if (this.config.provider === 'websocket') {
        // 构建消息内容
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
          
          return {
            role: msg.role,
            content: textContent,
          };
        });

        const wsUrl = this.config.baseUrl || 'ws://127.0.0.1:9998';
        console.log('WebSocket 请求 URL:', wsUrl);
        console.log('WebSocket 请求模型:', this.config.model);

        return new Promise<void>((resolve, reject) => {
          const ws = new WebSocket(wsUrl);
          let usedModel = this.config.model;
          let isClosed = false;

          const cleanup = () => {
            isClosed = true;
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
              ws.close();
            }
          };

          signal?.addEventListener('abort', () => {
            cleanup();
            onError(new Error('请求已中断'));
            reject(new Error('请求已中断'));
          });

          ws.onopen = () => {
            console.log('WebSocket 连接已建立');
            // 发送请求
            const request = {
              model: this.config.model,
              messages: formattedMessages,
              temperature: 0.7,
              max_tokens: 2000,
              stream: true,
            };
            ws.send(JSON.stringify(request));
          };

          ws.onmessage = (event) => {
            if (isClosed) return;
            
            try {
              let data;
              if (typeof event.data === 'string') {
                data = JSON.parse(event.data);
              } else {
                // 如果是二进制数据，尝试解析
                const text = new TextDecoder().decode(event.data);
                data = JSON.parse(text);
              }
              
              // 尝试解析常见格式
              if (data.model) {
                usedModel = data.model;
              }
              
              // 尝试多种数据格式
              let content = null;
              
              // OpenAI 格式
              if (data.choices && data.choices[0]?.delta?.content) {
                content = data.choices[0].delta.content;
              }
              // Google Gemini 格式
              else if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                content = data.candidates[0].content.parts[0].text;
              }
              // 简单格式
              else if (data.content) {
                content = data.content;
              }
              else if (data.text) {
                content = data.text;
              }
              else if (data.message?.content) {
                content = data.message.content;
              }
              
              if (content) {
                onChunk(content);
              }
              
              // 检查是否完成
              if (data.done || data.finished || data.finish_reason || (data.choices && data.choices[0]?.finish_reason)) {
                cleanup();
                onComplete(usedModel);
                resolve();
              }
            } catch (e) {
              console.log('解析 WebSocket 消息失败，尝试按文本处理:', event.data);
              // 如果解析失败，尝试直接作为文本
              if (typeof event.data === 'string' && event.data.trim()) {
                onChunk(event.data);
              }
            }
          };

          ws.onerror = (error) => {
            if (isClosed) return;
            console.error('WebSocket 错误:', error);
            cleanup();
            onError(new Error('WebSocket 连接错误'));
            reject(new Error('WebSocket 连接错误'));
          };

          ws.onclose = (event) => {
            if (isClosed) return;
            console.log('WebSocket 连接关闭:', event.code, event.reason);
            if (!event.wasClean) {
              onError(new Error(`WebSocket 连接意外关闭: ${event.code} ${event.reason}`));
              reject(new Error(`WebSocket 连接意外关闭: ${event.code} ${event.reason}`));
            } else {
              onComplete(usedModel);
              resolve();
            }
          };
        });
      }

      // Google AI Studio 特殊处理
      if (this.config.provider === 'google') {
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
          
          return {
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: textContent }],
          };
        });

        const url = this.buildApiUrl(`/models/${this.config.model}:streamGenerateContent`);
        console.log('Google Stream API 请求 URL:', url);
        console.log('Google Stream API 请求模型:', this.config.model);
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: formattedMessages,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2000,
            },
          }),
          signal,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.error('Google Stream API 错误响应:', errorText);
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
          
          // Google 流式响应通常是 JSON 数组或者用换行分隔的 JSON
          // 尝试解析缓冲区
          try {
            // 尝试直接解析为 JSON 数组
            const data = JSON.parse(buffer);
            if (Array.isArray(data)) {
              for (const item of data) {
                const content = item.candidates?.[0]?.content?.parts?.[0]?.text;
                if (content) {
                  onChunk(content);
                }
              }
              buffer = '';
            }
          } catch {
            // 如果解析失败，尝试按行处理
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine) continue;
              
              try {
                const data = JSON.parse(trimmedLine);
                const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (content) {
                  onChunk(content);
                }
              } catch {
                // 忽略解析错误的行
              }
            }
          }
        }

        onComplete(usedModel);
        return;
      }

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
