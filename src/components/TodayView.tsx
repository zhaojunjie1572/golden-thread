import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProtocols } from '../context/ProtocolContext';
import { ProtocolModel, goalTypeLabels, triggerTypeLabels } from '../types/protocol';
import MindMapView from './MindMapView';
import SimpleMindMap from './SimpleMindMap';

const defaultWisdomQuotes = [
  { text: "千里之行，始于足下", author: "老子" },
  { text: "业精于勤，荒于嬉", author: "韩愈" },
  { text: "不积跬步，无以至千里", author: "荀子" },
  { text: "天行健，君子以自强不息", author: "周易" },
  { text: "一寸光阴一寸金，寸金难买寸光阴", author: "王贞白" },
  { text: "学而不思则罔，思而不学则殆", author: "孔子" },
  { text: "知之为知之，不知为不知，是知也", author: "孔子" },
  { text: "三人行，必有我师焉", author: "孔子" },
  { text: "生于忧患，死于安乐", author: "孟子" },
  { text: "路漫漫其修远兮，吾将上下而求索", author: "屈原" }
];

const STORAGE_KEY = 'wisdom_quotes';

const formatDate = (() => {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
  return (date: Date): string => formatter.format(date);
})();

const WisdomQuoteCard = ({ 
  quote, 
  onAdd, 
  onEdit,
  onChange
}: { 
  quote: { text: string; author: string }; 
  onAdd: () => void; 
  onEdit: () => void;
  onChange: () => void;
}) => (
  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-200 p-5 shadow-lg">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-2xl">📜</span>
      <h2 className="text-lg font-bold text-amber-800">醒世恒言</h2>
      <div className="ml-auto flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="text-xs bg-amber-500 text-white px-2 py-1 rounded-lg hover:bg-amber-600 transition-colors"
        >
          + 添加
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="text-xs bg-blue-500 text-white px-2 py-1 rounded-lg hover:bg-blue-600 transition-colors"
        >
          编辑
        </button>
      </div>
    </div>
    <div 
      className="bg-white/70 rounded-xl p-4 border border-amber-100 cursor-pointer hover:bg-white/90 transition-colors"
      onClick={onChange}
    >
      <p className="text-lg font-medium text-gray-800 italic leading-relaxed">
        "{quote.text}"
      </p>
      <p className="text-right text-sm text-amber-700 mt-2 font-semibold">
        —— {quote.author}
      </p>
      <p className="text-center text-xs text-amber-500 mt-2">点击更换语录</p>
    </div>
  </div>
);

const QuickActionCard = ({
  title,
  subtitle,
  icon,
  color,
  onClick,
  stats
}: {
  title: string;
  subtitle: string;
  icon: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
  onClick: () => void;
  stats: string;
}) => {
  const colorClasses = {
    blue: 'from-blue-50 to-blue-100 border-blue-200 hover:border-blue-300 text-blue-700',
    green: 'from-green-50 to-green-100 border-green-200 hover:border-green-300 text-green-700',
    purple: 'from-purple-50 to-purple-100 border-purple-200 hover:border-purple-300 text-purple-700',
    orange: 'from-orange-50 to-orange-100 border-orange-200 hover:border-orange-300 text-orange-700'
  };

  const iconBgClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500'
  };

  return (
    <button
      onClick={onClick}
      className={`w-full bg-gradient-to-br ${colorClasses[color]} rounded-2xl border-2 p-6 transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] text-left group`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-12 h-12 ${iconBgClasses[color]} rounded-xl flex items-center justify-center text-white text-2xl shadow-lg group-hover:scale-110 transition-transform`}>
              {icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 group-hover:text-gray-900">{title}</h2>
              <p className="text-sm text-gray-500">{subtitle}</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium bg-white/60 ${colorClasses[color]}`}>
            {stats}
          </span>
        </div>
      </div>
      <div className="mt-4 flex items-center text-sm text-gray-500 group-hover:text-gray-700 transition-colors">
        <span>点击进入</span>
        <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
      </div>
    </button>
  );
};



const NotificationPermissionPrompt = ({ 
  onRequest, 
  onDismiss 
}: { 
  onRequest: () => void; 
  onDismiss: () => void;
}) => (
  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
    <div className="flex items-start gap-4">
      <div className="text-3xl">🔔</div>
      <div className="flex-1">
        <h3 className="font-semibold text-gray-800 mb-1">开启提醒功能</h3>
        <p className="text-sm text-gray-600 mb-4">
          允许浏览器发送通知，不错过任何行动时间！
        </p>
        <div className="flex gap-3">
          <button
            onClick={onRequest}
            className="bg-amber-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-600 transition-colors"
          >
            开启通知
          </button>
          <button
            onClick={onDismiss}
            className="text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            稍后再说
          </button>
        </div>
      </div>
    </div>
  </div>
);



const CompletedState = () => (
  <div className="text-center py-16">
    <div className="text-6xl mb-6 text-green-500">✅</div>
    <h2 className="text-2xl font-semibold text-gray-800 mb-4">今日完成！</h2>
    <p className="text-gray-500">继续保持，明天也要加油</p>
  </div>
);

const SuccessModal = ({ 
  isOpen, 
  reward, 
  onClose 
}: { 
  isOpen: boolean; 
  reward?: string; 
  onClose: () => void;
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">太棒了！</h3>
        <p className="text-gray-500 mb-6">
          {reward ? `完成任务！\n奖励：${reward}` : '你完成了今天的任务！'}
        </p>
        <button
          onClick={onClose}
          className="w-full bg-amber-500 text-white py-3 rounded-xl font-semibold hover:bg-amber-600 transition-colors"
        >
          继续
        </button>
      </div>
    </div>
  );
};

const FailureModal = ({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void;
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">💪</div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">没关系</h3>
        <p className="text-gray-500 mb-6">明天继续努力，或者看看是否需要调整难度</p>
        <button
          onClick={onClose}
          className="w-full bg-gray-500 text-white py-3 rounded-xl font-semibold hover:bg-gray-600 transition-colors"
        >
          好的
        </button>
      </div>
    </div>
  );
};

const ProtocolCard = ({
  protocol,
  onSuccess,
  onFailure,
  onOpenMindMap
}: {
  protocol: ProtocolModel;
  onSuccess: () => void;
  onFailure: () => void;
  onOpenMindMap?: (protocol: ProtocolModel) => void;
}) => {
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFailure, setShowFailure] = useState(false);

  const handleSuccessInternal = useCallback(() => {
    onSuccess();
    setShowSuccess(true);
  }, [onSuccess]);

  const handleFailureInternal = useCallback(() => {
    onFailure();
    setShowFailure(true);
  }, [onFailure]);

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">{protocol.principle}</h3>
            <p className="text-sm text-gray-500 mt-1">优先级: {protocol.priority}</p>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-amber-50 text-amber-700">
            {goalTypeLabels[protocol.goalType]}
          </span>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-2">
            <span className="text-sm text-gray-500 min-w-[60px]">触发</span>
            <span className="text-sm text-gray-700">
              {triggerTypeLabels[protocol.triggerType]}: {protocol.triggerCondition}
            </span>
          </div>

          {protocol.reminderTime && (
            <div className="flex items-start gap-2">
              <span className="text-sm text-gray-500 min-w-[60px]">⏰ 提醒</span>
              <span className="text-sm font-medium text-amber-600">{protocol.reminderTime}</span>
            </div>
          )}

          {(protocol.psychologicalBoundary || protocol.actionPermission) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              {protocol.psychologicalBoundary && (
                <div>
                  <div className="flex items-center gap-1 text-purple-600 text-sm font-medium mb-1">
                    <span>🛡️</span> 不做
                  </div>
                  <div className="text-sm text-gray-700">{protocol.psychologicalBoundary}</div>
                </div>
              )}
              {protocol.actionPermission && (
                <div>
                  <div className="flex items-center gap-1 text-green-600 text-sm font-medium mb-1">
                    <span>✅</span> 可以做
                  </div>
                  <div className="text-sm text-gray-700">{protocol.actionPermission}</div>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-semibold text-amber-600 mb-2 flex items-center gap-1">
                  <span>📋</span> Plan A
                </h4>
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-xs text-gray-500 min-w-[40px]">标准</span>
                  <span className="text-sm text-gray-700">{protocol.action}</span>
                </div>
                <div className="flex items-center gap-2 text-amber-600 text-sm">
                  <span>最小:</span>
                  <span className="font-medium">{protocol.minimumAction}</span>
                </div>
              </div>
              {protocol.actionPlanB && (
                <div>
                  <h4 className="text-sm font-semibold text-blue-600 mb-2 flex items-center gap-1">
                    <span>🔄</span> Plan B
                  </h4>
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xs text-gray-500 min-w-[40px]">标准</span>
                    <span className="text-sm text-gray-700">{protocol.actionPlanB}</span>
                  </div>
                  {protocol.minimumActionPlanB && (
                    <div className="flex items-center gap-2 text-blue-600 text-sm">
                      <span>最小:</span>
                      <span className="font-medium">{protocol.minimumActionPlanB}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {protocol.environmentPrep && (
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-start gap-2">
                <span className="text-sm text-gray-500 min-w-[60px]">准备</span>
                <span className="text-sm text-gray-700">{protocol.environmentPrep}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          {onOpenMindMap && (
            <button
              onClick={() => onOpenMindMap(protocol)}
              className="px-4 bg-amber-100 text-amber-700 py-3.5 rounded-xl font-semibold hover:bg-amber-200 transition-colors flex items-center justify-center gap-2"
              title="思维导图"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9z" />
              </svg>
            </button>
          )}
          <button
            onClick={handleSuccessInternal}
            className="flex-1 bg-green-500 text-white py-3.5 rounded-xl font-semibold hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            完成
          </button>
          <button
            onClick={handleFailureInternal}
            className="flex-1 bg-gray-400 text-white py-3.5 rounded-xl font-semibold hover:bg-gray-500 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            跳过
          </button>
        </div>
      </div>

      <SuccessModal 
        isOpen={showSuccess} 
        reward={protocol.reward} 
        onClose={() => setShowSuccess(false)} 
      />
      <FailureModal 
        isOpen={showFailure} 
        onClose={() => setShowFailure(false)} 
      />
    </>
  );
};

export default function TodayView() {
  const {
    getTodayProtocols,
    protocols,
    isLoading,
    requestNotificationPermission,
    hasNotificationPermission,
    markProtocolSuccess,
    markProtocolFailure
  } = useProtocols();
  const navigate = useNavigate();

  const todayProtocols = useMemo(() => getTodayProtocols(), [getTodayProtocols]);
  const allCompleted = useMemo(() => protocols.length > 0 && todayProtocols.length === 0, [protocols.length, todayProtocols.length]);

  const [showPermissionPrompt, setShowPermissionPrompt] = useState(() => !hasNotificationPermission() && protocols.length > 0);

  // 思维导图状态
  const [showMindMap, setShowMindMap] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolModel | undefined>(undefined);

  // 语录状态 - 使用单个 state 对象减少重渲染
  const [quoteState, setQuoteState] = useState(() => {
    const savedQuotes = localStorage.getItem(STORAGE_KEY);
    const quotes = savedQuotes ? JSON.parse(savedQuotes) : defaultWisdomQuotes;
    const today = new Date().getDate();
    return {
      quotes,
      currentIndex: today % quotes.length,
      showEditModal: false,
      editingIndex: null as number | null,
      newText: '',
      newAuthor: ''
    };
  });

  const currentQuote = quoteState.quotes[quoteState.currentIndex];

  // 保存语录到 localStorage
  const saveQuotesToStorage = useCallback((quotes: typeof defaultWisdomQuotes) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
  }, []);

  const handleSuccess = useCallback((protocol: ProtocolModel) => {
    markProtocolSuccess(protocol.id);
  }, [markProtocolSuccess]);

  const handleFailure = useCallback((protocol: ProtocolModel) => {
    markProtocolFailure(protocol.id);
  }, [markProtocolFailure]);

  const changeQuote = useCallback(() => {
    setQuoteState(prev => ({
      ...prev,
      currentIndex: (prev.currentIndex + 1) % prev.quotes.length
    }));
  }, []);

  const openAddModal = useCallback(() => {
    setQuoteState(prev => ({
      ...prev,
      showEditModal: true,
      editingIndex: null,
      newText: '',
      newAuthor: ''
    }));
  }, []);

  const openEditModal = useCallback((index: number) => {
    setQuoteState(prev => ({
      ...prev,
      showEditModal: true,
      editingIndex: index,
      newText: prev.quotes[index].text,
      newAuthor: prev.quotes[index].author
    }));
  }, []);

  const saveQuote = useCallback(() => {
    if (!quoteState.newText.trim()) return;

    setQuoteState(prev => {
      const updatedQuotes = [...prev.quotes];
      const newQuote = { text: prev.newText, author: prev.newAuthor || '我' };

      if (prev.editingIndex !== null) {
        updatedQuotes[prev.editingIndex] = newQuote;
      } else {
        updatedQuotes.push(newQuote);
      }

      saveQuotesToStorage(updatedQuotes);

      return {
        ...prev,
        quotes: updatedQuotes,
        showEditModal: false
      };
    });
  }, [quoteState.newText, quoteState.newAuthor, saveQuotesToStorage]);

  const deleteQuote = useCallback(() => {
    setQuoteState(prev => {
      if (prev.quotes.length <= 1) {
        alert('至少需要保留一条语录！');
        return prev;
      }

      const updatedQuotes = prev.quotes.filter((_: typeof defaultWisdomQuotes[0], i: number) => i !== prev.editingIndex);
      saveQuotesToStorage(updatedQuotes);

      let newIndex = prev.currentIndex;
      if (prev.currentIndex >= updatedQuotes.length) {
        newIndex = Math.max(0, updatedQuotes.length - 1);
      }

      return {
        ...prev,
        quotes: updatedQuotes,
        showEditModal: false,
        currentIndex: newIndex
      };
    });
  }, [saveQuotesToStorage]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">今日执行</h1>
          <p className="text-gray-500">{formatDate(new Date())}</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SimpleMindMap />
          <WisdomQuoteCard
            quote={currentQuote}
            onAdd={openAddModal}
            onEdit={() => openEditModal(quoteState.currentIndex)}
            onChange={changeQuote}
          />
        </div>
      </div>
      
      {/* 快速入口区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 创建协议入口 */}
        <QuickActionCard
          title="创建新协议"
          subtitle="定义你的行动规则"
          icon="➕"
          color="blue"
          onClick={() => navigate('/create')}
          stats={protocols.length > 0 ? `${protocols.length} 个协议` : '开始创建'}
        />

        {/* 协议列表入口 */}
        <QuickActionCard
          title="我的协议库"
          subtitle="管理和追踪所有协议"
          icon="📋"
          color="green"
          onClick={() => navigate('/protocols')}
          stats={`${protocols.filter(p => p.successCount > 0).length} 个已执行`}
        />
      </div>

      {/* 语录编辑弹窗 */}
      {quoteState.showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[500px] max-w-[90vw]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {quoteState.editingIndex !== null ? '编辑语录' : '添加语录'}
              </h3>
              <button
                onClick={() => setQuoteState(prev => ({ ...prev, showEditModal: false }))}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">语录内容</label>
                <textarea
                  value={quoteState.newText}
                  onChange={(e) => setQuoteState(prev => ({ ...prev, newText: e.target.value }))}
                  placeholder="输入语录内容..."
                  className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">作者</label>
                <input
                  type="text"
                  value={quoteState.newAuthor}
                  onChange={(e) => setQuoteState(prev => ({ ...prev, newAuthor: e.target.value }))}
                  placeholder="输入作者名称（可选）"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              {quoteState.editingIndex !== null && (
                <button
                  onClick={deleteQuote}
                  className="flex-1 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                >
                  删除
                </button>
              )}
              <button
                onClick={() => setQuoteState(prev => ({ ...prev, showEditModal: false }))}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={saveQuote}
                disabled={!quoteState.newText.trim()}
                className="flex-1 py-2 bg-amber-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showPermissionPrompt && (
        <NotificationPermissionPrompt
          onRequest={async () => {
            await requestNotificationPermission();
            setShowPermissionPrompt(false);
          }}
          onDismiss={() => setShowPermissionPrompt(false)}
        />
      )}
      
      {protocols.length === 0 ? null : allCompleted ? (
        <CompletedState />
      ) : (
        <div className="space-y-6">
          {todayProtocols.map(protocol => (
            <ProtocolCard
              key={protocol.id}
              protocol={protocol}
              onSuccess={() => handleSuccess(protocol)}
              onFailure={() => handleFailure(protocol)}
              onOpenMindMap={(proto) => {
                setSelectedProtocol(proto);
                setShowMindMap(true);
              }}
            />
          ))}
        </div>
      )}

      {showMindMap && selectedProtocol && (
        <MindMapView
          protocol={selectedProtocol}
          onClose={() => setShowMindMap(false)}
        />
      )}
    </div>
  );
}
