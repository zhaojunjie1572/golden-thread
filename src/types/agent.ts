// 思维智能体工作流系统类型定义

export type AgentRole = 
  | 'analyzer'      // 分析者：理解需求、拆解问题
  | 'planner'       // 规划者：制定方案、设计路径
  | 'executor'      // 执行者：具体行动、落地实施
  | 'reviewer'      // 审查者：评估风险、检查质量
  | 'synthesizer';  // 综合者：整合信息、生成结论

export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

// 可执行任务
export interface ExecutableTask {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  estimatedTime: number;        // 预计耗时（分钟）
  deadline?: Date;              // 截止日期
  dependencies: string[];       // 依赖的其他任务ID
  requiredResources: string[];  // 所需资源
  verificationCriteria: string; // 完成标准
  status: TaskStatus;
  createdAt: Date;
  completedAt?: Date;
  tags: string[];
  assignee?: string;            // 执行人
}

// 智能体模块（增强版）
export interface AgentModule {
  id: string;
  name: string;
  icon: string;
  role: AgentRole;
  description: string;          // 模块功能描述
  
  // 系统提示词
  systemPrompt: string;
  
  // 能力定义
  capabilities: string[];
  
  // 输入输出规范
  inputFormat: string;
  outputFormat: string;
  
  // 工作流连接
  dependencies: string[];       // 依赖的前置模块ID
  outputsTo: string[];          // 输出到哪些模块
  
  // 任务生成配置
  taskGeneration: {
    enabled: boolean;
    template: string;           // 任务生成提示词模板
    defaultPriority: TaskPriority;
  };
  
  // 记忆配置
  memoryConfig: {
    maxMessages: number;        // 最大保留消息数
    extractSummary: boolean;    // 是否自动提取摘要
    shareable: boolean;         // 记忆是否可共享给其他模块
  };
  
  // 元数据
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// 工作流定义
export interface Workflow {
  id: string;
  name: string;
  description: string;
  agentIds: string[];           // 参与的智能体顺序
  connections: WorkflowConnection[]; // 连接关系
  autoExecute: boolean;         // 是否自动执行
  createdAt: Date;
  updatedAt: Date;
}

// 工作流连接
export interface WorkflowConnection {
  from: string;                 // 源模块ID
  to: string;                   // 目标模块ID
  condition?: string;           // 触发条件（可选）
  dataMapping: Record<string, string>; // 数据映射
}

// 工作流执行实例
export interface WorkflowInstance {
  id: string;
  workflowId: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  currentAgentIndex: number;
  context: WorkflowContext;
  tasks: ExecutableTask[];
  startedAt: Date;
  completedAt?: Date;
}

// 工作流上下文（在各模块间传递）
export interface WorkflowContext {
  originalInput: string;        // 原始输入
  accumulatedInsights: string[]; // 累积的洞察
  generatedTasks: ExecutableTask[];
  metadata: Record<string, any>;
}

// 智能体记忆条目
export interface AgentMemory {
  id: string;
  agentId: string;
  type: 'conversation' | 'insight' | 'task' | 'summary';
  content: string;
  timestamp: Date;
  importance: number;           // 重要性评分 0-1
  tags: string[];
  relatedTaskIds?: string[];
}

// 预设的智能体模板
export const AGENT_TEMPLATES: Omit<AgentModule, 'id' | 'createdAt' | 'updatedAt' | 'version'>[] = [
  {
    name: '🔍 需求分析师',
    icon: '🔍',
    role: 'analyzer',
    description: '深入理解用户需求，提取关键信息，识别潜在问题',
    systemPrompt: `你是专业的需求分析师。你的任务是：
1. 深入理解用户的真实需求（包括显性和隐性）
2. 识别需求背后的动机和痛点
3. 将模糊需求转化为清晰、可验证的描述
4. 识别潜在的风险和约束条件
5. 输出结构化的需求文档

输出格式：
- 核心需求：（一句话概括）
- 详细描述：（具体说明）
- 成功标准：（如何验证需求已满足）
- 风险点：（可能的问题）
- 依赖条件：（需要什么前提）`,
    capabilities: ['需求提取', '动机分析', '风险评估', '约束识别'],
    inputFormat: '用户原始需求描述',
    outputFormat: '结构化需求文档',
    dependencies: [],
    outputsTo: [],
    taskGeneration: {
      enabled: true,
      template: '基于需求分析结果，创建任务来验证和细化需求',
      defaultPriority: 'high'
    },
    memoryConfig: {
      maxMessages: 50,
      extractSummary: true,
      shareable: true
    }
  },
  {
    name: '📋 方案规划师',
    icon: '📋',
    role: 'planner',
    description: '基于需求制定详细的执行方案，设计最优路径',
    systemPrompt: `你是专业的方案规划师。你的任务是：
1. 基于需求分析制定多种可行方案
2. 评估各方案的优缺点和资源需求
3. 设计最优执行路径
4. 制定里程碑和检查点
5. 识别关键依赖和瓶颈

输出格式：
- 方案概述：（总体思路）
- 详细步骤：（分阶段执行计划）
- 资源需求：（时间、人力、物资）
- 里程碑：（关键节点）
- 风险预案：（Plan B）`,
    capabilities: ['方案设计', '路径优化', '资源评估', '里程碑制定'],
    inputFormat: '结构化需求文档',
    outputFormat: '详细执行方案',
    dependencies: [],
    outputsTo: [],
    taskGeneration: {
      enabled: true,
      template: '将执行方案拆解为具体的可执行任务',
      defaultPriority: 'medium'
    },
    memoryConfig: {
      maxMessages: 50,
      extractSummary: true,
      shareable: true
    }
  },
  {
    name: '⚡ 任务执行器',
    icon: '⚡',
    role: 'executor',
    description: '将方案转化为具体的可执行任务，明确执行细节',
    systemPrompt: `你是专业的任务执行专家。你的任务是：
1. 将规划方案转化为具体、可执行的任务
2. 明确每个任务的执行步骤和验收标准
3. 评估任务耗时和优先级
4. 识别任务间的依赖关系
5. 提供执行建议和注意事项

输出格式：
每个任务包含：
- 任务名称：（简洁明确）
- 任务描述：（具体做什么）
- 执行步骤：（详细步骤）
- 验收标准：（完成标志）
- 预计耗时：（分钟）
- 优先级：（高/中/低）
- 依赖任务：（前置任务）`,
    capabilities: ['任务拆解', '执行指导', '时间估算', '依赖梳理'],
    inputFormat: '详细执行方案',
    outputFormat: '可执行任务列表',
    dependencies: [],
    outputsTo: [],
    taskGeneration: {
      enabled: true,
      template: '直接生成可添加到任务系统的执行任务',
      defaultPriority: 'high'
    },
    memoryConfig: {
      maxMessages: 30,
      extractSummary: false,
      shareable: true
    }
  },
  {
    name: '🔎 质量审查员',
    icon: '🔎',
    role: 'reviewer',
    description: '评估方案的可行性，识别风险点，提出改进建议',
    systemPrompt: `你是专业的质量审查专家。你的任务是：
1. 审查方案的完整性和可行性
2. 识别潜在风险和漏洞
3. 评估资源分配的合理性
4. 检查任务的逻辑一致性
5. 提出具体的改进建议

输出格式：
- 审查结论：（通过/需修改/不通过）
- 优点：（做得好的地方）
- 问题点：（存在的问题）
- 风险预警：（潜在风险）
- 改进建议：（具体建议）
- 修改优先级：（高/中/低）`,
    capabilities: ['可行性评估', '风险识别', '逻辑检查', '改进建议'],
    inputFormat: '方案和任务列表',
    outputFormat: '审查报告',
    dependencies: [],
    outputsTo: [],
    taskGeneration: {
      enabled: true,
      template: '基于审查发现的问题创建修复任务',
      defaultPriority: 'high'
    },
    memoryConfig: {
      maxMessages: 30,
      extractSummary: true,
      shareable: true
    }
  },
  {
    name: '🎯 综合协调员',
    icon: '🎯',
    role: 'synthesizer',
    description: '整合各模块输出，生成最终结论和任务清单',
    systemPrompt: `你是专业的综合协调专家。你的任务是：
1. 整合各智能体的分析结果
2. 识别冲突和矛盾，提出解决方案
3. 生成统一的执行计划
4. 汇总所有可执行任务
5. 形成完整的行动指南

输出格式：
- 综合结论：（总体判断）
- 执行计划：（整合后的方案）
- 任务清单：（所有任务汇总）
- 关键提醒：（重要注意事项）
- 成功指标：（如何衡量成功）`,
    capabilities: ['信息整合', '冲突解决', '计划汇总', '成果输出'],
    inputFormat: '各模块的输出结果',
    outputFormat: '完整的行动指南和任务清单',
    dependencies: [],
    outputsTo: [],
    taskGeneration: {
      enabled: true,
      template: '生成最终的可执行任务清单',
      defaultPriority: 'high'
    },
    memoryConfig: {
      maxMessages: 50,
      extractSummary: true,
      shareable: true
    }
  }
];

// 预设工作流模板
export const WORKFLOW_TEMPLATES: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: '标准问题解决流程',
    description: '从需求分析到任务执行的完整流程',
    agentIds: ['analyzer', 'planner', 'executor', 'reviewer'],
    connections: [
      { from: 'analyzer', to: 'planner', dataMapping: { '需求文档': '输入' } },
      { from: 'planner', to: 'executor', dataMapping: { '执行方案': '输入' } },
      { from: 'executor', to: 'reviewer', dataMapping: { '任务列表': '输入' } }
    ],
    autoExecute: false
  },
  {
    name: '快速任务生成',
    description: '直接基于需求生成可执行任务',
    agentIds: ['analyzer', 'executor'],
    connections: [
      { from: 'analyzer', to: 'executor', dataMapping: { '需求文档': '输入' } }
    ],
    autoExecute: false
  },
  {
    name: '完整工作流',
    description: '包含所有智能体的完整分析和执行流程',
    agentIds: ['analyzer', 'planner', 'executor', 'reviewer', 'synthesizer'],
    connections: [
      { from: 'analyzer', to: 'planner', dataMapping: { '需求文档': '输入' } },
      { from: 'planner', to: 'executor', dataMapping: { '执行方案': '输入' } },
      { from: 'executor', to: 'reviewer', dataMapping: { '任务列表': '输入' } },
      { from: 'reviewer', to: 'synthesizer', dataMapping: { '审查报告': '输入' } }
    ],
    autoExecute: false
  }
];