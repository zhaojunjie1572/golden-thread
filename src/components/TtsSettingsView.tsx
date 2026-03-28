import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

interface TtsSettingsViewProps {
  onClose: () => void;
}

interface TtsConfig {
  engine: 'browser' | 'edge-tts' | 'custom-api';
  customApi?: {
    url: string;
    method: 'GET' | 'POST';
    headers: string;
    textParam: string;
    voiceParam?: string;
    rateParam?: string;
    pitchParam?: string;
    bodyTemplate?: string;
  };
}

const EDGE_TTS_VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', gender: 'female' as const, desc: '温柔女声' },
  { id: 'zh-CN-XiaoyiNeural', name: '晓伊', gender: 'female' as const, desc: '标准女声' },
  { id: 'zh-CN-XiaohanNeural', name: '晓涵', gender: 'female' as const, desc: '甜美女声' },
  { id: 'zh-CN-XiaomengNeural', name: '晓梦', gender: 'female' as const, desc: '活泼女声' },
  { id: 'zh-CN-XiaomoNeural', name: '晓墨', gender: 'female' as const, desc: '知性女声' },
  { id: 'zh-CN-XiaoxuanNeural', name: '晓萱', gender: 'female' as const, desc: '清新女声' },
  { id: 'zh-CN-XiaoyouNeural', name: '晓悠', gender: 'female' as const, desc: '自然女声' },
  { id: 'zh-CN-XiaozhenNeural', name: '晓甄', gender: 'female' as const, desc: '优雅女声' },
  { id: 'zh-CN-YunxiNeural', name: '云希', gender: 'male' as const, desc: '标准男声' },
  { id: 'zh-CN-YunyangNeural', name: '云扬', gender: 'male' as const, desc: '沉稳男声' },
  { id: 'zh-CN-YunfengNeural', name: '云锋', gender: 'male' as const, desc: '洪亮男声' },
  { id: 'zh-CN-YunhaoNeural', name: '云皓', gender: 'male' as const, desc: '磁性男声' },
];

const CONFIG_STORAGE_KEY = 'tts-settings';

export default function TtsSettingsView({ onClose }: TtsSettingsViewProps) {
  const { colors } = useTheme();
  
  const [config, setConfig] = useState<TtsConfig>(() => {
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      return saved ? JSON.parse(saved) : { engine: 'browser' };
    } catch {
      return { engine: 'browser' };
    }
  });

  const [selectedEdgeVoice, setSelectedEdgeVoice] = useState(() => {
    return localStorage.getItem('edge-tts-voice') || EDGE_TTS_VOICES[0].id;
  });

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('edge-tts-voice', selectedEdgeVoice);
  }, [selectedEdgeVoice]);

  const handleTest = async () => {
    setTestStatus('testing');
    setTestMessage('正在测试...');
    
    try {
      if (config.engine === 'browser') {
        if (!('speechSynthesis' in window)) {
          throw new Error('浏览器不支持语音合成');
        }
        const utterance = new SpeechSynthesisUtterance('你好，这是测试语音');
        utterance.lang = 'zh-CN';
        window.speechSynthesis.speak(utterance);
        setTestStatus('success');
        setTestMessage('测试成功！');
      } else if (config.engine === 'edge-tts') {
        setTestStatus('success');
        setTestMessage('Edge TTS 配置已保存！请使用支持的代理服务进行测试。');
      } else if (config.engine === 'custom-api' && config.customApi) {
        const { url, method, headers, textParam, voiceParam, rateParam, pitchParam, bodyTemplate } = config.customApi;
        
        if (!url || !textParam) {
          throw new Error('请填写完整的 API 配置');
        }

        let requestUrl = url;
        let requestBody: string | undefined;
        const testText = '你好，这是测试语音';
        
        if (method === 'GET') {
          const params = new URLSearchParams();
          params.set(textParam, testText);
          if (voiceParam) params.set(voiceParam, selectedEdgeVoice);
          if (rateParam) params.set(rateParam, '1.0');
          if (pitchParam) params.set(pitchParam, '1.0');
          requestUrl = `${url}?${params.toString()}`;
        } else {
          if (bodyTemplate) {
            requestBody = bodyTemplate
              .replace('{{text}}', testText)
              .replace('{{voice}}', selectedEdgeVoice)
              .replace('{{rate}}', '1.0')
              .replace('{{pitch}}', '1.0');
          } else {
            const body: Record<string, any> = { [textParam]: testText };
            if (voiceParam) body[voiceParam] = selectedEdgeVoice;
            if (rateParam) body[rateParam] = 1.0;
            if (pitchParam) body[pitchParam] = 1.0;
            requestBody = JSON.stringify(body);
          }
        }

        const parsedHeaders: Record<string, string> = {};
        if (headers) {
          try {
            Object.assign(parsedHeaders, JSON.parse(headers));
          } catch {
            const lines = headers.split('\n');
            lines.forEach(line => {
              const [key, value] = line.split(':').map(s => s.trim());
              if (key && value) {
                parsedHeaders[key] = value;
              }
            });
          }
        }

        const response = await fetch(requestUrl, {
          method,
          headers: { 'Content-Type': 'application/json', ...parsedHeaders },
          body: method === 'POST' ? requestBody : undefined,
        });

        if (!response.ok) {
          throw new Error(`API 请求失败: ${response.status}`);
        }

        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        await audio.play();
        
        setTestStatus('success');
        setTestMessage('测试成功！');
      }
    } catch (error) {
      setTestStatus('error');
      setTestMessage(error instanceof Error ? error.message : '测试失败');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div 
        className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">TTS 语音设置</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">TTS 引擎</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'browser', label: '浏览器', desc: '原生免费' },
                { value: 'edge-tts', label: 'Edge TTS', desc: '微软语音' },
                { value: 'custom-api', label: '自定义', desc: 'API 接口' },
              ].map((engine) => (
                <button
                  key={engine.value}
                  type="button"
                  onClick={() => setConfig({ ...config, engine: engine.value as any })}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    config.engine === engine.value
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-white">{engine.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{engine.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {(config.engine === 'edge-tts' || config.engine === 'custom-api') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">声音选择</label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl p-2">
                {EDGE_TTS_VOICES.map((voice) => (
                  <label
                    key={voice.id}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedEdgeVoice === voice.id
                        ? voice.gender === 'female' ? 'bg-pink-50 dark:bg-pink-900/20' : 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="edge-voice"
                      value={voice.id}
                      checked={selectedEdgeVoice === voice.id}
                      onChange={() => setSelectedEdgeVoice(voice.id)}
                      className={`w-4 h-4 ${voice.gender === 'female' ? 'text-pink-500' : 'text-blue-500'}`}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {voice.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {voice.desc}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      voice.gender === 'female' 
                        ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                      {voice.gender === 'female' ? '女声' : '男声'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {config.engine === 'custom-api' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">API URL</label>
                <input
                  type="text"
                  value={config.customApi?.url || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    customApi: { ...config.customApi!, url: e.target.value }
                  })}
                  placeholder="https://example.com/tts"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">请求方法</label>
                  <select
                    value={config.customApi?.method || 'GET'}
                    onChange={(e) => setConfig({
                      ...config,
                      customApi: { ...config.customApi!, method: e.target.value as any }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">文本参数名</label>
                  <input
                    type="text"
                    value={config.customApi?.textParam || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      customApi: { ...config.customApi!, textParam: e.target.value }
                    })}
                    placeholder="text"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">声音参数</label>
                  <input
                    type="text"
                    value={config.customApi?.voiceParam || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      customApi: { ...config.customApi!, voiceParam: e.target.value }
                    })}
                    placeholder="voice"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">语速参数</label>
                  <input
                    type="text"
                    value={config.customApi?.rateParam || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      customApi: { ...config.customApi!, rateParam: e.target.value }
                    })}
                    placeholder="rate"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">音调参数</label>
                  <input
                    type="text"
                    value={config.customApi?.pitchParam || ''}
                    onChange={(e) => setConfig({
                      ...config,
                      customApi: { ...config.customApi!, pitchParam: e.target.value }
                    })}
                    placeholder="pitch"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">请求头 (JSON 或每行一个)</label>
                <textarea
                  value={config.customApi?.headers || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    customApi: { ...config.customApi!, headers: e.target.value }
                  })}
                  placeholder='{"Authorization": "Bearer xxx"}'
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">请求体模板 (可选)</label>
                <textarea
                  value={config.customApi?.bodyTemplate || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    customApi: { ...config.customApi!, bodyTemplate: e.target.value }
                  })}
                  placeholder='{"text": "{{text}}", "voice": "{{voice}}"}'
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  可用变量: {'{{text}}'}, {'{{voice}}'}, {'{{rate}}'}, {'{{pitch}}'}
                </p>
              </div>
            </div>
          )}

          {config.engine === 'edge-tts' && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-700">
              <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">💡 使用说明</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Edge TTS 需要通过代理服务访问。您可以：
              </p>
              <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 list-disc list-inside space-y-1">
                <li>部署自己的 Edge TTS 代理服务</li>
                <li>使用自定义 API 配置连接到您的代理</li>
                <li>或者继续使用浏览器原生 TTS</li>
              </ul>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              关闭
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={testStatus === 'testing'}
              className={`flex-1 px-4 py-2 rounded-lg text-white font-medium transition-all ${
                testStatus === 'success' 
                  ? 'bg-green-500 hover:bg-green-600'
                  : testStatus === 'error'
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-amber-500 hover:bg-amber-600'
              }`}
              style={{ backgroundColor: testStatus === 'idle' ? colors.primary : undefined }}
            >
              {testStatus === 'testing' ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  测试中...
                </div>
              ) : testStatus === 'success' ? (
                '✓ 测试成功'
              ) : testStatus === 'error' ? (
                '✗ 重新测试'
              ) : (
                '测试配置'
              )}
            </button>
          </div>

          {testMessage && (
            <div className={`p-3 rounded-lg text-sm ${
              testStatus === 'success' 
                ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : testStatus === 'error'
                ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}>
              {testMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
