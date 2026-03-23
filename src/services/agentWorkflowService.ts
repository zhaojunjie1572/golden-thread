import {
  AgentModule,
  Workflow,
  WorkflowInstance,
  WorkflowContext,
  ExecutableTask,
  AgentMemory,
  AGENT_TEMPLATES,
  WORKFLOW_TEMPLATES,
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

      tasks.push({
        id: crypto.randomUUID(),
        title: title.slice(0, 50),
        description: description.slice(0, 200),
        priority,
        estimatedTime,
        dependencies: [],
        requiredResources: [],
        verificationCriteria: verificationCriteria.slice(0, 100),
        status: 'pending',
        createdAt: new Date(),
        tags: [],
      });
    }

    return tasks;
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
}

// 导出便捷方法
export const agentWorkflow = AgentWorkflowService;