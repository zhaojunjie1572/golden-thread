import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AgentModule, Workflow, WorkflowInstance, ExecutableTask, AGENT_TEMPLATES, WORKFLOW_TEMPLATES } from '../types/agent';
import { agentWorkflow } from '../services/agentWorkflowService';
import { apiService } from '../services/apiService';

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
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [showWorkflowBuilder, setShowWorkflowBuilder] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState<ExecutableTask[]>([]);
  const [activeTab, setActiveTab] = useState<'workflows' | 'agents' | 'history'>('workflows');

  // 工作流构建器状态
  const [builderNodes, setBuilderNodes] = useState<AgentNode[]>([]);
  const [builderConnections, setBuilderConnections] = useState<Connection[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
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
    setShowAgentSelector(false);
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

  const importTasksToProtocol = () => {
    if (generatedTasks.length === 0) {
      alert('没有可导入的任务');
      return;
    }

    const taskText = agentWorkflow.exportTasksToProtocol(generatedTasks);
    navigator.clipboard.writeText(taskText);
    alert(`已复制 ${generatedTasks.length} 个任务到剪贴板，可以粘贴到行动协议中`);
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

  // 渲染智能体卡片
  const renderAgentCard = (agent: AgentModule) => (
    <div
      key={agent.id}
      className="bg-white rounded-xl shadow-md p-4 border border-gray-100 hover:border-golden transition-colors"
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{agent.icon}</span>
        <div>
          <h4 className="font-semibold text-gray-800">{agent.name}</h4>
          <span className="text-xs text-gray-500 capitalize">{agent.role}</span>
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
                } ${selectedNode === node.id ? 'ring-2 ring-golden' : ''} ${
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(renderAgentCard)}
          </div>
        )}

        {/* 历史标签页 */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {instances.map(inst => (
              <div
                key={inst.id}
                className="bg-white rounded-lg p-4 border border-gray-200"
              >
                <div className="flex justify-between items-start">
                  <div>
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
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                      {inst.context.originalInput}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(inst.startedAt).toLocaleString()}
                  </span>
                </div>
                {inst.tasks.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <span className="text-xs text-gray-500">
                      生成了 {inst.tasks.length} 个任务
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
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <span>📋</span>
                      生成的可执行任务 ({generatedTasks.length}个)
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {generatedTasks.map((task, i) => (
                        <div
                          key={task.id}
                          className="p-3 bg-gray-50 rounded-lg border-l-4 border-golden"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
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

                    <button
                      onClick={importTasksToProtocol}
                      className="mt-4 w-full py-2 bg-golden text-white rounded-lg hover:opacity-90"
                    >
                      复制任务到剪贴板
                    </button>
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
      </div>
    </div>
  );
}
