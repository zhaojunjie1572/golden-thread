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
      const resources: ResourceRequirement[] = [];
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

    const conditions: ConditionMatch[] = [];
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

    const missingResources: ResourceRequirement[] = [];
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
  ): Promise<ValueExchangeAssessment> {
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