export type TriggerType = 'time' | 'event' | 'state';

export type GoalType = 'habit' | 'task' | 'system';

export interface ExecutionRecord {
  id: string;
  date: string;
  isSuccess: boolean;
}

export interface ProtocolModel {
  id: string;
  createdAt: string;
  
  principle: string;
  goalType: GoalType;
  priority: number;
  
  triggerType: TriggerType;
  triggerCondition: string;
  timeWindow: string;
  frequency: string;
  reminderTime: string;
  
  psychologicalBoundary: string;
  actionPermission: string;
  
  action: string;
  minimumAction: string;
  maxDuration: number;
  locationConstraint: string;
  
  actionPlanB: string;
  minimumActionPlanB: string;
  maxDurationPlanB: number;
  locationConstraintPlanB: string;
  
  environmentPrep: string;
  frictionReduce: string;
  frictionIncrease: string;
  
  precommitment: string;
  ruleIfConflict: string;
  
  successCriteria: string;
  failureResponse: string;
  reward: string;
  
  reviewCycle: string;
  reviewQuestions: string[];
  adjustmentRules: string;
  
  failureCount: number;
  successCount: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  
  executionHistory: ExecutionRecord[];
}

export const triggerTypeLabels: Record<TriggerType, string> = {
  time: '时间触发',
  event: '事件触发',
  state: '状态触发'
};

export const goalTypeLabels: Record<GoalType, string> = {
  habit: '习惯养成',
  task: '一次性任务',
  system: '长期系统'
};

export interface ProtocolTheme {
  id: string;
  name: string;
  icon: string;
  defaultPrinciple: string;
  defaultTriggerCondition: string;
  defaultAction: string;
  defaultMinimumAction: string;
  defaultGoalType: GoalType;
}

export const DEFAULT_THEMES: ProtocolTheme[] = [
  {
    id: 'health',
    name: '健康生活',
    icon: '💪',
    defaultPrinciple: '保持健康',
    defaultTriggerCondition: '每天早上起床',
    defaultAction: '做10分钟运动',
    defaultMinimumAction: '做2分钟伸展',
    defaultGoalType: 'habit',
  },
  {
    id: 'learning',
    name: '学习提升',
    icon: '📚',
    defaultPrinciple: '提升认知',
    defaultTriggerCondition: '每天晚上8点',
    defaultAction: '读30分钟书',
    defaultMinimumAction: '读1页书',
    defaultGoalType: 'habit',
  },
  {
    id: 'work',
    name: '高效工作',
    icon: '💼',
    defaultPrinciple: '提升效率',
    defaultTriggerCondition: '每天早上9点',
    defaultAction: '专注工作1小时',
    defaultMinimumAction: '列待办清单',
    defaultGoalType: 'habit',
  },
  {
    id: 'relationship',
    name: '关系维护',
    icon: '❤️',
    defaultPrinciple: '维护关系',
    defaultTriggerCondition: '每周五晚上',
    defaultAction: '和家人/朋友聊天30分钟',
    defaultMinimumAction: '发一条问候消息',
    defaultGoalType: 'habit',
  },
  {
    id: 'finance',
    name: '财务管理',
    icon: '💰',
    defaultPrinciple: '积累财富',
    defaultTriggerCondition: '每月1号',
    defaultAction: '记录本月收支',
    defaultMinimumAction: '看一眼余额',
    defaultGoalType: 'habit',
  },
  {
    id: 'creativity',
    name: '创意创作',
    icon: '🎨',
    defaultPrinciple: '激发创意',
    defaultTriggerCondition: '灵感来临时',
    defaultAction: '写30分钟',
    defaultMinimumAction: '写3句话',
    defaultGoalType: 'habit',
  },
];

export let customThemes: ProtocolTheme[] = [];

export function getThemes(): ProtocolTheme[] {
  try {
    const saved = localStorage.getItem('custom-protocol-themes');
    if (saved) {
      customThemes = JSON.parse(saved);
    }
  } catch {}
  return [...DEFAULT_THEMES, ...customThemes];
}

export function addCustomTheme(theme: ProtocolTheme) {
  customThemes.push(theme);
  localStorage.setItem('custom-protocol-themes', JSON.stringify(customThemes));
}

export function removeCustomTheme(id: string) {
  customThemes = customThemes.filter(t => t.id !== id);
  localStorage.setItem('custom-protocol-themes', JSON.stringify(customThemes));
}

export interface ProtocolUIModule {
  id: string;
  name: string;
  icon: string;
  description: string;
  hasReminder: boolean;
  visible: boolean;
  fields: string[];
}

export const DEFAULT_UI_MODULES: ProtocolUIModule[] = [
  {
    id: 'basic-info',
    name: '基本信息',
    icon: '💡',
    description: '设置协议的基本信息',
    hasReminder: false,
    visible: true,
    fields: ['principle', 'goalType', 'priority'],
  },
  {
    id: 'trigger',
    name: '触发机制',
    icon: '⏰',
    description: '设置触发条件和时间',
    hasReminder: true,
    visible: true,
    fields: ['triggerType', 'triggerCondition', 'timeWindow', 'frequency'],
  },
  {
    id: 'execution',
    name: '执行动作',
    icon: '▶️',
    description: '设置具体的执行动作',
    hasReminder: false,
    visible: true,
    fields: ['action', 'minimumAction', 'maxDuration', 'locationConstraint'],
  },
  {
    id: 'plan-b',
    name: 'Plan B',
    icon: '🔄',
    description: '备用方案',
    hasReminder: false,
    visible: true,
    fields: ['actionPlanB', 'minimumActionPlanB', 'maxDurationPlanB', 'locationConstraintPlanB'],
  },
  {
    id: 'environment',
    name: '环境设计',
    icon: '🏠',
    description: '设计执行环境',
    hasReminder: false,
    visible: true,
    fields: ['environmentPrep', 'frictionReduce', 'frictionIncrease'],
  },
  {
    id: 'feedback',
    name: '反馈系统',
    icon: '🔄',
    description: '设置反馈和复盘',
    hasReminder: false,
    visible: true,
    fields: ['successCriteria', 'failureResponse', 'reward', 'reviewCycle', 'adjustmentRules'],
  },
];

export function createEmptyProtocol(): ProtocolModel {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    principle: '',
    goalType: 'habit',
    priority: 3,
    triggerType: 'time',
    triggerCondition: '',
    timeWindow: '',
    frequency: 'daily',
    reminderTime: '',
    psychologicalBoundary: '',
    actionPermission: '',
    action: '',
    minimumAction: '',
    maxDuration: 30,
    locationConstraint: '',
    actionPlanB: '',
    minimumActionPlanB: '',
    maxDurationPlanB: 30,
    locationConstraintPlanB: '',
    environmentPrep: '',
    frictionReduce: '',
    frictionIncrease: '',
    precommitment: '',
    ruleIfConflict: '',
    successCriteria: '',
    failureResponse: '',
    reward: '',
    reviewCycle: '每周日',
    reviewQuestions: [
      '哪些执行成功？',
      '卡点在哪？',
      '是否需要降低难度？'
    ],
    adjustmentRules: '连续失败3次 → 降低难度',
    failureCount: 0,
    successCount: 0,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    executionHistory: []
  };
}

export function markSuccess(protocol: ProtocolModel): ProtocolModel {
  return {
    ...protocol,
    successCount: protocol.successCount + 1,
    consecutiveSuccesses: protocol.consecutiveSuccesses + 1,
    consecutiveFailures: 0,
    executionHistory: [
      ...protocol.executionHistory,
      {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        isSuccess: true
      }
    ]
  };
}

export function markFailure(protocol: ProtocolModel): ProtocolModel {
  return {
    ...protocol,
    failureCount: protocol.failureCount + 1,
    consecutiveFailures: protocol.consecutiveFailures + 1,
    consecutiveSuccesses: 0,
    executionHistory: [
      ...protocol.executionHistory,
      {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        isSuccess: false
      }
    ]
  };
}

export function shouldAutoDowngrade(protocol: ProtocolModel): boolean {
  return protocol.consecutiveFailures >= 3;
}

export function shouldAutoUpgrade(protocol: ProtocolModel): boolean {
  return protocol.consecutiveSuccesses >= 5;
}

export function hasExecutedToday(protocol: ProtocolModel): boolean {
  const today = new Date().toDateString();
  return protocol.executionHistory.some(record => {
    return new Date(record.date).toDateString() === today;
  });
}
