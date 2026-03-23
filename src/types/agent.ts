// 思维智能体工作流系统类型定义

export type AgentRole = 
  | 'analyzer'      // 分析者：理解需求、拆解问题
  | 'planner'       // 规划者：制定方案、设计路径
  | 'executor'      // 执行者：具体行动、落地实施
  | 'reviewer'      // 审查者：评估风险、检查质量
  | 'synthesizer';  // 综合者：整合信息、生成结论

export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

// 资源类型
export type ResourceType = 
  | 'time'        // 时间
  | 'money'       // 资金
  | 'energy'      // 精力/体力
  | 'skill'       // 技能
  | 'tool'        // 工具/设备
  | 'network'     // 人脉/关系
  | 'information' // 信息/数据
  | 'space';      // 空间/场地

// 资源需求
export interface ResourceRequirement {
  type: ResourceType;
  description: string;
  amount?: number;              // 数量
  unit?: string;                // 单位
  isEssential: boolean;         // 是否必需
  alternatives?: string[];      // 替代方案
}

// 条件匹配
export interface ConditionMatch {
  condition: string;            // 条件描述
  isMet: boolean;               // 是否满足
  confidence: number;           // 置信度 0-100
  evidence?: string;            // 证据/依据
  gap?: string;                 // 差距（如果不满足）
}

// 可行性评估
export interface FeasibilityAssessment {
  overallScore: number;         // 总体可行性 0-100
  timeFeasibility: number;      // 时间可行性
  resourceFeasibility: number;  // 资源可行性
  skillFeasibility: number;     // 技能可行性
  riskLevel: 'low' | 'medium' | 'high';
  conditions: ConditionMatch[]; // 条件匹配情况
  missingResources: ResourceRequirement[]; // 缺失资源
  recommendations: string[];    // 改进建议
}

// 价值交换评估
export interface ValueExchangeAssessment {
  inputResources: ResourceRequirement[];   // 投入资源
  outputValue: string[];                   // 产出价值
  roi: number;                             // 投资回报率估计
  breakEvenTime?: number;                  // 盈亏平衡时间（天）
  sustainability: 'short' | 'medium' | 'long'; // 可持续性
  marketFit: number;                       // 市场匹配度 0-100
}

// 心理边界评估 - 一个人敢不敢做的心理边界
export interface MentalBoundary {
  boundary: string;                        // 边界描述（如"不敢在公众场合发言"）
  type: 'fear' | 'habit' | 'belief' | 'comfort_zone'; // 边界类型
  severity: number;                        // 严重程度 0-100
  rootCause?: string;                      // 根本原因
  triggers: string[];                      // 触发场景
  impact: string;                          // 对任务的影响
}

// 勇气/动机评估 - 有没有勇气去挑战困难
export interface CourageAssessment {
  overallCourage: number;                  // 总体勇气值 0-100
  motivationLevel: number;                 // 动机水平 0-100
  motivationSources: string[];             // 动机来源
  challengeReadiness: number;              // 挑战准备度 0-100
  resilience: number;                      // 心理韧性 0-100
  growthMindset: number;                   // 成长型思维 0-100
  fearFactors: {                           // 恐惧因素
    factor: string;
    intensity: number;                     // 强度 0-100
    canOvercome: boolean;
    overcomingStrategy?: string;
  }[];
  historicalSuccess: {                     // 历史成功经验
    context: string;
    achievement: string;
    confidenceBoost: number;               // 对当前任务的信心提升
  }[];
}

// 权力/许可评估 - 有没有权力/许可去做
export interface PermissionAssessment {
  hasAuthority: boolean;                   // 是否有决策权
  authorityLevel: number;                  // 权力等级 0-100
  requiresApproval: boolean;               // 是否需要批准
  approvers?: string[];                    // 需要谁批准
  organizationalConstraints: string[];     // 组织约束
  legalConstraints: string[];              // 法律约束
  ethicalConsiderations: string[];         // 伦理考量
  implicitPermissions: {                   // 隐性许可
    context: string;
    granted: boolean;
    confidence: number;
  }[];
  riskOfOverstepping: number;              // 越权风险 0-100
}

// 综合心理评估
export interface PsychologicalAssessment {
  mentalBoundaries: MentalBoundary[];      // 心理边界列表
  courage: CourageAssessment;              // 勇气/动机评估
  permission: PermissionAssessment;        // 权力/许可评估
  overallReadiness: number;                // 总体心理准备度 0-100
  limitingFactors: string[];               // 限制因素
  enablingFactors: string[];               // 促进因素
  recommendations: string[];               // 心理建设建议
  supportNeeded: string[];                 // 需要的支持
}

// 可执行任务
export interface ExecutableTask {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  estimatedTime: number;        // 预计耗时（分钟）
  deadline?: Date;              // 截止日期
  dependencies: string[];       // 依赖的其他任务ID
  requiredResources: ResourceRequirement[];  // 所需资源
  verificationCriteria: string; // 完成标准
  status: TaskStatus;
  createdAt: Date;
  completedAt?: Date;
  tags: string[];
  assignee?: string;            // 执行人
  
  // 新增：可行性评估
  feasibility?: FeasibilityAssessment;
  
  // 新增：价值交换评估
  valueExchange?: ValueExchangeAssessment;
  
  // 新增：市场匹配
  marketFit?: {
    targetAudience: string[];   // 目标受众
    competition: string[];      // 竞争对手/替代方案
    differentiation: string;    // 差异化优势
    timing: string;             // 时机评估
  };
  
  // 新增：心理评估 - 一个人敢不敢做的心理边界
  psychologicalAssessment?: PsychologicalAssessment;
}

// 目标对象（模拟用户/测试对象）
export interface TargetPersona {
  id: string;
  name: string;
  description: string;          // 目标对象描述
  characteristics: string[];    // 特征标签
  painPoints: string[];         // 痛点/关注点
  expectations: string[];       // 期望
  feedbackStyle: 'critical' | 'supportive' | 'neutral' | 'detailed'; // 反馈风格
}

// 模拟反馈
export interface SimulatedFeedback {
  id: string;
  agentId: string;
  targetPersonaId: string;
  originalOutput: string;       // 原始输出
  feedback: string;             // 反馈内容
  score: number;                // 评分 0-100
  concerns: string[];           // 关注点
  suggestions: string[];        // 改进建议
  timestamp: Date;
  iteration: number;            // 第几次迭代
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
  
  // 目标对象模拟反馈配置
  simulationConfig: {
    enabled: boolean;
    targetPersonas: string[];   // 使用的目标对象ID列表
    maxIterations: number;      // 最大迭代次数
    minScoreThreshold: number;  // 最低通过分数
    autoIterate: boolean;       // 是否自动迭代优化
  };
  
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
    },
    simulationConfig: {
      enabled: false,
      targetPersonas: [],
      maxIterations: 3,
      minScoreThreshold: 70,
      autoIterate: false
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
    },
    simulationConfig: {
      enabled: false,
      targetPersonas: [],
      maxIterations: 3,
      minScoreThreshold: 70,
      autoIterate: false
    }
  },
  {
    name: '⚡ 任务执行器',
    icon: '⚡',
    role: 'executor',
    description: '将方案转化为具体的可执行任务，明确执行细节，评估心理可行性',
    systemPrompt: `你是专业的任务执行专家。你的任务是：
1. 将规划方案转化为具体、可执行的任务
2. 明确每个任务的执行步骤和验收标准
3. 评估任务耗时和优先级
4. 识别任务间的依赖关系
5. 提供执行建议和注意事项
6. **关键：评估每个任务的心理可行性** - 分析执行者是否"敢做"、"有勇气挑战"、"有权力执行"

输出格式：
每个任务包含：
- 任务名称：（简洁明确）
- 任务描述：（具体做什么）
- 执行步骤：（详细步骤）
- 验收标准：（完成标志）
- 预计耗时：（分钟）
- 优先级：（高/中/低）
- 依赖任务：（前置任务）
- **心理边界评估**：（需要突破的心理障碍，如"公开演讲恐惧"、"权威沟通焦虑"等）
- **勇气需求**：（执行此任务需要的勇气等级 0-100）
- **权力许可**：（是否需要特殊权限或批准）`,
    capabilities: ['任务拆解', '执行指导', '时间估算', '依赖梳理', '心理评估', '边界识别'],
    inputFormat: '详细执行方案',
    outputFormat: '可执行任务列表（含心理评估）',
    dependencies: [],
    outputsTo: [],
    taskGeneration: {
      enabled: true,
      template: `生成可执行任务，并对每个任务进行心理可行性评估：

对于每个任务，请分析：
1. 心理边界：执行这个任务需要突破什么心理边界？（如：不敢拒绝、害怕失败、社交焦虑等）
2. 勇气需求：挑战这个困难需要多大勇气？（1-100分）
3. 权力许可：执行此任务需要什么权限？是否需要批准？

格式示例：
任务：向领导提出加薪请求
- 心理边界：权威恐惧、自我价值怀疑
- 勇气需求：85/100
- 权力许可：无需批准，但需考虑组织层级`,
      defaultPriority: 'high'
    },
    memoryConfig: {
      maxMessages: 30,
      extractSummary: false,
      shareable: true
    },
    simulationConfig: {
      enabled: true,
      targetPersonas: ['busy-professional', 'perfectionist', 'beginner'],
      maxIterations: 3,
      minScoreThreshold: 75,
      autoIterate: true
    }
  },
  {
    name: '🔎 质量审查员',
    icon: '🔎',
    role: 'reviewer',
    description: '评估方案的可行性，识别风险点，审查心理可行性，提出改进建议',
    systemPrompt: `你是专业的质量审查专家。你的任务是：
1. 审查方案的完整性和可行性
2. 识别潜在风险和漏洞
3. 评估资源分配的合理性
4. 检查任务的逻辑一致性
5. **审查心理可行性**：评估执行者的心理准备度、勇气是否足够、权力是否允许
6. 提出具体的改进建议

输出格式：
- 审查结论：（通过/需修改/不通过）
- 优点：（做得好的地方）
- 问题点：（存在的问题）
- 风险预警：（潜在风险）
- **心理可行性评估**：
  - 心理准备度：（0-100分）
  - 勇气匹配度：任务所需勇气 vs 执行者现有勇气
  - 权力匹配度：任务所需权限 vs 执行者现有权限
  - 心理风险：（如"可能导致焦虑"、"可能触发逃避"等）
- 改进建议：（具体建议，包括心理建设建议）
- 修改优先级：（高/中/低）`,
    capabilities: ['可行性评估', '风险识别', '逻辑检查', '改进建议', '心理可行性审查'],
    inputFormat: '方案和任务列表（含心理评估）',
    outputFormat: '审查报告（含心理可行性分析）',
    dependencies: [],
    outputsTo: [],
    taskGeneration: {
      enabled: true,
      template: '基于审查发现的问题创建修复任务，特别关注心理层面的障碍和突破策略',
      defaultPriority: 'high'
    },
    memoryConfig: {
      maxMessages: 30,
      extractSummary: true,
      shareable: true
    },
    simulationConfig: {
      enabled: false,
      targetPersonas: [],
      maxIterations: 3,
      minScoreThreshold: 70,
      autoIterate: false
    }
  },
  {
    name: '🎯 综合协调员',
    icon: '🎯',
    role: 'synthesizer',
    description: '整合各模块输出，生成最终结论、任务清单和心理准备指南',
    systemPrompt: `你是专业的综合协调专家。你的任务是：
1. 整合各智能体的分析结果
2. 识别冲突和矛盾，提出解决方案
3. 生成统一的执行计划
4. 汇总所有可执行任务
5. **整合心理评估**：汇总所有任务的心理边界、勇气需求、权力许可
6. 形成完整的行动指南（含心理建设建议）

输出格式：
- 综合结论：（总体判断）
- 执行计划：（整合后的方案）
- 任务清单：（所有任务汇总，标注心理难度等级）
- **心理准备指南**：
  - 总体心理边界地图
  - 勇气建设路径（从低勇气任务到高勇气任务）
  - 权力许可检查清单
  - 心理风险预警
- 关键提醒：（重要注意事项）
- 成功指标：（如何衡量成功）`,
    capabilities: ['信息整合', '冲突解决', '计划汇总', '成果输出', '心理评估整合'],
    inputFormat: '各模块的输出结果（含心理评估）',
    outputFormat: '完整的行动指南、任务清单和心理准备方案',
    dependencies: [],
    outputsTo: [],
    taskGeneration: {
      enabled: true,
      template: `生成最终的可执行任务清单，并整合心理评估结果：

对于每个任务，标注：
1. 心理难度等级（简单/中等/困难/极难）
2. 需要突破的心理边界
3. 建议的勇气准备度
4. 权力许可状态

同时生成心理准备指南，帮助执行者逐步建立信心。`,
      defaultPriority: 'high'
    },
    memoryConfig: {
      maxMessages: 50,
      extractSummary: true,
      shareable: true
    },
    simulationConfig: {
      enabled: true,
      targetPersonas: ['busy-professional', 'perfectionist', 'beginner', 'skeptical-analyst', 'creative-explorer'],
      maxIterations: 3,
      minScoreThreshold: 75,
      autoIterate: true
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

// 预设目标对象（模拟用户）
export const TARGET_PERSONAS: TargetPersona[] = [
  {
    id: 'busy-professional',
    name: '💼 忙碌的职场人士',
    description: '工作繁忙、时间碎片化、追求效率的职场人',
    characteristics: ['时间敏感', '结果导向', '实用主义', '抗压能力强'],
    painPoints: ['时间不够用', '难以坚持', '信息过载', '精力分散'],
    expectations: ['快速见效', '操作简单', '灵活调整', '明确指导'],
    feedbackStyle: 'critical'
  },
  {
    id: 'perfectionist',
    name: '🎯 完美主义者',
    description: '追求高标准、注重细节、容易拖延的完美主义者',
    characteristics: ['高标准', '注重细节', '自我要求高', '深思熟虑'],
    painPoints: ['过度准备', '害怕失败', '难以开始', '容易 burnout'],
    expectations: ['系统完善', '质量保障', '风险控制', '专业指导'],
    feedbackStyle: 'detailed'
  },
  {
    id: 'beginner',
    name: '🌱 初学者',
    description: '刚开始尝试、缺乏经验、需要引导的新手',
    characteristics: ['学习意愿强', '开放心态', '需要鼓励', '循序渐进'],
    painPoints: ['不知从何开始', '缺乏信心', '容易放弃', '方法不当'],
    expectations: ['简单易懂', '循序渐进', '及时反馈', '正向激励'],
    feedbackStyle: 'supportive'
  },
  {
    id: 'skeptical-analyst',
    name: '🧐 理性分析师',
    description: '逻辑严谨、数据驱动、质疑一切的理性派',
    characteristics: ['逻辑严谨', '数据驱动', '质疑精神', '追求证据'],
    painPoints: ['过度分析', '行动迟缓', '难以决策', '忽视直觉'],
    expectations: ['逻辑严密', '数据支持', '风险评估', '可验证性'],
    feedbackStyle: 'neutral'
  },
  {
    id: 'creative-explorer',
    name: '🎨 创意探索者',
    description: '富有创意、喜欢尝试、追求多样性的探索者',
    characteristics: ['创意丰富', '好奇心强', '灵活多变', '享受过程'],
    painPoints: ['难以专注', '缺乏条理', '容易分心', '执行困难'],
    expectations: ['有趣好玩', '灵活自由', '创意空间', '多样选择'],
    feedbackStyle: 'supportive'
  }
];