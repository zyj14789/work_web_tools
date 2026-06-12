// ===== 工具集 Background Service Worker =====

const TOOLS_STORAGE_KEY = "cb_tools_config";
const SETTINGS_STORAGE_KEY = "cb_tool_settings";
const CONTEXT_MENU_ID = "cb-save-txt";

// 安装/更新时设置默认配置（仅首次，不覆盖已有设置）
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(TOOLS_STORAGE_KEY, (result) => {
    if (!result[TOOLS_STORAGE_KEY]) {
      chrome.storage.local.set({
        [TOOLS_STORAGE_KEY]: {
          floatingBall: true,
          txtSaver: true,
        },
      });
    }
  });
  ensureContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  ensureContextMenu();
});

// ===== 右键菜单：保存为txt文件 =====

function ensureContextMenu() {
  chrome.storage.local.get(TOOLS_STORAGE_KEY, (result) => {
    const config = result[TOOLS_STORAGE_KEY] || {};
    const txtSaverEnabled = config.txtSaver === true;

    chrome.contextMenus.update(CONTEXT_MENU_ID, {
      title: "保存为txt文件",
      contexts: ["selection"],
      visible: txtSaverEnabled,
    }, () => {
      if (chrome.runtime.lastError) {
        chrome.contextMenus.create({
          id: CONTEXT_MENU_ID,
          title: "保存为txt文件",
          contexts: ["selection"],
          visible: txtSaverEnabled,
        }, () => void chrome.runtime.lastError);
      }
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !info.selectionText || !tab || tab.id == null) return;

  const text = info.selectionText;

  // 读取用户设置的文件名前缀
  chrome.storage.local.get(SETTINGS_STORAGE_KEY, (result) => {
    const settings = result[SETTINGS_STORAGE_KEY] || {};
    const txtSettings = settings.txtSaver || {};
    const prefix = (txtSettings.filenamePrefix && txtSettings.filenamePrefix.trim()) || "selected-text";
    const random = Math.random().toString(36).slice(2, 8);
    const filename = prefix + "-" + random + ".txt";

    const dataUrl = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
    chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: true,
    }).catch(() => {});
  });
});

// 监听工具开关变化，同步右键菜单可见性
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[TOOLS_STORAGE_KEY]) {
    const newConfig = changes[TOOLS_STORAGE_KEY].newValue || {};
    const txtSaverEnabled = newConfig.txtSaver === true;
    chrome.contextMenus.update(CONTEXT_MENU_ID, {
      visible: txtSaverEnabled,
    }, () => void chrome.runtime.lastError);
  }
});

ensureContextMenu();