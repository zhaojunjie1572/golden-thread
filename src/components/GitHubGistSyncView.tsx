import { useState, useEffect } from 'react';
import { GitHubGistSyncService, GitHubGistConfig } from '../services/githubGistSyncService';
import { useTheme } from '../context/ThemeContext';

export function GitHubGistSyncView() {
  const { colors } = useTheme();
  const [config, setConfig] = useState<GitHubGistConfig | null>(null);
  const [token, setToken] = useState('');
  const [gistId, setGistId] = useState('');
  const [autoSync, setAutoSync] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [conflict, setConflict] = useState<{ hasConflict: boolean; details: any } | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [isEdge, setIsEdge] = useState(false);
  const [diagnosticInfo, setDiagnosticInfo] = useState<string>('');

  useEffect(() => {
    // 检测是否是 Edge 浏览器
    const userAgent = navigator.userAgent.toLowerCase();
    const isEdgeBrowser = userAgent.includes('edg') && !userAgent.includes('chrome');
    setIsEdge(isEdgeBrowser);

    // 检测 localStorage 是否可用
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      setStorageAvailable(true);
    } catch (e) {
      setStorageAvailable(false);
      console.error('[GitHubGistSyncView] localStorage 不可用:', e);
    }

    const savedConfig = GitHubGistSyncService.getConfig();
    if (savedConfig) {
      setConfig(savedConfig);
      setToken(savedConfig.token || '');
      setGistId(savedConfig.gistId || '');
      setAutoSync(savedConfig.autoSync !== false);
    }
  }, []);

  const handleSaveConfig = () => {
    if (!token.trim()) {
      setMessage({ text: '请输入 GitHub Token', type: 'error' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const newConfig: GitHubGistConfig = {
      token: token.trim(),
      gistId: gistId.trim() || undefined,
      autoSync,
      lastSyncTime: config?.lastSyncTime
    };

    GitHubGistSyncService.saveConfig(newConfig);
    setConfig(newConfig);

    // 自动同步已禁用，始终停止自动同步
    GitHubGistSyncService.stopAutoSync();
    setMessage({ text: '配置已保存！请使用手动同步按钮进行同步', type: 'success' });

    setTimeout(() => setMessage(null), 3000);
  };

  const handleSyncToCloud = async (force: boolean = false) => {
    if (!token.trim()) {
      setMessage({ text: '请先配置 GitHub Token', type: 'error' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    // 强制覆盖时显示确认对话框
    if (force) {
      if (!confirm('⚠️ 警告：强制覆盖将用本地数据完全替换云端数据，云端现有数据将丢失！\n\n确定要继续吗？')) {
        return;
      }
    }

    setIsSyncing(true);
    try {
      const result = await GitHubGistSyncService.syncToCloud(force);
      
      if (result.success) {
        setMessage({ text: `✅ ${result.message}`, type: 'success' });
        if (result.gistId) {
          setGistId(result.gistId);
        }
        const updatedConfig = GitHubGistSyncService.getConfig();
        if (updatedConfig) {
          setConfig(updatedConfig);
        }
      } else {
        setMessage({ text: `❌ ${result.message}`, type: 'error' });
      }
    } catch (error) {
      setMessage({ text: '同步失败，请检查网络和 Token', type: 'error' });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleSyncFromCloud = async () => {
    if (!token.trim() || !gistId.trim()) {
      setMessage({ text: '请先配置 Token 和 Gist ID', type: 'error' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setIsSyncing(true);
    try {
      const result = await GitHubGistSyncService.syncFromCloud();

      if (result.success) {
        setMessage({ text: `✅ ${result.message}`, type: 'success' });
        setConflict(null);
        // 延迟 5 秒刷新，让用户有时间看到控制台日志
        setTimeout(() => {
          window.location.reload();
        }, 5000);
      } else if (result.hasConflict) {
        setConflict({ hasConflict: true, details: result.conflictDetails });
        setMessage({ text: '⚠️ 检测到数据冲突！', type: 'error' });
      } else {
        setMessage({ text: `❌ ${result.message}`, type: 'error' });
      }
    } catch (error) {
      setMessage({ text: '同步失败，请检查网络和配置', type: 'error' });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleResolveConflict = async (keepLocal: boolean) => {
    if (keepLocal) {
      setConflict(null);
      setMessage({ text: '保留了本地版本，云端数据未导入', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } else {
      setIsSyncing(true);
      try {
        const result = await GitHubGistSyncService.forceSyncFromCloud();
        if (result.success) {
          setMessage({ text: '✅ 云端版本已覆盖本地数据！页面即将刷新...', type: 'success' });
          setConflict(null);
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          setMessage({ text: `❌ ${result.message}`, type: 'error' });
        }
      } catch (error) {
        setMessage({ text: '同步失败，请检查网络和配置', type: 'error' });
      } finally {
        setIsSyncing(false);
        setTimeout(() => setMessage(null), 5000);
      }
    }
  };

  const handleClearConfig = () => {
    if (!confirm('确定要清除所有配置吗？这不会删除云端数据。')) {
      return;
    }
    GitHubGistSyncService.clearConfig();
    setConfig(null);
    setToken('');
    setGistId('');
    setAutoSync(false);
    setMessage({ text: '本地配置已清除', type: 'success' });
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="p-6 rounded-lg" style={{ backgroundColor: `${colors.primary}20` }}>
        <h3 className="text-lg font-bold mb-2 flex items-center gap-2" style={{ color: colors.primary }}>
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          GitHub Gist 云端同步
        </h3>
        <p className="text-sm opacity-80">
          使用 GitHub Gist 免费存储空间，实现多设备数据自动同步
        </p>
      </div>

      {/* Edge 浏览器提示 */}
      {isEdge && (
        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
          <p className="font-semibold text-blue-800">🌐 Edge 浏览器 detected</p>
          <p className="text-sm text-blue-700 mt-1">
            如果同步失败，请检查以下设置：
          </p>
          <ul className="text-sm text-blue-600 mt-1 list-disc list-inside space-y-1">
            <li>地址栏左侧的<strong>盾牌图标</strong> → 关闭"跟踪防护"</li>
            <li>设置 → Cookie 和网站权限 → 允许本地存储</li>
            <li>确保不在 InPrivate 模式下使用</li>
          </ul>
        </div>
      )}

      {/* 存储不可用警告 */}
      {!storageAvailable && (
        <div className="p-4 rounded-lg bg-red-100 text-red-800">
          <p className="font-semibold">⚠️ 浏览器存储不可用</p>
          <p className="text-sm mt-1">
            可能是以下原因：
          </p>
          <ul className="text-sm mt-1 list-disc list-inside">
            <li>浏览器处于隐私/无痕模式</li>
            <li>浏览器禁止了第三方 Cookie/存储</li>
            <li>存储空间已满</li>
          </ul>
          <p className="text-sm mt-2">
            请尝试使用普通模式浏览，或检查浏览器设置。
          </p>
        </div>
      )}

      {/* 消息提示 */}
      {message && (
        <div
          className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
        >
          {message.text}
        </div>
      )}

      {/* 冲突解决 UI */}
      {conflict && conflict.hasConflict && (
        <div className="p-6 rounded-lg bg-yellow-50 border-2 border-yellow-400">
          <h4 className="font-bold text-yellow-800 mb-4 flex items-center gap-2">
            ⚠️ 数据冲突检测
          </h4>
          <p className="text-sm text-yellow-700 mb-4">
            检测到您在多个设备上有不同的数据修改，请选择要保留的版本：
          </p>

          <div className="space-y-3 mb-4">
            {conflict.details.books && (
              <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="font-medium">📚 书籍</span>
                <span className="text-sm">
                  本地: <strong>{conflict.details.books.local}</strong> 本 |
                  云端: <strong>{conflict.details.books.cloud}</strong> 本
                </span>
              </div>
            )}
            {conflict.details.protocols && (
              <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="font-medium">📋 协议</span>
                <span className="text-sm">
                  本地: <strong>{conflict.details.protocols.local}</strong> 个 |
                  云端: <strong>{conflict.details.protocols.cloud}</strong> 个
                </span>
              </div>
            )}
            {conflict.details.thinkTankModules && (
              <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="font-medium">🧠 智库模块</span>
                <span className="text-sm">
                  本地: <strong>{conflict.details.thinkTankModules.local}</strong> 个 |
                  云端: <strong>{conflict.details.thinkTankModules.cloud}</strong> 个
                </span>
              </div>
            )}
            {conflict.details.mindMaps && (
              <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="font-medium">🧠 思维导图</span>
                <span className="text-sm">
                  本地: <strong>{conflict.details.mindMaps.local}</strong> 个 |
                  云端: <strong>{conflict.details.mindMaps.cloud}</strong> 个
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleResolveConflict(true)}
              className="px-4 py-3 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors"
            >
              📱 保留本地版本
            </button>
            <button
              onClick={() => handleResolveConflict(false)}
              disabled={isSyncing}
              className="px-4 py-3 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {isSyncing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  导入中...
                </span>
              ) : (
                '☁️ 使用云端版本'
              )}
            </button>
          </div>

          <p className="text-xs text-yellow-600 mt-4 text-center">
            💡 提示：如果想先上传本地数据，可以先点击"保留本地版本"，然后再"上传到云端"
          </p>
        </div>
      )}

      {/* 配置区域 */}
      <div className="p-6 rounded-lg border-2 border-dashed" style={{ borderColor: colors.primary }}>
        <h4 className="font-semibold mb-4" style={{ color: colors.primary }}>⚙️ 配置 GitHub Token</h4>
        
        {/* Token 输入 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">GitHub Personal Access Token</label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showToken ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            需要生成 Token，权限：gist (选中)
          </p>
        </div>

        {/* Gist ID 输入 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Gist ID（可选，首次会自动创建）</label>
          <input
            type="text"
            value={gistId}
            onChange={(e) => setGistId(e.target.value)}
            placeholder="8f7f9a2b3c4d5e6f7a8b9c0d1e2f3a4b"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <p className="text-xs text-gray-500 mt-1">
            首次同步会自动创建 Gist 并保存 ID
          </p>
        </div>

        {/* 自动同步开关 */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <label className="text-sm font-medium">双向自动同步</label>
            <p className="text-xs text-gray-500">开启后，自动下载云端数据并合并，再上传更新</p>
          </div>
          <button
            onClick={() => setAutoSync(!autoSync)}
            className={`w-12 h-6 rounded-full transition-colors ${
              autoSync ? 'bg-golden' : 'bg-gray-300'
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
              autoSync ? 'translate-x-6' : 'translate-x-0.5'
            }`} />
          </button>
        </div>

        {/* 自动同步说明 */}
        {autoSync && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm">
            <p className="text-blue-700">
              <span className="font-semibold">🔄 双向同步流程：</span>
            </p>
            <ol className="text-blue-600 text-xs mt-1 space-y-1 list-decimal list-inside">
              <li>每分钟自动检查云端数据</li>
              <li>下载云端数据并与本地数据智能合并</li>
              <li>将合并后的数据上传到云端</li>
              <li>所有设备保持数据一致</li>
            </ol>
          </div>
        )}

        {/* 保存按钮 */}
        <button
          onClick={handleSaveConfig}
          className="w-full px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-90"
          style={{ backgroundColor: colors.primary, color: '#fff' }}
        >
          保存配置
        </button>
      </div>

      {/* 同步操作 */}
      {config && config.token && (
        <div className="p-6 rounded-lg border-2" style={{ borderColor: colors.primary }}>
          <h4 className="font-semibold mb-4" style={{ color: colors.primary }}>🔄 同步操作</h4>
          
          {/* 同步状态 */}
          <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg space-y-2">
            <p className="text-sm">
              <span className="opacity-70">上次同步：</span>
              <span className="font-medium">
                {GitHubGistSyncService.formatLastSyncTime(config.lastSyncTime)}
              </span>
            </p>
            {config.gistId && (
              <div className="text-xs">
                <p className="text-gray-500">
                  <span className="opacity-70">Gist ID: </span>
                  <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded font-mono">
                    {config.gistId}
                  </code>
                </p>
                <p className="text-gray-400 mt-1">
                  💡 请确保所有设备使用相同的 Gist ID 才能实现同步
                </p>
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleSyncToCloud(false)}
              disabled={isSyncing}
              className="px-4 py-3 rounded-lg font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#238636', color: '#fff' }}
            >
              {isSyncing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  同步中...
                </span>
              ) : (
                '☁️ 上传到云端'
              )}
            </button>

            <button
              onClick={handleSyncFromCloud}
              disabled={isSyncing || !config.gistId}
              className="px-4 py-3 rounded-lg font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#1f6feb', color: '#fff' }}
            >
              {isSyncing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  同步中...
                </span>
              ) : (
                '📥 从云端下载'
              )}
            </button>
          </div>

          {/* 强制覆盖按钮 */}
          <button
            onClick={() => handleSyncToCloud(true)}
            disabled={isSyncing || !config.gistId}
            className="w-full mt-3 px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-90 disabled:opacity-50 bg-orange-500 text-white"
          >
            {isSyncing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                同步中...
              </span>
            ) : (
              '⚠️ 强制覆盖云端（用本地数据替换云端）'
            )}
          </button>

          {/* 诊断按钮 */}
          <button
            onClick={() => {
              const info = {
                userAgent: navigator.userAgent,
                gistId: config.gistId || '未设置',
                hasToken: config.token ? '已设置' : '未设置',
                autoSync: config.autoSync,
                lastSyncTime: config.lastSyncTime || '从未同步',
                storageAvailable: storageAvailable,
                localBooks: JSON.parse(localStorage.getItem('golden-thread-books') || '[]').length,
                localProtocols: JSON.parse(localStorage.getItem('golden-thread-protocols') || '[]').length,
                localMindMaps: JSON.parse(localStorage.getItem('mindmap-saved-records') || '[]').length,
              };
              const infoText = JSON.stringify(info, null, 2);
              setDiagnosticInfo(infoText);
              navigator.clipboard.writeText(infoText);
              setMessage({ text: '诊断信息已复制到剪贴板', type: 'success' });
              setTimeout(() => setMessage(null), 3000);
            }}
            className="w-full mt-4 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
          >
            🔍 复制诊断信息（用于排查同步问题）
          </button>

          {diagnosticInfo && (
            <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-mono overflow-auto max-h-40">
              <pre>{diagnosticInfo}</pre>
            </div>
          )}
        </div>
      )}

      {/* Token 生成指南 */}
      <div className="p-6 rounded-lg bg-gray-100 dark:bg-gray-800">
        <h4 className="font-semibold mb-3">📖 Token 生成指南</h4>
        <ol className="text-sm space-y-2 opacity-80 list-decimal list-inside">
          <li>登录 GitHub，点击右上角头像 → Settings</li>
          <li>左侧菜单选择 "Developer settings"</li>
          <li>选择 "Personal access tokens" → "Tokens (classic)"</li>
          <li>点击 "Generate new token" → "Generate new token (classic)"</li>
          <li>填写 Note（如：Golden Thread Sync）</li>
          <li>勾选权限：<strong>gist</strong> ✅</li>
          <li>点击 "Generate token" 并复制生成的 Token</li>
        </ol>
        <p className="text-xs mt-3 opacity-60">
          💡 Token 只显示一次，请妥善保存
        </p>
      </div>

      {/* 清除配置 */}
      {config && (
        <button
          onClick={handleClearConfig}
          className="w-full px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
        >
          🗑️ 清除本地配置
        </button>
      )}
    </div>
  );
}
