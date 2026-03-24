import React, { useState, useRef, useCallback, useEffect } from 'react';
import { apiService, ChatMessage } from '../services/apiService';

// 类型定义
interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
  x?: number;
  y?: number;
  collapsed?: boolean;
}

interface NodePosition {
  x: number;
  y: number;
}

// 常量定义
const NODE_WIDTH = 120;
const NODE_HEIGHT = 36;
const HORIZONTAL_GAP = 140;
const VERTICAL_GAP = 50;

const defaultMindMapData: MindMapNode = {
  id: 'root',
  label: '思维导图',
  children: [
    {
      id: '1',
      label: '核心概念',
      children: [
        { id: '1-1', label: '放射性思维' },
        { id: '1-2', label: '可视化工具' }
      ]
    },
    {
      id: '2',
      label: '主要用途',
      children: [
        { id: '2-1', label: '高效记忆' },
        { id: '2-2', label: '头脑风暴' },
        { id: '2-3', label: '知识整理' },
        { id: '2-4', label: '项目规划' }
      ]
    },
    {
      id: '3',
      label: '构成要素',
      children: [
        { id: '3-1', label: '核心主题' },
        { id: '3-2', label: '分支结构' },
        { id: '3-3', label: '关键词' },
        { id: '3-4', label: '颜色图像' }
      ]
    },
    {
      id: '4',
      label: '应用场景',
      children: [
        { id: '4-1', label: '学习笔记' },
        { id: '4-2', label: '工作规划' },
        { id: '4-3', label: '创意策划' }
      ]
    }
  ]
};

export default function SimpleMindMap() {
  const [mindMapData, setMindMapData] = useState<MindMapNode>(() => {
    try {
      const saved = localStorage.getItem('simple-mindmap-data');
      if (saved) {
        const parsed = JSON.parse(saved);
        // 验证解析后的数据是否有效
        if (parsed && typeof parsed === 'object' && parsed.id && parsed.label) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load mind map data:', e);
    }
    return defaultMindMapData;
  });
  const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map());
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);
  const [editingNode, setEditingNode] = useState<MindMapNode | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [transform, setTransform] = useState({ x: 20, y: 150, scale: 0.85 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showHelp, setShowHelp] = useState(false);

  // 新增状态
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showInputPanel, setShowInputPanel] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // 双指缩放相关状态
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  const isPinchingRef = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const draggingNodeIdRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 保存思维导图数据（防抖）
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem('simple-mindmap-data', JSON.stringify(mindMapData));
    }, 500);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [mindMapData]);

  // 计算树的高度
  const getTreeHeight = useCallback((node: MindMapNode): number => {
    const children = node.children?.filter(c => !c.collapsed) || [];
    if (children.length === 0) return NODE_HEIGHT;
    let totalHeight = 0;
    for (const child of children) {
      totalHeight += getTreeHeight(child) + (totalHeight > 0 ? VERTICAL_GAP : 0);
    }
    return Math.max(totalHeight, NODE_HEIGHT);
  }, []);

  // 初始化节点位置
  const initializeNodePositions = useCallback((rootNode: MindMapNode) => {
    const positions = new Map<string, NodePosition>();

    const setPositions = (node: MindMapNode, x: number, y: number) => {
      positions.set(node.id, { x, y });
      const children = node.children?.filter(c => !c.collapsed) || [];
      if (children.length === 0) return;

      const totalHeight = getTreeHeight(node);
      let currentY = y - totalHeight / 2 + NODE_HEIGHT / 2;

      for (const child of children) {
        const childHeight = getTreeHeight(child);
        const childY = currentY + childHeight / 2 - NODE_HEIGHT / 2;
        const childX = x + HORIZONTAL_GAP;
        setPositions(child, childX, childY);
        currentY += childHeight + VERTICAL_GAP;
      }
    };

    setPositions(rootNode, 0, 0);
    setNodePositions(positions);
  }, [getTreeHeight]);

  // 初始化位置
  useEffect(() => {
    initializeNodePositions(mindMapData);
  }, [mindMapData, initializeNodePositions]);

  // 获取节点颜色
  const getNodeColor = (level: number, isRoot: boolean = false) => {
    if (isRoot) {
      return { bg: 'bg-amber-600', text: 'text-white', border: 'border-amber-700' };
    }
    const colors = [
      { bg: 'bg-amber-500', text: 'text-white', border: 'border-amber-600' },
      { bg: 'bg-yellow-400', text: 'text-yellow-900', border: 'border-yellow-500' },
      { bg: 'bg-yellow-200', text: 'text-yellow-800', border: 'border-yellow-300' },
    ];
    return colors[Math.min(level, colors.length - 1)];
  };

  // 处理节点点击
  const handleNodeClick = (e: React.MouseEvent, node: MindMapNode) => {
    e.stopPropagation();
    setSelectedNode(node);
  };

  // 处理节点双击（展开/折叠）
  const handleNodeDoubleClick = (e: React.MouseEvent, node: MindMapNode) => {
    e.stopPropagation();
    if (node.children && node.children.length > 0) {
      const updateNode = (n: MindMapNode): MindMapNode => {
        if (n.id === node.id) {
          return { ...n, collapsed: !n.collapsed };
        }
        return {
          ...n,
          children: n.children?.map(updateNode)
        };
      };
      setMindMapData(updateNode(mindMapData));
    }
  };

  // 打开编辑弹窗
  const openEditModal = (node: MindMapNode) => {
    setEditingNode(node);
    setEditLabel(node.label);
    setShowEditModal(true);
  };

  // 保存节点编辑
  const saveNodeEdit = () => {
    if (!editingNode) return;

    const updateNode = (node: MindMapNode): MindMapNode => {
      if (node.id === editingNode.id) {
        return { ...node, label: editLabel };
      }
      return {
        ...node,
        children: node.children?.map(updateNode)
      };
    };

    setMindMapData(updateNode(mindMapData));
    setShowEditModal(false);
    setEditingNode(null);
  };

  // 添加子节点
  const addChildNode = (parentNode: MindMapNode) => {
    const newChild: MindMapNode = {
      id: `node-${Date.now()}`,
      label: '新节点',
      children: []
    };

    const updateNode = (node: MindMapNode): MindMapNode => {
      if (node.id === parentNode.id) {
        return {
          ...node,
          collapsed: false,
          children: [...(node.children || []), newChild]
        };
      }
      return {
        ...node,
        children: node.children?.map(updateNode)
      };
    };

    setMindMapData(updateNode(mindMapData));
  };

  // 删除节点
  const deleteNode = (nodeToDelete: MindMapNode) => {
    if (nodeToDelete.id === 'root') {
      alert('不能删除根节点');
      return;
    }

    if (!confirm('确定要删除这个节点吗？')) return;

    const removeNode = (node: MindMapNode): MindMapNode | null => {
      if (node.children) {
        const filtered = node.children
          .filter(c => c.id !== nodeToDelete.id)
          .map(removeNode)
          .filter(Boolean) as MindMapNode[];
        return { ...node, children: filtered };
      }
      return node;
    };

    setMindMapData(removeNode(mindMapData) || mindMapData);
    setSelectedNode(null);
  };

  // 处理鼠标移动
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

  // 计算双指之间的距离
  const getTouchDistance = (touches: TouchList | React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 处理触摸移动（移动端）
  const handleTouchMove = useCallback((e: TouchEvent) => {
    // 双指缩放
    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = getTouchDistance(e.touches);
      
      if (lastTouchDistance !== null) {
        const scaleDelta = distance / lastTouchDistance;
        setTransform(prev => ({
          ...prev,
          scale: Math.max(0.3, Math.min(3, prev.scale * scaleDelta))
        }));
      }
      
      setLastTouchDistance(distance);
      isPinchingRef.current = true;
      return;
    }

    // 单指拖拽节点
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
    } else if (isPanningRef.current && e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      setTransform(prev => ({
        ...prev,
        x: touch.clientX - panStart.x,
        y: touch.clientY - panStart.y
      }));
    }
  }, [dragOffset, panStart, lastTouchDistance]);

  // 处理鼠标/触摸结束
  const handleEnd = useCallback(() => {
    draggingNodeIdRef.current = null;
    setDraggingNodeId(null);
    isPanningRef.current = false;
    setIsPanning(false);
    isPinchingRef.current = false;
    setLastTouchDistance(null);
  }, []);

  // 添加全局事件监听（修复重复添加问题）
  useEffect(() => {
    // 使用全局事件监听，不依赖特定容器
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
    };
  }, [handleMouseMove, handleTouchMove, handleEnd]);

  // 处理节点拖拽开始
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

  // 处理节点触摸开始（移动端）
  const handleNodeTouchStart = (e: React.TouchEvent, nodeId: string) => {
    e.stopPropagation();

    const pos = nodePositions.get(nodeId);
    if (!pos) return;

    const touch = e.touches[0];
    setDraggingNodeId(nodeId);
    draggingNodeIdRef.current = nodeId;
    setDragOffset({
      x: touch.clientX - pos.x,
      y: touch.clientY - pos.y
    });
  };

  // 处理画布拖拽
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (draggingNodeId) return;
    isPanningRef.current = true;
    setIsPanning(true);
    setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  // 处理画布触摸开始（移动端）
  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    if (draggingNodeId) return;
    
    // 双指触摸 - 准备缩放
    if (e.touches.length === 2) {
      const distance = getTouchDistance(e.touches);
      setLastTouchDistance(distance);
      isPinchingRef.current = true;
      return;
    }
    
    // 单指触摸 - 拖拽画布
    if (e.touches.length === 1) {
      isPanningRef.current = true;
      setIsPanning(true);
      const touch = e.touches[0];
      setPanStart({ x: touch.clientX - transform.x, y: touch.clientY - transform.y });
    }
  };

  // 处理滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.3, Math.min(3, prev.scale * delta))
    }));
  };

  // 重置视图
  const resetView = () => {
    setTransform({ x: 20, y: 150, scale: 0.85 });
    initializeNodePositions(mindMapData);
  };

  // 切换全屏
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTransform({ x: 50, y: 300, scale: 1 });
    initializeNodePositions(mindMapData);
  };

  // 解析AI生成的文本为思维导图数据
  const parseMindMapFromText = (text: string): MindMapNode => {
    const lines = text.split('\n').filter(line => line.trim());
    const root: MindMapNode = {
      id: 'root',
      label: '思维导图',
      children: []
    };

    const stack: MindMapNode[] = [root];
    let currentLevel = 0;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      let level = 0;
      let content = line;

      // 计算层级
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
        level = Math.min(currentLevel + 1, 4);
        content = line.substring(2).trim();
      } else {
        // 尝试根据缩进判断层级
        const indent = line.search(/\S/);
        if (indent > 0) {
          level = Math.min(Math.floor(indent / 2) + 1, 4);
        }
        content = line.trim();
      }

      if (!content) continue;

      currentLevel = level;

      const newNode: MindMapNode = {
        id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

  // AI生成思维导图
  const generateMindMapFromAI = async () => {
    if (!inputText.trim()) {
      setGenerationError('请输入内容');
      return;
    }

    if (!apiService.hasApiKey()) {
      setGenerationError('请先配置API密钥');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setStreamingContent('');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const systemPrompt = `你是一个专业的思维导图生成专家。请根据用户提供的主题或内容，生成一个结构化、逻辑清晰的思维导图。

## 核心要求

1. **结构规范**（严格遵循）：
   - 根节点：# 主题名称
   - 一级分支：## 主要分类
   - 二级分支：### 子分类
   - 三级分支：#### 细节
   - 叶子节点：- 具体内容

2. **内容提取原则**：
   - 提取关键信息，去除冗余描述
   - 使用简洁的短语（5-10字为宜）
   - 保持逻辑层次，不要扁平化
   - 重要细节不能遗漏

3. **思维导图结构**：
   - 分析主题的核心概念
   - 提取3-6个主要分支
   - 每个分支下包含2-5个子节点
   - 确保逻辑关系清晰

4. **注意事项**：
   - 确保层级关系正确，不要跳级
   - 使用中文标点符号
   - 每个节点内容要完整、准确
   - 输出格式必须是Markdown标题格式`;

      const messages: ChatMessage[] = [
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: systemPrompt,
          timestamp: new Date()
        },
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: `请为以下内容生成思维导图：\n\n${inputText}`,
          timestamp: new Date()
        }
      ];

      let fullContent = '';

      await apiService.streamChat(
        messages,
        (chunk) => {
          fullContent += chunk;
          setStreamingContent(fullContent);
        },
        () => {
          try {
            const mindMap = parseMindMapFromText(fullContent);
            if (!mindMap.children || mindMap.children.length === 0) {
              throw new Error('生成的思维导图结构为空');
            }
            setMindMapData(mindMap);
            initializeNodePositions(mindMap);
            setShowInputPanel(false);
            setInputText('');
          } catch (parseError) {
            console.error('解析思维导图失败:', parseError);
            setGenerationError('AI 返回的格式不正确，请重试');
          }
          setIsGenerating(false);
          abortControllerRef.current = null;
        },
        (err) => {
          if (err.name !== 'AbortError') {
            setGenerationError(err.message);
          }
          setIsGenerating(false);
          abortControllerRef.current = null;
        },
        abortController.signal
      );
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        setGenerationError(err instanceof Error ? err.message : '生成失败');
      }
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // 停止生成
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  // 从文本手动生成思维导图
  const generateFromText = () => {
    if (!inputText.trim()) {
      setGenerationError('请输入内容');
      return;
    }
    const mindMap = parseMindMapFromText(inputText);
    setMindMapData(mindMap);
    initializeNodePositions(mindMap);
    setShowInputPanel(false);
    setInputText('');
  };

  // 渲染节点
  const renderNode = (node: MindMapNode, level: number = 0, isRoot: boolean = false) => {
    const pos = nodePositions.get(node.id);
    if (!pos) return null;

    const isSelected = selectedNode?.id === node.id;
    const isDragging = draggingNodeId === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = node.collapsed && hasChildren;
    const color = getNodeColor(level, isRoot);

    return (
      <React.Fragment key={node.id}>
        <div
          className={`absolute flex items-center justify-center rounded-lg font-medium transition-all cursor-pointer select-none
            ${color.bg} ${color.text} 
            ${isSelected ? 'ring-2 ring-blue-500 shadow-lg z-20' : ''}
            ${isDragging ? 'opacity-80 cursor-grabbing z-30 shadow-xl scale-105' : ''}
            ${isCollapsed ? 'ring-2 ring-dashed ring-gray-400' : ''}
            hover:shadow-md hover:scale-105`}
          style={{
            left: pos.x,
            top: pos.y,
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
            fontSize: isRoot ? '14px' : '12px',
            zIndex: isDragging ? 30 : isSelected ? 20 : 10 - level
          }}
          onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
          onTouchStart={(e) => handleNodeTouchStart(e, node.id)}
          onClick={(e) => handleNodeClick(e, node)}
          onDoubleClick={(e) => handleNodeDoubleClick(e, node)}
          title={hasChildren ? '双击展开/折叠' : ''}
        >
          <span className="px-2 text-center truncate">
            {node.label.length > 12 ? node.label.substring(0, 10) + '...' : node.label}
          </span>
          {hasChildren && (
            <span className="absolute -right-2 -top-2 w-5 h-5 bg-white rounded-full flex items-center justify-center text-xs shadow-md border border-gray-200">
              {isCollapsed ? '+' : '-'}
            </span>
          )}
        </div>

        {/* 选中节点的操作按钮 */}
        {isSelected && !isDragging && (
          <div
            className="absolute flex items-center gap-1 bg-white rounded-full shadow-lg z-40 px-2 py-1 border border-gray-100"
            style={{
              left: pos.x + NODE_WIDTH / 2 - 40,
              top: pos.y - 35
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(node);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs transition-colors"
              title="编辑"
            >
              ✏️
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                addChildNode(node);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-green-500 hover:bg-green-600 text-white text-xs transition-colors"
              title="添加子节点"
            >
              ➕
            </button>
            {!isRoot && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNode(node);
                }}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white text-xs transition-colors"
                title="删除"
              >
                🗑️
              </button>
            )}
          </div>
        )}

        {/* 递归渲染子节点 */}
        {!isCollapsed && node.children?.map((child) => renderNode(child, level + 1))}
      </React.Fragment>
    );
  };

  // 渲染连接线
  const renderConnections = () => {
    const connections: JSX.Element[] = [];

    const traverse = (node: MindMapNode) => {
      const parentPos = nodePositions.get(node.id);
      if (!parentPos) return;

      const children = node.children?.filter(c => !c.collapsed) || [];
      children.forEach((child) => {
        const childPos = nodePositions.get(child.id);
        if (!childPos) return;

        const startX = parentPos.x + NODE_WIDTH;
        const startY = parentPos.y + NODE_HEIGHT / 2;
        const endX = childPos.x;
        const endY = childPos.y + NODE_HEIGHT / 2;
        const controlOffset = (endX - startX) / 2;

        connections.push(
          <path
            key={`${node.id}-${child.id}`}
            d={`M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`}
            fill="none"
            stroke="#D4A574"
            strokeWidth={2}
            opacity={0.7}
          />
        );

        traverse(child);
      });
    };

    traverse(mindMapData);
    return connections;
  };

  // 导出思维导图
  const exportMindMap = () => {
    const data = {
      mindMap: mindMapData,
      exportTime: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindmap_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 导入思维导图
  const importMindMap = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.mindMap) {
          setMindMapData(data.mindMap);
          initializeNodePositions(data.mindMap);
        }
      } catch (err) {
        alert('导入失败：文件格式不正确');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 重置为默认数据
  const resetToDefault = () => {
    if (confirm('确定要重置为默认思维导图吗？当前数据将丢失。')) {
      setMindMapData(defaultMindMapData);
      initializeNodePositions(defaultMindMapData);
      setSelectedNode(null);
    }
  };

  // 工具栏按钮组件
  const ToolbarButton = ({ onClick, icon, title, className = '' }: { onClick: () => void, icon: string, title: string, className?: string }) => (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors ${className}`}
      title={title}
    >
      {icon}
    </button>
  );

  // 渲染画布内容
  const renderCanvas = (isFullscreenMode: boolean) => (
    <div
      ref={isFullscreenMode ? fullscreenContainerRef : containerRef}
      className={`relative bg-white rounded-xl overflow-hidden border border-amber-100 touch-none ${isFullscreenMode ? 'h-full' : ''}`}
      style={{
        height: isFullscreenMode ? '100%' : '280px',
        cursor: draggingNodeId ? 'grabbing' : isPanning ? 'grabbing' : 'grab',
        touchAction: 'none'
      }}
      onMouseDown={handleCanvasMouseDown}
      onTouchStart={handleCanvasTouchStart}
      onWheel={handleWheel}
      onClick={() => setSelectedNode(null)}
    >
      {/* 缩放控制 */}
      <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/90 rounded-lg p-1 shadow-md z-50">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setTransform(prev => ({ ...prev, scale: Math.max(0.3, prev.scale * 0.9) }));
          }}
          className="p-1 text-amber-600 hover:bg-amber-100 rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <span className="text-xs text-amber-700 min-w-[40px] text-center">
          {Math.round(transform.scale * 100)}%
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setTransform(prev => ({ ...prev, scale: Math.min(3, prev.scale * 1.1) }));
          }}
          className="p-1 text-amber-600 hover:bg-amber-100 rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* 思维导图内容 */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0'
        }}
      >
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: '3000px', height: '2000px', overflow: 'visible' }}
        >
          {renderConnections()}
        </svg>
        {renderNode(mindMapData, 0, true)}
      </div>
    </div>
  );

  // 渲染标题栏
  const renderHeader = () => (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🧠</span>
        <h2 className="text-lg font-bold text-amber-800">思维导图</h2>
      </div>
      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={() => setShowInputPanel(!showInputPanel)}
          icon="✨"
          title="AI生成"
          className="text-amber-600 hover:bg-amber-100"
        />
        <ToolbarButton
          onClick={() => setShowHelp(!showHelp)}
          icon="❓"
          title="帮助"
          className="text-amber-600 hover:bg-amber-100"
        />
        <ToolbarButton
          onClick={resetView}
          icon="🔄"
          title="重置视图"
          className="text-amber-600 hover:bg-amber-100"
        />
        <input
          type="file"
          accept=".json"
          className="hidden"
          id="mindmap-import"
          onChange={importMindMap}
        />
        <label
          htmlFor="mindmap-import"
          className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
          title="导入"
        >
          📥
        </label>
        <ToolbarButton
          onClick={exportMindMap}
          icon="📤"
          title="导出"
          className="text-amber-600 hover:bg-amber-100"
        />
        <ToolbarButton
          onClick={toggleFullscreen}
          icon={isFullscreen ? "⛶" : "⛶"}
          title={isFullscreen ? "退出全屏" : "全屏"}
          className="text-amber-600 hover:bg-amber-100"
        />
        <ToolbarButton
          onClick={resetToDefault}
          icon="🗑️"
          title="重置默认"
          className="text-red-500 hover:bg-red-100"
        />
      </div>
    </div>
  );

  // 渲染输入面板
  const renderInputPanel = () => {
    if (!showInputPanel) return null;

    return (
      <div className="mb-3 bg-white rounded-xl p-4 border border-amber-200 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">生成思维导图</h3>
          <button
            onClick={() => {
              setShowInputPanel(false);
              setGenerationError(null);
              setInputText('');
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="输入主题或内容，AI将自动生成思维导图...&#10;例如：人工智能的发展与应用&#10;&#10;或者输入Markdown格式的内容手动生成"
          className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
          rows={4}
        />

        {generationError && (
          <div className="mt-2 p-2 bg-red-50 rounded-lg text-xs text-red-600">
            {generationError}
          </div>
        )}

        {isGenerating && (
          <div className="mt-2 p-2 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-blue-700">AI正在生成...</span>
            </div>
            {streamingContent && (
              <pre className="text-xs text-gray-600 max-h-24 overflow-auto whitespace-pre-wrap">
                {streamingContent}
              </pre>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <button
            onClick={generateFromText}
            disabled={!inputText.trim() || isGenerating}
            className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            文本生成
          </button>
          <button
            onClick={generateMindMapFromAI}
            disabled={!inputText.trim() || isGenerating || !apiService.hasApiKey()}
            className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {isGenerating ? '生成中...' : 'AI生成'}
          </button>
          {isGenerating && (
            <button
              onClick={handleStopGeneration}
              className="px-3 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
            >
              停止
            </button>
          )}
        </div>

        {!apiService.hasApiKey() && (
          <p className="mt-2 text-xs text-gray-500">
            💡 提示：在 AI助手 页面配置API密钥后可以使用AI生成功能
          </p>
        )}
      </div>
    );
  };

  // 渲染帮助提示
  const renderHelp = () => {
    if (!showHelp) return null;

    return (
      <div className="mb-3 bg-blue-50 rounded-lg p-3 text-xs text-blue-700 border border-blue-200">
        <p className="font-medium mb-1">操作指南：</p>
        <ul className="space-y-0.5 list-disc list-inside">
          <li>单击节点：选中并显示操作按钮</li>
          <li>双击节点：展开/折叠子节点</li>
          <li>拖拽节点：移动节点位置</li>
          <li>拖拽空白处：移动画布</li>
          <li>滚轮（PC）：缩放视图</li>
          <li>双指捏合（手机）：缩放视图</li>
        </ul>
      </div>
    );
  };

  // 渲染编辑弹窗
  const renderEditModal = () => {
    if (!showEditModal || !editingNode) return null;

    return (
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
        onClick={() => setShowEditModal(false)}
      >
        <div
          className="bg-white rounded-2xl p-5 w-[350px] max-w-[90vw] shadow-xl"
          onClick={e => e.stopPropagation()}
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4">编辑节点</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              节点内容
            </label>
            <input
              type="text"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="输入节点内容..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveNodeEdit();
              }}
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
              className="flex-1 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 普通模式
  if (!isFullscreen) {
    return (
      <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border-2 border-amber-200 p-4 shadow-lg">
        {renderHeader()}
        {renderInputPanel()}
        {renderHelp()}
        {renderCanvas(false)}
        {renderEditModal()}
      </div>
    );
  }

  // 全屏模式
  return (
    <>
      {/* 全屏遮罩 */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={toggleFullscreen} />

      {/* 全屏容器 */}
      <div className="fixed inset-4 sm:inset-8 lg:inset-16 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border-2 border-amber-200 shadow-2xl z-50 flex flex-col p-4 sm:p-6">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            <h2 className="text-xl font-bold text-amber-800">思维导图</h2>
          </div>
          <div className="flex items-center gap-1">
            <ToolbarButton
              onClick={() => setShowInputPanel(!showInputPanel)}
              icon="✨"
              title="AI生成"
              className="text-amber-600 hover:bg-amber-100"
            />
            <ToolbarButton
              onClick={() => setShowHelp(!showHelp)}
              icon="❓"
              title="帮助"
              className="text-amber-600 hover:bg-amber-100"
            />
            <ToolbarButton
              onClick={resetView}
              icon="🔄"
              title="重置视图"
              className="text-amber-600 hover:bg-amber-100"
            />
            <input
              type="file"
              accept=".json"
              className="hidden"
              id="mindmap-import-fullscreen"
              onChange={importMindMap}
            />
            <label
              htmlFor="mindmap-import-fullscreen"
              className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
              title="导入"
            >
              📥
            </label>
            <ToolbarButton
              onClick={exportMindMap}
              icon="📤"
              title="导出"
              className="text-amber-600 hover:bg-amber-100"
            />
            <ToolbarButton
              onClick={toggleFullscreen}
              icon="✕"
              title="退出全屏"
              className="text-red-500 hover:bg-red-100"
            />
          </div>
        </div>

        {/* 输入面板（全屏模式） */}
        {showInputPanel && (
          <div className="mb-4 bg-white rounded-xl p-4 border border-amber-200 shadow-md max-h-64 overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">生成思维导图</h3>
              <button
                onClick={() => {
                  setShowInputPanel(false);
                  setGenerationError(null);
                  setInputText('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="输入主题或内容，AI将自动生成思维导图...&#10;例如：人工智能的发展与应用"
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
              rows={3}
            />

            {generationError && (
              <div className="mt-2 p-2 bg-red-50 rounded-lg text-xs text-red-600">
                {generationError}
              </div>
            )}

            {isGenerating && (
              <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-blue-700">AI正在生成...</span>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <button
                onClick={generateFromText}
                disabled={!inputText.trim() || isGenerating}
                className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                文本生成
              </button>
              <button
                onClick={generateMindMapFromAI}
                disabled={!inputText.trim() || isGenerating || !apiService.hasApiKey()}
                className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {isGenerating ? '生成中...' : 'AI生成'}
              </button>
              {isGenerating && (
                <button
                  onClick={handleStopGeneration}
                  className="px-3 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                >
                  停止
                </button>
              )}
            </div>

            {!apiService.hasApiKey() && (
              <p className="mt-2 text-xs text-gray-500">
                💡 提示：在 AI助手 页面配置API密钥后可以使用AI生成功能
              </p>
            )}
          </div>
        )}

        {/* 帮助提示（全屏模式） */}
        {showHelp && (
          <div className="mb-4 bg-blue-50 rounded-lg p-3 text-xs text-blue-700 border border-blue-200">
            <p className="font-medium mb-1">操作指南：</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>单击节点：选中并显示操作按钮</li>
              <li>双击节点：展开/折叠子节点</li>
              <li>拖拽节点：移动节点位置</li>
              <li>拖拽空白处：移动画布</li>
              <li>滚轮（PC）：缩放视图</li>
              <li>双指捏合（手机）：缩放视图</li>
            </ul>
          </div>
        )}

        {/* 画布 */}
        <div className="flex-1 min-h-0">
          {renderCanvas(true)}
        </div>

        {/* 编辑弹窗 */}
        {renderEditModal()}
      </div>
    </>
  );
}
