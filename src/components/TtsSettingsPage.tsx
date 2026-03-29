import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useSpeech } from '../context/SpeechContext';
import { 
  CloudTtsConfig, 
  ALIYUN_VOICES,
  EDGE_TTS_VOICES,
  TtsEngine
} from '../services/cloudTtsService';

export default function TtsSettingsPage() {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const { 
    speechState, 
    voices,
    categorizedVoices,
    setSelectedVoice: setSelectedVoiceInSpeech,
    setSpeechRate,
    setVolume,
    setPitch,
    setRemovePunctuation,
    setCloudTtsConfig,
    testVoice,
    testCloudTts
  } = useSpeech();

  const [config, setConfig] = useState<CloudTtsConfig>(speechState.cloudTtsConfig);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [showAliyun, setShowAliyun] = useState(false);
  const [showEdgeTts, setShowEdgeTts] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    setConfig(speechState.cloudTtsConfig);
  }, [speechState.cloudTtsConfig]);

  // 当在浏览器引擎下开启 Edge TTS 开关时，自动展开 Edge TTS 配置
  useEffect(() => {
    if (config.engine === 'browser' && config.useEdgeTts === true) {
      setShowEdgeTts(true);
    }
  }, [config.engine, config.useEdgeTts]);

  const handleSaveConfig = () => {
    setCloudTtsConfig(config);
  };

  const handleTest = async () => {
    setTestStatus('testing');
    setTestMessage('正在测试...');
    
    try {
      await testCloudTts(config, '你好，这是测试语音，希望你喜欢这个声音');
      setTestStatus('success');
      setTestMessage('测试成功！');
      
      setTimeout(() => {
        setTestStatus('idle');
        setTestMessage('');
      }, 2000);
    } catch (error) {
      setTestStatus('error');
      setTestMessage(error instanceof Error ? error.message : '测试失败');
    }
  };

  const handleTestVoice = async (voiceName: string) => {
    setTestStatus('testing');
    setTestMessage('正在测试...');
    
    try {
      if (config.engine === 'browser') {
        testVoice(voiceName);
      } else {
        await testCloudTts(config, '你好，这是测试语音');
      }
      setTestStatus('success');
      setTestMessage('测试成功！');
      
      setTimeout(() => {
        setTestStatus('idle');
        setTestMessage('');
      }, 2000);
    } catch (error) {
      setTestStatus('error');
      setTestMessage(error instanceof Error ? error.message : '测试失败');
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">TTS 语音设置</h1>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">TTS 引擎选择</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { value: 'browser' as TtsEngine, label: '浏览器', desc: '免费原生' },
                { value: 'edge-tts' as TtsEngine, label: 'Edge TTS', desc: '微软语音' },
                { value: 'aliyun' as TtsEngine, label: '阿里云', desc: '高质量语音' },
                { value: 'custom' as TtsEngine, label: '自定义', desc: 'API 接口' },
              ].map((engine) => (
                <button
                  key={engine.value}
                  type="button"
                  onClick={() => setConfig({ ...config, engine: engine.value })}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    config.engine === engine.value
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-white">{engine.label}</div>
                  <div className="text-xs text-gray-500">{engine.desc}</div>
                </button>
              ))}
            </div>

            {/* Edge TTS 开关 */}
            {config.engine === 'browser' && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">使用 Edge TTS</span>
                    <p className="text-xs text-gray-500 mt-0.5">开启后使用微软高质量语音替代本地声音</p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={config.useEdgeTts === true}
                      onChange={(e) => setConfig({ ...config, useEdgeTts: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-amber-500"></div>
                  </div>
                </label>
              </div>
            )}

            {/* 系统默认语音开关 - 仅在浏览器引擎时显示 */}
            {config.engine === 'browser' && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">使用系统默认语音</span>
                    <p className="text-xs text-gray-500 mt-0.5">关闭时可手动选择特定声音</p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={config.useSystemVoice !== false}
                      onChange={(e) => setConfig({ ...config, useSystemVoice: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-amber-500"></div>
                  </div>
                </label>
              </div>
            )}
          </div>

          {config.engine === 'aliyun' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">阿里云配置</h2>
                <button
                  onClick={() => setShowAliyun(!showAliyun)}
                  className="text-sm text-amber-500 hover:text-amber-600"
                >
                  {showAliyun ? '收起' : '展开'}
                </button>
              </div>
              
              {showAliyun && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-sm text-blue-700 dark:text-blue-300">
                    💡 获取阿里云访问密钥：访问 https://nls-portal.console.aliyun.com/
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Access Key ID</label>
                    <input
                      type="text"
                      value={config.aliyun?.accessKeyId || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        aliyun: { ...config.aliyun!, accessKeyId: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="your-access-key-id"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Access Key Secret</label>
                    <input
                      type="password"
                      value={config.aliyun?.accessKeySecret || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        aliyun: { ...config.aliyun!, accessKeySecret: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="your-access-key-secret"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">App Key</label>
                    <input
                      type="text"
                      value={config.aliyun?.appKey || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        aliyun: { ...config.aliyun!, appKey: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="your-app-key"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">声音选择</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl p-2">
                      {ALIYUN_VOICES.map((voice) => (
                        <label
                          key={voice.id}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                            config.aliyun?.voice === voice.id
                              ? voice.gender === 'female' ? 'bg-pink-50 dark:bg-pink-900/20' : 'bg-blue-50 dark:bg-blue-900/20'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="aliyun-voice"
                            value={voice.id}
                            checked={config.aliyun?.voice === voice.id}
                            onChange={() => setConfig({
                              ...config,
                              aliyun: { ...config.aliyun!, voice: voice.id }
                            })}
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
                </div>
              )}
            </div>
          )}

          {(config.engine === 'edge-tts' || (config.engine === 'browser' && config.useEdgeTts === true)) && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edge TTS 配置</h2>
                <button
                  onClick={() => setShowEdgeTts(!showEdgeTts)}
                  className="text-sm text-amber-500 hover:text-amber-600"
                >
                  {showEdgeTts ? '收起' : '展开'}
                </button>
              </div>
              
              {showEdgeTts && (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-xl text-sm text-green-700 dark:text-green-300">
                    <div className="font-medium mb-2">💡 推荐方案</div>
                    <ul className="list-disc list-inside space-y-1">
                      <li>部署 Edge TTS 代理到 Vercel 或 Netlify</li>
                      <li>免费使用微软高质量语音</li>
                      <li>手机、电脑都能用</li>
                    </ul>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">代理 API URL</label>
                    <input
                      type="text"
                      value={config['edge-tts']?.apiUrl || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        'edge-tts': { ...config['edge-tts']!, apiUrl: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="https://your-edge-tts.vercel.app/tts"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">声音选择</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl p-2">
                      {EDGE_TTS_VOICES.map((voice) => (
                        <label
                          key={voice.id}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                            config['edge-tts']?.voice === voice.id
                              ? voice.gender === 'female' ? 'bg-pink-50 dark:bg-pink-900/20' : 'bg-blue-50 dark:bg-blue-900/20'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="edge-voice"
                            value={voice.id}
                            checked={config['edge-tts']?.voice === voice.id}
                            onChange={() => setConfig({
                              ...config,
                              'edge-tts': { ...config['edge-tts']!, voice: voice.id }
                            })}
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
                </div>
              )}
            </div>
          )}

          {config.engine === 'custom' && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">自定义 API 配置</h2>
                <button
                  onClick={() => setShowCustom(!showCustom)}
                  className="text-sm text-amber-500 hover:text-amber-600"
                >
                  {showCustom ? '收起' : '展开'}
                </button>
              </div>
              
              {showCustom && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">API URL</label>
                    <input
                      type="text"
                      value={config.custom?.apiUrl || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        custom: { ...config.custom!, apiUrl: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="https://example.com/tts"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">请求方法</label>
                      <select
                        value={config.custom?.method || 'GET'}
                        onChange={(e) => setConfig({
                          ...config,
                          custom: { ...config.custom!, method: e.target.value as any }
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
                        value={config.custom?.textParam || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          custom: { ...config.custom!, textParam: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="text"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">声音参数</label>
                      <input
                        type="text"
                        value={config.custom?.voiceParam || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          custom: { ...config.custom!, voiceParam: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="voice"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">声音值</label>
                      <input
                        type="text"
                        value={config.custom?.voiceValue || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          custom: { ...config.custom!, voiceValue: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="voice-id"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">语速参数</label>
                      <input
                        type="text"
                        value={config.custom?.rateParam || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          custom: { ...config.custom!, rateParam: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder="rate"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">请求头 (JSON)</label>
                    <textarea
                      value={JSON.stringify(config.custom?.headers || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          setConfig({
                            ...config,
                            custom: { ...config.custom!, headers: JSON.parse(e.target.value) }
                          });
                        } catch {}
                      }}
                      placeholder='{"Authorization": "Bearer xxx"}'
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">朗读参数</h2>
            
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">朗读速度</label>
                  <span className="text-sm text-gray-500">{speechState.speechRate.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={speechState.speechRate}
                  onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  style={{ accentColor: colors.primary }}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>慢速</span>
                  <span>正常</span>
                  <span>快速</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">音量</label>
                  <span className="text-sm text-gray-500">{Math.round(speechState.volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={speechState.volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  style={{ accentColor: colors.primary }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">音调</label>
                  <span className="text-sm text-gray-500">{speechState.pitch.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={speechState.pitch}
                  onChange={(e) => setPitch(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  style={{ accentColor: colors.primary }}
                />
              </div>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={speechState.removePunctuation}
                  onChange={(e) => setRemovePunctuation(e.target.checked)}
                  className="w-4 h-4 text-amber-500 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">朗读时去除标点符号</span>
              </label>
            </div>
          </div>

          {config.engine === 'browser' && config.useEdgeTts !== true && config.useSystemVoice === false && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">声音选择</h2>
                <span className="text-xs text-gray-500">
                  中文女声: {categorizedVoices.filter(v => v.category === 'zh-female').length} | 
                  全部: {voices.length} 种
                </span>
              </div>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="voice"
                    value=""
                    checked={speechState.selectedVoice === ''}
                    onChange={() => setSelectedVoiceInSpeech('')}
                    className="w-4 h-4 text-amber-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">🎯 自动选择最优中文女声</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">系统自动选择最佳声音</p>
                  </div>
                  {speechState.selectedVoice === '' && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleTestVoice('');
                      }}
                      className="text-xs px-3 py-1.5 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500/20 transition-colors"
                    >
                      试听
                    </button>
                  )}
                </label>

                {categorizedVoices.some(v => v.category === 'zh-female') && (
                  <div className="mt-4 mb-2">
                    <div className="text-xs font-semibold px-2 py-1 bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-lg">
                      👩 中文女声
                    </div>
                  </div>
                )}
                {categorizedVoices.filter(v => v.category === 'zh-female').map((voice) => (
                  <label
                    key={voice.name}
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors bg-pink-50/50 dark:bg-pink-900/10"
                  >
                    <input
                      type="radio"
                      name="voice"
                      value={voice.name}
                      checked={speechState.selectedVoice === voice.name}
                      onChange={() => setSelectedVoiceInSpeech(voice.name)}
                      className="w-4 h-4 text-pink-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{voice.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{voice.lang}</p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 rounded-full">
                      中文
                    </span>
                    {speechState.selectedVoice === voice.name && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleTestVoice(voice.name);
                        }}
                        className="text-xs px-3 py-1.5 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500/20 transition-colors flex-shrink-0"
                      >
                        试听
                      </button>
                    )}
                  </label>
                ))}

                {categorizedVoices.some(v => v.category === 'zh-male') && (
                  <div className="mt-4 mb-2">
                    <div className="text-xs font-semibold px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg">
                      👨 中文男声
                    </div>
                  </div>
                )}
                {categorizedVoices.filter(v => v.category === 'zh-male').map((voice) => (
                  <label
                    key={voice.name}
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors bg-blue-50/50 dark:bg-blue-900/10"
                  >
                    <input
                      type="radio"
                      name="voice"
                      value={voice.name}
                      checked={speechState.selectedVoice === voice.name}
                      onChange={() => setSelectedVoiceInSpeech(voice.name)}
                      className="w-4 h-4 text-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{voice.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{voice.lang}</p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
                      中文
                    </span>
                    {speechState.selectedVoice === voice.name && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleTestVoice(voice.name);
                        }}
                        className="text-xs px-3 py-1.5 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500/20 transition-colors flex-shrink-0"
                      >
                        试听
                      </button>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSaveConfig}
              className="flex-1 px-4 py-2 rounded-lg text-white font-medium transition-all"
              style={{ backgroundColor: colors.primary }}
            >
              保存配置
            </button>
            <button
              onClick={handleTest}
              disabled={testStatus === 'testing'}
              className={`flex-1 px-4 py-2 rounded-lg text-white font-medium transition-all ${
                testStatus === 'success' 
                  ? 'bg-green-500 hover:bg-green-600'
                  : testStatus === 'error'
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-gray-600 hover:bg-gray-700'
              }`}
            >
              {testStatus === 'testing' ? '测试中...' : 
               testStatus === 'success' ? '✓ 成功' : 
               testStatus === 'error' ? '✗ 重试' : '测试配置'}
            </button>
          </div>

          {testMessage && (
            <div className={`p-4 rounded-xl text-sm ${
              testStatus === 'success' 
                ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : testStatus === 'error'
                ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}>
              {testMessage}
            </div>
          )}

          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="font-medium mb-2">💡 使用提示</div>
            <ul className="list-disc list-inside space-y-1">
              <li>浏览器 TTS：免费使用，但声音质量取决于系统</li>
              <li>阿里云 TTS：高质量中文女声，需要阿里云账号和 Access Key</li>
              <li>自定义 API：可以连接到您自己的 TTS 代理服务</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
