import type {
  DOMSnapshot,
  TableStructure,
  ChartHint,
  FormStructure,
  HiddenFieldHint,
  DataAttributeHint,
  ScriptDataHint,
} from '../../app/ai/types';
import { logger } from '../../app/utils/logger';
import { getRecentNetworkRequests } from './network-observer';

const MAX_SAMPLE_ROWS = 5;
const MAX_KEY_TEXTS = 80;
const MAX_TABLE_COLUMNS = 20;
const MAX_PAGE_TEXT_LENGTH = 12000;
const MAX_SCRIPT_HINTS = 12;
const MAX_DATA_ATTR_HINTS = 30;
const MAX_HIDDEN_FIELDS = 80;

export function collectDOMSnapshot(): DOMSnapshot {
  const startTime = performance.now();

  const snapshot: DOMSnapshot = {
    url: window.location.href,
    title: document.title,
    timestamp: Date.now(),
    tables: collectTables(),
    charts: collectChartHints(),
    forms: collectForms(),
    keyTexts: collectKeyTexts(),
    hiddenFields: collectHiddenFields(),
    dataAttributes: collectDataAttributes(),
    scriptData: collectScriptData(),
    networkRequests: getRecentNetworkRequests(20),
    pageText: collectPageText(),
    metadata: {
      url: window.location.href,
      title: document.title,
      platform: detectPlatform(),
      lastModified: document.lastModified,
    },
  };

  const elapsed = performance.now() - startTime;
  logger.debug(`DOM snapshot collected in ${elapsed.toFixed(1)}ms`, {
    tables: snapshot.tables.length,
    charts: snapshot.charts.length,
    forms: snapshot.forms.length,
    keyTexts: snapshot.keyTexts.length,
    hiddenFields: snapshot.hiddenFields?.length || 0,
    scriptData: snapshot.scriptData?.length || 0,
    networkRequests: snapshot.networkRequests?.length || 0,
  });

  return snapshot;
}

function collectTables(): TableStructure[] {
  const tables: TableStructure[] = [];
  const elements = document.querySelectorAll('table');

  elements.forEach((table, index) => {
    const headers: string[] = [];
    const headerRow = table.querySelector('thead tr, tr:first-child');
    if (headerRow) {
      headerRow.querySelectorAll('th, td').forEach(cell => {
        const text = cell.textContent?.trim() || '';
        if (text && headers.length < MAX_TABLE_COLUMNS) {
          headers.push(text);
        }
      });
    }

    if (headers.length === 0) return;

    const rows = table.querySelectorAll('tbody tr, tr');
    const sampleRows: string[][] = [];
    let dataRowCount = 0;

    rows.forEach((row, rowIdx) => {
      if (rowIdx === 0 && headerRow && row === headerRow) return;

      const cells: string[] = [];
      row.querySelectorAll('td, th').forEach(cell => {
        cells.push(cell.textContent?.trim() || '');
      });

      if (cells.some(c => /\d/.test(c))) {
        dataRowCount++;
        if (sampleRows.length < MAX_SAMPLE_ROWS) {
          sampleRows.push(cells.slice(0, MAX_TABLE_COLUMNS));
        }
      }
    });

    const selector = buildSelector(table);
    tables.push({
      selector,
      headers,
      rowCount: dataRowCount,
      sampleRows,
    });
  });

  return tables;
}

function collectChartHints(): ChartHint[] {
  const hints: ChartHint[] = [];
  const selectors = ['canvas', 'svg', '[class*="chart"]', '[class*="echart"]', '[class*="highchart"]', '[id*="chart"]'];

  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      const tag = el.tagName.toLowerCase();
      const type = (tag === 'canvas' ? 'canvas' : tag === 'svg' ? 'svg' : 'div') as ChartHint['type'];

      hints.push({
        selector: buildSelector(el),
        type,
        className: el.className?.toString() || '',
        id: el.id || '',
      });
    });
  });

  return hints.slice(0, 10);
}

function collectForms(): FormStructure[] {
  const forms: FormStructure[] = [];

  document.querySelectorAll('form, [class*="filter"], [class*="search"]').forEach(el => {
    const inputs: { name: string; type: string; value: string }[] = [];
    el.querySelectorAll('input, select, textarea').forEach(input => {
      const inp = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      inputs.push({
        name: inp.getAttribute('name') || inp.getAttribute('placeholder') || inp.id || '',
        type: inp.getAttribute('type') || inp.tagName.toLowerCase(),
        value: inp.getAttribute('type') === 'password' ? '***' : sanitizeValue(inp.value || '', 200),
      });
    });

    if (inputs.length > 0) {
      const submit = el.querySelector('[type="submit"], button') as HTMLElement | null;
      forms.push({
        selector: buildSelector(el),
        inputs,
        submitText: submit?.textContent?.trim() || '',
      });
    }
  });

  return forms.slice(0, 5);
}

function collectKeyTexts(): string[] {
  const texts: Set<string> = new Set();

  const metricKeywords = [
    '曝光', '点击', '消耗', '转化', 'CPA', 'CTR', 'ROI', '展现',
    '点击率', '转化率', '转化成本', '千次展现成本', '花费', '预算',
    'impression', 'click', 'cost', 'conversion', 'revenue',
    '计划', '广告', '创意', '广告组', 'campaign', 'ad', 'creative',
  ];

  const textNodes = document.querySelectorAll(
    'h1, h2, h3, h4, h5, h6, label, caption, th, .metric, .kpi, [class*="metric"], [class*="kpi"], [class*="value"], [class*="number"], [id*="metric"], [id*="data"], [id*="report"]',
  );

  textNodes.forEach(node => {
    const text = node.textContent?.trim() || '';
    if (!text || text.length > 100) return;

    const hasMetric = metricKeywords.some(kw => text.includes(kw));
    if (hasMetric || /\d+\.?\d*%?/.test(text)) {
      texts.add(text);
    }
  });

  return Array.from(texts).slice(0, MAX_KEY_TEXTS);
}

function collectHiddenFields(): HiddenFieldHint[] {
  const fields: HiddenFieldHint[] = [];

  document.querySelectorAll('input[type="hidden"], input[hidden], textarea[hidden], select[hidden]').forEach(el => {
    const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const name = input.getAttribute('name') || '';
    const id = input.id || '';
    const value = sanitizeValue(input.value || input.getAttribute('value') || '', 500);
    if (!name && !id && !value) return;

    fields.push({
      selector: buildSelector(el),
      name,
      id,
      value,
    });
  });

  return fields.slice(0, MAX_HIDDEN_FIELDS);
}

function collectDataAttributes(): DataAttributeHint[] {
  const hints: DataAttributeHint[] = [];

  document.querySelectorAll<HTMLElement>('[data-id], [data-code], [data-value], [data-name], [data-json], [data-url], [data-api], [data-list], [data-total], [data-count], [data-campaign]').forEach(el => {
    const attributes: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      if (!attr.name.startsWith('data-')) continue;
      attributes[attr.name] = sanitizeValue(attr.value, 500);
    }

    if (Object.keys(attributes).length === 0) return;
    hints.push({
      selector: buildSelector(el),
      text: sanitizeValue(el.textContent?.trim() || '', 300),
      attributes,
    });
  });

  return hints.slice(0, MAX_DATA_ATTR_HINTS);
}

function collectScriptData(): ScriptDataHint[] {
  const hints: ScriptDataHint[] = [];
  const scriptKeyword = /(campaign|ad|advert|report|stat|metric|cost|click|ctr|cpa|conversion|budget|计划|广告|报表|消耗|点击|转化|预算|ajax|url|data)/i;
  const assignmentPattern = /(?:var|let|const|window\.)\s*[\w.$]+\s*=\s*(?:\{[\s\S]{0,2000}?\}|\[[\s\S]{0,2000}?\]|["'][\s\S]{0,500}?["']|\d+(?:\.\d+)?)/g;
  const ajaxUrlPattern = /(?:url|action)\s*:\s*["'][^"']{1,300}["']|[$.]ajax\s*\([\s\S]{0,1200}?\)|fetch\s*\(\s*["'][^"']{1,300}["']/g;

  document.querySelectorAll<HTMLScriptElement>('script:not([src])').forEach((script, index) => {
    const text = script.textContent || '';
    if (!scriptKeyword.test(text)) return;

    const assignments = Array.from(text.matchAll(assignmentPattern)).map(match => match[0]);
    const ajaxHints = Array.from(text.matchAll(ajaxUrlPattern)).map(match => match[0]);
    const content = [...assignments, ...ajaxHints]
      .map(value => sanitizeValue(value, 1200))
      .filter(Boolean)
      .slice(0, 10)
      .join('\n');

    if (content) {
      hints.push({
        label: `inline-script-${index + 1}`,
        content,
      });
    }
  });

  return hints.slice(0, MAX_SCRIPT_HINTS);
}

function collectPageText(): string {
  const root = document.body;
  if (!root) return '';

  const rawText = root.innerText || root.textContent || '';
  const lines = rawText
    .split(/\n+/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length >= 2 && line.length <= 300)
    .filter((line, index, array) => array.indexOf(line) === index);

  const metricLines = lines.filter(line =>
    /\d/.test(line) || /曝光|点击|消耗|转化|CPA|CTR|ROI|预算|计划|广告|报表|成本|余额|充值|花费|impression|click|cost|conversion|campaign/i.test(line),
  );

  return metricLines.join('\n').slice(0, MAX_PAGE_TEXT_LENGTH);
}

function detectPlatform(): string {
  const url = window.location.href.toLowerCase();
  const title = document.title.toLowerCase();

  const platformPatterns: [string, RegExp][] = [
    ['巨量引擎', /oceanengine|巨量|bytedance|toutiao/i],
    ['腾讯广告', /e\.qq\.com|广点通|gdt|tencent/i],
    ['百度营销', /baidu|凤巢|sem\.baidu/i],
    ['Google Ads', /ads\.google|googleads|google adwords/i],
    ['Meta Ads', /facebook\.com\/ads|meta ads/i],
    ['快手广告', /kuaishou|e\.kuaishou/i],
  ];

  for (const [platform, pattern] of platformPatterns) {
    if (pattern.test(url) || pattern.test(title)) {
      return platform;
    }
  }

  return '未知平台';
}

function buildSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  const classes = Array.from(el.classList).slice(0, 3).join('.');
  if (classes) return `${el.tagName.toLowerCase()}.${classes}`;
  return el.tagName.toLowerCase();
}

function sanitizeValue(value: string, maxLength: number): string {
  return value
    .replace(/((?:password|passwd|pwd|token|secret|authorization|cookie|session|api[_-]?key)=)[^&\s"]+/gi, '$1***')
    .replace(/("(?:password|passwd|pwd|token|secret|authorization|cookie|session|api[_-]?key)"\s*:\s*)"[^"]*"/gi, '$1"***"')
    .slice(0, maxLength);
}
