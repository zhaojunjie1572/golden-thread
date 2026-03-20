export interface Desire {
  id: string;
  description: string;
  intensity: number;
  type: 'material' | 'spiritual' | 'social' | 'growth';
}

export interface Need {
  id: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  quantifiable?: string;
}

export interface Problem {
  id: string;
  description: string;
  metrics?: string;
  urgency: 'high' | 'medium' | 'low';
}

export interface Condition {
  id: string;
  description: string;
  type: 'necessary' | 'sufficient';
  threshold: string;
  isMet: boolean;
}

export interface Task {
  id: string;
  description: string;
  type: 'core' | 'support' | 'optional';
  resourceRequirements: string[];
  timeWindow: string;
  assignee: string;
  estimatedHours: number;
}

export interface Resource {
  id: string;
  name: string;
  type: 'human' | 'material' | 'financial' | 'informational';
  availability: number;
  quantity: number;
  quality: number;
}

export interface Capability {
  id: string;
  name: string;
  level: number;
  description: string;
}

export interface PsychologicalBoundary {
  id: string;
  description: string;
  type: 'hard' | 'soft';
  limit: string;
}

export interface ActionPermission {
  id: string;
  description: string;
  authorityLevel: number;
  scope: string;
}

export interface MarketContext {
  scenario: string;
  situationalAwareness: string;
  resourceSniffing: string;
  supplyDemandAnalysis: string;
  authorityPermission: string;
}

export interface ValueExchange {
  industryInfo: string;
  marketNodes: string;
  resourceUtilization: string;
  marketReturn: string;
}

export interface ActionClause {
  id: string;
  title: string;
  content: string;
  type: 'mandatory' | 'recommended' | 'optional';
}

export interface ActionProtocol {
  id: string;
  createdAt: number;

  desire?: Desire;
  needs: Need[];
  problems: Problem[];

  conditions: Condition[];
  tasks: Task[];

  resources: Resource[];
  capabilities: Capability[];
  psychologicalBoundaries: PsychologicalBoundary[];
  actionPermissions: ActionPermission[];

  marketContext?: MarketContext;
  valueExchange?: ValueExchange;
  successProbability: number;

  clauses: ActionClause[];
  summary: string;
}

export function createEmptyActionProtocol(): ActionProtocol {
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    needs: [],
    problems: [],
    conditions: [],
    tasks: [],
    resources: [],
    capabilities: [],
    psychologicalBoundaries: [],
    actionPermissions: [],
    successProbability: 0.5,
    clauses: [],
    summary: '',
  };
}

export const desireTypes = [
  { value: 'material', label: '物质欲望' },
  { value: 'spiritual', label: '精神欲望' },
  { value: 'social', label: '社交欲望' },
  { value: 'growth', label: '成长欲望' },
];

export const priorityLevels = [
  { value: 'high', label: '高优先级' },
  { value: 'medium', label: '中优先级' },
  { value: 'low', label: '低优先级' },
];

export const urgencyLevels = [
  { value: 'high', label: '紧急' },
  { value: 'medium', label: '一般' },
  { value: 'low', label: '不急' },
];

export const conditionTypes = [
  { value: 'necessary', label: '必要条件' },
  { value: 'sufficient', label: '充分条件' },
];

export const taskTypes = [
  { value: 'core', label: '核心任务' },
  { value: 'support', label: '支持任务' },
  { value: 'optional', label: '可选任务' },
];

export const resourceTypes = [
  { value: 'human', label: '人力资源' },
  { value: 'material', label: '物质资源' },
  { value: 'financial', label: '财务资源' },
  { value: 'informational', label: '信息资源' },
];
