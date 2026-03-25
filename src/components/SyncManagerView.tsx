import { useState } from 'react';
import { SyncService, MergeResult } from '../services/syncService';
import { useTheme } from '../context/ThemeContext';
import { GitHubGistSyncView } from './GitHubGistSyncView';

export function SyncManagerView() {
  const { colors, isDarkMode } = useTheme();
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showGistSync, setShowGistSync] = useState(false);
  const [showMergeResult, setShowMergeResult] = useState<MergeResult | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');

  const handleExport = () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      SyncService.downloadJSON(`golden-thread-backup-${timestamp}.json`);
      setMessage({ text: '数据导出成功！', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ text: '数据导出失败', type: 'error' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        
        if (importMode === 'merge') {
          // 合并模式
          const result = SyncService.importFromJSON(content, 'merge');
          if (result) {
            // 重新读取合并结果
            const mergeResult = SyncService.mergeData(JSON.parse(content));
            setShowMergeResult(mergeResult);
            setMessage({ text: '数据合并成功！请查看合并详情', type: 'success' });
          } else {
            setMessage({ text: '数据合并失败，请检查文件格式', type: 'error' });
          }
        } else {
          // 覆盖模式
          const success = SyncService.importFromJSON(content, 'replace');
          if (success) {
            setMessage({ text: '数据导入成功！页面即将刷新...', type: 'success' });
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } else {
            setMessage({ text: '数据导入失败，请检查文件格式', type: 'error' });
            setTimeout(() => setMessage(null), 3000);
          }
        }
      } catch (error) {
        setMessage({ text: '数据导入失败', type: 'error' });
        setTimeout(() => setMessage(null), 3000);
      } finally {
        setIsImporting(false);
        event.target.value = '';
      }
    };
    reader.onerror = () => {
      setMessage({ text: '文件读取失败', type: 'error' });
      setTimeout(() => setMessage(null), 3000);
      setIsImporting(false);
    };
    reader.readAsText(file);
  };

  const bgColor = isDarkMode ? colors.bgDark : colors.bgLight;
  const textColor = isDarkMode ? '#fff' : '#000';

  return (
    <div className="p-6 max-w-2xl mx-auto" style={{ backgroundColor: bgColor, color: textColor, minHeight: '100vh' }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: colors.primary }}>数据同步管理</h2>
          <p className="text-sm opacity-70 mb-3">☁️ GitHub Gist 免费云同步 | 📤 JSON 手动导出</p>
          <div className="text-xs opacity-60 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <p className="font-semibold text-blue-700 dark:text-blue-300 mb-1">📋 同步范围：</p>
            <p>✅ 书籍、协议、协议执行历史、醒世恒言、智库、AI助手聊天记录、AI配置、工作流智能体、思维导图</p>
            <p className="font-semibold text-red-600 dark:text-red-400 mt-1 mb-1">❌ 不同步：</p>
            <p>主题、背景图片、书源、音乐网站、本地音乐元数据、读书器设置、朗读设置（每个设备独立设置）</p>
          </div>
        </div>
        <button
          onClick={() => window.location.href = '/'}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="返回首页"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        <div className="p-6 rounded-lg border-2 border-dashed" style={{ borderColor: colors.primary }}>
          <h3 className="text-lg font-semibold mb-3" style={{ color: colors.primary }}>📤 导出数据</h3>
          <p className="text-sm opacity-70 mb-4">将当前所有数据（书籍、书源、协议、智库模块提示词、设置等）导出为 JSON 文件</p>
          <button
            onClick={handleExport}
            className="px-6 py-3 rounded-lg font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: colors.primary, color: '#fff' }}
          >
            导出备份文件
          </button>
        </div>

        <div className="p-6 rounded-lg border-2 border-dashed" style={{ borderColor: '#238636' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-lg font-semibold" style={{ color: '#238636' }}>☁️ GitHub Gist 云端同步（推荐）</h3>
              <p className="text-sm opacity-70 mt-1">免费、稳定的云端同步方案，支持多设备自动同步</p>
            </div>
            <button
              onClick={() => setShowGistSync(!showGistSync)}
              className="px-4 py-2 rounded-lg font-medium transition-all hover:opacity-80 active:scale-95"
              style={{ backgroundColor: '#238636', color: '#fff' }}
            >
              {showGistSync ? '收起 ↑' : '配置 ↓'}
            </button>
          </div>
          
          {showGistSync && (
            <div className="mt-6">
              <GitHubGistSyncView />
            </div>
          )}
        </div>

        <div className="p-6 rounded-lg border-2 border-dashed" style={{ borderColor: colors.primary }}>
          <h3 className="text-lg font-semibold mb-3" style={{ color: colors.primary }}>📥 导入数据</h3>
          
          {/* 导入模式选择 */}
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">选择导入模式：</p>
            <div className="flex gap-3">
              <button
                onClick={() => setImportMode('replace')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  importMode === 'replace'
                    ? 'bg-red-100 text-red-700 border-2 border-red-300'
                    : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                }`}
              >
                🔄 完全覆盖
                <span className="block text-xs font-normal mt-1 opacity-70">用导入的数据替换当前所有数据</span>
              </button>
              <button
                onClick={() => setImportMode('merge')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  importMode === 'merge'
                    ? 'bg-green-100 text-green-700 border-2 border-green-300'
                    : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                }`}
              >
                🔀 智能合并
                <span className="block text-xs font-normal mt-1 opacity-70">保留两边数据，自动去重合并</span>
              </button>
            </div>
          </div>

          <p className="text-sm opacity-70 mb-4">
            {importMode === 'replace' 
              ? '⚠️ 警告：会覆盖当前所有数据，请确保已备份重要内容'
              : '✅ 智能合并会保留两边的数据，自动去重并解决冲突'}
          </p>
          
          <label className="inline-block cursor-pointer">
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={isImporting}
              className="hidden"
            />
            <div
              className={`px-6 py-3 rounded-lg font-medium transition-all ${isImporting ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
              style={{ backgroundColor: colors.primary, color: '#fff' }}
            >
              {isImporting ? '正在导入...' : importMode === 'merge' ? '选择文件合并' : '选择文件导入'}
            </div>
          </label>

          {/* 合并结果显示 */}
          {showMergeResult && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-green-800 dark:text-green-200">🎉 合并完成！</h4>
                <button
                  onClick={() => window.location.reload()}
                  className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors"
                >
                  刷新页面
                </button>
              </div>
              <div className="space-y-2 text-sm">
                {showMergeResult.books.added > 0 && (
                  <div className="flex justify-between">
                    <span>📚 书籍</span>
                    <span className="text-green-600">+{showMergeResult.books.added} 本</span>
                  </div>
                )}
                {showMergeResult.protocols.added > 0 && (
                  <div className="flex justify-between">
                    <span>📋 协议</span>
                    <span className="text-green-600">+{showMergeResult.protocols.added} 个</span>
                  </div>
                )}
                {showMergeResult.thinkTankModules.added > 0 && (
                  <div className="flex justify-between">
                    <span>🧠 智库模块</span>
                    <span className="text-green-600">+{showMergeResult.thinkTankModules.added} 个</span>
                  </div>
                )}
                {showMergeResult.thinkTankMessages.added > 0 && (
                  <div className="flex justify-between">
                    <span>💬 对话消息</span>
                    <span className="text-green-600">+{showMergeResult.thinkTankMessages.added} 条</span>
                  </div>
                )}

                {showMergeResult.aiAssistantChatSessions.added > 0 && (
                  <div className="flex justify-between">
                    <span>🤖 AI 聊天记录</span>
                    <span className="text-green-600">+{showMergeResult.aiAssistantChatSessions.added} 个会话</span>
                  </div>
                )}
                {showMergeResult.agentWorkflow.added > 0 && (
                  <div className="flex justify-between">
                    <span>⚙️ 工作流智能体</span>
                    <span className="text-green-600">+{showMergeResult.agentWorkflow.added} 个</span>
                  </div>
                )}
                {showMergeResult.protocolUiModules.added > 0 && (
                  <div className="flex justify-between">
                    <span>🧩 协议 UI 模块</span>
                    <span className="text-green-600">+{showMergeResult.protocolUiModules.added} 个</span>
                  </div>
                )}
                {showMergeResult.mindMaps.added > 0 && (
                  <div className="flex justify-between">
                    <span>🧠 思维导图</span>
                    <span className="text-green-600">+{showMergeResult.mindMaps.added} 个</span>
                  </div>
                )}
                {showMergeResult.quotes.added > 0 && (
                  <div className="flex justify-between">
                    <span>✨ 醒世恒言</span>
                    <span className="text-green-600">+{showMergeResult.quotes.added} 条</span>
                  </div>
                )}
                {showMergeResult.protocolExecutionHistory.added > 0 && (
                  <div className="flex justify-between">
                    <span>📊 协议执行记录</span>
                    <span className="text-green-600">+{showMergeResult.protocolExecutionHistory.added} 条</span>
                  </div>
                )}
                {(showMergeResult.books.updated + showMergeResult.protocols.updated + showMergeResult.thinkTankModules.updated) > 0 && (
                  <div className="flex justify-between pt-2 border-t border-green-200 dark:border-green-800">
                    <span>📝 更新项目</span>
                    <span className="text-blue-600">
                      {showMergeResult.books.updated + showMergeResult.protocols.updated + showMergeResult.thinkTankModules.updated} 个
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 rounded-lg bg-gray-100 dark:bg-gray-800">
          <h3 className="text-lg font-semibold mb-3">💡 使用说明</h3>
          
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">🔄 两种导入模式：</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">完全覆盖模式：</span>
                <span className="opacity-80"> 用导入的数据完全替换当前数据，适合单一设备使用</span>
              </div>
              <div>
                <span className="font-medium">智能合并模式：</span>
                <span className="opacity-80"> 自动合并两边数据，去重并解决冲突，适合多设备同步</span>
              </div>
            </div>
          </div>

          <h4 className="font-semibold mb-2">📋 操作步骤：</h4>
          <ul className="space-y-2 text-sm opacity-80 mb-4">
            <li>• 在设备 A 上点击"导出备份文件"保存 JSON 文件</li>
            <li>• 将 JSON 文件传输到设备 B（通过云盘、微信等）</li>
            <li>• 在设备 B 上选择"智能合并"模式，点击"选择文件合并"</li>
            <li>• 查看合并结果，点击"刷新页面"完成同步</li>
          </ul>

          <h4 className="font-semibold mt-4 mb-2">📦 同步内容包括：</h4>
          <ul className="space-y-1 text-sm opacity-80">
            <li>• 📚 所有书籍数据</li>
            <li>•  所有协议</li>
            <li>• 📊 协议执行历史（打卡记录）</li>
            <li>• ✨ 醒世恒言语录</li>
            <li>• 🧠 智库模块（包括你辛苦写的提示词！）</li>
            <li>• 💬 智库模块的对话历史</li>
            <li>• 🎨 智库模块 UI 设置（背景、颜色、透明度）</li>
            <li>• 🤖 AI 助手聊天记录（所有会话）</li>
            <li>• 🎨 AI 助手 UI 设置（背景、颜色、透明度）</li>
            <li>• 📝 自定义协议主题</li>
            <li>• 🧩 协议创建界面 UI 模块（预设）</li>
            <li>• 🤖 AI 助手 API 配置（API Key、Base URL、模型等）</li>
            <li>• ⚙️ 工作流智能体（agents、workflows、instances、memories、feedbacks、personas）</li>
            <li>• 🧠 思维导图（保存的导图数据）</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
