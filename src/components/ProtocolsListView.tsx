import React, { useState, useEffect } from 'react';
import { useProtocols } from '../context/ProtocolContext';
import { ProtocolModel, goalTypeLabels, triggerTypeLabels, shouldAutoDowngrade, shouldAutoUpgrade } from '../types/protocol';

interface Milestone {
  id: string;
  date: string;
  description: string;
}

export default function ProtocolsListView() {
  const { protocols, deleteProtocol } = useProtocols();
  
  const [expandedReview, setExpandedReview] = useState(false);
  const [expandedMilestone, setExpandedMilestone] = useState(false);
  
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [newMilestone, setNewMilestone] = useState('');
  
  const [reviewAnswers, setReviewAnswers] = useState<{ [key: string]: string }>(() => {
    try {
      const saved = localStorage.getItem('review-answers');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  useEffect(() => {
    localStorage.setItem('review-answers', JSON.stringify(reviewAnswers));
  }, [reviewAnswers]);

  const totalSuccesses = protocols.reduce((sum, p) => sum + p.successCount, 0);
  const totalFailures = protocols.reduce((sum, p) => sum + p.failureCount, 0);
  const suggestions = getSuggestions(protocols);

  useEffect(() => {
    const saved = localStorage.getItem('milestones');
    if (saved) {
      setMilestones(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('milestones', JSON.stringify(milestones));
  }, [milestones]);

  const addMilestone = () => {
    if (newMilestone.trim()) {
      const milestone: Milestone = {
        id: crypto.randomUUID(),
        date: new Date().toLocaleDateString('zh-CN'),
        description: newMilestone.trim(),
      };
      setMilestones([milestone, ...milestones]);
      setNewMilestone('');
    }
  };

  const deleteMilestone = (id: string) => {
    setMilestones(milestones.filter(m => m.id !== id));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">所有协议</h1>
        <p className="text-gray-500 mt-1">共 {protocols.length} 个协议</p>
      </div>

      {protocols.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-6 text-gray-300">📋</div>
          <h2 className="text-xl font-semibold text-gray-600 mb-2">还没有协议</h2>
          <p className="text-gray-400">去创建你的第一个行动协议吧</p>
        </div>
      ) : (
        <div className="space-y-4 mb-8">
          {protocols.map(protocol => (
            <ProtocolItem
              key={protocol.id}
              protocol={protocol}
              onDelete={() => deleteProtocol(protocol.id)}
            />
          ))}
        </div>
      )}
      
      <div className="space-y-4">
        <DrawerModule 
          title="复盘" 
          icon="📊" 
          expanded={expandedReview}
          onToggle={() => setExpandedReview(!expandedReview)}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <SectionCard title="本周概览" icon="📊">
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <StatCard label="总协议" value={protocols.length} color="text-golden" bgColor="bg-golden/10" />
                  <StatCard label="总成功" value={totalSuccesses} color="text-green-500" bgColor="bg-green-50" />
                  <StatCard label="总失败" value={totalFailures} color="text-red-500" bgColor="bg-red-50" />
                </div>

                {protocols.length > 0 && (
                  <div className="space-y-3">
                    {protocols.map(protocol => (
                      <ProtocolReviewRow key={protocol.id} protocol={protocol} />
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="每周三问" icon="❓">
                <div className="space-y-6">
                  <ReviewQuestion
                    question="哪些执行成功了？为什么？"
                    placeholder="记录成功的原因，找到可复制的模式"
                    value={reviewAnswers['success'] || ''}
                    onChange={(val) => setReviewAnswers(prev => ({ ...prev, success: val }))}
                  />
                  <ReviewQuestion
                    question="哪些没执行？卡在哪里？"
                    placeholder="诚实面对卡点，不是找借口，而是找系统问题"
                    value={reviewAnswers['failure'] || ''}
                    onChange={(val) => setReviewAnswers(prev => ({ ...prev, failure: val }))}
                  />
                  <ReviewQuestion
                    question="下周调整哪一个动作？"
                    placeholder="只改一个，不要贪多。系统优化是渐进的"
                    value={reviewAnswers['improvement'] || ''}
                    onChange={(val) => setReviewAnswers(prev => ({ ...prev, improvement: val }))}
                  />
                </div>
              </SectionCard>

              <SectionCard title="系统优化建议" icon="🔧">
                {suggestions.length > 0 ? (
                  <div className="space-y-4">
                    {suggestions.map((suggestion, index) => (
                      <div key={index} className="flex items-start gap-3 p-4 rounded-xl bg-gray-50">
                        <span className="text-2xl mt-0.5">{suggestion.icon}</span>
                        <div>
                          <h4 className={`font-semibold ${suggestion.color}`}>{suggestion.title}</h4>
                          <p className="text-sm text-gray-500 mt-1">{suggestion.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">🎉</div>
                    <p className="text-gray-500">目前没有需要优化的建议，继续保持！</p>
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        </DrawerModule>

        <DrawerModule 
          title="第一次纪念" 
          icon="🏛️" 
          expanded={expandedMilestone}
          onToggle={() => setExpandedMilestone(!expandedMilestone)}
        >
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMilestone}
                onChange={(e) => setNewMilestone(e.target.value)}
                placeholder="记录你的里程碑事件..."
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && addMilestone()}
              />
              <button
                onClick={addMilestone}
                className="px-6 py-3 bg-golden text-white rounded-xl font-semibold hover:bg-golden-dark transition-colors"
              >
                添加
              </button>
            </div>

            {milestones.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🏛️</div>
                <p className="text-gray-500">还没有里程碑</p>
                <p className="text-sm text-gray-400 mt-2">记录你的每一个重要时刻</p>
              </div>
            ) : (
              <div className="space-y-4 relative">
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-golden/30" />
                
                {milestones.map((milestone) => (
                  <div key={milestone.id} className="relative pl-14">
                    <div className="absolute left-4 top-2 w-5 h-5 bg-golden rounded-full border-4 border-white shadow" />
                    
                    <div className="bg-gray-50 rounded-xl p-4 relative group">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs text-golden font-medium mb-1">{milestone.date}</p>
                          <p className="text-gray-800">{milestone.description}</p>
                        </div>
                        <button
                          onClick={() => deleteMilestone(milestone.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-red-500"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DrawerModule>
      </div>
    </div>
  );
}

function DrawerModule({ 
  title, 
  icon, 
  expanded, 
  onToggle, 
  children 
}: { 
  title: string; 
  icon: string; 
  expanded: boolean; 
  onToggle: () => void; 
  children: React.ReactNode; 
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-6 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        </div>
        <svg 
          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="p-6 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}

function ProtocolItem({ 
  protocol, 
  onDelete 
}: { 
  protocol: ProtocolModel; 
  onDelete: () => void;
}) {
  const [showDetail, setShowDetail] = React.useState(false);

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-800">{protocol.principle}</h3>
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-golden/15 text-golden">
                {goalTypeLabels[protocol.goalType]}
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-3">
              {triggerTypeLabels[protocol.triggerType]}: {protocol.triggerCondition}
            </p>
            {protocol.reminderTime && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">⏰</span>
                <span className="text-sm font-medium text-golden">提醒时间: {protocol.reminderTime}</span>
              </div>
            )}
            <div className="flex items-center gap-6">
              <StatBadge icon="✅" label="成功" value={protocol.successCount} color="text-green-500" />
              <StatBadge icon="❌" label="失败" value={protocol.failureCount} color="text-red-500" />
              {protocol.consecutiveSuccesses > 0 && (
                <StatBadge icon="🔥" label="连胜" value={protocol.consecutiveSuccesses} color="text-orange-500" />
              )}
              {protocol.consecutiveFailures > 0 && (
                <StatBadge icon="⚠️" label="连败" value={protocol.consecutiveFailures} color="text-yellow-500" />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => setShowDetail(true)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {showDetail && (
        <ProtocolDetailModal protocol={protocol} onClose={() => setShowDetail(false)} />
      )}
    </>
  );
}

function StatBadge({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm">{icon}</span>
      <span className={`text-sm font-medium ${color}`}>{value}</span>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

function ProtocolDetailModal({ protocol, onClose }: { protocol: ProtocolModel; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">{protocol.principle}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <DetailSection title="执行统计">
            <div className="grid grid-cols-4 gap-4">
              <StatCard label="成功" value={protocol.successCount} color="text-green-500" bgColor="bg-green-50" />
              <StatCard label="失败" value={protocol.failureCount} color="text-red-500" bgColor="bg-red-50" />
              <StatCard label="连胜" value={protocol.consecutiveSuccesses} color="text-orange-500" bgColor="bg-orange-50" />
              <StatCard label="连败" value={protocol.consecutiveFailures} color="text-yellow-500" bgColor="bg-yellow-50" />
            </div>
          </DetailSection>

          <DetailSection title="触发机制">
            <DetailRow label="触发类型" value={triggerTypeLabels[protocol.triggerType]} />
            <DetailRow label="触发条件" value={protocol.triggerCondition} />
            {protocol.timeWindow && <DetailRow label="时间窗口" value={protocol.timeWindow} />}
            {protocol.reminderTime && <DetailRow label="提醒时间" value={protocol.reminderTime} highlight />}
            <DetailRow label="频率" value={protocol.frequency === 'daily' ? '每天' : protocol.frequency === 'weekly' ? '每周' : '每月'} />
            {protocol.psychologicalBoundary && <DetailRow label="心理边界（不做）" value={protocol.psychologicalBoundary} />}
            {protocol.actionPermission && <DetailRow label="行动许可（可以做）" value={protocol.actionPermission} />}
          </DetailSection>

          <DetailSection title="执行动作 - Plan A">
            <DetailRow label="标准动作" value={protocol.action} />
            <DetailRow label="最小动作" value={protocol.minimumAction} highlight />
            <DetailRow label="最大时长" value={`${protocol.maxDuration} 分钟`} />
            {protocol.locationConstraint && <DetailRow label="地点约束" value={protocol.locationConstraint} />}
          </DetailSection>

          {protocol.actionPlanB && (
            <DetailSection title="执行动作 - Plan B">
              <DetailRow label="标准动作" value={protocol.actionPlanB} />
              {protocol.minimumActionPlanB && <DetailRow label="最小动作" value={protocol.minimumActionPlanB} highlight />}
              <DetailRow label="最大时长" value={`${protocol.maxDurationPlanB} 分钟`} />
              {protocol.locationConstraintPlanB && <DetailRow label="地点约束" value={protocol.locationConstraintPlanB} />}
            </DetailSection>
          )}

          {(protocol.environmentPrep || protocol.frictionReduce || protocol.frictionIncrease) && (
            <DetailSection title="环境设计">
              {protocol.environmentPrep && <DetailRow label="事前准备" value={protocol.environmentPrep} />}
              {protocol.frictionReduce && <DetailRow label="降低阻力" value={protocol.frictionReduce} />}
              {protocol.frictionIncrease && <DetailRow label="增加阻力" value={protocol.frictionIncrease} />}
            </DetailSection>
          )}

          {protocol.executionHistory.length > 0 && (
            <DetailSection title="执行历史">
              <div className="space-y-2">
                {protocol.executionHistory.slice(-10).reverse().map(record => (
                  <div key={record.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={record.isSuccess ? 'text-green-500' : 'text-red-500'}>
                        {record.isSuccess ? '✅' : '❌'}
                      </span>
                      <span className="text-sm text-gray-600">
                        {new Date(record.date).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {record.isSuccess ? '成功' : '失败'}
                    </span>
                  </div>
                ))}
              </div>
            </DetailSection>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function DetailRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-4 py-2">
      <span className="text-sm text-gray-500 min-w-[100px]">{label}</span>
      <span className={`text-sm text-gray-700 flex-1 ${highlight ? 'text-golden font-medium' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function StatCard({ label, value, color, bgColor }: { label: string; value: number; color: string; bgColor: string }) {
  return (
    <div className={`${bgColor} rounded-xl p-4 text-center`}>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">{icon}</span>
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ProtocolReviewRow({ protocol }: { protocol: ProtocolModel }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-gray-50">
      <div>
        <h4 className="font-medium text-gray-800">{protocol.principle}</h4>
        <p className="text-sm text-gray-500 mt-0.5">{protocol.triggerCondition}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <span className="text-green-500">✅</span>
          <span className="text-sm font-medium text-gray-700">{protocol.successCount}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-red-500">❌</span>
          <span className="text-sm font-medium text-gray-700">{protocol.failureCount}</span>
        </div>
      </div>
    </div>
  );
}

function ReviewQuestion({ 
  question, 
  placeholder,
  value,
  onChange
}: { 
  question: string; 
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-2">
      <h4 className="font-medium text-gray-800">{question}</h4>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none resize-none"
      />
    </div>
  );
}

function getSuggestions(protocols: ProtocolModel[]) {
  const suggestions: Array<{
    icon: string;
    color: string;
    title: string;
    message: string;
  }> = [];

  for (const protocol of protocols) {
    if (shouldAutoDowngrade(protocol)) {
      suggestions.push({
        icon: '⬇️',
        color: 'text-orange-600',
        title: `建议降级：${protocol.principle}`,
        message: `连续失败${protocol.consecutiveFailures}次，可以考虑降低最小动作或减少频率`
      });
    }

    if (shouldAutoUpgrade(protocol)) {
      suggestions.push({
        icon: '⬆️',
        color: 'text-green-600',
        title: `可以升级：${protocol.principle}`,
        message: `连续成功${protocol.consecutiveSuccesses}次，可以考虑增加挑战`
      });
    }
  }

  return suggestions;
}
