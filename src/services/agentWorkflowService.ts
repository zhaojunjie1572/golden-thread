import {
  AgentModule,
  Workflow,
  WorkflowInstance,
  WorkflowContext,
  ExecutableTask,
  AgentMemory,
  SimulatedFeedback,
  TargetPersona,
  AGENT_TEMPLATES,
  WORKFLOW_TEMPLATES,
  TARGET_PERSONAS,
  TaskPriority,
  PsychologicalAssessment,
  MentalBoundary,
  CourageAssessment,
  PermissionAssessment,
  ResourceType,
} from '../types/agent';
import { apiService } from './apiService';
import { ChatMessage } from './apiService';

// 智能体工作流服务
export class AgentWorkflowService {
  private static STORAGE_KEY = 'agent-workflows';
  private static INSTANCE_STORAGE_KEY = 'agent-workflow-instances';
  private static AGENT_STORAGE_KEY = 'agent-modules';
  private static MEMORY_STORAGE_KEY = 'agent-memories';
  private static FEEDBACK_STORAGE_KEY = 'agent-feedbacks';
  private static PERSONA_STORAGE_KEY = 'agent-personas';

  // ========== 智能体模块管理 ==========

  static getAgents(): AgentModule[] {
    try {
      const saved = localStorage.getItem(this.AGENT_STORAGE_KEY);
      if (saved) {
        const agents = JSON.parse(saved);
        return agents.map((agent: any) => ({
          ...agent,
          createdAt: new Date(agent.createdAt),
          updatedAt: new Date(agent.updatedAt),
        }));
      }
    } catch (error) {
      console.error('加载智能体失败:', error);
    }
    return [];
  }

  static saveAgents(agents: AgentModule[]) {
    try {
      localStorage.setItem(this.AGENT_STORAGE_KEY, JSON.stringify(agents));
    } catch (error) {
      console.error('保存智能体失败:', error);
    }
  }

  static createAgentFromTemplate(templateId: string): AgentModule | null {
    const template = AGENT_TEMPLATES.find(t => 
      t.name.toLowerCase().includes(templateId.toLowerCase()) ||
      t.role === templateId
    );
    
    if (!template) return null;

    const now = new Date();
    return {
      ...template,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
  }

  static initializeDefaultAgents(): AgentModule[] {
    const agents = AGENT_TEMPLATES.map(template => ({
      ...template,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    }));
    this.saveAgents(agents);
    return agents;
  }

  // ========== 智能体 CRUD 操作 ==========

  static createAgent(agentData: Partial<AgentModule>): AgentModule {
    const now = new Date();
    const newAgent: AgentModule = {
      id: crypto.randomUUID(),
      name: agentData.name || '未命名智能体',
      icon: agentData.icon || '🤖',
      role: agentData.role || 'analyzer',
      description: agentData.description || '',
      systemPrompt: agentData.systemPrompt || '',
      capabilities: agentData.capabilities || [],
      inputFormat: agentData.inputFormat || '',
      outputFormat: agentData.outputFormat || '',
      dependencies: agentData.dependencies || [],
      outputsTo: agentData.outputsTo || [],
      taskGeneration: {
        enabled: agentData.taskGeneration?.enabled ?? true,
        template: agentData.taskGeneration?.template || '',
        defaultPriority: agentData.taskGeneration?.defaultPriority || 'medium',
      },
      memoryConfig: {
        maxMessages: agentData.memoryConfig?.maxMessages ?? 50,
        extractSummary: agentData.memoryConfig?.extractSummary ?? true,
        shareable: agentData.memoryConfig?.shareable ?? true,
      },
      simulationConfig: {
        enabled: agentData.simulationConfig?.enabled ?? false,
        targetPersonas: agentData.simulationConfig?.targetPersonas || [],
        maxIterations: agentData.simulationConfig?.maxIterations ?? 3,
        minScoreThreshold: agentData.simulationConfig?.minScoreThreshold ?? 70,
        autoIterate: agentData.simulationConfig?.autoIterate ?? false,
      },
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    const agents = this.getAgents();
    agents.push(newAgent);
    this.saveAgents(agents);
    return newAgent;
  }

  static updateAgent(agentId: string, updates: Partial<AgentModule>): AgentModule | null {
    const agents = this.getAgents();
    const index = agents.findIndex(a => a.id === agentId);
    
    if (index === -1) return null;

    const updatedAgent = {
      ...agents[index],
      ...updates,
      id: agents[index].id, // 保持ID不变
      createdAt: agents[index].createdAt, // 保持创建时间不变
      updatedAt: new Date(),
      version: agents[index].version + 1,
    };

    agents[index] = updatedAgent;
    this.saveAgents(agents);
    return updatedAgent;
  }

  static deleteAgent(agentId: string): boolean {
    const agents = this.getAgents();
    const filteredAgents = agents.filter(a => a.id !== agentId);
    
    if (filteredAgents.length === agents.length) {
      return false; // 没有找到要删除的智能体
    }
    
    this.saveAgents(filteredAgents);
    return true;
  }

  static duplicateAgent(agentId: string): AgentModule | null {
    const agents = this.getAgents();
    const agent = agents.find(a => a.id === agentId);
    
    if (!agent) return null;

    const now = new Date();
    const duplicatedAgent: AgentModule = {
      ...agent,
      id: crypto.randomUUID(),
      name: `${agent.name} (复制)`,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    agents.push(duplicatedAgent);
    this.saveAgents(agents);
    return duplicatedAgent;
  }

  static exportAgent(agentId: string): string | null {
    const agents = this.getAgents();
    const agent = agents.find(a => a.id === agentId);
    
    if (!agent) return null;
    
    return JSON.stringify(agent, null, 2);
  }

  static importAgent(jsonString: string): AgentModule | null {
    try {
      const agentData = JSON.parse(jsonString);
      
      // 验证必要字段
      if (!agentData.name || !agentData.systemPrompt) {
        throw new Error('缺少必要字段');
      }

      return this.createAgent(agentData);
    } catch (error) {
      console.error('导入智能体失败:', error);
      return null;
    }
  }

  // ========== AI 辅助生成智能体 ==========

  static async generateAgentWithAI(
    description: string,
    role: string,
    onProgress?: (message: string) => void
  ): Promise<Partial<AgentModule> | null> {
    const prompt = `基于以下描述，创建一个完整的智能体配置：

描述：${description}
角色定位：${role}

请生成一个JSON格式的智能体配置，包含以下字段：
{
  "name": "智能体名称（带emoji）",
  "icon": "emoji图标",
  "role": "${role}",
  "description": "简短描述",
  "systemPrompt": "详细的系统提示词，指导AI如何工作",
  "capabilities": ["能力1", "能力2", "能力3"],
  "inputFormat": "期望的输入格式说明",
  "outputFormat": "期望的输出格式说明",
  "taskGeneration": {
    "enabled": true,
    "template": "任务生成提示词模板",
    "defaultPriority": "medium"
  },
  "memoryConfig": {
    "maxMessages": 50,
    "extractSummary": true,
    "shareable": true
  }
}

请确保：
1. systemPrompt 详细且实用
2. capabilities 至少包含3-5个核心能力
3. taskGeneration.template 能够生成可执行的任务
4. 所有字段都有合理的值`;

    try {
      onProgress?.('正在分析需求...');
      
      const response = await apiService.chat([
        { role: 'system', content: '你是一个智能体设计专家，擅长创建高质量的AI智能体配置。' },
        { role: 'user', content: prompt }
      ]);

      onProgress?.('正在解析配置...');
      
      // 提取JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析AI响应');
      }

      const config = JSON.parse(jsonMatch[0]);
      
      onProgress?.('配置生成完成！');
      return config;
    } catch (error) {
      console.error('生成智能体失败:', error);
      onProgress?.('生成失败，请重试');
      return null;
    }
  }

  // ========== 工作流管理 ==========

  static getWorkflows(): Workflow[] {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const workflows = JSON.parse(saved);
        return workflows.map((wf: any) => ({
          ...wf,
          createdAt: new Date(wf.createdAt),
          updatedAt: new Date(wf.updatedAt),
        }));
      }
    } catch (error) {
      console.error('加载工作流失败:', error);
    }
    return [];
  }

  static saveWorkflows(workflows: Workflow[]) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(workflows));
    } catch (error) {
      console.error('保存工作流失败:', error);
    }
  }

  static createWorkflowFromTemplate(templateId: string): Workflow | null {
    const template = WORKFLOW_TEMPLATES.find(t => 
      t.name.toLowerCase().includes(templateId.toLowerCase())
    );
    
    if (!template) return null;

    const now = new Date();
    return {
      ...template,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
  }

  // ========== 工作流执行 ==========

  static async executeWorkflow(
    workflow: Workflow,
    initialInput: string,
    onProgress?: (instance: WorkflowInstance, currentAgent: AgentModule) => void
  ): Promise<WorkflowInstance> {
    const agents = this.getAgents();
    const instance: WorkflowInstance = {
      id: crypto.randomUUID(),
      workflowId: workflow.id,
      status: 'running',
      currentAgentIndex: 0,
      context: {
        originalInput: initialInput,
        accumulatedInsights: [],
        generatedTasks: [],
        metadata: {},
      },
      tasks: [],
      startedAt: new Date(),
    };

    this.saveInstance(instance);

    try {
      for (let i = 0; i < workflow.agentIds.length; i++) {
        instance.currentAgentIndex = i;
        const agentId = workflow.agentIds[i];
        const agent = agents.find(a => a.id === agentId);
        
        if (!agent) {
          console.warn(`智能体 ${agentId} 不存在，跳过`);
          continue;
        }

        onProgress?.(instance, agent);

        // 执行智能体
        const result = await this.executeAgent(agent, instance.context);
        
        // 更新上下文
        instance.context.accumulatedInsights.push(
          `[${agent.name}] ${result.summary}`
        );
        
        if (result.tasks) {
          instance.tasks.push(...result.tasks);
          instance.context.generatedTasks.push(...result.tasks);
        }

        // 保存中间状态
        this.saveInstance(instance);
      }

      instance.status = 'completed';
      instance.completedAt = new Date();
    } catch (error) {
      console.error('工作流执行失败:', error);
      instance.status = 'failed';
    }

    this.saveInstance(instance);
    return instance;
  }

  static async executeAgent(
    agent: AgentModule,
    context: WorkflowContext
  ): Promise<{ summary: string; tasks?: ExecutableTask[] }> {
    const messages: ChatMessage[] = [
      {
        id: crypto.randomUUID(),
        role: 'system',
        content: agent.systemPrompt,
        timestamp: new Date(),
      },
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: this.buildAgentInput(agent, context),
        timestamp: new Date(),
      },
    ];

    let fullResponse = '';

    return new Promise((resolve, reject) => {
      apiService.streamChat(
        messages,
        (chunk) => {
          fullResponse += chunk;
        },
        () => {
          // 解析响应
          const tasks = agent.taskGeneration.enabled
            ? this.extractTasksFromResponse(fullResponse, agent.taskGeneration.defaultPriority)
            : undefined;

          resolve({
            summary: fullResponse.slice(0, 200) + '...',
            tasks,
          });
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  private static buildAgentInput(agent: AgentModule, context: WorkflowContext): string {
    let input = `原始需求：${context.originalInput}\n\n`;
    
    if (context.accumulatedInsights.length > 0) {
      input += `前期分析结果：\n${context.accumulatedInsights.join('\n')}\n\n`;
    }

    input += `请按照你的角色（${agent.role}）和专业能力（${agent.capabilities.join('、')}）处理以上信息。`;
    
    if (agent.taskGeneration.enabled) {
      input += `\n\n${agent.taskGeneration.template}`;
    }

    return input;
  }

  // ========== 任务提取 ==========

  static extractTasksFromResponse(
    response: string,
    defaultPriority: TaskPriority = 'medium'
  ): ExecutableTask[] {
    const tasks: ExecutableTask[] = [];
    
    // 匹配任务格式的正则表达式
    const taskPattern = /任务[：:]\s*([^\n]+)[\s\S]*?(?=任务[：:]|$)/gi;
    const matches = response.matchAll(taskPattern);
    
    for (const match of matches) {
      const taskText = match[0];
      const title = match[1]?.trim() || '未命名任务';
      
      // 提取描述
      const descMatch = taskText.match(/描述[：:]\s*([^\n]+)/i);
      const description = descMatch?.[1]?.trim() || '';
      
      // 提取耗时
      const timeMatch = taskText.match(/(?:耗时|时间|预计)[：:]\s*(\d+)/i);
      const estimatedTime = timeMatch ? parseInt(timeMatch[1]) : 30;
      
      // 提取优先级
      let priority: TaskPriority = defaultPriority;
      if (/高|high/i.test(taskText)) priority = 'high';
      else if (/低|low/i.test(taskText)) priority = 'low';
      
      // 提取验收标准
      const verifyMatch = taskText.match(/(?:验收|标准|完成)[：:]\s*([^\n]+)/i);
      const verificationCriteria = verifyMatch?.[1]?.trim() || '按描述完成';

      // 提取资源需求
      const resources: { type: ResourceType; description: string; isEssential: boolean }[] = [];
      const resourceMatch = taskText.match(/(?:资源|需要)[：:]([\s\S]*?)(?=时间|验收|$)/i);
      if (resourceMatch) {
        const resourceLines = resourceMatch[1].split('\n');
        for (const line of resourceLines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
            const resourceText = trimmed.substring(1).trim();
            // 尝试识别资源类型
            let type: ResourceType = 'time';
            if (/钱|资金|成本|费用|元|块/i.test(resourceText)) type = 'money';
            else if (/技能|能力|知识|经验/i.test(resourceText)) type = 'skill';
            else if (/工具|设备|软件|硬件/i.test(resourceText)) type = 'tool';
            else if (/人脉|关系|联系|资源/i.test(resourceText)) type = 'network';
            else if (/信息|数据|资料|情报/i.test(resourceText)) type = 'information';
            else if (/空间|场地|位置/i.test(resourceText)) type = 'space';
            else if (/精力|体力|能量/i.test(resourceText)) type = 'energy';

            resources.push({
              type,
              description: resourceText,
              isEssential: true,
            });
          }
        }
      }

      tasks.push({
        id: crypto.randomUUID(),
        title: title.slice(0, 50),
        description: description.slice(0, 200),
        priority,
        estimatedTime,
        dependencies: [],
        requiredResources: resources,
        verificationCriteria: verificationCriteria.slice(0, 100),
        status: 'pending',
        createdAt: new Date(),
        tags: [],
      });
    }

    return tasks;
  }

  // ========== 可行性评估 ==========

  static async assessTaskFeasibility(
    task: ExecutableTask,
    userContext?: string
  ): Promise<ExecutableTask> {
    const prompt = `请对以下任务进行可行性评估：

任务名称：${task.title}
任务描述：${task.description}
预计耗时：${task.estimatedTime}分钟
所需资源：${task.requiredResources.map(r => r.description).join('、') || '未明确'}

${userContext ? `用户背景：${userContext}` : ''}

请从以下维度评估：
1. 时间可行性（当前时间是否足够）
2. 资源可行性（资源是否可获取）
3. 技能可行性（是否具备必要技能）
4. 风险等级（低/中/高）
5. 条件匹配（需要满足什么条件）
6. 缺失资源（缺少什么）
7. 改进建议

输出格式：
总体评分：（0-100分）
时间可行性：（0-100分）
资源可行性：（0-100分）
技能可行性：（0-100分）
风险等级：（低/中/高）
条件匹配：
- 条件1：（满足/不满足）- 说明
- 条件2：（满足/不满足）- 说明
缺失资源：
- 资源1：说明
- 资源2：说明
改进建议：
- 建议1
- 建议2`;

    const messages: ChatMessage[] = [
      {
        id: crypto.randomUUID(),
        role: 'system',
        content: '你是专业的可行性评估专家，擅长分析任务的可执行性和资源匹配度。',
        timestamp: new Date(),
      },
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: prompt,
        timestamp: new Date(),
      },
    ];

    let fullResponse = '';

    return new Promise((resolve) => {
      apiService.streamChat(
        messages,
        (chunk) => {
          fullResponse += chunk;
        },
        () => {
          const feasibility = this.parseFeasibilityFromResponse(fullResponse);
          resolve({
            ...task,
            feasibility,
          });
        },
        () => {
          // 评估失败时返回基础评估
          resolve({
            ...task,
            feasibility: {
              overallScore: 70,
              timeFeasibility: 70,
              resourceFeasibility: 70,
              skillFeasibility: 70,
              riskLevel: 'medium',
              conditions: [],
              missingResources: [],
              recommendations: ['建议进一步评估'],
            },
          });
        }
      );
    });
  }

  static parseFeasibilityFromResponse(response: string) {
    const overallMatch = response.match(/总体评分[：:]\s*(\d+)/i);
    const timeMatch = response.match(/时间可行性[：:]\s*(\d+)/i);
    const resourceMatch = response.match(/资源可行性[：:]\s*(\d+)/i);
    const skillMatch = response.match(/技能可行性[：:]\s*(\d+)/i);
    const riskMatch = response.match(/风险等级[：:]\s*(低|中|高)/i);

    const conditions: { condition: string; isMet: boolean; confidence: number; evidence?: string; gap?: string }[] = [];
    const conditionSection = response.match(/条件匹配[：:]([\s\S]*?)(?=缺失资源|改进建议|$)/i);
    if (conditionSection) {
      const lines = conditionSection[1].split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
          const text = trimmed.substring(1).trim();
          const isMet = text.includes('满足') && !text.includes('不满足');
          const conditionMatch = text.match(/^(.+?)[：:]/);
          conditions.push({
            condition: conditionMatch ? conditionMatch[1].trim() : text,
            isMet,
            confidence: isMet ? 80 : 20,
          });
        }
      }
    }

    const missingResources: { type: ResourceType; description: string; isEssential: boolean; amount?: number; unit?: string; alternatives?: string[] }[] = [];
    const resourceSection = response.match(/缺失资源[：:]([\s\S]*?)(?=改进建议|$)/i);
    if (resourceSection) {
      const lines = resourceSection[1].split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
          missingResources.push({
            type: 'time',
            description: trimmed.substring(1).trim(),
            isEssential: true,
          });
        }
      }
    }

    const recommendations: string[] = [];
    const suggestionSection = response.match(/改进建议[：:]([\s\S]*?)$/i);
    if (suggestionSection) {
      const lines = suggestionSection[1].split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
          recommendations.push(trimmed.substring(1).trim());
        }
      }
    }

    return {
      overallScore: overallMatch ? parseInt(overallMatch[1]) : 70,
      timeFeasibility: timeMatch ? parseInt(timeMatch[1]) : 70,
      resourceFeasibility: resourceMatch ? parseInt(resourceMatch[1]) : 70,
      skillFeasibility: skillMatch ? parseInt(skillMatch[1]) : 70,
      riskLevel: (riskMatch?.[1] as 'low' | 'medium' | 'high') || 'medium',
      conditions,
      missingResources,
      recommendations: recommendations.length > 0 ? recommendations : ['建议进一步评估'],
    };
  }

  // ========== 价值交换评估 ==========

  static async assessValueExchange(
    tasks: ExecutableTask[],
    goal: string
  ): Promise<{ inputResources: { type: ResourceType; description: string; isEssential: boolean }[]; outputValue: string[]; roi: number; sustainability: 'short' | 'medium' | 'long'; marketFit: number; breakEvenTime?: number }> {
    const totalTime = tasks.reduce((sum, t) => sum + t.estimatedTime, 0);
    const allResources = tasks.flatMap(t => t.requiredResources);

    return {
      inputResources: allResources,
      outputValue: [`完成目标：${goal}`, `产出${tasks.length}个可执行任务`],
      roi: 100, // 简化计算
      sustainability: totalTime < 60 ? 'short' : totalTime < 300 ? 'medium' : 'long',
      marketFit: 75,
    };
  }

  // ========== 心理评估 - 心理边界、勇气/动机、权力允许 ==========

  static async assessPsychologicalFactors(
    task: ExecutableTask,
    userContext?: string
  ): Promise<ExecutableTask> {
    const prompt = `请对以下任务进行深度心理评估，分析执行者的心理边界、勇气和权力许可：

任务名称：${task.title}
任务描述：${task.description}
预计耗时：${task.estimatedTime}分钟
所需资源：${task.requiredResources.map(r => r.description).join('、') || '未明确'}

${userContext ? `用户背景：${userContext}` : ''}

请从以下三个维度进行深度分析：

## 1. 心理边界评估（敢不敢做）
分析执行这个任务需要突破哪些心理边界：
- 恐惧因素（失败恐惧、社交恐惧、未知恐惧等）
- 习惯边界（舒适区、惯性思维等）
- 信念限制（自我设限、能力怀疑等）
- 触发场景（什么情况下会感到不适）

## 2. 勇气/动机评估（有没有勇气挑战）
分析执行者挑战这个困难的内在动力：
- 总体勇气值（0-100）
- 动机水平（0-100）及来源
- 挑战准备度（0-100）
- 心理韧性（0-100）
- 成长型思维程度（0-100）
- 恐惧因素及克服策略
- 历史成功经验参考

## 3. 权力/许可评估（有没有权力做）
分析执行者是否有权限执行此任务：
- 是否有决策权
- 权力等级（0-100）
- 是否需要上级/他人批准
- 组织约束条件
- 法律/合规约束
- 伦理考量
- 越权风险评估（0-100）

输出格式：

【心理边界】
- 边界1：描述 | 类型(fear/habit/belief/comfort_zone) | 严重程度(0-100) | 触发场景 | 影响
- 边界2：...

【勇气评估】
总体勇气值：（0-100）
动机水平：（0-100）
动机来源：来源1、来源2...
挑战准备度：（0-100）
心理韧性：（0-100）
成长型思维：（0-100）
恐惧因素：
- 恐惧1：描述 | 强度(0-100) | 可克服(是/否) | 克服策略
- 恐惧2：...
历史成功经验：
- 经验1：场景 | 成就 | 信心提升值(0-100)

【权力许可】
是否有决策权：（是/否）
权力等级：（0-100）
是否需要批准：（是/否）
需要批准人：批准人1、批准人2...
组织约束：约束1、约束2...
法律约束：约束1、约束2...
伦理考量：考量1、考量2...
越权风险：（0-100）

【综合评估】
总体心理准备度：（0-100）
限制因素：因素1、因素2...
促进因素：因素1、因素2...
心理建设建议：建议1、建议2...
需要的支持：支持1、支持2...`;

    const messages: ChatMessage[] = [
      {
        id: crypto.randomUUID(),
        role: 'system',
        content: '你是专业的心理评估专家，擅长分析个人在执行任务时的心理状态、内在障碍和权限边界。',
        timestamp: new Date(),
      },
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: prompt,
        timestamp: new Date(),
      },
    ];

    let fullResponse = '';

    return new Promise((resolve) => {
      apiService.streamChat(
        messages,
        (chunk) => {
          fullResponse += chunk;
        },
        () => {
          const psychologicalAssessment = this.parsePsychologicalAssessmentFromResponse(fullResponse);
          resolve({
            ...task,
            psychologicalAssessment,
          });
        },
        () => {
          // 评估失败时返回基础评估
          resolve({
            ...task,
            psychologicalAssessment: this.getDefaultPsychologicalAssessment(),
          });
        }
      );
    });
  }

  static parsePsychologicalAssessmentFromResponse(response: string): PsychologicalAssessment {
    // 解析心理边界
    const mentalBoundaries: MentalBoundary[] = [];
    const boundarySection = response.match(/【心理边界】([\s\S]*?)(?=【勇气评估】|$)/i);
    if (boundarySection) {
      const lines = boundarySection[1].split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
          const parts = trimmed.substring(1).split('|').map(p => p.trim());
          if (parts.length >= 2) {
            mentalBoundaries.push({
              boundary: parts[0],
              type: (parts[1] as MentalBoundary['type']) || 'fear',
              severity: parseInt(parts[2]) || 50,
              triggers: parts[3] ? parts[3].split('、') : [],
              impact: parts[4] || '影响任务执行',
            });
          }
        }
      }
    }

    // 解析勇气评估
    const courageMatch = response.match(/总体勇气值[：:]\s*(\d+)/i);
    const motivationMatch = response.match(/动机水平[：:]\s*(\d+)/i);
    const readinessMatch = response.match(/挑战准备度[：:]\s*(\d+)/i);
    const resilienceMatch = response.match(/心理韧性[：:]\s*(\d+)/i);
    const growthMatch = response.match(/成长型思维[：:]\s*(\d+)/i);
    const motivationSourcesMatch = response.match(/动机来源[：:]\s*(.+)/i);

    const fearFactors: CourageAssessment['fearFactors'] = [];
    const fearSection = response.match(/恐惧因素[：:]([\s\S]*?)(?=历史成功经验|$)/i);
    if (fearSection) {
      const lines = fearSection[1].split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
          const parts = trimmed.substring(1).split('|').map(p => p.trim());
          if (parts.length >= 2) {
            fearFactors.push({
              factor: parts[0],
              intensity: parseInt(parts[1]) || 50,
              canOvercome: parts[2]?.includes('是') || false,
              overcomingStrategy: parts[3],
            });
          }
        }
      }
    }

    const historicalSuccess: CourageAssessment['historicalSuccess'] = [];
    const successSection = response.match(/历史成功经验[：:]([\s\S]*?)(?=【权力许可】|$)/i);
    if (successSection) {
      const lines = successSection[1].split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
          const parts = trimmed.substring(1).split('|').map(p => p.trim());
          if (parts.length >= 2) {
            historicalSuccess.push({
              context: parts[0],
              achievement: parts[1],
              confidenceBoost: parseInt(parts[2]) || 50,
            });
          }
        }
      }
    }

    const courage: CourageAssessment = {
      overallCourage: courageMatch ? parseInt(courageMatch[1]) : 70,
      motivationLevel: motivationMatch ? parseInt(motivationMatch[1]) : 70,
      motivationSources: motivationSourcesMatch ? motivationSourcesMatch[1].split('、') : ['内在驱动'],
      challengeReadiness: readinessMatch ? parseInt(readinessMatch[1]) : 70,
      resilience: resilienceMatch ? parseInt(resilienceMatch[1]) : 70,
      growthMindset: growthMatch ? parseInt(growthMatch[1]) : 70,
      fearFactors: fearFactors.length > 0 ? fearFactors : [{ factor: '未知恐惧', intensity: 50, canOvercome: true }],
      historicalSuccess: historicalSuccess.length > 0 ? historicalSuccess : [],
    };

    // 解析权力许可
    const authorityMatch = response.match(/是否有决策权[：:]\s*(是|否)/i);
    const authorityLevelMatch = response.match(/权力等级[：:]\s*(\d+)/i);
    const approvalMatch = response.match(/是否需要批准[：:]\s*(是|否)/i);
    const riskMatch = response.match(/越权风险[：:]\s*(\d+)/i);
    const approversMatch = response.match(/需要批准人[：:]\s*(.+)/i);
    const orgConstraintsMatch = response.match(/组织约束[：:]\s*(.+)/i);
    const legalConstraintsMatch = response.match(/法律约束[：:]\s*(.+)/i);
    const ethicalMatch = response.match(/伦理考量[：:]\s*(.+)/i);

    const permission: PermissionAssessment = {
      hasAuthority: authorityMatch ? authorityMatch[1] === '是' : true,
      authorityLevel: authorityLevelMatch ? parseInt(authorityLevelMatch[1]) : 80,
      requiresApproval: approvalMatch ? approvalMatch[1] === '是' : false,
      approvers: approversMatch ? approversMatch[1].split('、') : undefined,
      organizationalConstraints: orgConstraintsMatch ? orgConstraintsMatch[1].split('、') : [],
      legalConstraints: legalConstraintsMatch ? legalConstraintsMatch[1].split('、') : [],
      ethicalConsiderations: ethicalMatch ? ethicalMatch[1].split('、') : [],
      implicitPermissions: [],
      riskOfOverstepping: riskMatch ? parseInt(riskMatch[1]) : 20,
    };

    // 解析综合评估
    const overallReadinessMatch = response.match(/总体心理准备度[：:]\s*(\d+)/i);
    const limitingMatch = response.match(/限制因素[：:]\s*(.+)/i);
    const enablingMatch = response.match(/促进因素[：:]\s*(.+)/i);
    const recommendationsMatch = response.match(/心理建设建议[：:]\s*(.+)/i);
    const supportMatch = response.match(/需要的支持[：:]\s*(.+)/i);

    return {
      mentalBoundaries: mentalBoundaries.length > 0 ? mentalBoundaries : [],
      courage,
      permission,
      overallReadiness: overallReadinessMatch ? parseInt(overallReadinessMatch[1]) : 70,
      limitingFactors: limitingMatch ? limitingMatch[1].split('、') : [],
      enablingFactors: enablingMatch ? enablingMatch[1].split('、') : ['内在动机'],
      recommendations: recommendationsMatch ? recommendationsMatch[1].split('、') : ['逐步建立信心'],
      supportNeeded: supportMatch ? supportMatch[1].split('、') : [],
    };
  }

  static getDefaultPsychologicalAssessment(): PsychologicalAssessment {
    return {
      mentalBoundaries: [],
      courage: {
        overallCourage: 70,
        motivationLevel: 70,
        motivationSources: ['目标驱动'],
        challengeReadiness: 70,
        resilience: 70,
        growthMindset: 70,
        fearFactors: [{ factor: '一般性焦虑', intensity: 30, canOvercome: true }],
        historicalSuccess: [],
      },
      permission: {
        hasAuthority: true,
        authorityLevel: 80,
        requiresApproval: false,
        organizationalConstraints: [],
        legalConstraints: [],
        ethicalConsiderations: [],
        implicitPermissions: [],
        riskOfOverstepping: 20,
      },
      overallReadiness: 70,
      limitingFactors: [],
      enablingFactors: ['积极态度'],
      recommendations: ['循序渐进'],
      supportNeeded: [],
    };
  }

  // ========== 记忆管理 ==========

  static getMemories(agentId?: string): AgentMemory[] {
    try {
      const saved = localStorage.getItem(this.MEMORY_STORAGE_KEY);
      if (saved) {
        const memories = JSON.parse(saved);
        const parsed = memories.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        return agentId ? parsed.filter((m: AgentMemory) => m.agentId === agentId) : parsed;
      }
    } catch (error) {
      console.error('加载记忆失败:', error);
    }
    return [];
  }

  static saveMemory(memory: AgentMemory) {
    const memories = this.getMemories();
    memories.push(memory);
    
    // 限制记忆数量
    const maxMemories = 1000;
    if (memories.length > maxMemories) {
      memories.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      memories.splice(maxMemories);
    }
    
    try {
      localStorage.setItem(this.MEMORY_STORAGE_KEY, JSON.stringify(memories));
    } catch (error) {
      console.error('保存记忆失败:', error);
    }
  }

  // ========== 实例管理 ==========

  static getInstances(): WorkflowInstance[] {
    try {
      const saved = localStorage.getItem(this.INSTANCE_STORAGE_KEY);
      if (saved) {
        const instances = JSON.parse(saved);
        return instances.map((inst: any) => ({
          ...inst,
          startedAt: new Date(inst.startedAt),
          completedAt: inst.completedAt ? new Date(inst.completedAt) : undefined,
          tasks: inst.tasks.map((t: any) => ({
            ...t,
            createdAt: new Date(t.createdAt),
            completedAt: t.completedAt ? new Date(t.completedAt) : undefined,
          })),
        }));
      }
    } catch (error) {
      console.error('加载实例失败:', error);
    }
    return [];
  }

  static saveInstance(instance: WorkflowInstance) {
    const instances = this.getInstances();
    const index = instances.findIndex(i => i.id === instance.id);
    
    if (index >= 0) {
      instances[index] = instance;
    } else {
      instances.push(instance);
    }
    
    // 限制实例数量
    const maxInstances = 50;
    if (instances.length > maxInstances) {
      instances.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
      instances.splice(maxInstances);
    }
    
    try {
      localStorage.setItem(this.INSTANCE_STORAGE_KEY, JSON.stringify(instances));
    } catch (error) {
      console.error('保存实例失败:', error);
    }
  }

  static deleteInstance(instanceId: string): boolean {
    try {
      const instances = this.getInstances();
      const filteredInstances = instances.filter(i => i.id !== instanceId);
      
      if (filteredInstances.length === instances.length) {
        return false; // 没有找到要删除的实例
      }
      
      localStorage.setItem(this.INSTANCE_STORAGE_KEY, JSON.stringify(filteredInstances));
      return true;
    } catch (error) {
      console.error('删除实例失败:', error);
      return false;
    }
  }

  static clearAllInstances(): boolean {
    try {
      localStorage.removeItem(this.INSTANCE_STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('清空所有实例失败:', error);
      return false;
    }
  }

  // ========== 任务导出 ==========

  static exportTasksToProtocol(tasks: ExecutableTask[]): string {
    return tasks.map((task, index) => {
      const priorityEmoji = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
      return `${index + 1}. ${priorityEmoji} ${task.title}
   ⏱️ ${task.estimatedTime}分钟 | ✅ ${task.verificationCriteria}`;
    }).join('\n\n');
  }

  static async importTasksToSystem(tasks: ExecutableTask[]): Promise<boolean> {
    // 这里可以集成到现有的 ProtocolContext
    // 暂时返回成功，实际实现需要调用 ProtocolContext 的方法
    console.log('导入任务到系统:', tasks);
    return true;
  }

  // ========== 目标对象管理 ==========

  static getTargetPersonas(): TargetPersona[] {
    try {
      const saved = localStorage.getItem(this.PERSONA_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('加载目标对象失败:', error);
    }
    return TARGET_PERSONAS;
  }

  static saveTargetPersonas(personas: TargetPersona[]) {
    try {
      localStorage.setItem(this.PERSONA_STORAGE_KEY, JSON.stringify(personas));
    } catch (error) {
      console.error('保存目标对象失败:', error);
    }
  }

  // ========== 模拟反馈功能 ==========

  static async generateSimulatedFeedback(
    agent: AgentModule,
    output: string,
    context: WorkflowContext,
    persona: TargetPersona,
    iteration: number = 1
  ): Promise<SimulatedFeedback> {
    const feedbackPrompt = `你是${persona.name}，${persona.description}

你的特征：${persona.characteristics.join('、')}
你的痛点：${persona.painPoints.join('、')}
你的期望：${persona.expectations.join('、')}

现在有一个${agent.name}为你生成了以下内容：

---
${output}
---

请从${persona.name}的角度，对以上内容进行评估和反馈。

反馈风格：${persona.feedbackStyle === 'critical' ? '批判性 - 指出问题和不足' : persona.feedbackStyle === 'supportive' ? '支持性 - 鼓励为主，温和建议' : persona.feedbackStyle === 'neutral' ? '中立 - 客观评价' : '详细 - 全面细致的分析'}

请按以下格式输出：

总体评分：（0-100分）

总体评价：（简要评价）

关注点：（列出你关心的3-5个点）
- 关注点1
- 关注点2
...

改进建议：（具体的改进建议）
- 建议1
- 建议2
...

是否满意：（是/否/部分满意）`;

    const messages: ChatMessage[] = [
      {
        id: crypto.randomUUID(),
        role: 'system',
        content: feedbackPrompt,
        timestamp: new Date(),
      },
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: '请提供你的反馈',
        timestamp: new Date(),
      },
    ];

    let fullResponse = '';

    return new Promise((resolve, reject) => {
      apiService.streamChat(
        messages,
        (chunk) => {
          fullResponse += chunk;
        },
        () => {
          const feedback = this.parseFeedbackFromResponse(fullResponse, persona.feedbackStyle);
          resolve({
            id: crypto.randomUUID(),
            agentId: agent.id,
            targetPersonaId: persona.id,
            originalOutput: output,
            feedback: feedback.summary,
            score: feedback.score,
            concerns: feedback.concerns,
            suggestions: feedback.suggestions,
            timestamp: new Date(),
            iteration,
          });
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  static parseFeedbackFromResponse(
    response: string,
    style: TargetPersona['feedbackStyle']
  ): { summary: string; score: number; concerns: string[]; suggestions: string[] } {
    // 提取评分
    const scoreMatch = response.match(/评分[：:]\s*(\d+)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 70;

    // 提取关注点
    const concerns: string[] = [];
    const concernMatch = response.match(/关注点[：:]([\s\S]*?)(?=改进建议|是否满意|$)/i);
    if (concernMatch) {
      const lines = concernMatch[1].split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
          concerns.push(trimmed.substring(1).trim());
        }
      }
    }

    // 提取建议
    const suggestions: string[] = [];
    const suggestionMatch = response.match(/改进建议[：:]([\s\S]*?)(?=是否满意|$)/i);
    if (suggestionMatch) {
      const lines = suggestionMatch[1].split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
          suggestions.push(trimmed.substring(1).trim());
        }
      }
    }

    // 生成摘要
    const summary = response.slice(0, 200) + (response.length > 200 ? '...' : '');

    return { summary, score, concerns, suggestions };
  }

  static async executeAgentWithFeedback(
    agent: AgentModule,
    context: WorkflowContext,
    onProgress?: (message: string) => void
  ): Promise<{ output: string; feedbacks: SimulatedFeedback[]; finalScore: number }> {
    if (!agent.simulationConfig.enabled || agent.simulationConfig.targetPersonas.length === 0) {
      // 如果没有启用反馈模拟，直接执行
      const result = await this.executeAgent(agent, context);
      return { output: result.summary, feedbacks: [], finalScore: 100 };
    }

    const personas = this.getTargetPersonas().filter(p => 
      agent.simulationConfig.targetPersonas.includes(p.id)
    );

    let currentOutput = '';
    const allFeedbacks: SimulatedFeedback[] = [];
    let iteration = 1;

    // 初始执行
    onProgress?.(`🤖 ${agent.name} 正在生成内容...`);
    const initialResult = await this.executeAgent(agent, context);
    currentOutput = initialResult.summary;

    // 收集反馈
    for (const persona of personas) {
      onProgress?.(`🎭 ${persona.name} 正在评估...`);
      const feedback = await this.generateSimulatedFeedback(
        agent,
        currentOutput,
        context,
        persona,
        iteration
      );
      allFeedbacks.push(feedback);
      onProgress?.(`📊 ${persona.name} 评分: ${feedback.score}/100`);
    }

    // 计算平均分数
    const avgScore = allFeedbacks.reduce((sum, f) => sum + f.score, 0) / allFeedbacks.length;

    // 如果需要自动迭代且分数不达标
    if (
      agent.simulationConfig.autoIterate &&
      avgScore < agent.simulationConfig.minScoreThreshold &&
      iteration < agent.simulationConfig.maxIterations
    ) {
      onProgress?.(`🔄 平均分 ${avgScore.toFixed(1)} 低于阈值，开始优化...`);
      
      // 构建优化提示
      const optimizationPrompt = `基于以下反馈优化你的输出：\n\n${allFeedbacks.map(f => 
        `[${f.feedback.slice(0, 100)}... 评分: ${f.score}]`
      ).join('\n')}`;

      context.accumulatedInsights.push(optimizationPrompt);
      
      // 重新执行
      const optimizedResult = await this.executeAgent(agent, context);
      currentOutput = optimizedResult.summary;
      iteration++;
    }

    return { output: currentOutput, feedbacks: allFeedbacks, finalScore: avgScore };
  }

  static getFeedbacks(agentId?: string): SimulatedFeedback[] {
    try {
      const saved = localStorage.getItem(this.FEEDBACK_STORAGE_KEY);
      if (saved) {
        const feedbacks = JSON.parse(saved);
        const parsed = feedbacks.map((f: any) => ({
          ...f,
          timestamp: new Date(f.timestamp),
        }));
        return agentId ? parsed.filter((f: SimulatedFeedback) => f.agentId === agentId) : parsed;
      }
    } catch (error) {
      console.error('加载反馈失败:', error);
    }
    return [];
  }

  static saveFeedback(feedback: SimulatedFeedback) {
    const feedbacks = this.getFeedbacks();
    feedbacks.push(feedback);
    
    // 限制反馈数量
    const maxFeedbacks = 500;
    if (feedbacks.length > maxFeedbacks) {
      feedbacks.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      feedbacks.splice(maxFeedbacks);
    }
    
    try {
      localStorage.setItem(this.FEEDBACK_STORAGE_KEY, JSON.stringify(feedbacks));
    } catch (error) {
      console.error('保存反馈失败:', error);
    }
  }
}

// 导出便捷方法
export const agentWorkflow = AgentWorkflowService;
