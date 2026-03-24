import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiService, ChatMessage } from '../services/apiService';
import { ProtocolModel } from '../types/protocol';

interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
}

interface NodePosition {
  x: number;
  y: number;
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
  const abortControllerRef = useRef<AbortController | null>(null);

  // 监听 API 密钥变化，更新设置状态
  useEffect(() => {
    const checkApiKey = () => {
      if (apiService.hasApiKey() && showSettings) {
        setShowSettings(false);
      }
    };
    checkApiKey();
    const interval = setInterval(checkApiKey, 1000);
    return () => clearInterval(interval);
  }, [showSettings]);

  const [editingNode, setEditingNode] = useState<MindMapNode | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);

  const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map());
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const draggingNodeIdRef = useRef<string | null>(null);
  const isPanningRef = useRef(false);

  const NODE_WIDTH = 140;
  const NODE_HEIGHT = 40;
  const HORIZONTAL_GAP = 180;
  const VERTICAL_GAP = 60;

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

    const stack: MindMapNode[] = [root];

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

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
        continue;
      }

      const newNode: MindMapNode = {
        id: `node-${crypto.randomUUID()}`,
        label: content,
        children: []
      };

      while (stack.length > level + 1) {
        stack.pop();
      }

      const parent = stack[stack.length - 1];
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(newNode);
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
              if (!mindMap.children || mindMap.children.length === 0) {
                throw new Error('生成的思维导图结构为空');
              }
              initializeNodePositions(mindMap);
              setMindMapData(mindMap);
            } catch (parseError) {
              console.error('解析思维导图失败:', parseError);
              setError('AI 返回的格式不正确，请重新生成');
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
              initializeNodePositions(fallbackNode);
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

  const initializeNodePositions = (rootNode: MindMapNode) => {
    const positions = new Map<string, NodePosition>();
    
    const calculatePositions = (node: MindMapNode, x: number, y: number, level: number): number => {
      positions.set(node.id, { x, y });

      const children = node.children || [];
      if (children.length === 0) return NODE_HEIGHT;

      let totalChildHeight = 0;
      const childHeights: number[] = [];

      for (const child of children) {
        const childHeight = calculatePositions(child, x + HORIZONTAL_GAP, 0, level + 1);
        childHeights.push(childHeight);
        totalChildHeight += childHeight + (childHeights.length > 1 ? VERTICAL_GAP : 0);
      }

      let currentY = y - totalChildHeight / 2 + NODE_HEIGHT / 2;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const childPos = positions.get(child.id)!;
        positions.set(child.id, { ...childPos, y: currentY + childHeights[i] / 2 - NODE_HEIGHT / 2 });
        currentY += childHeights[i] + VERTICAL_GAP;
      }

      return Math.max(totalChildHeight, NODE_HEIGHT);
    };

    calculatePositions(rootNode, 0, 0, 0);
    setNodePositions(positions);
  };

  const getNodeColor = (level: number) => {
    const colors = [
      { bg: 'bg-amber-600', text: 'text-white', border: 'border-amber-800' },
      { bg: 'bg-amber-500', text: 'text-amber-900', border: 'border-amber-600' },
      { bg: 'bg-yellow-400', text: 'text-yellow-900', border: 'border-yellow-600' },
      { bg: 'bg-yellow-200', text: 'text-yellow-900', border: 'border-yellow-400' },
      { bg: 'bg-yellow-100', text: 'text-yellow-900', border: 'border-yellow-300' },
    ];
    return colors[Math.min(level, colors.length - 1)];
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const pos = nodePositions.get(nodeId);
    if (!pos) return;

    setDraggingNodeId(nodeId);
    draggingNodeIdRef.current = nodeId;
    setDragOffset({
      x: e.clientX - pos.x,
      y: e.clientY - pos.y
    });
  };

  const handleNodeTouchStart = (e: React.TouchEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const pos = nodePositions.get(nodeId);
    if (!pos) return;

    draggingNodeIdRef.current = nodeId;
    setDraggingNodeId(nodeId);
    const touch = e.touches[0];
    setDragOffset({
      x: touch.clientX - pos.x,
      y: touch.clientY - pos.y
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (draggingNodeIdRef.current) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      setNodePositions(prev => {
        const newMap = new Map(prev);
        newMap.set(draggingNodeIdRef.current!, { x: newX, y: newY });
        return newMap;
      });
    } else if (isPanningRef.current) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      }));
    }
  }, [dragOffset, panStart]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (draggingNodeIdRef.current && e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      const newX = touch.clientX - dragOffset.x;
      const newY = touch.clientY - dragOffset.y;
      setNodePositions(prev => {
        const newMap = new Map(prev);
        newMap.set(draggingNodeIdRef.current!, { x: newX, y: newY });
        return newMap;
      });
    }
  }, [dragOffset]);

  const handleMouseUp = useCallback(() => {
    draggingNodeIdRef.current = null;
    setDraggingNodeId(null);
    isPanningRef.current = false;
    setIsPanning(false);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mouseleave', handleMouseUp);
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleMouseUp);
    container.addEventListener('touchcancel', handleMouseUp);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mouseleave', handleMouseUp);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleMouseUp);
      container.removeEventListener('touchcancel', handleMouseUp);
    };
  }, [handleMouseMove, handleTouchMove, handleMouseUp]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (draggingNodeId) return;
    isPanningRef.current = true;
    setIsPanning(true);
    setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    if (draggingNodeId) return;
    if (e.touches.length === 1) {
      isPanningRef.current = true;
      setIsPanning(true);
      setPanStart({
        x: e.touches[0].clientX - transform.x,
        y: e.touches[0].clientY - transform.y
      });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.3, Math.min(3, prev.scale * delta))
    }));
  };

  const handleNodeClick = (e: React.MouseEvent, node: MindMapNode) => {
    e.stopPropagation();
    setSelectedNode(node);
  };

  const openEditModal = (node: MindMapNode) => {
    setEditingNode(node);
    setEditLabel(node.label);
    setShowEditModal(true);
  };

  const saveNodeEdit = () => {
    if (!editingNode || !mindMapData) return;

    const deepClone = (node: MindMapNode): MindMapNode => ({
      ...node,
      children: node.children?.map(deepClone)
    });

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

    if (selectedNode?.id === editingNode.id) {
      setSelectedNode({ ...selectedNode, label: editLabel });
    }

    setShowEditModal(false);
    setEditingNode(null);
  };

  const addChildNode = (parentNode: MindMapNode) => {
    if (!mindMapData) return;

    const newChild: MindMapNode = {
      id: `node-${crypto.randomUUID()}`,
      label: '新节点',
      children: []
    };

    const deepClone = (node: MindMapNode): MindMapNode => ({
      ...node,
      children: node.children?.map(deepClone)
    });

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

    const parentPos = nodePositions.get(parentNode.id);
    if (parentPos) {
      const newPositions = new Map(nodePositions);
      newPositions.set(newChild.id, {
        x: parentPos.x + HORIZONTAL_GAP,
        y: parentPos.y
      });
      setNodePositions(newPositions);
    }

    setMindMapData(clonedData);
  };

  const deleteNode = (nodeToDelete: MindMapNode) => {
    if (!mindMapData || nodeToDelete.id === 'root') {
      alert('不能删除根节点');
      return;
    }

    if (!confirm('确定要删除这个节点吗？')) return;

    const deepClone = (node: MindMapNode): MindMapNode => ({
      ...node,
      children: node.children?.map(deepClone)
    });

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

    if (selectedNode?.id === nodeToDelete.id) {
      setSelectedNode(null);
    }

    const newPositions = new Map(nodePositions);
    newPositions.delete(nodeToDelete.id);
    setNodePositions(newPositions);

    setMindMapData(clonedData);
  };

  const resetView = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
  };

  const renderNode = (node: MindMapNode, level: number = 0) => {
    const pos = nodePositions.get(node.id);
    if (!pos) return null;

    const isSelected = selectedNode?.id === node.id;
    const isDragging = draggingNodeId === node.id;
    const color = getNodeColor(level);

    return (
      <React.Fragment key={node.id}>
        <div
          className={`absolute flex items-center justify-center rounded-lg font-medium transition-shadow cursor-grab select-none
            ${color.bg} ${color.text} ${isSelected ? 'ring-4 ring-blue-500 shadow-lg z-20' : ''}
            ${isDragging ? 'opacity-80 cursor-grabbing z-30 shadow-xl' : ''}
            hover:shadow-md`}
          style={{
            left: pos.x,
            top: pos.y,
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
            border: `2px solid ${color.border}`,
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
            touchAction: 'none'
          }}
          onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
          onTouchStart={(e) => handleNodeTouchStart(e, node.id)}
          onClick={(e) => handleNodeClick(e, node)}
        >
          <span className="px-2 text-center truncate text-sm">
            {node.label.length > 18 ? node.label.substring(0, 16) + '...' : node.label}
          </span>
        </div>

        {isSelected && (
          <div
            className="absolute flex items-center gap-1 bg-white rounded-full shadow-lg z-40 px-2 py-1"
            style={{
              left: pos.x + NODE_WIDTH + 8,
              top: pos.y + NODE_HEIGHT / 2 - 16,
              transform: 'translateY(-50%)'
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(node);
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs"
              title="编辑"
            >
              ✏️
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                addChildNode(node);
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-green-500 hover:bg-green-600 text-white text-xs"
              title="添加子节点"
            >
              ➕
            </button>
            {node.id !== 'root' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNode(node);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white text-xs"
                title="删除"
              >
                🗑️
              </button>
            )}
          </div>
        )}

        {node.children?.map((child) => renderNode(child, level + 1))}
      </React.Fragment>
    );
  };

  const renderConnections = () => {
    if (!mindMapData) return null;

    const connections: JSX.Element[] = [];
    const traverse = (node: MindMapNode, level: number = 0) => {
      const parentPos = nodePositions.get(node.id);
      if (!parentPos) return;

      node.children?.forEach((child) => {
        const childPos = nodePositions.get(child.id);
        if (!childPos) return;

        const startX = parentPos.x + NODE_WIDTH;
        const startY = parentPos.y + NODE_HEIGHT / 2;
        const endX = childPos.x;
        const endY = childPos.y + NODE_HEIGHT / 2;
        const controlOffset = (endX - startX) / 3;

        const color = getNodeColor(level);

        connections.push(
          <path
            key={`${node.id}-${child.id}`}
            d={`M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`}
            fill="none"
            stroke={color.border}
            strokeWidth={level === 0 ? 2.5 : 1.5}
            opacity={0.6}
          />
        );

        traverse(child, level + 1);
      });
    };

    traverse(mindMapData);
    return connections;
  };

  const saveMindMap = () => {
    if (!mindMapData) return;

    const mindMapExport = {
      data: mindMapData,
      positions: Array.from(nodePositions.entries()),
      savedAt: new Date().toISOString(),
      protocolId: protocol?.id,
      protocolName: protocol?.principle
    };

    const blob = new Blob([JSON.stringify(mindMapExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindmap_${protocol?.principle?.replace(/\s+/g, '_') || 'untitled'}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const savedMindMaps = JSON.parse(localStorage.getItem('saved-mindmaps') || '[]');
    savedMindMaps.push({
      id: crypto.randomUUID(),
      ...mindMapExport
    });
    localStorage.setItem('saved-mindmaps', JSON.stringify(savedMindMaps));

    alert('思维导图已保存！');
  };

  const SettingsIcon = () => (
    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.572c.94 1.543-.826 3.31-2.37 2.37.996.608 2.296.07 2.572-1.065z" />
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
    </svg>
  );

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
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">思维导图</h3>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(0.3, prev.scale * 0.9) }))}
                        className="p-2 hover:bg-white rounded-md transition-colors"
                        title="缩小"
                      >
                        <ZoomOutIcon />
                      </button>
                      <span className="text-sm text-gray-600 min-w-[60px] text-center">
                        {Math.round(transform.scale * 100)}%
                      </span>
                      <button
                        onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(3, prev.scale * 1.1) }))}
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
                    <button
                      onClick={saveMindMap}
                      className="px-4 py-2 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors flex items-center gap-2"
                      title="保存思维导图"
                    >
                      💾 保存
                    </button>
                  </div>
                </div>

                <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                  <p className="flex items-center gap-2">
                    <HandIcon />
                    <span>电脑：拖拽节点移动 | 空白处拖拽画布 | 滚轮缩放</span>
                  </p>
                  <p className="flex items-center gap-2 mt-1">
                    <span>📱</span>
                    <span>手机：拖拽节点移动 | 空白处拖拽画布</span>
                  </p>
                </div>

                <div
                  ref={containerRef}
                  className="relative flex-1 bg-gray-50 rounded-xl overflow-hidden select-none"
                  style={{
                    height: '600px',
                    cursor: draggingNodeId ? 'grabbing' : isPanning ? 'grabbing' : 'grab',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                    userSelect: 'none',
                    touchAction: 'none'
                  }}
                  onMouseDown={handleCanvasMouseDown}
                  onTouchStart={handleCanvasTouchStart}
                  onWheel={handleWheel}
                  onClick={() => setSelectedNode(null)}
                >
                  <div
                    ref={contentRef}
                    className="absolute inset-0"
                    style={{
                      transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                      transformOrigin: '0 0'
                    }}
                  >
                    <svg
                      className="absolute inset-0 pointer-events-none"
                      style={{ width: '4000px', height: '3000px', overflow: 'visible' }}
                    >
                      {renderConnections()}
                    </svg>
                    {renderNode(mindMapData)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

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
