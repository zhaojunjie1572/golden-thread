import React, { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useProtocols } from '../context/ProtocolContext';
import { 
  createEmptyProtocol, 
  ProtocolModel, 
  TriggerType, 
  GoalType, 
  triggerTypeLabels, 
  goalTypeLabels,
  ProtocolTheme,
  DEFAULT_THEMES,
  getThemes,
  addCustomTheme,
  removeCustomTheme,
  ProtocolUIModule,
  DEFAULT_UI_MODULES,
} from '../types/protocol';

type ThemeFormType = {
  name: string;
  icon: string;
  defaultPrinciple: string;
  defaultTriggerCondition: string;
  defaultAction: string;
  defaultMinimumAction: string;
  defaultGoalType: GoalType;
};

type ModuleFormType = {
  name: string;
  icon: string;
  description: string;
  hasReminder: boolean;
};

export default function ProtocolCreateView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addProtocol, requestNotificationPermission, hasNotificationPermission } = useProtocols();
  
  const initialForm = (location.state as { prefillData?: ProtocolModel })?.prefillData || createEmptyProtocol();
  const [form, setForm] = useState<ProtocolModel>(initialForm);
  const [notificationRequested, setNotificationRequested] = useState(false);
  
  const [themes, setThemes] = useState<ProtocolTheme[]>(() => getThemes());
  const [selectedThemeId, setSelectedThemeId] = useState<string>('');
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [editingTheme, setEditingTheme] = useState<ProtocolTheme | null>(null);
  const [themeForm, setThemeForm] = useState<ThemeFormType>({
    name: '',
    icon: '✨',
    defaultPrinciple: '',
    defaultTriggerCondition: '',
    defaultAction: '',
    defaultMinimumAction: '',
    defaultGoalType: 'habit',
  });

  const [uiModules, setUiModules] = useState<ProtocolUIModule[]>(() => {
    try {
      const saved = localStorage.getItem('protocol-ui-modules');
      return saved ? JSON.parse(saved) : DEFAULT_UI_MODULES;
    } catch {
      return DEFAULT_UI_MODULES;
    }
  });
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const [showModuleEditor, setShowModuleEditor] = useState(false);
  const [editingModule, setEditingModule] = useState<ProtocolUIModule | null>(null);
  const [moduleForm, setModuleForm] = useState<ModuleFormType>({
    name: '',
    icon: '✨',
    description: '',
    hasReminder: false,
  });

  const applyTheme = useCallback((theme: ProtocolTheme) => {
    setForm(prev => ({
      ...prev,
      principle: theme.defaultPrinciple,
      goalType: theme.defaultGoalType,
      triggerCondition: theme.defaultTriggerCondition,
      action: theme.defaultAction,
      minimumAction: theme.defaultMinimumAction,
    }));
    setSelectedThemeId(theme.id);
  }, []);

  const handleAddTheme = () => {
    setEditingTheme(null);
    setThemeForm({
      name: '',
      icon: '✨',
      defaultPrinciple: '',
      defaultTriggerCondition: '',
      defaultAction: '',
      defaultMinimumAction: '',
      defaultGoalType: 'habit',
    });
    setShowThemeEditor(true);
  };

  const handleEditTheme = (theme: ProtocolTheme) => {
    setEditingTheme(theme);
    setThemeForm({
      name: theme.name,
      icon: theme.icon,
      defaultPrinciple: theme.defaultPrinciple,
      defaultTriggerCondition: theme.defaultTriggerCondition,
      defaultAction: theme.defaultAction,
      defaultMinimumAction: theme.defaultMinimumAction,
      defaultGoalType: theme.defaultGoalType,
    });
    setShowThemeEditor(true);
  };

  const handleSaveTheme = () => {
    if (!themeForm.name.trim()) {
      alert('请输入主题名称');
      return;
    }

    const newTheme: ProtocolTheme = {
      id: editingTheme?.id || crypto.randomUUID(),
      name: themeForm.name,
      icon: themeForm.icon,
      defaultPrinciple: themeForm.defaultPrinciple,
      defaultTriggerCondition: themeForm.defaultTriggerCondition,
      defaultAction: themeForm.defaultAction,
      defaultMinimumAction: themeForm.defaultMinimumAction,
      defaultGoalType: themeForm.defaultGoalType,
    };

    if (editingTheme) {
      setThemes(prev => prev.map(t => t.id === editingTheme.id ? newTheme : t));
    } else {
      addCustomTheme(newTheme);
      setThemes(getThemes());
    }

    setShowThemeEditor(false);
    setEditingTheme(null);
  };

  const handleDeleteTheme = (id: string) => {
    if (!confirm('确定要删除这个主题吗？')) return;
    removeCustomTheme(id);
    setThemes(getThemes());
    if (selectedThemeId === id) {
      setSelectedThemeId('');
    }
  };

  const handleAddModule = () => {
    setEditingModule(null);
    setModuleForm({
      name: '新模块',
      icon: '✨',
      description: '',
      hasReminder: false,
    });
    setShowModuleEditor(true);
  };

  const handleEditModule = (module: ProtocolUIModule) => {
    setEditingModule(module);
    setModuleForm({
      name: module.name,
      icon: module.icon,
      description: module.description,
      hasReminder: module.hasReminder,
    });
    setShowModuleEditor(true);
  };

  const handleSaveModule = () => {
    if (!moduleForm.name.trim()) {
      alert('请输入模块名称');
      return;
    }

    let newModules: ProtocolUIModule[];
    if (editingModule) {
      newModules = uiModules.map(m => 
        m.id === editingModule.id 
          ? { ...m, ...moduleForm }
          : m
      );
    } else {
      const newModule: ProtocolUIModule = {
        id: crypto.randomUUID(),
        name: moduleForm.name,
        icon: moduleForm.icon,
        description: moduleForm.description,
        hasReminder: moduleForm.hasReminder,
        visible: true,
        fields: [],
      };
      newModules = [...uiModules, newModule];
    }
    
    setUiModules(newModules);
    localStorage.setItem('protocol-ui-modules', JSON.stringify(newModules));
    setShowModuleEditor(false);
    setEditingModule(null);
  };

  const handleDeleteModule = (id: string) => {
    if (!confirm('确定要删除这个模块吗？')) return;
    const newModules = uiModules.map(m => 
      m.id === id ? { ...m, visible: false } : m
    );
    setUiModules(newModules);
    localStorage.setItem('protocol-ui-modules', JSON.stringify(newModules));
    if (expandedModuleId === id) {
      setExpandedModuleId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (form.reminderTime && !hasNotificationPermission() && !notificationRequested) {
      const granted = await requestNotificationPermission();
      setNotificationRequested(true);
      if (!granted) {
        alert('需要通知权限才能使用提醒功能');
        return;
      }
    }
    
    addProtocol(form);
    navigate('/');
  };

  const isFormValid = form.principle.trim() !== '' &&
    form.triggerCondition.trim() !== '' &&
    form.action.trim() !== '' &&
    form.minimumAction.trim() !== '';

  const visibleModules = uiModules.filter(m => m.visible);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </button>
        <h1 className="text-3xl font-bold text-gray-800">创建协议</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">🎯</span>
            <h2 className="text-lg font-semibold text-gray-800">主题模块</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-500 min-w-[80px]">选择主题</label>
              <div className="flex-1 flex gap-2">
                <select
                  value={selectedThemeId}
                  onChange={(e) => {
                    const theme = themes.find(t => t.id === e.target.value);
                    if (theme) applyTheme(theme);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none"
                >
                  <option value="">--- 自定义 ---</option>
                  {themes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.icon} {theme.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddTheme}
                  className="px-4 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
                  title="添加自定义主题"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
            {selectedThemeId && (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400">当前主题：</span>
                <span className="text-sm font-medium text-golden">
                  {themes.find(t => t.id === selectedThemeId)?.icon} {themes.find(t => t.id === selectedThemeId)?.name}
                </span>
                {!DEFAULT_THEMES.some(t => t.id === selectedThemeId) && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const theme = themes.find(t => t.id === selectedThemeId);
                        if (theme) handleEditTheme(theme);
                      }}
                      className="text-xs text-gray-400 hover:text-golden"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTheme(selectedThemeId)}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      删除
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <span>📦</span> 协议模块
          </h2>
          <button
            type="button"
            onClick={handleAddModule}
            className="px-4 py-2 rounded-lg bg-golden text-white hover:opacity-90 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            添加模块
          </button>
        </div>

        {visibleModules.map((module, index) => (
          <ModuleCard
            key={module.id}
            module={module}
            form={form}
            setForm={setForm}
            isExpanded={expandedModuleId === module.id}
            onToggle={() => setExpandedModuleId(expandedModuleId === module.id ? null : module.id)}
            onEdit={() => handleEditModule(module)}
            onDelete={() => handleDeleteModule(module.id)}
            index={index}
          />
        ))}

        <button
          type="submit"
          disabled={!isFormValid}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-colors ${
            isFormValid
              ? 'bg-golden text-white hover:bg-golden-dark'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          保存协议
        </button>
      </form>

      {showThemeEditor && (
        <ThemeEditor
          themeForm={themeForm}
          setThemeForm={setThemeForm}
          editingTheme={editingTheme}
          onSave={handleSaveTheme}
          onClose={() => setShowThemeEditor(false)}
        />
      )}

      {showModuleEditor && (
        <ModuleEditor
          moduleForm={moduleForm}
          setModuleForm={setModuleForm}
          editingModule={editingModule}
          onSave={handleSaveModule}
          onClose={() => setShowModuleEditor(false)}
        />
      )}
    </div>
  );
}

function ModuleCard({ 
  module, 
  form, 
  setForm, 
  isExpanded, 
  onToggle, 
  onEdit, 
  onDelete, 
  index 
}: { 
  module: ProtocolUIModule; 
  form: ProtocolModel; 
  setForm: (f: ProtocolModel) => void;
  isExpanded: boolean; 
  onToggle: () => void; 
  onEdit: () => void; 
  onDelete: () => void;
  index: number;
}) {
  const renderModuleFields = () => {
    switch (module.id) {
      case 'basic-info':
        return (
          <div className="space-y-4">
            <FormField
              label="行动原则"
              placeholder="例如：提升认知 / 保持健康"
              value={form.principle}
              onChange={(v) => setForm({ ...form, principle: v })}
            />
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-500 min-w-[80px]">目标类型</label>
              <select
                value={form.goalType}
                onChange={(e) => setForm({ ...form, goalType: e.target.value as GoalType })}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none"
              >
                {Object.entries(goalTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-500 min-w-[80px]">优先级</label>
              <div className="flex-1 flex gap-1">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setForm({ ...form, priority: level })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      form.priority === level
                        ? 'bg-golden text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'trigger':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-500 min-w-[80px]">触发类型</label>
              <select
                value={form.triggerType}
                onChange={(e) => setForm({ ...form, triggerType: e.target.value as TriggerType })}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none"
              >
                {Object.entries(triggerTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <FormField
              label="触发条件"
              placeholder="例如：22:00 / 打开手机刷短视频 / 感觉焦虑"
              value={form.triggerCondition}
              onChange={(v) => setForm({ ...form, triggerCondition: v })}
            />
            <FormField
              label="执行时间窗口"
              placeholder="例如：22:00-22:30"
              value={form.timeWindow}
              onChange={(v) => setForm({ ...form, timeWindow: v })}
            />
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-500 min-w-[80px]">提醒时间</label>
              <input
                type="time"
                value={form.reminderTime}
                onChange={(e) => setForm({ ...form, reminderTime: e.target.value })}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-500 min-w-[80px]">频率</label>
              <div className="flex-1 flex gap-1">
                {[
                  { value: 'daily', label: '每天' },
                  { value: 'weekly', label: '每周' },
                  { value: 'monthly', label: '每月' }
                ].map((freq) => (
                  <button
                    key={freq.value}
                    type="button"
                    onClick={() => setForm({ ...form, frequency: freq.value })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      form.frequency === freq.value
                        ? 'bg-golden text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {freq.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'execution':
        return (
          <div className="space-y-4">
            <FormField
              label="标准动作"
              placeholder="例如：打开书读第10-15页"
              value={form.action}
              onChange={(v) => setForm({ ...form, action: v })}
            />
            <FormField
              label="最小动作（关键！）"
              placeholder="例如：只读1页"
              value={form.minimumAction}
              onChange={(v) => setForm({ ...form, minimumAction: v })}
            />
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-500 min-w-[80px]">最大时长</label>
              <div className="flex-1 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, maxDuration: Math.max(5, form.maxDuration - 5) })}
                  className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <span className="text-lg font-medium w-16 text-center">{form.maxDuration} 分钟</span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, maxDuration: Math.min(120, form.maxDuration + 5) })}
                  className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
            <FormField
              label="地点约束（可选）"
              placeholder="例如：只在书桌执行"
              value={form.locationConstraint}
              onChange={(v) => setForm({ ...form, locationConstraint: v })}
            />
          </div>
        );

      case 'plan-b':
        return (
          <div className="space-y-4">
            <FormField
              label="Plan B 标准动作"
              placeholder="例如：在手机上听书"
              value={form.actionPlanB}
              onChange={(v) => setForm({ ...form, actionPlanB: v })}
            />
            <FormField
              label="Plan B 最小动作（关键！）"
              placeholder="例如：听5分钟"
              value={form.minimumActionPlanB}
              onChange={(v) => setForm({ ...form, minimumActionPlanB: v })}
            />
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-500 min-w-[80px]">最大时长</label>
              <div className="flex-1 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, maxDurationPlanB: Math.max(5, form.maxDurationPlanB - 5) })}
                  className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <span className="text-lg font-medium w-16 text-center">{form.maxDurationPlanB} 分钟</span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, maxDurationPlanB: Math.min(120, form.maxDurationPlanB + 5) })}
                  className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
            <FormField
              label="地点约束（可选）"
              placeholder="例如：在路上也能执行"
              value={form.locationConstraintPlanB}
              onChange={(v) => setForm({ ...form, locationConstraintPlanB: v })}
            />
          </div>
        );

      case 'environment':
        return (
          <div className="space-y-4">
            <FormField
              label="事前准备"
              placeholder="例如：书提前放桌上"
              value={form.environmentPrep}
              onChange={(v) => setForm({ ...form, environmentPrep: v })}
            />
            <FormField
              label="降低阻力"
              placeholder="例如：App默认打开学习页面"
              value={form.frictionReduce}
              onChange={(v) => setForm({ ...form, frictionReduce: v })}
            />
            <FormField
              label="增加阻力"
              placeholder="例如：卸载短视频 / 远离手机"
              value={form.frictionIncrease}
              onChange={(v) => setForm({ ...form, frictionIncrease: v })}
            />
          </div>
        );

      case 'feedback':
        return (
          <div className="space-y-4">
            <FormField
              label="成功标准"
              placeholder="例如：完成1页"
              value={form.successCriteria}
              onChange={(v) => setForm({ ...form, successCriteria: v })}
            />
            <FormField
              label="失败应对"
              placeholder="例如：第二天只做最小动作"
              value={form.failureResponse}
              onChange={(v) => setForm({ ...form, failureResponse: v })}
            />
            <FormField
              label="奖励机制"
              placeholder="例如：完成后允许娱乐10分钟"
              value={form.reward}
              onChange={(v) => setForm({ ...form, reward: v })}
            />
            <FormField
              label="复盘周期"
              placeholder="例如：每周日"
              value={form.reviewCycle}
              onChange={(v) => setForm({ ...form, reviewCycle: v })}
            />
            <FormField
              label="调整规则"
              placeholder="例如：连续失败3次 → 降低难度"
              value={form.adjustmentRules}
              onChange={(v) => setForm({ ...form, adjustmentRules: v })}
            />
          </div>
        );

      default:
        return (
          <div className="text-center py-8 text-gray-400">
            自定义模块内容
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div 
        className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{module.icon}</span>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                {index + 1}. {module.name}
              </h3>
              {module.description && (
                <p className="text-sm text-gray-500">{module.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {module.hasReminder && (
              <span className="px-2 py-1 text-xs bg-golden/10 text-golden rounded-full">
                ⏰ 闹钟
              </span>
            )}
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {!DEFAULT_UI_MODULES.some(m => m.id === module.id) && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="p-2 text-gray-400 hover:text-golden hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={onDelete}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            <svg 
              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-6 border-t border-gray-100">
          {renderModuleFields()}
        </div>
      )}
    </div>
  );
}

function ThemeEditor({ 
  themeForm, 
  setThemeForm, 
  editingTheme, 
  onSave, 
  onClose 
}: {
  themeForm: ThemeFormType;
  setThemeForm: React.Dispatch<React.SetStateAction<ThemeFormType>>;
  editingTheme: ProtocolTheme | null;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">
              {editingTheme ? '编辑主题' : '添加自定义主题'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm text-gray-500 mb-1 block">主题图标</label>
            <div className="flex gap-2 flex-wrap">
              {['✨', '🎯', '💪', '📚', '💼', '❤️', '💰', '🎨', '🧠', '🌟'].map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setThemeForm((prev: { name: string; icon: string; defaultPrinciple: string; defaultTriggerCondition: string; defaultAction: string; defaultMinimumAction: string; defaultGoalType: GoalType }) => ({ ...prev, icon }))}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-colors ${
                    themeForm.icon === icon
                      ? 'bg-golden/10 border-2 border-golden'
                      : 'bg-gray-100 hover:bg-gray-200 border-2 border-transparent'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">主题名称</label>
            <input
              type="text"
              value={themeForm.name}
              onChange={(e) => setThemeForm((prev: ThemeFormType) => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none"
              placeholder="例如：我的专属主题"
            />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">默认行动原则</label>
            <textarea
              value={themeForm.defaultPrinciple}
              onChange={(e) => setThemeForm((prev: ThemeFormType) => ({ ...prev, defaultPrinciple: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none resize-none"
              rows={2}
              placeholder="例如：提升认知"
            />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">默认触发条件</label>
            <textarea
              value={themeForm.defaultTriggerCondition}
              onChange={(e) => setThemeForm((prev: ThemeFormType) => ({ ...prev, defaultTriggerCondition: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none resize-none"
              rows={2}
              placeholder="例如：每天晚上8点"
            />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">默认标准动作</label>
            <textarea
              value={themeForm.defaultAction}
              onChange={(e) => setThemeForm((prev: ThemeFormType) => ({ ...prev, defaultAction: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none resize-none"
              rows={2}
              placeholder="例如：读30分钟书"
            />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">默认最小动作</label>
            <textarea
              value={themeForm.defaultMinimumAction}
              onChange={(e) => setThemeForm((prev: ThemeFormType) => ({ ...prev, defaultMinimumAction: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none resize-none"
              rows={2}
              placeholder="例如：读1页书"
            />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">默认目标类型</label>
            <select
              value={themeForm.defaultGoalType}
              onChange={(e) => setThemeForm((prev: ThemeFormType) => ({ ...prev, defaultGoalType: e.target.value as GoalType }))}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none"
            >
              {Object.entries(goalTypeLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex-1 px-4 py-2.5 rounded-xl bg-golden text-white hover:opacity-90 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function ModuleEditor({ 
  moduleForm, 
  setModuleForm, 
  editingModule, 
  onSave, 
  onClose 
}: {
  moduleForm: ModuleFormType;
  setModuleForm: React.Dispatch<React.SetStateAction<ModuleFormType>>;
  editingModule: ProtocolUIModule | null;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">
              {editingModule ? '编辑模块' : '添加模块'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm text-gray-500 mb-1 block">模块图标</label>
            <div className="flex gap-2 flex-wrap">
              {['✨', '💡', '⏰', '▶️', '🔄', '🏠', '✅', '🎯', '📝', '💬'].map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setModuleForm((prev: ModuleFormType) => ({ ...prev, icon }))}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-colors ${
                    moduleForm.icon === icon
                      ? 'bg-golden/10 border-2 border-golden'
                      : 'bg-gray-100 hover:bg-gray-200 border-2 border-transparent'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">模块名称</label>
            <input
              type="text"
              value={moduleForm.name}
              onChange={(e) => setModuleForm((prev: ModuleFormType) => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none"
              placeholder="例如：我的模块"
            />
          </div>

          <div>
            <label className="text-sm text-gray-500 mb-1 block">模块描述</label>
            <textarea
              value={moduleForm.description}
              onChange={(e) => setModuleForm((prev: ModuleFormType) => ({ ...prev, description: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none resize-none"
              rows={2}
              placeholder="描述这个模块的用途"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="hasReminder"
              checked={moduleForm.hasReminder}
              onChange={(e) => setModuleForm((prev: ModuleFormType) => ({ ...prev, hasReminder: e.target.checked }))}
              className="w-4 h-4 text-golden rounded focus:ring-golden"
            />
            <label htmlFor="hasReminder" className="text-sm text-gray-700">
              启用闹钟提醒
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex-1 px-4 py-2.5 rounded-xl bg-golden text-white hover:opacity-90 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, placeholder, value, onChange }: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm text-gray-500">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-golden focus:ring-2 focus:ring-golden/20 outline-none resize-none"
      />
    </div>
  );
}
