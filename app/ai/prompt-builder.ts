import type { DOMSnapshot } from './types';

export function buildPageUnderstandingPrompt(snapshot: DOMSnapshot): string {
  return `你是一个广告投放系统的页面结构分析专家。请分析以下网页DOM结构快照，识别页面类型和关键数据区域。

## 页面信息
- URL: ${snapshot.url}
- 标题: ${snapshot.title}
- 平台: ${snapshot.metadata.platform}

## DOM结构快照

### 表格结构
${snapshot.tables.map((t, i) => `
表格${i + 1}:
  选择器: ${t.selector}
  表头: ${t.headers.join(', ')}
  行数: ${t.rowCount}
  样本行:
${t.sampleRows.map(row => `    ${row.join(' | ')}`).join('\n')}
`).join('\n')}

### 图表区域
${snapshot.charts.map((c, i) => `
图表${i + 1}: ${c.type}元素, class="${c.className}", id="${c.id}"
`).join('\n')}

### 表单结构
${snapshot.forms.map((f, i) => `
表单${i + 1}:
  选择器: ${f.selector}
  输入项: ${f.inputs.map(inp => `${inp.name}(${inp.type})=${inp.value}`).join(', ')}
`).join('\n')}

### JSP/HTML渲染数据线索
隐藏字段:
${(snapshot.hiddenFields || []).map(field => `- ${field.name || field.id}: ${field.value}`).join('\n') || '无'}

data-*属性:
${(snapshot.dataAttributes || []).map(item => `- ${item.selector} ${JSON.stringify(item.attributes)} 文本:${item.text}`).join('\n') || '无'}

内联脚本数据片段:
${(snapshot.scriptData || []).map(item => `- ${item.label}:\n${item.content}`).join('\n') || '无'}

### 最近JSON接口响应
${(snapshot.networkRequests || []).map((req, i) => `
接口${i + 1}: ${req.method} ${req.url}
状态: ${req.status}, 类型: ${req.contentType}
请求: ${req.requestBody || ''}
响应片段: ${req.responseText}
`).join('\n') || '无'}

### 关键文本节点
${snapshot.keyTexts.map(text => `- ${text}`).join('\n')}

### 页面可见文本摘要
${truncateForPrompt(snapshot.pageText || '', 6000)}

## 请以JSON格式返回以下内容（只返回JSON，不要其他文字）：
{
  "pageType": "report" | "campaign_list" | "ad_creative" | "settings" | "other",
  "dataRegions": [
    {
      "selector": "CSS选择器",
      "type": "table" | "chart" | "metric_card" | "filter_bar",
      "label": "区域名称",
      "metrics": ["指标1", "指标2"]
    }
  ],
  "keyMetrics": ["识别到的关键指标名称列表"],
  "timeRange": "时间范围描述或null",
  "platform": "广告平台标识",
  "confidence": 0.0-1.0
}`;
}

export function buildDataExtractionPrompt(
  snapshot: DOMSnapshot,
  understanding: Record<string, unknown>,
): string {
  return `你是一个广告投放数据提取专家。请从以下页面DOM结构快照中提取结构化的业务数据。

## 页面理解结果
${JSON.stringify(understanding, null, 2)}

## 数据源快照
以下数据来自同一页面，包含HTML/JSP渲染后的DOM、隐藏字段、内联脚本变量、页面可见文本，以及页面运行后捕获到的JSON接口响应。请优先使用表格与JSON接口响应中的数值，无法确定时再参考页面文本。

${buildSnapshotPayload(snapshot)}

## 请以JSON格式返回提取的数据（只返回JSON，不要其他文字）：
{
  "url": "${snapshot.url}",
  "timestamp": ${snapshot.timestamp},
  "pageType": "页面类型",
  "metrics": [
    {
      "name": "指标名称",
      "value": 数值,
      "unit": "单位(%/元/次等)",
      "changePercent": 变化百分比或null,
      "trend": "up" | "down" | "stable"
    }
  ],
  "dimensions": {
    "key": "value"
  },
  "campaigns": [
    {
      "id": "计划ID",
      "name": "计划名称",
      "status": "状态",
      "metrics": [同上结构的指标数组]
    }
  ],
  "rawText": "页面上的关键数字文本摘要"
}`;
}

export function buildAnomalyDetectionPrompt(
  currentData: Record<string, unknown>,
  historyData: Record<string, unknown>[],
): string {
  return `你是一个广告数据分析专家。请分析以下当前数据是否出现异常。

## 当前数据
${JSON.stringify(currentData, null, 2)}

## 历史数据（最近记录）
${JSON.stringify(historyData.slice(0, 20), null, 2)}

## 异常检测规则参考
- CTR异常下降: 较历史均值下降超过30%
- 消耗异常: 单日消耗波动超过50%或消耗停滞(0增长)
- CPA异常波动: 较历史均值上涨超过50%
- 转化量骤减: 较历史均值下降超过40%

## 请以JSON格式返回检测到的异常（只返回JSON，不要其他文字）：
{
  "anomalies": [
    {
      "id": "a_${Date.now()}_索引",
      "type": "ctr_drop" | "cost_spike" | "cpa_surge" | "conversion_drop" | "cost_stagnation",
      "severity": "high" | "medium" | "low",
      "title": "简短异常标题",
      "description": "详细异常描述",
      "currentValue": 当前值,
      "expectedValue": 期望值,
      "deviationPercent": 偏差百分比,
      "relatedMetrics": ["相关指标名"],
      "relatedCampaignIds": ["相关计划ID"],
      "timestamp": ${Date.now()},
      "confidence": 0.0-1.0
    }
  ]
}

如果没有异常，返回: { "anomalies": [] }`;
}

export function buildSuggestionPrompt(
  anomalies: Record<string, unknown>[],
  context: Record<string, unknown>,
): string {
  return `你是一个广告优化专家。基于以下异常检测结果和上下文信息，生成可操作的优化建议。

## 检测到的异常
${JSON.stringify(anomalies, null, 2)}

## 上下文信息
${JSON.stringify(context, null, 2)}

## 请以JSON格式返回建议（只返回JSON，不要其他文字）：
{
  "suggestions": [
    {
      "id": "s_${Date.now()}_索引",
      "type": "anomaly" | "opportunity" | "efficiency" | "strategy",
      "priority": "high" | "medium" | "low",
      "title": "建议标题（简短）",
      "description": "详细建议说明",
      "confidence": 0.0-1.0,
      "actionHint": "建议的操作方向"
    }
  ]
}

如果没有建议，返回: { "suggestions": [] }`;
}

export function buildPatternMiningPrompt(dataPoints: Record<string, unknown>[]): string {
  return `你是一个广告数据挖掘专家。请从以下累积的历史数据中发现有价值的模式和规律。

## 历史数据点（共${dataPoints.length}条）
${JSON.stringify(dataPoints.slice(0, 30), null, 2)}

## 请以JSON格式返回发现的模式（只返回JSON，不要其他文字）：
{
  "patterns": [
    {
      "id": "p_${Date.now()}_索引",
      "type": "optimization" | "risk" | "trend",
      "description": "模式描述",
      "confidence": 0.0-1.0,
      "discoveredAt": ${Date.now()},
      "relatedMetrics": ["相关指标"],
      "evidence": "发现此模式的证据描述",
      "actionable": true | false
    }
  ]
}

如果没有发现模式，返回: { "patterns": [] }`;
}

function buildSnapshotPayload(snapshot: DOMSnapshot): string {
  return truncateForPrompt(JSON.stringify({
    url: snapshot.url,
    title: snapshot.title,
    timestamp: snapshot.timestamp,
    tables: snapshot.tables,
    forms: snapshot.forms,
    hiddenFields: snapshot.hiddenFields || [],
    dataAttributes: snapshot.dataAttributes || [],
    scriptData: snapshot.scriptData || [],
    keyTexts: snapshot.keyTexts,
    pageText: snapshot.pageText || '',
    networkRequests: (snapshot.networkRequests || []).map(req => ({
      url: req.url,
      method: req.method,
      status: req.status,
      contentType: req.contentType,
      requestBody: req.requestBody,
      responseText: req.responseText,
    })),
  }, null, 2), 28000);
}

function truncateForPrompt(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value || '无';
  return `${value.slice(0, maxLength)}\n...[已截断 ${value.length - maxLength} 字符]`;
}
