# 工具集

Chrome 浏览器扩展工具集，提供剪贴板临存台面、悬浮球导航、文本暂存、网络请求捕获等便携功能。

## 版本

| 目录 | 说明 | 版本 |
|------|------|------|
| `chrome-extension/` | Chrome 标准版 | 2.0.0 |
| `360-extension/` | 360极速浏览器版 | 2.0.0 |

## 功能

- **临存台面** — 剪贴板历史管理与跨标签页同步，支持折叠状态持久化
- **悬浮球** — 页面悬浮快捷导航，支持拖拽定位
- **文本暂存** — 快速保存和回顾文本片段
- **网络捕获** — 拦截 XHR / fetch / jQuery 请求，捕获响应 JSON

## 安装

### Chrome 标准版

1. 打开 `chrome://extensions/`
2. 启用「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `chrome-extension/` 目录

### 360极速浏览器版

1. 打开 `chrome://extensions/`（或 360 扩展管理页面）
2. 启用「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `360-extension/` 目录

## Release

在 [Releases](https://github.com/zyj14789/work_web_tools/releases) 页面可下载各版本的 zip 打包文件。

## 技术栈

- Manifest V3
- Service Worker (background)
- Content Scripts + web_accessible_resources
- Chrome Extensions API (storage, clipboardWrite, contextMenus, scripting, downloads)
