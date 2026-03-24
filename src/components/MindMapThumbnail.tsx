import { useState, useEffect } from 'react';

interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
}

interface MindMapThumbnailProps {
  onClick?: () => void;
}

const defaultData: MindMapNode = {
  id: 'root',
  label: '思维导图',
  children: [
    { id: '1', label: '核心概念' },
    { id: '2', label: '主要用途' },
    { id: '3', label: '构成要素' },
  ]
};

export default function MindMapThumbnail({ onClick }: MindMapThumbnailProps) {
  const [mindMapData, setMindMapData] = useState<MindMapNode>(defaultData);
  const [nodeCount, setNodeCount] = useState(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('simple-mindmap-data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.id && parsed.label) {
          setMindMapData(parsed);
          // 计算节点数量
          const countNodes = (node: MindMapNode): number => {
            let count = 1;
            if (node.children) {
              count += node.children.reduce((sum, child) => sum + countNodes(child), 0);
            }
            return count;
          };
          setNodeCount(countNodes(parsed));
        }
      }
    } catch (e) {
      console.error('Failed to load mind map data:', e);
    }
  }, []);

  // 简化的节点渲染 - 只显示前两层
  const renderThumbnail = () => {
    const centerX = 50;
    const centerY = 50;
    
    return (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* 背景 */}
        <rect width="100" height="100" fill="#fffbeb" rx="8" />
        
        {/* 根节点 */}
        <g>
          <rect
            x={centerX - 20}
            y={centerY - 8}
            width="40"
            height="16"
            fill="#f59e0b"
            rx="4"
          />
          <text
            x={centerX}
            y={centerY + 3}
            textAnchor="middle"
            fontSize="6"
            fill="white"
            fontWeight="bold"
          >
            {mindMapData.label.slice(0, 6)}
          </text>
        </g>
        
        {/* 第一层子节点 */}
        {mindMapData.children?.slice(0, 4).map((child, index) => {
          const angle = (index * 90 + 45) * (Math.PI / 180);
          const radius = 30;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          
          return (
            <g key={child.id}>
              {/* 连线 */}
              <line
                x1={centerX}
                y1={centerY}
                x2={x}
                y2={y}
                stroke="#fbbf24"
                strokeWidth="1.5"
              />
              {/* 子节点 */}
              <rect
                x={x - 15}
                y={y - 6}
                width="30"
                height="12"
                fill="#fef3c7"
                stroke="#f59e0b"
                strokeWidth="1"
                rx="3"
              />
              <text
                x={x}
                y={y + 3}
                textAnchor="middle"
                fontSize="5"
                fill="#92400e"
              >
                {child.label.slice(0, 5)}
              </text>
            </g>
          );
        })}
        
        {/* 更多节点指示 */}
        {(mindMapData.children?.length || 0) > 4 && (
          <text x="90" y="90" fontSize="6" fill="#9ca3af" textAnchor="end">
            +{(mindMapData.children!.length - 4)}
          </text>
        )}
      </svg>
    );
  };

  return (
    <div 
      className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border-2 border-amber-200 p-4 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
      onClick={onClick}
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧠</span>
          <h2 className="text-lg font-bold text-amber-800">思维导图</h2>
        </div>
        <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
          {nodeCount} 节点
        </span>
      </div>
      
      {/* 缩略图 */}
      <div className="aspect-video bg-white rounded-xl border border-amber-100 overflow-hidden mb-3">
        {renderThumbnail()}
      </div>
      
      {/* 提示文字 */}
      <p className="text-xs text-gray-500 text-center">
        点击查看完整思维导图
      </p>
    </div>
  );
}
