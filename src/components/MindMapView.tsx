import React, { useState, useEffect, useRef } from 'react';
import { apiService, ChatMessage } from '../services/apiService';
import { ProtocolModel } from '../types/protocol';

interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
}

interface MindMapViewProps {
  protocol?: ProtocolModel;
  onClose: () => void;
}

export default function MindMapView({ protocol, onClose }: MindMapViewProps) {
  const [mindMapData, setMindMapData] = useState<MindMapNode | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(!apiService.hasApiKey());
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [showSourceText, setShowSourceText] = useState(false);
  const [sourceText, setSourceText] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // 编辑功能状态
  const [editingNode, setEditingNode] = useState<MindMapNode | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);
  
  // 拖拽和缩放状态
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const parseProtocolToText = (proto: ProtocolModel): string => {
    let text = `# ${proto.principle}\n\n`;
    text += `## 目标类型: ${proto.goalType}\n\n`;
    text += `## 触发机制\n`;
    text += `- 触发类型: ${proto.triggerType}\n`;
    text += `- 触发条件: ${proto.triggerCondition}\n`;
    if (proto.timeWindow) text += `- 时间窗口: ${proto.timeWindow}\n`;
    if (proto.reminderTime) text += `- 提醒时间: ${proto.reminderTime}\n`;
    text += `- 频率: ${proto.frequency}\n`;
    if (proto.psychologicalBoundary) text += `- 心理边界（不做）: ${proto.psychologicalBoundary}\n`;
    if (proto.actionPermission) text += `- 行动许可（可以做）: ${proto.actionPermission}\n\n`;
    
    text += `## 执行动作 - Plan A\n`;
    text += `- 标准动作: ${proto.action}\n`;
    text += `- 最小动作: ${proto.minimumAction}\n`;
    text += `- 最大时长: ${proto.maxDuration}分钟\n`;
    if (proto.locationConstraint) text += `- 地点约束: ${proto.locationConstraint}\n\n`;
    
    if (proto.actionPlanB) {
      text += `## 执行动作 - Plan B\n`;
      text += `- 标准动作: ${proto.actionPlanB}\n`;
      if (proto.minimumActionPlanB) text += `- 最小动作: ${proto.minimumActionPlanB}\n`;
      text += `- 最大时长: ${proto.maxDurationPlanB}分钟\n`;
      if (proto.locationConstraintPlanB) text += `- 地点约束: ${proto.locationConstraintPlanB}\n\n`;
    }
    
    if (proto.environmentPrep || proto.frictionReduce || proto.frictionIncrease) {
      text += `## 环境设计\n`;
      if (proto.environmentPrep) text += `- 事前准备: ${proto.environmentPrep}\n`;
      if (proto.frictionReduce) text += `- 降低阻力: ${proto.frictionReduce}\n`;
      if (proto.frictionIncrease) text += `- 增加阻力: ${proto.frictionIncrease}\n`;
    }
    
    return text;
  };

  useEffect(() => {
    if (protocol) {
      const text = parseProtocolToText(protocol);
      setSourceText(text);
    }
  }, [protocol]);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const parseMindMapFromText = (text: string): MindMapNode => {
    const lines = text.split('\n').filter(line => line.trim());
    const root: MindMapNode = {
      id: 'root',
      label: protocol?.principle || '思维导图',
      children: []
    };
    
    // 使用栈来跟踪当前路径
    const stack: MindMapNode[] = [root];
    
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      // 计算层级
      let level = 0;
      let content = line;
      
      if (line.startsWith('# ')) {
        level = 0;
        content = line.substring(2).trim();
        root.label = content || root.label;
        continue;
      } else if (line.startsWith('## ')) {
        level = 1;
        content = line.substring(3).trim();
      } else if (line.startsWith('### ')) {
        level = 2;
        content = line.substring(4).trim();
      } else if (line.startsWith('#### ')) {
        level = 3;
        content = line.substring(5).trim();
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        level = 4;
        content = line.substring(2).trim();
      } else {
        // 无法识别的行，跳过
        continue;
      }
      
      // 创建新节点
      const newNode: MindMapNode = {
        id: `node-${crypto.randomUUID()}`,
        label: content,
        children: []
      };
      
      // 调整栈到正确的父节点
      while (stack.length > level + 1) {
        stack.pop();
      }
      
      // 添加到父节点
      const parent = stack[stack.length - 1];
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(newNode);
      
      // 将新节点压入栈
      stack.push(newNode);
    }
    
    return root;
  };

  const handleGenerateMindMap = async () => {
    if (!apiService.hasApiKey()) {
      setShowSettings(true);
      return;
    }

    setError(null);
    setIsGenerating(true);
    setStreamingContent('');
    setMindMapData(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let fullContent = '';

    try {
      const systemPrompt = `你是一个专业的思维导图生成专家。请根据用户提供的行动协议内容，生成一个结构化、逻辑清晰的思维导图。

## 核心要求

1. **结构规范**（严格遵循）：
   - 根节点：# 协议主题（使用协议的核心原则）
   - 一级分支：## 关键维度（如：触发机制、执行方案、环境设计等）
   - 二级分支：### 具体类别
   - 叶子节点：- 具体内容

2. **内容提取原则**：
   - 提取关键信息，去除冗余描述
   - 使用简洁的短语（5-10字为宜）
   - 保持逻辑层次，不要扁平化
   - 重要细节不能遗漏

3. **思维导图结构模板**：

\#\#\# 协议主题（核心原则）

## 触发机制
### 触发条件
- 具体条件1
- 具体条件2
### 时间设置
- 提醒时间
- 频率规则

## 执行方案
### Plan A（标准方案）
- 标准动作
- 最小动作
- 时长限制
### Plan B（备用方案）
- 标准动作
- 最小动作

## 边界设定
### 心理边界（不做）
- 限制1
- 限制2
### 行动许可（可以做）
- 许可1
- 许可2

## 环境设计
### 事前准备
- 准备项1
- 准备项2
### 阻力管理
- 降低阻力
- 增加阻力

4. **注意事项**：
   - 如果协议中没有某项内容，省略该分支
   - 确保层级关系正确，不要跳级
   - 使用中文标点符号
   - 每个节点内容要完整、准确`

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: sourceText,
        timestamp: new Date()
      };

      const messages: ChatMessage[] = [
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: systemPrompt,
          timestamp: new Date()
        },
        userMessage
      ];

      await apiService.streamChat(
        messages,
        (chunk) => {
          if (abortController.signal.aborted) return;
          fullContent += chunk;
          setStreamingContent(fullContent);
        },
        () => {
          if (!abortController.signal.aborted) {
            try {
              const mindMap = parseMindMapFromText(fullContent);
              // 验证思维导图结构
              if (!mindMap.children || mindMap.children.length === 0) {
                throw new Error('生成的思维导图结构为空');
              }
              setMindMapData(mindMap);
            } catch (parseError) {
              console.error('解析思维导图失败:', parseError);
              setError('AI 返回的格式不正确，请重新生成');
              // 尝试使用备用方案：直接显示文本
              const fallbackNode: MindMapNode = {
                id: 'fallback',
                label: protocol?.principle || '思维导图',
                children: [
                  {
                    id: 'content',
                    label: '原始内容',
                    children: fullContent.split('\n').filter(l => l.trim()).map((line, i) => ({
                      id: `line-${i}`,
                      label: line.trim().substring(0, 50)
                    }))
                  }
                ]
              };
              setMindMapData(fallbackNode);
            }
          }
          setIsGenerating(false);
          abortControllerRef.current = null;
        },
        (err) => {
          if (err.name !== 'AbortError') {
            setError(err.message);
          }
          setIsGenerating(false);
          abortControllerRef.current = null;
        },
        abortController.signal
      );
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setError(err instanceof Error ? err.message : '生成失败');
      }
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const renderTree = (node: MindMapNode, x: number, y: number, level: number): React.ReactNode => {
    const nodeHeight = 36;
    const horizontalGap = 200;
    const verticalGap = 50;
    
    // 根据层级和内容动态计算节点宽度
    const baseWidth = level === 0 ? 160 : level === 1 ? 140 : level === 2 ? 120 : 100;
    const charWidth = level === 0 ? 16 : 13;
    const nodeWidth = Math.min(
      Math.max(baseWidth, node.label.length * charWidth + 32),
      level === 0 ? 280 : 220
    );

    const children = node.children || [];
    const totalHeight = Math.max(
      nodeHeight,
      children.reduce((sum, child, i) => {
        const childHeight = getTreeHeight(child, verticalGap);
        return sum + childHeight + (i > 0 ? verticalGap : 0);
      }, 0)
    );

    let currentY = y - totalHeight / 2 + nodeHeight / 2;

    // 根据层级定义颜色方案
    const colors = [
      { fill: '#d97706', stroke: '#92400e', text: 'white' },      // 根节点
      { fill: '#f59e0b', stroke: '#d97706', text: '#78350f' },    // 一级
      { fill: '#fbbf24', stroke: '#f59e0b', text: '#78350f' },    // 二级
      { fill: '#fde68a', stroke: '#fbbf24', text: '#78350f' },    // 三级
      { fill: '#fef3c7', stroke: '#fde68a', text: '#78350f' },    // 四级
    ];
    const color = colors[Math.min(level, colors.length - 1)];

    // 计算字体大小
    const fontSize = level === 0 ? 15 : level === 1 ? 13 : 12;

    // 判断是否选中
    const isSelected = selectedNode?.id === node.id;

    return (
      <React.Fragment key={node.id}>
        <g transform={`translate(${x}, ${y})`}>
          {/* 节点阴影 */}
          <rect
            x={-nodeWidth / 2 + 2}
            y={-nodeHeight / 2 + 2}
            width={nodeWidth}
            height={nodeHeight}
            rx={10}
            fill="rgba(0,0,0,0.1)"
          />
          {/* 节点主体 */}
          <rect
            x={-nodeWidth / 2}
            y={-nodeHeight / 2}
            width={nodeWidth}
            height={nodeHeight}
            rx={10}
            fill={color.fill}
            stroke={isSelected ? '#2563eb' : color.stroke}
            strokeWidth={isSelected ? 3 : level <= 1 ? 2.5 : 1.5}
            className="cursor-pointer transition-all hover:opacity-90"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedNode(node);
            }}
          />
          {/* 节点文字 */}
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fill={color.text}
            fontSize={fontSize}
            fontWeight={level <= 2 ? '600' : '400'}
            className="cursor-pointer pointer-events-none"
          >
            {node.label.length > 20 ? node.label.substring(0, 18) + '...' : node.label}
          </text>
          
          {/* 选中节点的操作按钮 */}
          {isSelected && (
            <g transform={`translate(${nodeWidth / 2 + 10}, 0)`}>
              {/* 编辑按钮 */}
              <circle
                cx={0}
                cy={-15}
                r={12}
                fill="#3b82f6"
                className="cursor-pointer hover:opacity-80"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditModal(node);
                }}
              />
              <text
                x={0}
                y={-11}
                textAnchor="middle"
                fill="white"
                fontSize={10}
              >✏️</text>
              
              {/* 添加子节点按钮 */}
              <circle
                cx={0}
                cy={0}
                r={12}
                fill="#10b981"
                className="cursor-pointer hover:opacity-80"
                onClick={(e) => {
                  e.stopPropagation();
                  addChildNode(node);
                }}
              />
              <text
                x={0}
                y={4}
                textAnchor="middle"
                fill="white"
                fontSize={10}
              >➕</text>
              
              {/* 删除按钮（根节点除外） */}
              {node.id !== 'root' && (
                <>
                  <circle
                    cx={0}
                    cy={15}
                    r={12}
                    fill="#ef4444"
                    className="cursor-pointer hover:opacity-80"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNode(node);
                    }}
                  />
                  <text
                    x={0}
                    y={19}
                    textAnchor="middle"
                    fill="white"
                    fontSize={10}
                  >🗑️</text>
                </>
              )}
            </g>
          )}
        </g>

        {children.map((child) => {
          const childHeight = getTreeHeight(child, verticalGap);
          const childY = currentY + childHeight / 2;
          currentY += childHeight + verticalGap;

          return (
            <React.Fragment key={child.id}>
              {/* 贝塞尔曲线连接线 */}
              <path
                d={`M ${x + nodeWidth / 2} ${y} 
                    C ${x + nodeWidth / 2 + horizontalGap / 3} ${y},
                      ${x + horizontalGap - nodeWidth / 2 - horizontalGap / 3} ${childY},
                      ${x + horizontalGap - nodeWidth / 2} ${childY}`}
                fill="none"
                stroke={color.stroke}
                strokeWidth={level === 0 ? 2.5 : 1.5}
                opacity={0.7}
              />
              {renderTree(child, x + horizontalGap, childY, level + 1)}
            </React.Fragment>
          );
        })}
      </React.Fragment>
    );
  };

  const getTreeHeight = (node: MindMapNode, gap: number): number => {
    const children = node.children || [];
    if (children.length === 0) return 40;
    return children.reduce((sum, child, i) => {
      return sum + getTreeHeight(child, gap) + (i > 0 ? gap : 0);
    }, 0);
  };

  const getTreeWidth = (node: MindMapNode, gap: number): number => {
    const children = node.children || [];
    if (children.length === 0) return 120;
    const maxChildWidth = Math.max(...children.map(child => getTreeWidth(child, gap)));
    return 120 + gap + maxChildWidth;
  };

  const SettingsIcon = () => (
    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 0 00-1.066 2.572c.94 1.543-.826 3.31-2.37 2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  const CloseIcon = () => (
    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );

  const ChevronIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showSourceText ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
    </svg>
  );

  const ZapIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );

  const StopIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
  );

  const RefreshIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );

  const ZoomInIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
    </svg>
  );

  const ZoomOutIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
    </svg>
  );

  const HandIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11" />
    </svg>
  );

  // 打开编辑节点弹窗
  const openEditModal = (node: MindMapNode) => {
    setEditingNode(node);
    setEditLabel(node.label);
    setShowEditModal(true);
  };

  // 保存节点编辑
  const saveNodeEdit = () => {
    if (!editingNode || !mindMapData) return;

    // 使用深拷贝创建新的数据结构
    const deepClone = (node: MindMapNode): MindMapNode => {
      return {
        ...node,
        children: node.children?.map(deepClone)
      };
    };

    // 递归更新节点标签
    const updateNodeLabel = (node: MindMapNode): boolean => {
      if (node.id === editingNode.id) {
        node.label = editLabel;
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (updateNodeLabel(child)) return true;
        }
      }
      return false;
    };

    const clonedData = deepClone(mindMapData);
    updateNodeLabel(clonedData);
    setMindMapData(clonedData);
    
    // 如果当前选中的节点是被编辑的节点，更新选中状态
    if (selectedNode?.id === editingNode.id) {
      setSelectedNode({ ...selectedNode, label: editLabel });
    }
    
    setShowEditModal(false);
    setEditingNode(null);
  };

  // 添加子节点
  const addChildNode = (parentNode: MindMapNode) => {
    if (!mindMapData) return;

    const newChild: MindMapNode = {
      id: `node-${crypto.randomUUID()}`,
      label: '新节点',
      children: []
    };

    // 使用深拷贝创建新的数据结构
    const deepClone = (node: MindMapNode): MindMapNode => {
      return {
        ...node,
        children: node.children?.map(deepClone)
      };
    };

    // 递归添加子节点
    const addChildToNode = (node: MindMapNode): boolean => {
      if (node.id === parentNode.id) {
        if (!node.children) node.children = [];
        node.children.push(newChild);
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (addChildToNode(child)) return true;
        }
      }
      return false;
    };

    const clonedData = deepClone(mindMapData);
    addChildToNode(clonedData);

    setMindMapData(clonedData);
  };

  // 删除节点
  const deleteNode = (nodeToDelete: MindMapNode) => {
    if (!mindMapData || nodeToDelete.id === 'root') {
      alert('不能删除根节点');
      return;
    }

    if (!confirm('确定要删除这个节点吗？')) return;

    // 使用深拷贝创建新的数据结构
    const deepClone = (node: MindMapNode): MindMapNode => {
      return {
        ...node,
        children: node.children?.map(deepClone)
      };
    };

    // 递归删除节点
    const removeNode = (node: MindMapNode): boolean => {
      if (node.children) {
        const initialLength = node.children.length;
        node.children = node.children.filter(child => child.id !== nodeToDelete.id);
        if (node.children.length < initialLength) return true;
        
        for (const child of node.children) {
          if (removeNode(child)) return true;
        }
      }
      return false;
    };

    const clonedData = deepClone(mindMapData);
    removeNode(clonedData);
    
    // 取消选中状态
    if (selectedNode?.id === nodeToDelete.id) {
      setSelectedNode(null);
    }
    
    setMindMapData(clonedData);
  };

  // 处理鼠标滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.max(0.3, Math.min(3, prev * delta)));
  };

  // 处理拖拽开始
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1) { // 左键或中键
      setIsDragging(true);
      setDragStart({ x: e.clientX - translateX, y: e.clientY - translateY });
    }
  };

  // 处理拖拽移动
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setTranslateX(e.clientX - dragStart.x);
      setTranslateY(e.clientY - dragStart.y);
    }
  };

  // 处理拖拽结束
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 重置视图
  const resetView = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">协议思维导图</h2>
            {protocol && <p className="text-sm text-gray-500 mt-1">{protocol.principle}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="设置"
            >
              <SettingsIcon />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {showSettings && (
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">API 配置</h3>
              <p className="text-sm text-gray-500 mb-4">
                请先在 AI 助手页面配置 API 密钥，然后返回生成思维导图。
              </p>
              <button
                onClick={() => setShowSettings(false)}
                className="w-full bg-golden text-white py-3 rounded-xl font-semibold hover:bg-golden-dark transition-colors"
              >
                我知道了
              </button>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border-b border-red-200">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex-1 overflow-auto p-6">
            {!mindMapData && !isGenerating && (
              <div className="text-center py-16">
                <div className="text-6xl mb-6">🧠</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">生成思维导图</h3>
                <p className="text-gray-500 mb-6">
                  基于协议内容，AI 将自动生成结构化的思维导图
                </p>

                <div className="max-w-2xl mx-auto mb-6">
                  <button
                    onClick={() => setShowSourceText(!showSourceText)}
                    className="flex items-center gap-2 text-sm text-golden hover:text-golden-dark transition-colors mx-auto"
                  >
                    <ChevronIcon />
                    {showSourceText ? '隐藏协议内容' : '查看协议内容'}
                  </button>

                  {showSourceText && (
                    <div className="mt-4 bg-gray-50 rounded-xl p-4 text-left">
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap">{sourceText}</pre>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleGenerateMindMap}
                  disabled={!apiService.hasApiKey()}
                  className="bg-golden text-white px-8 py-3 rounded-xl font-semibold hover:bg-golden-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                >
                  <ZapIcon />
                  生成思维导图
                </button>
              </div>
            )}

            {isGenerating && (
              <div className="text-center py-16">
                <div className="w-12 h-12 border-4 border-golden/30 border-t-golden rounded-full animate-spin mx-auto mb-6" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">正在生成...</h3>
                <p className="text-gray-500 mb-6">AI 正在分析协议并构建思维导图</p>
                
                <div className="max-w-2xl mx-auto bg-gray-50 rounded-xl p-4 text-left">
                  <pre className="text-sm text-gray-600 whitespace-pre-wrap">{streamingContent}</pre>
                </div>

                <button
                  onClick={handleStopGeneration}
                  className="mt-6 text-red-500 hover:text-red-600 flex items-center gap-2 mx-auto"
                >
                  <StopIcon />
                  停止生成
                </button>
              </div>
            )}

            {mindMapData && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">思维导图</h3>
                  <div className="flex items-center gap-2">
                    {/* 缩放控制 */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setScale(prev => Math.max(0.3, prev * 0.9))}
                        className="p-2 hover:bg-white rounded-md transition-colors"
                        title="缩小"
                      >
                        <ZoomOutIcon />
                      </button>
                      <span className="text-sm text-gray-600 min-w-[60px] text-center">
                        {Math.round(scale * 100)}%
                      </span>
                      <button
                        onClick={() => setScale(prev => Math.min(3, prev * 1.1))}
                        className="p-2 hover:bg-white rounded-md transition-colors"
                        title="放大"
                      >
                        <ZoomInIcon />
                      </button>
                    </div>
                    <button
                      onClick={resetView}
                      className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      title="重置视图"
                    >
                      重置
                    </button>
                    <button
                      onClick={handleGenerateMindMap}
                      className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <RefreshIcon />
                      重新生成
                    </button>
                  </div>
                </div>
                
                {/* 操作提示 */}
                <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                  <p className="flex items-center gap-2">
                    <HandIcon />
                    <span>鼠标滚轮缩放 | 拖拽移动 | 点击节点编辑</span>
                  </p>
                </div>
                
                <div 
                  className="bg-gray-50 rounded-xl overflow-hidden"
                  style={{ height: '600px', cursor: isDragging ? 'grabbing' : 'grab' }}
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onClick={() => setSelectedNode(null)}
                >
                  <svg
                    ref={svgRef}
                    width="100%"
                    height="100%"
                    viewBox={`0 0 ${getTreeWidth(mindMapData, 180) + 400} ${Math.max(600, getTreeHeight(mindMapData, 60) + 200)}`}
                    preserveAspectRatio="xMidYMid meet"
                    style={{
                      transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                      transformOrigin: 'center center',
                      transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                    }}
                  >
                    <g transform={`translate(200, ${Math.max(300, (getTreeHeight(mindMapData, 60) + 200) / 2)})`}>
                      {renderTree(mindMapData, 0, 0, 0)}
                    </g>
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 编辑节点弹窗 */}
      {showEditModal && editingNode && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
          onClick={() => setShowEditModal(false)}
        >
          <div 
            className="bg-white rounded-2xl p-6 w-[400px] max-w-[90vw]"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-4">编辑节点</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                节点内容
              </label>
              <textarea
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:border-golden focus:ring-1 focus:ring-golden"
                rows={3}
                placeholder="输入节点内容..."
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveNodeEdit}
                className="flex-1 py-2 bg-golden text-white rounded-lg hover:bg-golden-dark transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
