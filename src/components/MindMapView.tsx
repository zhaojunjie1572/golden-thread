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
    
    let currentParent: MindMapNode | null = null;
    let currentSubParent: MindMapNode | null = null;
    
    for (let line of lines) {
      line = line.trim();
      if (line.startsWith('## ')) {
        const label = line.substring(3).trim();
        currentParent = {
          id: `node-${crypto.randomUUID()}`,
          label,
          children: []
        };
        root.children?.push(currentParent);
        currentSubParent = null;
      } else if (line.startsWith('- ')) {
        const label = line.substring(2).trim();
        const node: MindMapNode = {
          id: `node-${crypto.randomUUID()}`,
          label
        };
        if (currentSubParent) {
          const parent = currentSubParent as MindMapNode;
          if (!parent.children) parent.children = [];
          parent.children.push(node);
        } else if (currentParent) {
          const parent = currentParent as MindMapNode;
          if (!parent.children) parent.children = [];
          parent.children.push(node);
        }
      } else if (line.startsWith('# ') && !line.startsWith('## ')) {
        root.label = line.substring(2).trim();
      }
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
      const systemPrompt = `你是一个专业的思维导图生成助手。请根据用户提供的协议内容，生成一个结构化的思维导图。

要求：
1. 使用Markdown格式输出
2. 根节点用 # 开头
3. 主要分支用 ## 开头
4. 子节点用 - 开头
5. 结构清晰，层次分明
6. 内容精炼，突出重点

示例格式：
# 协议主题
## 主要分支1
- 子项1
- 子项2
## 主要分支2
- 子项1
- 子项2`;

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
            const mindMap = parseMindMapFromText(fullContent);
            setMindMapData(mindMap);
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
    const nodeWidth = Math.max(120, node.label.length * 14 + 40);
    const nodeHeight = 40;
    const horizontalGap = 180;
    const verticalGap = 60;

    const children = node.children || [];
    const totalHeight = Math.max(
      nodeHeight,
      children.reduce((sum, child, i) => {
        const childHeight = getTreeHeight(child, verticalGap);
        return sum + childHeight + (i > 0 ? verticalGap : 0);
      }, 0)
    );

    let currentY = y - totalHeight / 2 + nodeHeight / 2;

    return (
      <React.Fragment key={node.id}>
        <g transform={`translate(${x}, ${y})`}>
          <rect
            x={-nodeWidth / 2}
            y={-nodeHeight / 2}
            width={nodeWidth}
            height={nodeHeight}
            rx={8}
            fill={level === 0 ? '#d97706' : level === 1 ? '#fbbf24' : '#fef3c7'}
            stroke={level === 0 ? '#92400e' : level === 1 ? '#d97706' : '#fbbf24'}
            strokeWidth={2}
          />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fill={level === 0 ? 'white' : '#78350f'}
            fontSize={level === 0 ? 14 : 12}
            fontWeight={level <= 1 ? 'bold' : 'normal'}
          >
            {node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label}
          </text>
        </g>

        {children.map((child) => {
          const childHeight = getTreeHeight(child, verticalGap);
          const childY = currentY + childHeight / 2;
          currentY += childHeight + verticalGap;

          return (
            <React.Fragment key={child.id}>
              <line
                x1={x + nodeWidth / 2}
                y1={y}
                x2={x + horizontalGap - 30}
                y2={childY}
                stroke="#d97706"
                strokeWidth={2}
              />
              <line
                x1={x + horizontalGap - 30}
                y1={childY}
                x2={x + horizontalGap}
                y2={childY}
                stroke="#d97706"
                strokeWidth={2}
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.001 0 01-15.357-2m15.357 2H15" />
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
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">思维导图</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleGenerateMindMap}
                      className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <RefreshIcon />
                      重新生成
                    </button>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-8 overflow-auto">
                  <svg
                    ref={svgRef}
                    width={getTreeWidth(mindMapData, 180) + 200}
                    height={getTreeHeight(mindMapData, 60) + 100}
                    className="mx-auto"
                  >
                    {renderTree(mindMapData, 100, (getTreeHeight(mindMapData, 60) + 100) / 2, 0)}
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
