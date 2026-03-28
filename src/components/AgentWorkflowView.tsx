import React, { useState, useEffect, useRef } from 'react';
import { AgentModule, Workflow, WorkflowInstance, ExecutableTask } from '../types/agent';
import { agentWorkflow } from '../services/agentWorkflowService';

interface AgentNode {
  id: string;
  agent: AgentModule;
  x: number;
  y: number;
  status: 'idle' | 'running' | 'completed' | 'error';
  output?: string;
}

interface Connection {
  from: string;
  to: string;
}

export default function AgentWorkflowView() {
  // 状态管理
  const [agents, setAgents] = useState<AgentModule[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [currentInstance, setCurrentInstance] = useState<WorkflowInstance | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showWorkflowBuilder, setShowWorkflowBuilder] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState<ExecutableTask[]>([]);
  const [activeTab, setActiveTab] = useState<'workflows' | 'agents' | 'history'>('workflows');
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [viewingInstance, setViewingInstance] = useState<WorkflowInstance | null>(null);

  // 工作流构建器状态
  const [builderNodes, setBuilderNodes] = useState<AgentNode[]>([]);
  const [builderConnections, setBuilderConnections] = useState<Connection[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const builderRef = useRef<HTMLDivElement>(null);

  // 初始化
  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const savedAgents = agentWorkflow.getAgents();
    if (savedAgents.length === 0) {
      const defaultAgents = agentWorkflow.initializeDefaultAgents();
      setAgents(defaultAgents);
    } else {
      setAgents(savedAgents);
    }

    setWorkflows(agentWorkflow.getWorkflows());
    setInstances(agentWorkflow.getInstances());
  };

  // 执行工作流
  const executeWorkflow = async (workflow: Workflow) => {
    if (!inputText.trim()) {
      alert('请输入需求描述');
      return;
    }

    setIsExecuting(true);
    setGeneratedTasks([]);

    try {
      const instance = await agentWorkflow.executeWorkflow(
        workflow,
        inputText,
        (inst, agent) => {
          setCurrentInstance({ ...inst });
          // 更新节点状态
          updateNodeStatus(agent.id, 'running');
        }
      );

      setCurrentInstance(instance);
      setGeneratedTasks(instance.tasks);
      setInstances(agentWorkflow.getInstances());

      // 标记所有节点完成
      workflow.agentIds.forEach(id => updateNodeStatus(id, 'completed'));
    } catch (error) {
      console.error('执行失败:', error);
      alert('工作流执行失败');
    } finally {
      setIsExecuting(false);
    }
  };

  const updateNodeStatus = (agentId: string, status: AgentNode['status']) => {
    setBuilderNodes(prev =>
      prev.map(node =>
        node.agent.id === agentId ? { ...node, status } : node
      )
    );
  };

  // 工作流构建器功能
  const addNodeToBuilder = (agent: AgentModule) => {
    const newNode: AgentNode = {
      id: crypto.randomUUID(),
      agent,
      x: 100 + builderNodes.length * 200,
      y: 200 + (builderNodes.length % 2) * 150,
      status: 'idle',
    };
    setBuilderNodes(prev => [...prev, newNode]);
  };

  const removeNode = (nodeId: string) => {
    setBuilderNodes(prev => prev.filter(n => n.id !== nodeId));
    setBuilderConnections(prev =>
      prev.filter(c => c.from !== nodeId && c.to !== nodeId)
    );
  };

  const startConnection = (nodeId: string) => {
    if (isConnecting && connectingFrom) {
      // 完成连接
      if (connectingFrom !== nodeId) {
        setBuilderConnections(prev => [
          ...prev,
          { from: connectingFrom, to: nodeId },
        ]);
      }
      setIsConnecting(false);
      setConnectingFrom(null);
    } else {
      // 开始连接
      setIsConnecting(true);
      setConnectingFrom(nodeId);
    }
  };

  const saveWorkflow = () => {
    if (builderNodes.length === 0) {
      alert('请至少添加一个智能体');
      return;
    }

    const name = prompt('请输入工作流名称：');
    if (!name) return;

    const workflow: Workflow = {
      id: crypto.randomUUID(),
      name,
      description: `包含 ${builderNodes.length} 个智能体的自定义工作流`,
      agentIds: builderNodes.map(n => n.agent.id),
      connections: builderConnections.map(c => ({
        from: builderNodes.find(n => n.id === c.from)?.agent.id || '',
        to: builderNodes.find(n => n.id === c.to)?.agent.id || '',
        dataMapping: {},
      })),
      autoExecute: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedWorkflows = [...workflows, workflow];
    agentWorkflow.saveWorkflows(updatedWorkflows);
    setWorkflows(updatedWorkflows);
    setShowWorkflowBuilder(false);
    setBuilderNodes([]);
    setBuilderConnections([]);
  };

  const deleteWorkflow = (id: string) => {
    if (!confirm('确定要删除这个工作流吗？')) return;
    const updated = workflows.filter(w => w.id !== id);
    agentWorkflow.saveWorkflows(updated);
    setWorkflows(updated);
  };

  const importTasksToProtocol = (tasks?: ExecutableTask[]) => {
    const tasksToImport = tasks || generatedTasks;
    if (tasksToImport.length === 0) {
      alert('没有可导入的任务');
      return;
    }

    const taskText = agentWorkflow.exportTasksToProtocol(tasksToImport);
    navigator.clipboard.writeText(taskText);
    alert(`已复制 ${tasksToImport.length} 个任务到剪贴板，可以粘贴到行动协议中`);
  };

  const importSelectedTasksToProtocol = () => {
    if (selectedTasks.size === 0) {
      alert('请先选择任务');
      return;
    }
    const tasksToImport = generatedTasks.filter(task => selectedTasks.has(task.id));
    importTasksToProtocol(tasksToImport);
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const selectAllTasks = () => {
    if (selectedTasks.size === generatedTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(generatedTasks.map(t => t.id)));
    }
  };

  const viewInstanceDetails = (instance: WorkflowInstance) => {
    setViewingInstance(instance);
    setGeneratedTasks(instance.tasks);
    setSelectedTasks(new Set());
  };

  // 渲染工作流卡片
  const renderWorkflowCard = (workflow: Workflow) => (
    <div
      key={workflow.id}
      className="bg-white rounded-xl shadow-md p-5 hover:shadow-lg transition-shadow border border-gray-100"
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-bold text-lg text-gray-800">{workflow.name}</h3>
        <button
          onClick={() => deleteWorkflow(workflow.id)}
          className="text-gray-400 hover:text-red-500 transition-colors"
        >
          ✕
        </button>
      </div>
      <p className="text-gray-600 text-sm mb-4">{workflow.description}</p>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs bg-golden/10 text-golden px-2 py-1 rounded-full">
          {workflow.agentIds.length} 个智能体
        </span>
      </div>
      <button
        onClick={() => setSelectedWorkflow(workflow)}
        className="w-full py-2 bg-golden text-white rounded-lg hover:opacity-90 transition-opacity"
      >
        选择执行
      </button>
    </div>
  );

  // 智能体管理状态
  const [showAgentEditor, setShowAgentEditor] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentModule | null>(null);
  const [showAgentGenerator, setShowAgentGenerator] = useState(false);
  const [agentForm, setAgentForm] = useState<Partial<AgentModule>>({
    name: '',
    icon: '🤖',
    role: 'analyzer',
    description: '',
    systemPrompt: '',
    capabilities: [],
    inputFormat: '',
    outputFormat: '',
    taskGeneration: {
      enabled: true,
      template: '',
      defaultPriority: 'medium',
    },
    memoryConfig: {
      maxMessages: 50,
      extractSummary: true,
      shareable: true,
    },
  });
  const [newCapability, setNewCapability] = useState('');
  
  // AI生成智能体状态
  const [agentGenDescription, setAgentGenDescription] = useState('');
  const [agentGenRole, setAgentGenRole] = useState('analyzer');
  const [agentGenProgress, setAgentGenProgress] = useState('');
  const [isGeneratingAgent, setIsGeneratingAgent] = useState(false);

  // 打开智能体编辑器
  const openAgentEditor = (agent?: AgentModule) => {
    if (agent) {
      setEditingAgent(agent);
      setAgentForm({ ...agent });
    } else {
      setEditingAgent(null);
      setAgentForm({
        name: '',
        icon: '🤖',
        role: 'analyzer',
        description: '',
        systemPrompt: '',
        capabilities: [],
        inputFormat: '',
        outputFormat: '',
        taskGeneration: {
          enabled: true,
          template: '',
          defaultPriority: 'medium',
        },
        memoryConfig: {
          maxMessages: 50,
          extractSummary: true,
          shareable: true,
        },
      });
    }
    setShowAgentEditor(true);
  };

  // 保存智能体
  const saveAgent = () => {
    if (!agentForm.name || !agentForm.systemPrompt) {
      alert('请填写名称和系统提示词');
      return;
    }

    if (editingAgent) {
      agentWorkflow.updateAgent(editingAgent.id, agentForm);
    } else {
      agentWorkflow.createAgent(agentForm);
    }
    
    loadData();
    setShowAgentEditor(false);
    setEditingAgent(null);
  };

  // 删除智能体
  const deleteAgent = (agentId: string) => {
    if (confirm('确定要删除这个智能体吗？')) {
      agentWorkflow.deleteAgent(agentId);
      loadData();
    }
  };

  // 复制智能体
  const duplicateAgent = (agentId: string) => {
    agentWorkflow.duplicateAgent(agentId);
    loadData();
  };

  // 导出智能体
  const exportAgent = (agent: AgentModule) => {
    const json = agentWorkflow.exportAgent(agent.id);
    if (json) {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${agent.name.replace(/\s+/g, '_')}_agent.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // 导入智能体
  const importAgent = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const agent = agentWorkflow.importAgent(content);
      if (agent) {
        loadData();
        alert('智能体导入成功！');
      } else {
        alert('导入失败，请检查文件格式');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // AI生成智能体
  const generateAgentWithAI = async () => {
    if (!agentGenDescription) {
      alert('请描述你想要的智能体');
      return;
    }

    setIsGeneratingAgent(true);
    setAgentGenProgress('');

    const config = await agentWorkflow.generateAgentWithAI(
      agentGenDescription,
      agentGenRole,
      (msg) => setAgentGenProgress(msg)
    );

    if (config) {
      setAgentForm({
        ...agentForm,
        ...config,
      });
      setShowAgentGenerator(false);
      setShowAgentEditor(true);
    }

    setIsGeneratingAgent(false);
  };

  // 添加能力
  const addCapability = () => {
    if (newCapability && !agentForm.capabilities?.includes(newCapability)) {
      setAgentForm({
        ...agentForm,
        capabilities: [...(agentForm.capabilities || []), newCapability],
      });
      setNewCapability('');
    }
  };

  // 移除能力
  const removeCapability = (cap: string) => {
    setAgentForm({
      ...agentForm,
      capabilities: agentForm.capabilities?.filter(c => c !== cap) || [],
    });
  };

  // 渲染智能体卡片
  const renderAgentCard = (agent: AgentModule) => (
    <div
      key={agent.id}
      className="bg-white rounded-xl shadow-md p-4 border border-gray-100 hover:border-golden transition-colors group"
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{agent.icon}</span>
        <div className="flex-1">
          <h4 className="font-semibold text-gray-800">{agent.name}</h4>
          <span className="text-xs text-gray-500 capitalize">{agent.role}</span>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => openAgentEditor(agent)}
            className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
            title="编辑"
          >
            ✏️
          </button>
          <button
            onClick={() => duplicateAgent(agent.id)}
            className="p-1 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded"
            title="复制"
          >
            📋
          </button>
          <button
            onClick={() => exportAgent(agent)}
            className="p-1 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded"
            title="导出"
          >
            💾
          </button>
          <button
            onClick={() => deleteAgent(agent.id)}
            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
            title="删除"
          >
            🗑️
          </button>
        </div>
      </div>
      <p className="text-gray-600 text-sm mb-3">{agent.description}</p>
      <div className="flex flex-wrap gap-1">
        {agent.capabilities.slice(0, 3).map((cap, i) => (
          <span
            key={i}
            className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
          >
            {cap}
          </span>
        ))}
        {agent.capabilities.length > 3 && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
            +{agent.capabilities.length - 3}
          </span>
        )}
      </div>
    </div>
  );

  // 渲染工作流构建器
  const renderWorkflowBuilder = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-[90vw] h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold">工作流构建器</h2>
          <button
            onClick={() => setShowWorkflowBuilder(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 flex">
          {/* 左侧智能体列表 */}
          <div className="w-64 border-r p-4 overflow-y-auto">
            <h3 className="font-semibold mb-3">可用智能体</h3>
            <div className="space-y-2">
              {agents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => addNodeToBuilder(agent)}
                  className="w-full text-left p-3 rounded-lg border hover:border-golden hover:bg-golden/5 transition-colors"
                >
                  <span className="mr-2">{agent.icon}</span>
                  <span className="text-sm">{agent.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 画布区域 */}
          <div
            ref={builderRef}
            className="flex-1 relative bg-gray-50 overflow-hidden"
            onClick={() => {
              setIsConnecting(false);
              setConnectingFrom(null);
            }}
          >
            {/* 连接线 */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {builderConnections.map((conn, i) => {
                const fromNode = builderNodes.find(n => n.id === conn.from);
                const toNode = builderNodes.find(n => n.id === conn.to);
                if (!fromNode || !toNode) return null;
                return (
                  <line
                    key={i}
                    x1={fromNode.x + 75}
                    y1={fromNode.y + 40}
                    x2={toNode.x + 75}
                    y2={toNode.y + 40}
                    stroke="#d97706"
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                  />
                );
              })}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3, 0 6" fill="#d97706" />
                </marker>
              </defs>
            </svg>

            {/* 节点 */}
            {builderNodes.map(node => (
              <div
                key={node.id}
                className={`absolute w-[150px] p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  node.status === 'running'
                    ? 'border-blue-500 bg-blue-50'
                    : node.status === 'completed'
                    ? 'border-green-500 bg-green-50'
                    : node.status === 'error'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 bg-white hover:border-golden'
                } ${
                  isConnecting && connectingFrom === node.id ? 'ring-2 ring-blue-400' : ''
                }`}
                style={{ left: node.x, top: node.y }}
                onClick={(e) => {
                  e.stopPropagation();
                  startConnection(node.id);
                }}
              >
                <div className="flex items-center gap-2">
                  <span>{node.agent.icon}</span>
                  <span className="text-sm font-medium truncate">
                    {node.agent.name}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeNode(node.id);
                  }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
            ))}

            {/* 提示文字 */}
            {builderNodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                点击左侧智能体添加到画布
              </div>
            )}
            {isConnecting && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm">
                点击另一个智能体完成连接
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t flex justify-between">
          <button
            onClick={() => {
              setBuilderNodes([]);
              setBuilderConnections([]);
            }}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            清空画布
          </button>
          <button
            onClick={saveWorkflow}
            disabled={builderNodes.length === 0}
            className="px-6 py-2 bg-golden text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            保存工作流
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 头部 */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">思维智能体工作流</h1>
            <p className="text-gray-600 mt-1">组合多个AI智能体，自动生成可执行任务</p>
          </div>
          <button
            onClick={() => setShowWorkflowBuilder(true)}
            className="px-4 py-2 bg-golden text-white rounded-lg hover:opacity-90 flex items-center gap-2"
          >
            <span>+</span>
            创建工作流
          </button>
        </div>

        {/* 标签页 */}
        <div className="flex gap-4 mb-6 border-b">
          {(['workflows', 'agents', 'history'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === tab
                  ? 'text-golden border-b-2 border-golden'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'workflows' && '工作流'}
              {tab === 'agents' && '智能体'}
              {tab === 'history' && '执行历史'}
            </button>
          ))}
        </div>

        {/* 工作流标签页 */}
        {activeTab === 'workflows' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map(renderWorkflowCard)}
            {workflows.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                <p>暂无工作流，点击右上角创建工作流</p>
              </div>
            )}
          </div>
        )}

        {/* 智能体标签页 */}
        {activeTab === 'agents' && (
          <div>
            {/* 智能体管理工具栏 */}
            <div className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
              <button
                onClick={() => openAgentEditor()}
                className="flex items-center gap-2 px-4 py-2 bg-golden text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                <span>➕</span>
                <span>新建智能体</span>
              </button>
              <button
                onClick={() => setShowAgentGenerator(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                <span>✨</span>
                <span>AI生成智能体</span>
              </button>
              <label className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:opacity-90 transition-opacity cursor-pointer">
                <span>📥</span>
                <span>导入智能体</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={importAgent}
                  className="hidden"
                />
              </label>
              <div className="flex-1"></div>
              <span className="text-sm text-gray-600 self-center">
                共 {agents.length} 个智能体
              </span>
            </div>

            {/* 智能体卡片网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map(renderAgentCard)}
              {agents.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">
                  <p>暂无智能体，点击上方按钮创建</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 历史标签页 */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {/* 批量操作栏 */}
            {instances.length > 0 && (
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">
                  共 {instances.length} 条执行记录
                </span>
                <button
                  onClick={() => {
                    if (confirm('确定要清空所有执行历史吗？此操作不可恢复。')) {
                      agentWorkflow.clearAllInstances();
                      loadData();
                    }
                  }}
                  className="text-sm text-red-600 hover:text-red-700 px-3 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  🗑️ 清空全部
                </button>
              </div>
            )}
            
            {instances.map(inst => (
              <div
                key={inst.id}
                className="bg-white rounded-lg p-4 border border-gray-200 hover:border-golden hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start">
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => viewInstanceDetails(inst)}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs ${
                          inst.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : inst.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {inst.status === 'completed'
                          ? '已完成'
                          : inst.status === 'failed'
                          ? '失败'
                          : '运行中'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(inst.startedAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                      {inst.context.originalInput}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        viewInstanceDetails(inst);
                      }}
                      className="text-golden text-sm hover:underline"
                    >
                      查看详情
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('确定要删除这条执行记录吗？')) {
                          agentWorkflow.deleteInstance(inst.id);
                          loadData();
                        }
                      }}
                      className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                      title="删除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                {inst.tasks.length > 0 && (
                  <div 
                    className="mt-3 pt-3 border-t flex items-center justify-between cursor-pointer"
                    onClick={() => viewInstanceDetails(inst)}
                  >
                    <span className="text-xs text-gray-500">
                      生成了 {inst.tasks.length} 个任务
                    </span>
                    <span className="text-xs text-golden">
                      点击查看 →
                    </span>
                  </div>
                )}
              </div>
            ))}
            {instances.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>暂无执行记录</p>
              </div>
            )}
          </div>
        )}

        {/* 执行面板 */}
        {selectedWorkflow && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl w-[600px] max-h-[80vh] flex flex-col">
              <div className="flex justify-between items-center p-4 border-b">
                <h2 className="text-xl font-bold">执行工作流：{selectedWorkflow.name}</h2>
                <button
                  onClick={() => {
                    setSelectedWorkflow(null);
                    setCurrentInstance(null);
                    setGeneratedTasks([]);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto">
                {/* 输入区域 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    输入你的需求或问题：
                  </label>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="例如：我想养成每天运动的习惯，但总是坚持不下来..."
                    className="w-full h-32 p-3 border rounded-lg resize-none focus:border-golden focus:ring-1 focus:ring-golden"
                    disabled={isExecuting}
                  />
                </div>

                {/* 执行进度 */}
                {isExecuting && currentInstance && (
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-blue-700">正在执行...</span>
                    </div>
                    <div className="text-sm text-blue-600">
                      步骤 {currentInstance.currentAgentIndex + 1} / {selectedWorkflow.agentIds.length}
                    </div>
                  </div>
                )}

                {/* 生成的任务 */}
                {generatedTasks.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <span>📋</span>
                        可执行任务 ({generatedTasks.length}个)
                        {selectedTasks.size > 0 && (
                          <span className="text-sm font-normal text-golden">
                            已选择 {selectedTasks.size} 个
                          </span>
                        )}
                      </h3>
                      <button
                        onClick={selectAllTasks}
                        className="text-sm text-golden hover:underline"
                      >
                        {selectedTasks.size === generatedTasks.length ? '取消全选' : '全选'}
                      </button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {generatedTasks.map((task, i) => (
                        <div
                          key={task.id}
                          onClick={() => toggleTaskSelection(task.id)}
                          className={`p-3 rounded-lg border-l-4 cursor-pointer transition-all ${
                            selectedTasks.has(task.id)
                              ? 'bg-golden/10 border-golden ring-1 ring-golden'
                              : 'bg-gray-50 border-gray-300 hover:border-golden/50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedTasks.has(task.id)}
                                  onChange={() => toggleTaskSelection(task.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-4 h-4 text-golden border-gray-300 rounded focus:ring-golden"
                                />
                                <span className="text-sm font-medium text-gray-500">#{i + 1}</span>
                                <span className="font-medium">{task.title}</span>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    task.priority === 'high'
                                      ? 'bg-red-100 text-red-700'
                                      : task.priority === 'medium'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-green-100 text-green-700'
                                  }`}
                                >
                                  {task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                <span>⏱️ {task.estimatedTime}分钟</span>
                                <span>✅ {task.verificationCriteria}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => importTasksToProtocol()}
                        className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        复制全部 ({generatedTasks.length})
                      </button>
                      <button
                        onClick={importSelectedTasksToProtocol}
                        disabled={selectedTasks.size === 0}
                        className="flex-1 py-2 bg-golden text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        复制选中 ({selectedTasks.size})
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t">
                <button
                  onClick={() => executeWorkflow(selectedWorkflow)}
                  disabled={isExecuting || !inputText.trim()}
                  className="w-full py-3 bg-golden text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isExecuting ? '执行中...' : '开始执行'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 工作流构建器 */}
        {showWorkflowBuilder && renderWorkflowBuilder()}

        {/* 历史记录详情弹窗 */}
        {viewingInstance && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl w-[700px] max-h-[85vh] flex flex-col">
              <div className="flex justify-between items-center p-4 border-b">
                <div>
                  <h2 className="text-xl font-bold">执行记录详情</h2>
                  <p className="text-sm text-gray-500">
                    {new Date(viewingInstance.startedAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setViewingInstance(null);
                    setGeneratedTasks([]);
                    setSelectedTasks(new Set());
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto">
                {/* 原始输入 */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <label className="text-sm font-medium text-gray-700">原始需求：</label>
                  <p className="text-sm text-gray-600 mt-1">{viewingInstance.context.originalInput}</p>
                </div>

                {/* 执行状态 */}
                <div className="mb-4 flex items-center gap-2">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs ${
                      viewingInstance.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : viewingInstance.status === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {viewingInstance.status === 'completed'
                      ? '已完成'
                      : viewingInstance.status === 'failed'
                      ? '失败'
                      : '运行中'}
                  </span>
                  <span className="text-sm text-gray-500">
                    生成了 {viewingInstance.tasks.length} 个任务
                  </span>
                </div>

                {/* 任务列表（复用上面的任务选择组件） */}
                {generatedTasks.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <span>📋</span>
                        任务列表 ({generatedTasks.length}个)
                        {selectedTasks.size > 0 && (
                          <span className="text-sm font-normal text-golden">
                            已选择 {selectedTasks.size} 个
                          </span>
                        )}
                      </h3>
                      <button
                        onClick={selectAllTasks}
                        className="text-sm text-golden hover:underline"
                      >
                        {selectedTasks.size === generatedTasks.length ? '取消全选' : '全选'}
                      </button>
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {generatedTasks.map((task, i) => (
                        <div
                          key={task.id}
                          onClick={() => toggleTaskSelection(task.id)}
                          className={`p-3 rounded-lg border-l-4 cursor-pointer transition-all ${
                            selectedTasks.has(task.id)
                              ? 'bg-golden/10 border-golden ring-1 ring-golden'
                              : 'bg-gray-50 border-gray-300 hover:border-golden/50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedTasks.has(task.id)}
                                  onChange={() => toggleTaskSelection(task.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-4 h-4 text-golden border-gray-300 rounded focus:ring-golden"
                                />
                                <span className="text-sm font-medium text-gray-500">#{i + 1}</span>
                                <span className="font-medium">{task.title}</span>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    task.priority === 'high'
                                      ? 'bg-red-100 text-red-700'
                                      : task.priority === 'medium'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-green-100 text-green-700'
                                  }`}
                                >
                                  {task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                <span>⏱️ {task.estimatedTime}分钟</span>
                                <span>✅ {task.verificationCriteria}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t flex gap-2">
                <button
                  onClick={() => importTasksToProtocol()}
                  className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  复制全部 ({generatedTasks.length})
                </button>
                <button
                  onClick={importSelectedTasksToProtocol}
                  disabled={selectedTasks.size === 0}
                  className="flex-1 py-2 bg-golden text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  复制选中 ({selectedTasks.size})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 智能体编辑器弹窗 */}
        {showAgentEditor && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl w-[800px] max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center p-4 border-b">
                <h2 className="text-xl font-bold">
                  {editingAgent ? `编辑智能体：${editingAgent.name}` : '新建智能体'}
                </h2>
                <button
                  onClick={() => {
                    setShowAgentEditor(false);
                    setEditingAgent(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto space-y-4">
                {/* 基本信息 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      名称 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={agentForm.name}
                      onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                      placeholder="例如：需求分析师"
                      className="w-full p-2 border rounded-lg focus:border-golden focus:ring-1 focus:ring-golden"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      图标
                    </label>
                    <input
                      type="text"
                      value={agentForm.icon}
                      onChange={(e) => setAgentForm({ ...agentForm, icon: e.target.value })}
                      placeholder="例如：🔍"
                      className="w-full p-2 border rounded-lg focus:border-golden focus:ring-1 focus:ring-golden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    角色类型
                  </label>
                  <select
                    value={agentForm.role}
                    onChange={(e) => setAgentForm({ ...agentForm, role: e.target.value as any })}
                    className="w-full p-2 border rounded-lg focus:border-golden focus:ring-1 focus:ring-golden"
                  >
                    <option value="analyzer">分析者 - 理解需求、拆解问题</option>
                    <option value="planner">规划者 - 制定方案、设计路径</option>
                    <option value="executor">执行者 - 具体行动、落地实施</option>
                    <option value="reviewer">审查者 - 评估风险、检查质量</option>
                    <option value="synthesizer">综合者 - 整合信息、生成结论</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    描述
                  </label>
                  <input
                    type="text"
                    value={agentForm.description}
                    onChange={(e) => setAgentForm({ ...agentForm, description: e.target.value })}
                    placeholder="简短描述这个智能体的功能"
                    className="w-full p-2 border rounded-lg focus:border-golden focus:ring-1 focus:ring-golden"
                  />
                </div>

                {/* 系统提示词 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    系统提示词 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={agentForm.systemPrompt}
                    onChange={(e) => setAgentForm({ ...agentForm, systemPrompt: e.target.value })}
                    placeholder="定义这个智能体的行为、能力和输出格式..."
                    rows={6}
                    className="w-full p-2 border rounded-lg resize-none focus:border-golden focus:ring-1 focus:ring-golden font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    系统提示词决定了智能体的行为和输出质量
                  </p>
                </div>

                {/* 能力标签 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    能力标签
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {agentForm.capabilities?.map((cap) => (
                      <span
                        key={cap}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
                      >
                        {cap}
                        <button
                          onClick={() => removeCapability(cap)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCapability}
                      onChange={(e) => setNewCapability(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addCapability()}
                      placeholder="添加能力标签"
                      className="flex-1 p-2 border rounded-lg focus:border-golden focus:ring-1 focus:ring-golden"
                    />
                    <button
                      onClick={addCapability}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      添加
                    </button>
                  </div>
                </div>

                {/* 输入输出格式 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      输入格式
                    </label>
                    <input
                      type="text"
                      value={agentForm.inputFormat}
                      onChange={(e) => setAgentForm({ ...agentForm, inputFormat: e.target.value })}
                      placeholder="期望的输入格式"
                      className="w-full p-2 border rounded-lg focus:border-golden focus:ring-1 focus:ring-golden"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      输出格式
                    </label>
                    <input
                      type="text"
                      value={agentForm.outputFormat}
                      onChange={(e) => setAgentForm({ ...agentForm, outputFormat: e.target.value })}
                      placeholder="期望的输出格式"
                      className="w-full p-2 border rounded-lg focus:border-golden focus:ring-1 focus:ring-golden"
                    />
                  </div>
                </div>

                {/* 任务生成配置 */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">任务生成配置</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="taskGenEnabled"
                        checked={agentForm.taskGeneration?.enabled}
                        onChange={(e) => setAgentForm({
                          ...agentForm,
                          taskGeneration: { ...agentForm.taskGeneration!, enabled: e.target.checked }
                        })}
                        className="w-4 h-4 text-golden border-gray-300 rounded focus:ring-golden"
                      />
                      <label htmlFor="taskGenEnabled" className="text-sm">启用任务生成</label>
                    </div>
                    {agentForm.taskGeneration?.enabled && (
                      <>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">
                            任务生成模板
                          </label>
                          <textarea
                            value={agentForm.taskGeneration?.template}
                            onChange={(e) => setAgentForm({
                              ...agentForm,
                              taskGeneration: { ...agentForm.taskGeneration!, template: e.target.value }
                            })}
                            placeholder="指导AI如何生成任务的提示词模板"
                            rows={3}
                            className="w-full p-2 border rounded-lg resize-none focus:border-golden focus:ring-1 focus:ring-golden text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">
                            默认优先级
                          </label>
                          <select
                            value={agentForm.taskGeneration?.defaultPriority}
                            onChange={(e) => setAgentForm({
                              ...agentForm,
                              taskGeneration: { ...agentForm.taskGeneration!, defaultPriority: e.target.value as any }
                            })}
                            className="w-full p-2 border rounded-lg focus:border-golden focus:ring-1 focus:ring-golden"
                          >
                            <option value="high">高</option>
                            <option value="medium">中</option>
                            <option value="low">低</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 记忆配置 */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">记忆配置</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        最大消息数
                      </label>
                      <input
                        type="number"
                        value={agentForm.memoryConfig?.maxMessages}
                        onChange={(e) => setAgentForm({
                          ...agentForm,
                          memoryConfig: { ...agentForm.memoryConfig!, maxMessages: parseInt(e.target.value) }
                        })}
                        min={10}
                        max={200}
                        className="w-full p-2 border rounded-lg focus:border-golden focus:ring-1 focus:ring-golden"
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={agentForm.memoryConfig?.extractSummary}
                          onChange={(e) => setAgentForm({
                            ...agentForm,
                            memoryConfig: { ...agentForm.memoryConfig!, extractSummary: e.target.checked }
                          })}
                          className="w-4 h-4 text-golden border-gray-300 rounded focus:ring-golden"
                        />
                        <span className="text-sm">自动提取摘要</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={agentForm.memoryConfig?.shareable}
                          onChange={(e) => setAgentForm({
                            ...agentForm,
                            memoryConfig: { ...agentForm.memoryConfig!, shareable: e.target.checked }
                          })}
                          className="w-4 h-4 text-golden border-gray-300 rounded focus:ring-golden"
                        />
                        <span className="text-sm">记忆可共享</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 p-4 border-t">
                <button
                  onClick={() => {
                    setShowAgentEditor(false);
                    setEditingAgent(null);
                  }}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={saveAgent}
                  className="flex-1 py-2 bg-golden text-white rounded-lg hover:opacity-90"
                >
                  {editingAgent ? '保存修改' : '创建智能体'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI生成智能体弹窗 */}
        {showAgentGenerator && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl w-[600px] max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center p-4 border-b">
                <h2 className="text-xl font-bold">✨ AI生成智能体</h2>
                <button
                  onClick={() => {
                    setShowAgentGenerator(false);
                    setAgentGenProgress('');
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    描述你想要的智能体
                  </label>
                  <textarea
                    value={agentGenDescription}
                    onChange={(e) => setAgentGenDescription(e.target.value)}
                    placeholder="例如：我想要一个专门帮助分析用户需求的智能体，它能够深入理解用户的痛点，提取关键信息..."
                    rows={4}
                    className="w-full p-3 border rounded-lg resize-none focus:border-golden focus:ring-1 focus:ring-golden"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    角色定位
                  </label>
                  <select
                    value={agentGenRole}
                    onChange={(e) => setAgentGenRole(e.target.value)}
                    className="w-full p-2 border rounded-lg focus:border-golden focus:ring-1 focus:ring-golden"
                  >
                    <option value="analyzer">分析者 - 理解需求、拆解问题</option>
                    <option value="planner">规划者 - 制定方案、设计路径</option>
                    <option value="executor">执行者 - 具体行动、落地实施</option>
                    <option value="reviewer">审查者 - 评估风险、检查质量</option>
                    <option value="synthesizer">综合者 - 整合信息、生成结论</option>
                  </select>
                </div>

                {agentGenProgress && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      {isGeneratingAgent && (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      )}
                      <span className="text-blue-700 text-sm">{agentGenProgress}</span>
                    </div>
                  </div>
                )}

                <div className="text-sm text-gray-500">
                  <p>AI将根据你的描述自动生成：</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>智能体名称和图标</li>
                    <li>详细的系统提示词</li>
                    <li>核心能力标签</li>
                    <li>任务生成模板</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3 p-4 border-t">
                <button
                  onClick={() => {
                    setShowAgentGenerator(false);
                    setAgentGenProgress('');
                  }}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  disabled={isGeneratingAgent}
                >
                  取消
                </button>
                <button
                  onClick={generateAgentWithAI}
                  disabled={isGeneratingAgent || !agentGenDescription}
                  className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingAgent ? '生成中...' : '开始生成'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
