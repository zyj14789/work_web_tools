# AI广告投放助手 - 任务分解 (TASKS)

## 任务依赖图

```
T01(Types) ──┬── T02(Logger) ──┬── T04(AI Engine) ── T10(AnomalyDetect)
             │                 │
             ├── T03(Storage) ─┼── T05(Memory) ──── T11(PatternMiner)
             │                 │
             └─────────────────┼── T06(Suggestion) ─ T07(Scheduler)
                               │
T08(ContentScript) ───────────┤
                               │
T09(Background) ──────────────┤
                               │
T12(Popup GUI) ───────────────┤
                               │
T13(SidePanel GUI) ───────────┘
                               │
T14(Content UI) ──────────────┘
                               │
T15(Tests) ───────────────────┘
                               │
T16(Build Config) ────────────┘
```

---

## Phase 1: 基础设置 (Setup)

### T01: 类型定义系统
- **文件**: `app/ai/types.ts`, `app/memory/types.ts`, `app/storage/adapter.ts`, `app/suggestion/types.ts`, `interface/types.ts`
- **依赖**: 无
- **内容**: 
  - AI引擎相关类型（DOMSnapshot, PageUnderstanding, ExtractedData, AnomalyResult, Suggestion, Pattern）
  - 记忆系统类型（SessionMemory, UserMemory, GlobalKnowledge）
  - 存储层接口（StorageAdapter, ExportData, MergeStrategy, MergeResult）
  - 建议引擎类型（SuggestionTrigger, SuggestionContext）
  - 消息协议类型（MessageType, ChromeMessage）
- **验收**: 所有类型编译通过，无循环依赖

### T02: 日志与工具模块
- **文件**: `app/utils/logger.ts`, `app/utils/throttle.ts`, `app/utils/validator.ts`
- **依赖**: T01
- **内容**:
  - 结构化日志系统（支持级别：DEBUG/INFO/WARN/ERROR）
  - 节流/防抖工具函数
  - 数据校验工具（API Key格式、URL格式、数据完整性）
- **验收**: 单元测试覆盖

---

## Phase 2: 存储层 (Storage)

### T03: 存储层实现
- **文件**: `app/storage/index.ts`, `app/storage/local-adapter.ts`, `app/storage/cloud-adapter.ts`, `app/storage/manager.ts`, `app/storage/crypto.ts`, `app/storage/merge.ts`
- **依赖**: T01, T02
- **内容**:
  - StorageAdapter 接口实现
  - LocalStorageAdapter (IndexedDB: userMemory, patterns, settings, pageTemplates, syncMeta)
  - CloudStorageAdapter (预留桩代码)
  - StorageManager (运行时适配器切换)
  - 加密模块 (SHA-256校验和、AES-GCM加密)
  - 合并引擎 (去重键匹配、冲突解决策略)
- **验收**: 
  - IndexedDB读写正常
  - 导出文件含校验和
  - 导入合并排重正确
  - 单元测试覆盖

---

## Phase 3: AI引擎 (AI Engine)

### T04: Prompt模板与AI核心
- **文件**: `app/ai/index.ts`, `app/ai/prompt-builder.ts`, `app/ai/page-parser.ts`, `app/ai/data-extractor.ts`
- **依赖**: T01, T02
- **内容**:
  - AIEngine类统一入口
  - PromptBuilder：构建发送给DeepSeek的Prompt模板
    - PAGE_UNDERSTANDING_PROMPT
    - DATA_EXTRACTION_PROMPT
    - ANOMALY_DETECTION_PROMPT
    - SUGGESTION_PROMPT
    - PATTERN_MINING_PROMPT
  - PageParser：调用AI理解页面结构
  - DataExtractor：调用AI提取业务数据
- **验收**: 
  - Prompt模板语法正确
  - 模拟AI返回解析正确
  - 单元测试覆盖

### T05: 记忆系统
- **文件**: `app/memory/index.ts`, `app/memory/session-memory.ts`, `app/memory/user-memory.ts`, `app/memory/global-knowledge.ts`
- **依赖**: T01, T02, T03
- **内容**:
  - MemorySystem统一入口
  - SessionMemory：内存Map缓存（页面历史、操作序列、提取数据）
  - UserMemory：持久化记忆（累积数据、模式、偏好）
  - GlobalKnowledge：内置基准数据和最佳实践
- **验收**: 
  - 会话数据正确隔离
  - 持久化数据读写正确
  - 单元测试覆盖

---

## Phase 4: 建议引擎 (Suggestion Engine)

### T06: 建议引擎核心
- **文件**: `app/suggestion/index.ts`, `app/suggestion/anomaly-detector.ts`, `app/suggestion/efficiency-analyzer.ts`, `app/suggestion/strategy-advisor.ts`
- **依赖**: T01, T02, T04, T05
- **内容**:
  - SuggestionEngine统一入口
  - AnomalyDetector：异常检测（CTR/消耗/CPA/转化量）
  - EfficiencyAnalyzer：效率分析（重复操作检测、筛选优化）
  - StrategyAdvisor：策略建议（低CTR/高CPA/预算分配）
- **验收**: 
  - 异常检测规则正确
  - 建议生成合理
  - 单元测试覆盖

### T07: 建议调度器
- **文件**: `app/suggestion/scheduler.ts`
- **依赖**: T01, T02, T06
- **内容**:
  - 建议冷却时间管理
  - 同类建议频率控制
  - 优先级排序
  - 待推送队列管理
- **验收**: 冷却和频率控制正确

---

## Phase 5: 接口层 (Interface)

### T08: Content Script
- **文件**: `interface/content/index.ts`, `interface/content/dom-snapshot.ts`, `interface/content/page-observer.ts`, `interface/content/ui-injector.ts`, `interface/content/types.ts`
- **依赖**: T01, T02
- **内容**:
  - Content Script入口（注入到广告后台页面）
  - DOMSnapshotCollector：轻量DOM结构采集（表格、图表、表单、关键文本）
  - PageObserver：MutationObserver监听页面变化（节流处理）
  - UIInjector：向页面注入侧边栏容器和行高亮样式
  - 与Background的消息通信
- **验收**: 
  - DOM快照采集准确
  - 页面变化检测正常
  - 消息通信成功

### T09: Background Service Worker
- **文件**: `interface/background/index.ts`, `interface/background/message-router.ts`, `interface/background/api-proxy.ts`, `interface/background/scheduler.ts`, `interface/background/types.ts`, `interface/messaging.ts`
- **依赖**: T01-T07
- **内容**:
  - Service Worker入口
  - MessageRouter：消息路由分发（Content/Popup/SidePanel→AI/Storage）
  - APIProxy：DeepSeek API调用代理（重试、超时、错误处理）
  - BackgroundScheduler：定时任务（数据采集调度）
  - 统一消息协议定义
- **验收**: 
  - 消息路由正确
  - API调用正常（含重试）
  - 定时任务可触发

---

## Phase 6: GUI层 (User Interface)

### T10: Popup UI
- **文件**: `gui/popup/index.html`, `gui/popup/main.tsx`, `gui/popup/App.tsx`, `gui/popup/components/ApiKeyForm.tsx`, `gui/popup/components/SuggestionToggle.tsx`, `gui/popup/components/QuickStats.tsx`
- **依赖**: T09
- **内容**:
  - API Key配置表单（输入+连接测试）
  - 建议总开关+分类开关
  - 快速统计信息展示
- **验收**: 
  - API Key可配置和测试
  - 开关状态正确持久化

### T11: Side Panel UI
- **文件**: `gui/sidepanel/index.html`, `gui/sidepanel/main.tsx`, `gui/sidepanel/App.tsx`, `gui/sidepanel/components/SuggestionList.tsx`, `gui/sidepanel/components/SuggestionCard.tsx`, `gui/sidepanel/components/SettingsPanel.tsx`, `gui/sidepanel/components/DataManager.tsx`, `gui/sidepanel/components/ExportImport.tsx`
- **依赖**: T09
- **内容**:
  - 主建议面板（实时展示异常和建议）
  - 建议卡片（优先级、置信度、操作按钮）
  - 设置面板（频率、敏感度、数据管理）
  - 导入导出界面（导出范围选择、导入预览、合并确认）
- **验收**: 
  - 建议列表正确渲染
  - 设置修改持久化
  - 导入导出流程完整

### T12: Content UI
- **文件**: `gui/content-ui/highlight.tsx`, `gui/content-ui/badge.tsx`
- **依赖**: T08
- **内容**:
  - 数据行高亮标记
  - 状态标识徽章
- **验收**: 高亮和标识正确显示

### T13: GUI共享组件与状态管理
- **文件**: `gui/shared/*.tsx`, `gui/stores/*.ts`, `gui/hooks/*.ts`, `gui/styles/globals.css`
- **依赖**: T10, T11, T12
- **内容**:
  - 共享UI组件（Button, Badge, Toast, LoadingSpinner, EmptyState）
  - Zustand Stores（settings, suggestions, memory）
  - 自定义Hooks（useChromeMessage, useSettings, useSuggestions）
  - Tailwind CSS全局样式
- **验收**: 组件复用正常，状态管理正确

---

## Phase 7: 构建配置与测试

### T14: 构建配置
- **文件**: `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `public/manifest.json`
- **依赖**: 所有实现文件
- **内容**:
  - Vite多入口构建配置（popup/sidepanel/content/background）
  - TypeScript配置
  - Tailwind+PostCSS配置
  - Manifest V3声明
  - npm scripts（dev/build/test/lint）
- **验收**: 构建成功，所有入口输出正确

### T15: 测试
- **目录**: `tests/`
- **依赖**: T01-T14
- **内容**:
  - 存储层测试（LocalStorageAdapter CRUD、导入导出、合并）
  - AI引擎测试（Prompt模板、页面解析、数据提取模拟）
  - 建议引擎测试（异常检测、效率分析）
  - 记忆系统测试（会话记忆、持久化记忆）
  - 合并引擎测试（去重、冲突解决）
  - Content Script测试（DOM快照采集模拟）
  - GUI组件测试（渲染、交互）
- **验收**: 
  - 核心逻辑覆盖率 > 70%
  - 所有测试通过

---

## 任务汇总

| ID | 任务 | 预估文件数 | 优先级 |
|----|------|-----------|--------|
| T01 | 类型定义系统 | ~6 | P0 |
| T02 | 日志与工具 | ~3 | P0 |
| T03 | 存储层实现 | ~6 | P0 |
| T04 | Prompt与AI核心 | ~4 | P0 |
| T05 | 记忆系统 | ~4 | P0 |
| T06 | 建议引擎核心 | ~4 | P0 |
| T07 | 建议调度器 | ~1 | P0 |
| T08 | Content Script | ~5 | P0 |
| T09 | Background Worker | ~5 | P0 |
| T10 | Popup UI | ~5 | P0 |
| T11 | Side Panel UI | ~7 | P0 |
| T12 | Content UI | ~2 | P0 |
| T13 | 共享组件与状态 | ~10 | P0 |
| T14 | 构建配置 | ~6 | P0 |
| T15 | 测试 | ~8 | P0 |

**总计: ~76个文件**

---

## 关键问题分析

### 问题1: IndexedDB在Service Worker中可用性
- **描述**: Manifest V3的Service Worker中IndexedDB API可用性
- **影响**: T03, T09
- **方案A**: 直接在Service Worker中使用IndexedDB ✅ (Chrome支持)
- **方案B**: 使用chrome.storage.local作为替代
- **决策(MANAGER)**: **方案A** - Service Worker支持IndexedDB

### 问题2: Content Script与页面隔离
- **描述**: React组件注入到页面DOM中需隔离样式
- **影响**: T08, T12
- **方案A**: Shadow DOM隔离
- **方案B**: CSS Module + 前缀命名空间 ✅
- **决策(MANAGER)**: **方案A** - Shadow DOM提供完全样式隔离

### 问题3: 测试中Chrome API模拟
- **描述**: 单元测试无法直接使用chrome.* API
- **影响**: T15
- **方案A**: vitest mock全局chrome对象 ✅
- **方案B**: 抽象chrome API到独立模块
- **决策(MANAGER)**: **方案A+B组合** - 抽象+Mock，确保可测试性

---

**PASS** - 任务分解完成，可进入核心实现阶段
