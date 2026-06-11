# AI广告投放助手 - 产品方案

## 1. 产品定位

为传统广告投放管理后台提供 **AI智能副驾驶**，通过浏览器插件形式，实时分析页面信息，积累行业优化知识，在适当时机向运营人员提供数据预警、效率优化和策略建议。

**核心特征**：
- **零侵入**：不修改现有后台代码，插件独立运行
- **AI自适应**：不硬编码页面选择器，由DeepSeek动态理解任意广告后台页面结构
- **纯本地**：所有持久化数据存储在用户本地，支持导入导出实现多设备同步
- **内部工具**：面向团队内部运营人员提效

---

## 2. 核心需求梳理

### 2.1 功能需求

| 模块 | 功能点 | 优先级 |
|------|--------|--------|
| **页面感知** | AI自适应理解页面DOM，实时采集数据 | P0 |
| **记忆系统** | 本地累积操作历史和业务数据，支持导入导出 | P0 |
| **知识沉淀** | AI自动挖掘优化模式，积累最佳实践 | P1 |
| **智能建议** | 数据异常预警、效率优化、策略建议 | P0 |
| **用户控制** | 建议接收开关、频率设置、数据管理 | P1 |

### 2.2 非功能需求

- **零侵入**：不对现有后台系统做任何代码修改
- **自适应**：通过AI理解页面结构，兼容任意广告后台
- **隐私安全**：MVP阶段全部数据本地存储，架构预留扩展能力
- **可迁移**：通过导入导出支持多设备使用，未来支持云端同步

---

## 3. 技术架构方案

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                            │
│                                                             │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │  广告后台页面    │◄──►│     AI助手插件 Content Script  │   │
│  │  (任意广告平台)  │    │  - DOM快照采集                │   │
│  │                 │    │  - 页面元素标注                │   │
│  └─────────────────┘    │  - 用户操作拦截                │   │
│                         └──────────────┬─────────────────┘   │
│                                        │                     │
│  ┌─────────────────────────────────────▼─────────────────┐   │
│  │           插件后台 Background / Service Worker         │   │
│  │  - 跨页面状态管理      - IndexedDB 持久化              │   │
│  │  - DeepSeek API 调用   - Prompt 编排                   │   │
│  │  - 导入导出 / 合并排重 - 建议调度与冷却                │   │
│  └─────────────────────────────────────┬─────────────────┘   │
│                                        │                     │
└────────────────────────────────────────┼─────────────────────┘
                                         │ HTTPS
                                         ▼
                              ┌──────────────────────┐
                              │    DeepSeek API      │
                              │   (用户自有 API Key)  │
                              │                      │
                              │  - 页面结构理解       │
                              │  - 业务数据提取       │
                              │  - 异常检测分析       │
                              │  - 优化建议生成       │
                              │  - 知识模式挖掘       │
                              └──────────────────────┘
```

**架构要点**：
- 无自建后端服务，插件直连 DeepSeek API
- 用户自行填写 API Key，插件仅做调用转发
- 所有业务数据持久化在浏览器 IndexedDB 中
- AI自适应：DOM理解、数据提取均由 DeepSeek 完成，不依赖硬编码选择器

### 3.2 核心组件设计

#### A. 页面感知模块 (Content Script)

```typescript
interface PageObserver {
  // 1. DOM快照采集（轻量，仅采集结构化摘要）
  captureDOMSnapshot(): DOMSnapshot;

  // 2. 用户操作拦截与记录
  trackUserActions(): void;

  // 3. 页面变化检测（MutationObserver + 节流）
  detectPageChanges(): void;
}

// DOM快照结构（发送给DeepSeek进行理解）
interface DOMSnapshot {
  url: string;
  title: string;
  timestamp: number;
  // 只采集结构信息，不采集完整DOM树
  tables: TableStructure[];    // 表格结构
  charts: ChartHint[];         // 图表区域标识
  forms: FormStructure[];      // 表单结构
  keyTexts: string[];          // 关键文本节点
  metadata: PageMetadata;      // 页面元信息
}
```

#### B. AI理解引擎 (Background → DeepSeek)

```typescript
// DeepSeek Prompt 编排模块
interface AIEngine {
  // 页面理解：让AI识别当前页面类型和关键数据区域
  understandPage(snapshot: DOMSnapshot): PageUnderstanding;

  // 数据提取：从页面快照中提取结构化业务数据
  extractData(snapshot: DOMSnapshot, context: PageUnderstanding): ExtractedData;

  // 异常分析：对比历史数据，检测异常
  analyzeAnomaly(current: ExtractedData, history: DataPoint[]): AnomalyResult[];

  // 建议生成：基于分析结果生成可操作建议
  generateSuggestions(anomalies: AnomalyResult[], context: MemoryContext): Suggestion[];

  // 知识挖掘：从累积数据中自动发现优化模式
  minePatterns(data: DataPoint[]): Pattern[];
}

// AI返回的页面理解结果
interface PageUnderstanding {
  pageType: 'report' | 'campaign_list' | 'ad_creative' | 'settings' | 'other';
  dataRegions: DataRegion[];     // AI识别出的数据区域
  keyMetrics: string[];          // 识别到的指标名称
  timeRange?: string;            // 时间范围
  platform?: string;             // 广告平台标识
}
```

#### C. 记忆系统 (本地优先 + 可扩展架构)

```typescript
// 存储层抽象接口 - 支持本地/云端无缝切换
interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  export(): Promise<ExportData>;
  import(data: ExportData, strategy: MergeStrategy): Promise<MergeResult>;
}

// 当前实现：本地存储适配器
class LocalStorageAdapter implements StorageAdapter {
  private db: IDBDatabase;
  // 基于 IndexedDB 实现
}

// 预留扩展：云端存储适配器（未来实现）
class CloudStorageAdapter implements StorageAdapter {
  private apiEndpoint: string;
  private authToken: string;
  // 调用后端 API 实现同步
}

// 存储管理器 - 运行时切换存储后端
class StorageManager {
  private adapter: StorageAdapter;
  
  constructor(mode: 'local' | 'cloud', config?: CloudConfig) {
    this.adapter = mode === 'local' 
      ? new LocalStorageAdapter() 
      : new CloudStorageAdapter(config);
  }
  
  // 支持运行时切换
  switchAdapter(mode: 'local' | 'cloud', config?: CloudConfig): void;
}

// 三层记忆架构 - 与存储层解耦
interface MemorySystem {
  // 1. 会话记忆 (内存 + 可选持久化)
  session: {
    pageHistory: PageView[];
    actionSequence: Action[];
    extractedData: any[];
  };

  // 2. 用户个人记忆 (通过 StorageAdapter 持久化)
  user: {
    deviceId: string;
    frequentOperations: string[];
    preferredMetrics: string[];
    customThresholds: Thresholds;
    accumulatedData: DataPoint[];  // 核心资产
    patterns: Pattern[];
    lastSyncAt: number;            // 最后同步时间（本地/云端通用）
    syncVersion: number;           // 数据版本号，用于冲突处理
  };

  // 3. 全局知识 (本地JSON + 支持云端热更新)
  global: {
    version: string;
    industryBenchmarks: Benchmarks;
    bestPractices: Practice[];
    updatedAt: number;
    source: 'builtin' | 'synced';  // 标记来源
  };
}

// 统一数据交换格式（本地导出/云端同步通用）
interface ExportData {
  formatVersion: string;         // 格式版本，用于兼容性检查
  exportedAt: number;
  sourceDeviceId: string;
  userMemory: UserMemory;
  checksum: string;              // 数据完整性校验
  // 预留云端字段
  userId?: string;               // 云端用户标识
  syncToken?: string;            // 同步令牌
}

// 合并策略（本地导入/云端同步通用）
interface MergeStrategy {
  deduplicateBy: string[];       // 去重键
  conflictResolution: 'latest' | 'manual' | 'server-wins' | 'client-wins';
  stats: {
    added: number;
    updated: number;
    skipped: number;
    conflicts: number;           // 冲突数量
  };
}
```

**阶段演进路径**：

| 阶段 | 存储方式 | 说明 |
|-----|---------|------|
| **Phase 1 (MVP)** | 纯本地 IndexedDB | 支持导入导出文件实现多设备同步 |
| **Phase 2 (增强)** | 本地优先 + 云端可选 | 用户可选择开启云端同步，自动备份 |
| **Phase 3 (企业)** | 云端优先 | 支持团队协作、数据共享、管理员看板 |

#### D. 建议引擎

```typescript
// 建议触发条件
interface SuggestionTrigger {
  type: 'anomaly' | 'opportunity' | 'efficiency' | 'strategy';
  priority: 'high' | 'medium' | 'low';
  cooldown: number;  // 同类建议冷却时间(秒)，避免重复打扰
}

// 建议内容
interface Suggestion {
  id: string;
  type: 'anomaly' | 'opportunity' | 'efficiency' | 'strategy';
  title: string;           // 简短标题
  description: string;     // 详细说明
  confidence: number;      // AI置信度 0-1
  relatedData?: any;       // 关联的原始数据
  actionHint?: string;     // 建议的操作方向
}
```

---

## 4. MVP功能设计（报表页面专项）

### 4.1 第一阶段：基础感知 + 数据异常预警

**目标**：在投放报表页面上实现端到端的数据感知和异常预警闭环

**功能清单**：

1. **AI自适应页面理解**
   - 插件采集页面DOM快照，发送给DeepSeek
   - AI自动识别：页面类型、表格区域、指标列、时间维度
   - 首次识别后缓存页面模板，后续直接复用（减少API调用）

2. **业务数据自动提取**
   - AI从表格中提取关键指标（曝光、点击、CTR、消耗、转化、CPA等）
   - 识别时间维度和对比数据（环比、同比）
   - 结构化存储到IndexedDB

3. **数据异常实时检测**
   - CTR异常下降（低于历史均值30%）
   - 消耗异常（超预算风险、消耗停滞）
   - CPA异常波动
   - 转化量骤减

4. **异常预警提示**
   - 侧边栏浮动面板展示
   - 异常数据行高亮标记
   - 一键查看详情

### 4.2 第二阶段：效率优化建议

1. **操作效率分析**
   - 检测重复性操作模式，提示可自动化流程
   - 推荐更高效的筛选和查看方式

2. **报表查看优化**
   - 自动保存常用筛选条件
   - 智能推荐关注指标组合
   - 异常数据自动置顶

### 4.3 第三阶段：策略建议

1. **基于数据的优化建议**
   - 低CTR计划：建议优化创意方向
   - 高CPA计划：建议调整出价或人群定向
   - 预算分配建议

2. **知识自动挖掘**
   - AI从累积数据中发现优化模式（如某类定向组合效果持续好）
   - 自动沉淀为可复用的优化策略

---

## 5. 用户交互设计

### 5.1 插件侧边栏界面

```
┌────────────────────────────────────┐
│  AI广告助手           [设置] [×]    │
├────────────────────────────────────┤
│  当前页面：投放报表 (已识别)         │
│  平台：XXX广告平台                  │
├────────────────────────────────────┤
│  发现 1 个异常                      │
│                                    │
│  [高] 计划A的CTR较昨日下降45%       │
│  当前: 0.8% → 昨日: 1.45%          │
│  [查看详情] [忽略]                  │
├────────────────────────────────────┤
│  优化建议 (3)                       │
│                                    │
│  [中] 3个计划预算即将耗尽            │
│  [低] 发现2个低效计划可考虑暂停      │
│  [低] 建议关注转化成本上升趋势        │
│                                    │
│  [查看更多建议]                     │
├────────────────────────────────────┤
│  建议接收：[开]   频率：[实时]       │
└────────────────────────────────────┘
```

### 5.2 设置面板

- **API配置**：DeepSeek API Key 输入与连接测试
- **建议开关**：总开关 + 分类开关（异常/效率/策略）
- **触发频率**：实时 / 5分钟 / 15分钟 / 手动
- **敏感度设置**：异常检测阈值调整
- **数据管理**：
  - 导出记忆数据（生成 `.admemory` 加密文件）
  - 导入记忆数据（智能合并排重）
  - 清除本地数据

### 5.3 导入导出流程

```
设备A导出                          设备B导入
┌─────────────┐                   ┌─────────────┐
│ 选择导出范围 │                   │ 选择备份文件 │
│ - 全部数据   │                   └──────┬──────┘
│ - 仅配置    │                          │
│ - 仅业务数据 │                          ▼
└──────┬──────┘                   ┌─────────────┐
       │                          │ 解析并预览   │
       ▼                          │ - 来源设备   │
┌─────────────┐                   │ - 数据条数   │
│ 生成加密文件 │                   │ - 冲突项数   │
│ .admemory   │                   └──────┬──────┘
└─────────────┘                          │
                                         ▼
                                ┌─────────────┐
                                │ 选择合并策略 │
                                │ - 自动合并   │
                                │ - 逐项确认   │
                                └──────┬──────┘
                                       │
                                       ▼
                                ┌─────────────┐
                                │ 执行合并    │
                                │ + 新增100条 │
                                │ ~ 更新50条  │
                                │ = 跳过20条  │
                                └─────────────┘
```

**数据合并规则**：
1. **去重键**：`campaignId + date + metricType` 组合唯一标识
2. **冲突处理**：同一指标以时间戳最新的为准
3. **设备标识**：保留数据来源设备ID，便于追溯
4. **完整性校验**：导出文件带 SHA-256 校验和，防止篡改

---

## 6. 数据安全与隐私

| 数据类型 | 处理方式 | 存储位置 |
|---------|---------|---------|
| 页面DOM快照 | 采集结构化摘要后发送DeepSeek分析 | 不持久化原始DOM |
| 业务数据（曝光、点击等） | 本地IndexedDB存储 | 仅本地 |
| 用户操作轨迹 | 本地存储 | 仅本地 |
| API Key | 用户自行配置，本地加密存储 | 仅本地 |
| 导出文件 | 用户主动导出，带校验和 | 用户自行管理 |

**隐私原则**：
- 不向任何第三方服务器上传业务数据
- DeepSeek API 仅接收DOM结构摘要用于分析，不接收原始页面内容
- 所有持久化数据完全在用户本地浏览器中
- 用户可随时导出或清除全部数据

---

## 7. 开发规范

### 7.1 技术栈

| 层级 | 技术选型 | 说明 |
|-----|---------|------|
| **编程语言** | TypeScript | 类型安全，便于维护 |
| **构建工具** | Vite / Webpack | 模块打包，支持热更新 |
| **UI框架** | React 18 + Tailwind CSS | 组件化开发，样式原子化 |
| **状态管理** | Zustand | 轻量级，适合插件场景 |
| **存储** | IndexedDB (idb 库封装) | 异步Promise API |
| **HTTP客户端** | Axios | API调用，支持拦截器 |
| **代码规范** | ESLint + Prettier | 统一代码风格 |

### 7.2 项目结构

```
ai-ad-assistant/
├── public/
│   ├── manifest.json          # Chrome扩展配置
│   ├── icons/                 # 插件图标
│   └── _locales/              # 国际化
├── src/
│   ├── manifest.ts            # Manifest配置生成
│   ├── background/            # Service Worker
│   │   ├── index.ts           # 入口
│   │   ├── ai-engine.ts       # DeepSeek API调用
│   │   ├── prompt-builder.ts  # Prompt编排
│   │   └── suggestion-scheduler.ts  # 建议调度
│   ├── content/               # Content Script
│   │   ├── index.ts           # 入口
│   │   ├── dom-snapshot.ts    # DOM快照采集
│   │   ├── page-observer.ts   # 页面变化监听
│   │   └── ui-injector.ts     # UI注入
│   ├── popup/                 # 插件弹窗
│   │   ├── App.tsx
│   │   └── index.html
│   ├── sidepanel/             # 侧边栏面板
│   │   ├── App.tsx
│   │   ├── SuggestionList.tsx
│   │   ├── SettingsPanel.tsx
│   │   └── index.html
│   ├── storage/               # 存储层
│   │   ├── adapter.ts         # StorageAdapter接口
│   │   ├── local-adapter.ts   # IndexedDB实现
│   │   ├── cloud-adapter.ts   # 云端适配器(预留)
│   │   └── manager.ts         # StorageManager
│   ├── types/                 # 类型定义
│   │   ├── index.ts
│   │   ├── memory.ts
│   │   ├── suggestion.ts
│   │   └── ai.ts
│   ├── utils/                 # 工具函数
│   │   ├── crypto.ts          # 加密/校验
│   │   ├── merge.ts           # 数据合并
│   │   └── throttle.ts        # 节流控制
│   └── styles/                # 全局样式
│       └── globals.css
├── tests/                     # 测试
├── scripts/                   # 构建脚本
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### 7.3 核心文件详解

#### manifest.json (Manifest V3)

```json
{
  "manifest_version": 3,
  "name": "AI广告助手",
  "version": "1.0.0",
  "description": "智能广告投放辅助工具",
  "permissions": [
    "storage",
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

#### 关键 TypeScript 类型

```typescript
// src/types/index.ts

// 消息通信类型
export interface MessagePayload {
  type: 'CAPTURE_DOM' | 'ANALYZE_DATA' | 'GET_SUGGESTIONS' | 'EXPORT_DATA' | 'IMPORT_DATA';
  payload?: any;
}

export interface MessageResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// DeepSeek API 相关
export interface DeepSeekConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  temperature: number;
}

export interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}
```

### 7.4 开发流程

```
┌─────────────────────────────────────────────────────────────┐
│                     开发工作流                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 环境准备                                                 │
│     ├── 安装 Node.js 18+                                    │
│     ├── npm install                                         │
│     └── 配置 .env (DeepSeek API Key)                        │
│                                                             │
│  2. 本地开发                                                 │
│     ├── npm run dev          # 启动开发服务器                │
│     ├── npm run build:dev    # 构建开发版                    │
│     └── Chrome 加载已解压的扩展                              │
│                                                             │
│  3. 调试测试                                                 │
│     ├── Chrome DevTools 调试 Content Script                  │
│     ├── chrome://extensions 调试 Service Worker              │
│     └── npm run test         # 运行单元测试                  │
│                                                             │
│  4. 构建发布                                                 │
│     ├── npm run build        # 生产构建                      │
│     ├── npm run pack         # 打包 .zip                    │
│     └── 上传 Chrome Web Store                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.5 关键实现要点

#### Content Script → Background 通信

```typescript
// content/index.ts
const snapshot = captureDOMSnapshot();
const response = await chrome.runtime.sendMessage({
  type: 'ANALYZE_DATA',
  payload: { snapshot }
});
```

#### DeepSeek API 调用封装

```typescript
// background/ai-engine.ts
export class AIEngine {
  private config: DeepSeekConfig;

  async understandPage(snapshot: DOMSnapshot): Promise<PageUnderstanding> {
    const prompt = this.buildUnderstandPrompt(snapshot);
    const response = await this.callDeepSeek(prompt);
    return this.parseUnderstanding(response);
  }

  private async callDeepSeek(prompt: string): Promise<string> {
    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.config.temperature
      })
    });
    const data = await response.json();
    return data.choices[0].message.content;
  }
}
```

#### IndexedDB 封装

```typescript
// storage/local-adapter.ts
import { openDB, DBSchema } from 'idb';

interface AdAssistantDB extends DBSchema {
  userMemory: {
    key: string;
    value: UserMemory;
  };
  sessionData: {
    key: string;
    value: any;
  };
}

export class LocalStorageAdapter implements StorageAdapter {
  private db: IDBPDatabase<AdAssistantDB>;

  async init(): Promise<void> {
    this.db = await openDB<AdAssistantDB>('ad-assistant', 1, {
      upgrade(db) {
        db.createObjectStore('userMemory');
        db.createObjectStore('sessionData');
      }
    });
  }

  async get<T>(key: string): Promise<T | null> {
    return await this.db.get('userMemory', key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.db.put('userMemory', value, key);
  }
}
```

---

## 8. 实施路线图

### Phase 1: MVP（报表页面专项）

| 周次 | 任务 | 产出 |
|-----|------|------|
| W1 | 项目初始化 + 基础框架 | 可运行的空插件 |
| W2 | DOM快照 + AI页面理解 | 能识别报表页面结构 |
| W3 | 数据提取 + 异常检测 | 能提取数据并检测异常 |
| W4 | 侧边栏UI + 建议展示 | 完整的用户交互界面 |
| W5 | IndexedDB存储 + 导入导出 | 数据持久化和迁移功能 |
| W6 | 设置面板 + 联调测试 | 可交付的MVP版本 |

**详细任务清单**：
- [ ] Chrome 插件基础框架（Manifest V3）
- [ ] Content Script：DOM快照采集模块
- [ ] Background：DeepSeek API调用与Prompt编排
- [ ] AI页面理解 + 数据提取（报表页面）
- [ ] 基础异常检测（规则引擎 + AI辅助）
- [ ] 侧边栏建议展示UI
- [ ] IndexedDB本地记忆存储
- [ ] 导入导出功能（含合并排重）
- [ ] 设置面板（API Key、建议开关、频率）

### Phase 2: 增强

- [ ] 页面模板缓存机制（减少API调用）
- [ ] 用户操作模式挖掘
- [ ] 效率优化建议
- [ ] 更多异常检测规则
- [ ] 建议反馈机制（有用/无用）

### Phase 3: 智能

- [ ] AI知识自动挖掘引擎
- [ ] 策略建议能力
- [ ] 跨页面扩展（计划列表、创意管理等）
- [ ] 多广告平台适配验证

---

## 9. 关键成功指标

| 指标 | 目标 | 说明 |
|-----|------|------|
| 用户采纳率 | > 30% | 日活跃用户 / 安装用户 |
| 建议点击率 | > 20% | 用户点击查看建议的比例 |
| 异常发现率 | > 80% | AI发现异常 / 总异常 |
| 误报率 | < 10% | 误报建议 / 总建议 |
| API成本 | < ¥5/人/天 | 单用户日均DeepSeek调用成本 |

---

## 10. 风险与应对

| 风险 | 影响 | 应对措施 |
|-----|------|---------|
| DeepSeek API不稳定或限流 | 高 | 本地规则引擎兜底，API不可用时降级为纯规则检测 |
| AI页面理解准确率不足 | 高 | 首次理解后缓存模板，用户可手动校正，持续优化Prompt |
| API成本过高 | 中 | 智能缓存 + 节流控制，非关键操作用规则引擎替代 |
| 用户打扰感 | 中 | 精细化冷却策略，用户可自定义开关和频率 |
| 数据丢失 | 中 | 导出文件带校验，支持多设备导入导出备份 |

---

## 11. 已确认决策

| 决策项 | 决策结果 | 说明 |
|-------|---------|------|
| **AI服务选型** | 接入自有 DeepSeek API Key | 用户自行提供API Key，插件内置调用逻辑，无需自建AI服务 |
| **知识库构建** | 自动挖掘 | AI自动从累积数据中提取优化模式，无需人工整理 |
| **商业化路径** | 内部工具 | 定位为团队内部提效工具，不对外商业化 |
| **多后台支持** | AI自适应 | 不硬编码DOM选择器，由DeepSeek动态理解页面结构，兼容任意广告后台 |
| **数据存储** | 本地优先 + 可扩展 | MVP阶段纯本地IndexedDB，架构预留云端同步接口，未来可无缝升级 |
