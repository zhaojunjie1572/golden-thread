import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// 全局错误处理
window.onerror = function(message, source, lineno, colno, error) {
  console.error('Global error:', { message, source, lineno, colno, error });
  // 在页面上显示错误信息
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif;">
        <h2 style="color: red;">页面加载错误</h2>
        <p><strong>错误:</strong> ${message}</p>
        <p><strong>位置:</strong> ${source}:${lineno}</p>
        <pre style="background: #f5f5f5; padding: 10px; overflow: auto;">${error?.stack || ''}</pre>
        <button onclick="localStorage.clear(); window.location.reload()" style="padding: 10px 20px; margin-top: 20px;">
          清除数据并刷新
        </button>
      </div>
    `;
  }
  return false;
};

window.onunhandledrejection = function(event) {
  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault();
};

// 白屏检测 - 如果页面在5秒后仍然没有内容，尝试恢复
setTimeout(() => {
  const root = document.getElementById('root');
  if (root && (root.innerHTML === '' || root.children.length === 0)) {
    console.error('White screen detected - attempting recovery');
    
    // 尝试清除可能导致问题的 localStorage 项
    const keysToRemove = [
      'simple-mindmap-data',
      'wisdom_quotes',
      'golden-thread-protocols'
    ];
    
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
        console.log(`Cleared ${key} from localStorage`);
      } catch (e) {
        console.error(`Failed to clear ${key}:`, e);
      }
    });
    
    // 显示恢复提示
    root.innerHTML = `
      <div style="
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f9fafb;
        padding: 20px;
        font-family: system-ui, -apple-system, sans-serif;
      ">
        <div style="
          max-width: 400px;
          width: 100%;
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
          padding: 32px;
          text-align: center;
        ">
          <div style="font-size: 48px; margin-bottom: 16px;">🔄</div>
          <h1 style="font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 8px;">
            页面数据已重置
          </h1>
          <p style="color: #6b7280; margin-bottom: 24px;">
            检测到页面加载问题，已自动清除可能损坏的数据。
          </p>
          <button onclick="window.location.reload()" style="
            width: 100%;
            padding: 12px 24px;
            background: #f59e0b;
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
          ">
            重新加载页面
          </button>
        </div>
      </div>
    `;
  }
}, 5000);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
