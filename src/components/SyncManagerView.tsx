import { useState } from 'react';
import { SyncService } from '../services/syncService';
import { useTheme } from '../context/ThemeContext';
import { GitHubGistSyncView } from './GitHubGistSyncView';

export function SyncManagerView() {
  const { colors, isDarkMode } = useTheme();
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showGistSync, setShowGistSync] = useState(false);

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
        const success = SyncService.importFromJSON(content);
        if (success) {
          setMessage({ text: '数据导入成功！页面即将刷新...', type: 'success' });
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          setMessage({ text: '数据导入失败，请检查文件格式', type: 'error' });
          setTimeout(() => setMessage(null), 3000);
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
          <p className="text-sm opacity-70">通过导出/导入 JSON 文件实现多设备同步</p>
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
          <p className="text-sm opacity-70 mb-4">从之前导出的 JSON 文件恢复数据（会覆盖当前所有数据）</p>
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
              {isImporting ? '正在导入...' : '选择文件导入'}
            </div>
          </label>
        </div>

        <div className="p-6 rounded-lg bg-gray-100 dark:bg-gray-800">
          <h3 className="text-lg font-semibold mb-3">💡 使用说明</h3>
          <ul className="space-y-2 text-sm opacity-80">
            <li>• 在设备 A 上点击"导出备份文件"保存 JSON 文件</li>
            <li>• 将 JSON 文件传输到设备 B（通过云盘、微信等）</li>
            <li>• 在设备 B 上点击"选择文件导入"选择该 JSON 文件</li>
            <li>• 导入后页面会自动刷新，所有数据即可同步</li>
          </ul>
          <h4 className="font-semibold mt-4 mb-2">📦 同步内容包括：</h4>
          <ul className="space-y-1 text-sm opacity-80">
            <li>• 📚 所有书籍数据</li>
            <li>• 📖 所有书源配置</li>
            <li>• 📋 所有协议</li>
            <li>• 🧠 智库模块（包括你辛苦写的提示词！）</li>
            <li>• 💬 智库模块的对话历史</li>
            <li>• 🎨 主题设置（深色/浅色模式、主题颜色）</li>
            <li>• 🏞️ 背景图片和亮度</li>
            <li>• 🎵 音乐音量</li>
            <li>• 🌐 音乐网站列表（自定义的音乐网站）</li>
            <li>• 📝 自定义协议主题</li>
            <li>• 📖 读书器设置（背景色、文字色、声音）</li>
            <li>• 🤖 AI 助手 API 配置（API Key、Base URL、模型等）</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
