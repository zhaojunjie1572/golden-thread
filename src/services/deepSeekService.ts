interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

class DeepSeekService {
  private apiKey: string | null = null;
  private apiBaseUrl = 'https://api.deepseek.com/v1';

  constructor() {
    this.loadApiKey();
  }

  loadApiKey() {
    this.apiKey = localStorage.getItem('deepseek-api-key');
  }

  setApiKey(key: string) {
    this.apiKey = key;
    if (key) {
      localStorage.setItem('deepseek-api-key', key);
    } else {
      localStorage.removeItem('deepseek-api-key');
    }
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  hasApiKey(): boolean {
    return !!this.apiKey && this.apiKey.trim().length > 0;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    if (!this.hasApiKey()) {
      throw new Error('请先设置DeepSeek API密钥');
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
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
    onComplete: () => void,
    onError: (error: Error) => void
  ) {
    if (!this.hasApiKey()) {
      onError(new Error('请先设置DeepSeek API密钥'));
      return;
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          temperature: 0.7,
          max_tokens: 2000,
          stream: true,
        }),
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
              const content = data.choices[0]?.delta?.content;
              if (content) {
                onChunk(content);
              }
            } catch {
            }
          }
        }
      }

      onComplete();
    } catch (error) {
      if (error instanceof Error) {
        onError(error);
      } else {
        onError(new Error('网络请求失败，请检查网络连接'));
      }
    }
  }
}

export const deepSeekService = new DeepSeekService();
export type { ChatMessage };
