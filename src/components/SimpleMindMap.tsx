import React, { useState, useRef, useCallback, useEffect } from 'react';

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

const NODE_WIDTH = 120;
const NODE_HEIGHT = 36;
const HORIZONTAL_GAP = 140;
const VERTICAL_GAP = 50;

export default function SimpleMindMap() {
  const [mindMapData, setMindMapData] = useState<MindMapNode>(() => {
    const saved = localStorage.getItem('simple-mindmap-data');
    return saved ? JSON.parse(saved) : defaultMindMapData;
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

  const containerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const draggingNodeIdRef = useRef<string | null>(null);

  // 保存思维导图数据
  useEffect(() => {
    localStorage.setItem('simple-mindmap-data', JSON.stringify(mindMapData));
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

  // 处理鼠标抬起
  const handleMouseUp = useCallback(() => {
    draggingNodeIdRef.current = null;
    setDraggingNodeId(null);
    isPanningRef.current = false;
    setIsPanning(false);
  }, []);

  // 添加事件监听
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mouseleave', handleMouseUp);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

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

  // 处理画布拖拽
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (draggingNodeId) return;
    isPanningRef.current = true;
    setIsPanning(true);
    setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
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

  return (
    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border-2 border-amber-200 p-4 shadow-lg">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🧠</span>
          <h2 className="text-lg font-bold text-amber-800">思维导图</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
            title="帮助"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            onClick={resetView}
            className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
            title="重置视图"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <input
            type="file"
            accept=".json"
            className="hidden"
            id="mindmap-import"
            onChange={importMindMap}
          />
          <label
            htmlFor="mindmap-import"
            className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
            title="导入"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </label>
          <button
            onClick={exportMindMap}
            className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
            title="导出"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          <button
            onClick={resetToDefault}
            className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
            title="重置默认"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* 帮助提示 */}
      {showHelp && (
        <div className="mb-3 bg-blue-50 rounded-lg p-3 text-xs text-blue-700 border border-blue-200">
          <p className="font-medium mb-1">操作指南：</p>
          <ul className="space-y-0.5 list-disc list-inside">
            <li>单击节点：选中并显示操作按钮</li>
            <li>双击节点：展开/折叠子节点</li>
            <li>拖拽节点：移动节点位置</li>
            <li>拖拽空白处：移动画布</li>
            <li>滚轮：缩放视图</li>
          </ul>
        </div>
      )}

      {/* 画布容器 */}
      <div
        ref={containerRef}
        className="relative bg-white rounded-xl overflow-hidden border border-amber-100"
        style={{
          height: '280px',
          cursor: draggingNodeId ? 'grabbing' : isPanning ? 'grabbing' : 'grab'
        }}
        onMouseDown={handleCanvasMouseDown}
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
            style={{ width: '2000px', height: '1500px', overflow: 'visible' }}
          >
            {renderConnections()}
          </svg>
          {renderNode(mindMapData, 0, true)}
        </div>
      </div>

      {/* 编辑弹窗 */}
      {showEditModal && editingNode && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
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
      )}
    </div>
  );
}
