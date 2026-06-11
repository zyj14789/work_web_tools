# AI广告投放助手 - 系统架构设计 (ARCH)

## 1. 架构总览

### 1.1 架构模式
采用**浏览器插件分层架构**，遵循 **app（核心逻辑）+ interface（执行接口层）+ gui（用户界面）** 三层分离原则。

```
┌─────────────────────────────────────────────────────────────────┐
│                         GUI Layer (gui/)                        │
│  ┌──────────────┐  ┌───────────────────┐  ┌────────────────┐   │
│  │   Popup      │  │   Side Panel      │  │  Content UI    │   │
│  │  (设置入口)   │  │  (建议展示主界面)   │  │ (页面标注)     │   │
│  └──────┬───────┘  └────────┬──────────┘  └───────┬────────┘   │
│         │                   │                     │             │
├─────────┼───────────────────┼─────────────────────┼─────────────┤
│         │         INTERFACE Layer (interface/)     │             │
│  ┌──────┴───────────────────┴─────────────────────┴──────────┐  │
│  │              Chrome Extension Messaging Bus                │  │
│  │  ┌──────────────────┐  ┌──────────────────────────────┐   │  │
│  │  │  Service Worker  │  │     Content Script Bridge    │   │  │
│  │  │  (Background)    │  │  - DOM Snapshot Collector    │   │  │
│  │  │  - Message Router│  │  - Page Observer            │   │  │
│  │  │  - API Proxy     │  │  - UI Injector              │   │  │
│  │  │  - Scheduler     │  │                              │   │  │
│  │  └────────┬─────────┘  └──────────────────────────────┘   │  │
│  └───────────┼────────────────────────────────────────────────┘  │
├─────────────┼────────────────────────────────────────────────────┤
│             │              APP Layer (app/)                       │
│  ┌──────────┴─────────────────────────────────────────────────┐  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │  │
│  │  │  AI Engine   │  │Memory System │  │Suggestion Engine │  │  │
│  │  │ - PageParser │  │ - SessionMem │  │ - AnomalyDetect  │  │  │
│  │  │ - DataExtract│  │ - UserMemory │  │ - EfficiencyAnaly│  │  │
│  │  │ - PromptBuild│  │ - GlobalKnow │  │ - StrategyAdvisor│  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │  │
│  │         │                 │                    │            │  │
│  │  ┌──────┴─────────────────┴────────────────────┴─────────┐  │  │
│  │  │                   Storage Layer                       │  │  │
│  │  │  ┌──────────────────┐  ┌─────────────────────────┐   │  │  │
│  │  │  │LocalStorageAdapter│  │CloudStorageAdapter(预留)│   │  │  │
│  │  │  │   (IndexedDB)    │  │   (HTTP API)            │   │  │  │
│  │  │  └──────────────────┘  └─────────────────────────┘   │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 技术选型

| 层级 | 技术 | 版本 | 选型理由 |
|------|------|------|----------|
| 语言 | TypeScript | 5.4+ | 类型安全，IDE友好 |
| 构建 | Vite | 5.x | 快速打包，原生ESM |
| UI框架 | React | 18.x | 组件化，生态完善 |
| 样式 | Tailwind CSS | 3.x | 原子化，零运行时 |
| 状态管理 | Zustand | 4.x | 轻量，无Provider |
| 存储 | idb | 8.x | IndexedDB Promise封装 |
| HTTP | fetch (native) | - | 零依赖，Service Worker兼容 |
| AI | DeepSeek Chat API | v1 | 需求指定 |
| 测试 | Vitest | 1.x | Vite原生集成 |
| 加密 | Web Crypto API | - | 浏览器原生，用于文件校验 |
| 扩展标准 | Manifest V3 | - | Chrome最新标准 |

---

## 2. 组件详细设计

### 2.1 APP层 - AI引擎 (`app/ai/`)

```
app/ai/
├── index.ts              # AI引擎统一入口
├── page-parser.ts        # 页面结构理解
├── data-extractor.ts     # 业务数据提取
├── prompt-builder.ts     # DeepSeek Prompt模板
├── anomaly-detector.ts   # 异常检测算法
├── pattern-miner.ts      # 知识模式挖掘
└── types.ts              # AI相关类型定义
```

**核心类设计**：

```typescript
class AIEngine {
  constructor(config: AIConfig)
  
  // 页面理解：发送DOM快照给AI，获取页面结构描述
  understandPage(snapshot: DOMSnapshot): Promise<PageUnderstanding>
  
  // 数据提取：基于页面理解结果提取结构化数据
  extractData(snapshot: DOMSnapshot, understanding: PageUnderstanding): Promise<ExtractedData>
  
  // 异常检测：对比当前数据与历史数据
  detectAnomalies(current: ExtractedData, history: DataPoint[]): Promise<AnomalyResult[]>
  
  // 建议生成：基于异常生成可操作建议
  generateSuggestions(anomalies: AnomalyResult[], context: SuggestionContext): Promise<Suggestion[]>
  
  // 知识挖掘：从历史数据中发现模式
  minePatterns(dataPoints: DataPoint[]): Promise<Pattern[]>
}
```

**Prompt模板设计**（关键）：
- `PAGE_UNDERSTANDING_PROMPT`：让AI分析页面结构
- `DATA_EXTRACTION_PROMPT`：让AI从DOM提取指标数据
- `ANOMALY_DETECTION_PROMPT`：让AI判断数据异常
- `SUGGESTION_PROMPT`：让AI生成优化建议
- `PATTERN_MINING_PROMPT`：让AI发现知识模式

### 2.2 APP层 - 记忆系统 (`app/memory/`)

```
app/memory/
├── index.ts              # 记忆系统统一入口
├── session-memory.ts     # 会话级内存缓存
├── user-memory.ts        # 用户持久化记忆
├── global-knowledge.ts   # 全局知识库
└── types.ts              # 记忆相关类型
```

**三层记忆架构**：

| 层级 | 生命周期 | 存储 | 内容 |
|------|----------|------|------|
| Session | 单次页面会话 | 内存Map | 页面历史、操作序列、提取数据 |
| User | 持久化 | IndexedDB | 累积数据、模式、偏好设置 |
| Global | 持久化(版本控制) | 内置JSON + 可更新 | 行业基准、最佳实践 |

### 2.3 APP层 - 存储层 (`app/storage/`)

```
app/storage/
├── index.ts              # 存储层统一入口
├── adapter.ts            # StorageAdapter接口定义
├── local-adapter.ts      # IndexedDB本地实现
├── cloud-adapter.ts      # 云端适配器(预留)
├── manager.ts            # StorageManager运行时切换
├── crypto.ts             # 文件加密与校验
└── merge.ts              # 数据合并排重逻辑
```

**接口设计**：
```typescript
interface StorageAdapter {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  remove(key: string): Promise<void>
  getAll(): Promise<Record<string, unknown>>
  clear(): Promise<void>
  export(scope: ExportScope): Promise<ExportData>
  import(data: ExportData, strategy: MergeStrategy): Promise<MergeResult>
}
```

**IndexedDB表设计**：
- `userMemory`：用户累积的业务数据点
- `patterns`：发现的优化模式
- `settings`：用户偏好配置
- `pageTemplates`：页面模板缓存
- `syncMeta`：同步元数据

### 2.4 APP层 - 建议引擎 (`app/suggestion/`)

```
app/suggestion/
├── index.ts              # 建议引擎统一入口
├── anomaly-detector.ts   # 异常检测规则
├── efficiency-analyzer.ts# 效率分析
├── strategy-advisor.ts   # 策略建议
├── scheduler.ts          # 建议调度与冷却
└── types.ts              # 建议相关类型
```

**建议调度规则**：
- 异常类建议：冷却时间5分钟
- 效率类建议：冷却时间15分钟
- 策略类建议：冷却时间30分钟
- 同类型建议每日上限可配置

### 2.5 INTERFACE层 (`interface/`)

```
interface/
├── background/           # Service Worker
│   ├── index.ts          # Worker入口
│   ├── message-router.ts # 消息路由分发
│   ├── api-proxy.ts      # DeepSeek API调用代理
│   ├── scheduler.ts      # 定时任务调度
│   └── types.ts
├── content/              # Content Script
│   ├── index.ts          # Content入口
│   ├── dom-snapshot.ts   # DOM快照采集器
│   ├── page-observer.ts  # 页面变化监听
│   ├── ui-injector.ts    # 侧边栏UI注入
│   └── types.ts
├── messaging.ts          # 消息协议定义
└── types.ts              # 接口层公共类型
```

**消息协议**（Chrome Extension Message Passing）：

```typescript
// 消息类型枚举
enum MessageType {
  // Content Script → Background
  PAGE_LOADED = 'page:loaded',
  DOM_SNAPSHOT = 'dom:snapshot',
  USER_ACTION = 'user:action',
  PAGE_CHANGED = 'page:changed',
  
  // Background → Content Script
  INJECT_UI = 'ui:inject',
  HIGHLIGHT_ROWS = 'ui:highlight',
  SHOW_NOTIFICATION = 'ui:notify',
  
  // Popup/SidePanel → Background
  GET_SETTINGS = 'settings:get',
  UPDATE_SETTINGS = 'settings:update',
  GET_SUGGESTIONS = 'suggestions:get',
  DISMISS_SUGGESTION = 'suggestion:dismiss',
  EXPORT_DATA = 'data:export',
  IMPORT_DATA = 'data:import',
  TEST_API_KEY = 'api:test',
  
  // Background → Popup/SidePanel
  SETTINGS_UPDATED = 'settings:updated',
  SUGGESTIONS_UPDATED = 'suggestions:updated',
  EXPORT_READY = 'export:ready',
  IMPORT_COMPLETE = 'import:complete',
}
```

### 2.6 GUI层 (`gui/`)

```
gui/
├── popup/                # 插件弹出窗口
│   ├── index.html
│   ├── main.tsx
│   ├── App.tsx
│   └── components/
│       ├── ApiKeyForm.tsx
│       ├── SuggestionToggle.tsx
│       └── QuickStats.tsx
├── sidepanel/            # 侧边栏主面板
│   ├── index.html
│   ├── main.tsx
│   ├── App.tsx
│   └── components/
│       ├── SuggestionList.tsx
│       ├── SuggestionCard.tsx
│       ├── SettingsPanel.tsx
│       ├── DataManager.tsx
│       └── ExportImport.tsx
├── content-ui/           # 页面内注入UI
│   ├── highlight.tsx     # 数据行高亮
│   └── badge.tsx         # 状态标识
├── shared/               # GUI共享组件
│   ├── Button.tsx
│   ├── Badge.tsx
│   ├── Toast.tsx
│   ├── LoadingSpinner.tsx
│   └── EmptyState.tsx
├── stores/               # Zustand状态管理
│   ├── settings-store.ts
│   ├── suggestions-store.ts
│   └── memory-store.ts
├── hooks/                # 自定义Hooks
│   ├── useChromeMessage.ts
│   ├── useSettings.ts
│   └── useSuggestions.ts
└── styles/
    └── globals.css       # Tailwind入口
```

---

## 3. 数据流设计

### 3.1 页面感知流程

```
用户打开广告后台页面
    │
    ▼
Content Script 注入 → 等待页面加载完成
    │
    ▼
采集DOM快照 (dom-snapshot.ts)
    │ 提取: 表格结构、图表区域、表单、关键文本
    │
    ▼
检查页面模板缓存 (pageTemplates in IndexedDB)
    │
    ├── 命中 → 直接使用缓存的Understanding
    │
    └── 未命中 → 发送快照到Background
                    │
                    ▼
              Background调用AI Engine
                    │
                    ▼
              DeepSeek API (Page Understanding)
                    │
                    ▼
              缓存模板 + 返回Understanding
    │
    ▼
数据提取流程 (同样先查缓存)
    │
    ▼
存入IndexedDB (userMemory)
    │
    ▼
触发异常检测
```

### 3.2 异常检测与建议流程

```
新数据存入IndexedDB
    │
    ▼
AI Engine.anomalyDetect()
    │ 输入: 当前数据 + 历史数据窗口(7天/30天)
    ▼
DeepSeek API (Anomaly Detection)
    │
    ▼
返回 AnomalyResult[]
    │
    ▼
Suggestion Engine.generateSuggestions()
    │ 根据异常类型和优先级生成建议
    ▼
Scheduler检查冷却时间
    │
    ├── 在冷却期 → 暂存待推送
    │
    └── 可推送 → 通过Message Bus发送到Side Panel
                    │
                    ▼
              Side Panel 渲染建议卡片
```

### 3.3 导入导出流程

```
导出:
  UserMemory (IndexedDB) → 序列化 → 计算SHA-256 → 打包ExportData
  → 触发浏览器下载 → .admemory文件

导入:
  用户选择.admemory文件 → 读取解析 → 校验checksum
  → 预览数据摘要 → 用户确认合并策略
  → MergeEngine执行合并排重 → 写入IndexedDB
  → 通知完成
```

---

## 4. 目录结构

```
ai-ad-assistant/
├── app/                        # 核心业务逻辑
│   ├── ai/                     # AI引擎
│   │   ├── index.ts
│   │   ├── page-parser.ts
│   │   ├── data-extractor.ts
│   │   ├── prompt-builder.ts
│   │   ├── anomaly-detector.ts
│   │   ├── pattern-miner.ts
│   │   └── types.ts
│   ├── memory/                 # 记忆系统
│   │   ├── index.ts
│   │   ├── session-memory.ts
│   │   ├── user-memory.ts
│   │   ├── global-knowledge.ts
│   │   └── types.ts
│   ├── storage/                # 存储层
│   │   ├── index.ts
│   │   ├── adapter.ts
│   │   ├── local-adapter.ts
│   │   ├── cloud-adapter.ts
│   │   ├── manager.ts
│   │   ├── crypto.ts
│   │   └── merge.ts
│   ├── suggestion/             # 建议引擎
│   │   ├── index.ts
│   │   ├── anomaly-detector.ts
│   │   ├── efficiency-analyzer.ts
│   │   ├── strategy-advisor.ts
│   │   ├── scheduler.ts
│   │   └── types.ts
│   └── utils/                  # 通用工具
│       ├── logger.ts
│       ├── throttle.ts
│       └── validator.ts
├── interface/                  # 执行接口层
│   ├── background/
│   │   ├── index.ts
│   │   ├── message-router.ts
│   │   ├── api-proxy.ts
│   │   ├── scheduler.ts
│   │   └── types.ts
│   ├── content/
│   │   ├── index.ts
│   │   ├── dom-snapshot.ts
│   │   ├── page-observer.ts
│   │   ├── ui-injector.ts
│   │   └── types.ts
│   ├── messaging.ts
│   └── types.ts
├── gui/                        # 用户界面
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   └── components/
│   │       ├── ApiKeyForm.tsx
│   │       ├── SuggestionToggle.tsx
│   │       └── QuickStats.tsx
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   └── components/
│   │       ├── SuggestionList.tsx
│   │       ├── SuggestionCard.tsx
│   │       ├── SettingsPanel.tsx
│   │       ├── DataManager.tsx
│   │       └── ExportImport.tsx
│   ├── content-ui/
│   │   ├── highlight.tsx
│   │   └── badge.tsx
│   ├── shared/
│   │   ├── Button.tsx
│   │   ├── Badge.tsx
│   │   ├── Toast.tsx
│   │   ├── LoadingSpinner.tsx
│   │   └── EmptyState.tsx
│   ├── stores/
│   │   ├── settings-store.ts
│   │   ├── suggestions-store.ts
│   │   └── memory-store.ts
│   ├── hooks/
│   │   ├── useChromeMessage.ts
│   │   ├── useSettings.ts
│   │   └── useSuggestions.ts
│   └── styles/
│       └── globals.css
├── tests/                      # 测试代码
│   ├── app/
│   │   ├── ai/
│   │   ├── memory/
│   │   ├── storage/
│   │   └── suggestion/
│   ├── interface/
│   └── gui/
├── public/                     # 静态资源
│   ├── manifest.json
│   └── icons/
├── logs/                       # 日志
├── docs/                       # 文档
│   ├── PRD.md
│   ├── ARCH.md
│   ├── TASKS.md
│   └── ...
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

---

## 5. 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| AI调用时机 | 页面加载后+定时轮询 | 兼顾实时性和API成本 |
| 模板缓存策略 | LRU + TTL(24h) | 避免重复分析相同结构页面 |
| 建议推送方式 | 侧边栏被动展示 | 避免弹窗打扰用户工作流 |
| 状态管理位置 | Background Service Worker | 跨页面共享状态，单一数据源 |
| 数据序列化 | JSON + 自定义扩展名 | 简单通用，.admemory品牌标识 |
| 日志方案 | 结构化日志 + 控制台输出 | 便于调试和问题追溯 |

---

## 6. 对抗机制 - 架构问题识别

### 问题1: Service Worker生命周期不可控
- **描述**: Chrome可能随时休眠Service Worker，导致状态丢失
- **影响范围**: 所有background逻辑
- **严重程度**: 高
- **方案A**: 所有重要状态持久化到IndexedDB，Worker启动时恢复
- **方案B**: 使用chrome.storage.session保持轻量会话
- **方案C**: 增加心跳机制延长Worker生命
- **决策(MANAGER)**: **方案A** - 持久化优先策略，确保数据不丢失

### 问题2: AI API延迟导致用户体验差
- **描述**: DeepSeek API响应可能需要5-10秒
- **影响范围**: 页面感知和建议生成
- **严重程度**: 中
- **方案A**: 异步处理+加载状态提示
- **方案B**: 页面模板预缓存+仅增量分析
- **方案C**: 本地规则预筛选+AI深度分析
- **决策(MANAGER)**: **方案A+B组合** - 缓存优先，异步展示，渐进式加载

### 问题3: IndexedDB跨域限制
- **描述**: Content Script在不同域名下无法访问同一IndexedDB
- **影响范围**: 数据持久化
- **严重程度**: 高
- **方案A**: 所有存储操作通过Service Worker代理
- **方案B**: 使用chrome.storage.local API
- **方案C**: Content Script不直接操作DB，通过消息传递
- **决策(MANAGER)**: **方案A+C组合** - Service Worker统一管理存储，Content Script通过消息通信

---

## 7. MANAGER_DECISION.md

**决策汇总**:
- ✅ UI框架: React 18 + Tailwind CSS
- ✅ 构建工具: Vite 5
- ✅ 状态管理: Zustand
- ✅ 存储方案: IndexedDB (idb封装)，Service Worker统一管理
- ✅ AI模型: DeepSeek Chat API v1
- ✅ 测试框架: Vitest
- ✅ 扩展标准: Manifest V3
- ✅ 存储持久化策略: Worker启动时从IndexedDB恢复状态
- ✅ AI延迟处理: 模板缓存 + 异步加载 + 渐进展示
- ✅ 跨域存储: Service Worker代理所有存储操作

**PASS** - 架构设计通过，可进入任务分解阶段
