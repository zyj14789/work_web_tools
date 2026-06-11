# AI广告投放助手 - Chrome浏览器插件

智能广告投放辅助工具，通过AI驱动的方式为广告运营人员提供数据预警、效率优化和策略建议。

## 功能特性

- 🤖 **AI自适应页面理解**：DeepSeek AI动态理解任意广告后台页面结构
- ⚠️ **数据异常预警**：CTR下降、消耗异常、CPA波动、转化骤减实时检测
- 💡 **智能优化建议**：基于历史数据的效率优化和策略建议
- 📊 **侧边栏面板**：非侵入式侧边栏展示建议，不影响原有工作流
- 🔒 **纯本地存储**：所有业务数据存储在浏览器本地IndexedDB
- 📥 **数据导入导出**：支持 .admemory 文件导出导入，实现多设备同步

## 技术架构

```
app/        → 核心业务逻辑（AI引擎、记忆系统、存储层、建议引擎）
interface/  → 执行接口层（Content Script、Background Service Worker）
gui/        → 用户界面（Popup弹窗、SidePanel侧边栏）
tests/      → 测试代码（32个测试用例）
```

## 技术栈

- **语言**: TypeScript 5.4+
- **构建**: Vite 5
- **UI**: React 18 + Tailwind CSS
- **状态管理**: Zustand
- **存储**: IndexedDB (idb)
- **AI**: DeepSeek Chat API
- **测试**: Vitest
- **扩展标准**: Chrome Manifest V3

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发构建

```bash
npm run dev     # 开发模式（watch）
npm run build   # 生产构建
```

### 运行测试

```bash
npm test            # 运行所有测试
npm run test:watch  # watch模式
```

### 加载到Chrome

1. 构建项目：`npm run build`
2. 打开 Chrome → `chrome://extensions/`
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择 `dist/` 目录

### 配置

1. 点击插件图标打开弹出窗口
2. 在设置中输入 DeepSeek API Key（格式：`sk-...`）
3. 点击「测试连接」确认可用
4. 开启建议开关，选择合适的检查频率

## 项目结构

```
ai-ad-assistant/
├── app/                    # 核心业务逻辑
│   ├── ai/                 # AI引擎（页面解析、数据提取、Prompt模板）
│   ├── memory/             # 记忆系统（会话/用户/全局三层）
│   ├── storage/            # 存储层（IndexedDB适配器、加密、合并）
│   ├── suggestion/         # 建议引擎（异常检测、效率分析、调度器）
│   └── utils/              # 工具函数（日志、节流、校验）
├── interface/              # 执行接口层
│   ├── background/         # Service Worker（消息路由、API代理）
│   ├── content/            # Content Script（DOM采集、页面监听、UI注入）
│   └── messaging.ts        # 消息协议定义
├── gui/                    # 用户界面
│   ├── popup/              # 弹出窗口（设置入口）
│   ├── sidepanel/          # 侧边栏（建议展示主界面）
│   ├── shared/             # 共享UI组件
│   ├── stores/             # Zustand状态管理
│   ├── hooks/              # 自定义React Hooks
│   └── styles/             # 全局样式
├── tests/                  # 测试代码
├── public/                 # 静态资源（manifest.json、图标）
├── docs/                   # 文档（PRD、ARCH、TASKS、REVIEW、AUDIT）
└── scripts/                # 构建脚本
```

## 运行要求

- Chrome 100+ / Edge 100+
- DeepSeek API Key

## 隐私说明

- 所有业务数据存储在浏览器本地（IndexedDB）
- API Key本地加密存储，仅用于调用DeepSeek API
- 不向任何第三方服务器上传业务数据
- 导出文件可自行管理

## 版本

v1.0.0 - MVP
