// ===== 工具集 Background Service Worker (360兼容版) =====

const TOOLS_STORAGE_KEY = "cb_tools_config";
const SETTINGS_STORAGE_KEY = "cb_tool_settings";
const CONTEXT_MENU_ID = "cb-save-txt";

// ===== 安装/更新时设置默认配置（仅首次，不覆盖已有设置） =====
chrome.runtime.onInstalled.addListener(function () {
  chrome.storage.local.get(TOOLS_STORAGE_KEY, function (result) {
    if (!result[TOOLS_STORAGE_KEY]) {
      chrome.storage.local.set((function () {
        var data = {};
        data[TOOLS_STORAGE_KEY] = {
          floatingBall: true,
          txtSaver: true,
          clipboardShelf: true
        };
        return data;
      })());
    }
  });
  ensureContextMenu();
});

chrome.runtime.onStartup.addListener(function () {
  ensureContextMenu();
});

// ===== 右键菜单：保存为txt文件 =====

function ensureContextMenu() {
  if (!chrome.contextMenus) {
    console.warn("[360-extension] contextMenus API not available");
    return;
  }
  chrome.storage.local.get(TOOLS_STORAGE_KEY, function (result) {
    var config = result[TOOLS_STORAGE_KEY] || {};
    var txtSaverEnabled = config.txtSaver === true;

    chrome.contextMenus.update(CONTEXT_MENU_ID, {
      title: "\u4fdd\u5b58\u4e3atxt\u6587\u4ef6",
      contexts: ["selection"],
      visible: txtSaverEnabled
    }, function () {
      if (chrome.runtime.lastError) {
        chrome.contextMenus.create({
          id: CONTEXT_MENU_ID,
          title: "\u4fdd\u5b58\u4e3atxt\u6587\u4ef6",
          contexts: ["selection"],
          visible: txtSaverEnabled
        }, function () { void chrome.runtime.lastError; });
      }
    });
  });
}

if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId !== CONTEXT_MENU_ID || !info.selectionText || !tab || tab.id == null) return;

    var text = info.selectionText;
    chrome.storage.local.get(SETTINGS_STORAGE_KEY, function (result) {
      var settings = result[SETTINGS_STORAGE_KEY] || {};
      var txtSettings = settings.txtSaver || {};
      var prefix = (txtSettings.filenamePrefix && txtSettings.filenamePrefix.trim()) || "selected-text";
      var random = Math.random().toString(36).slice(2, 8);
      var filename = prefix + "-" + random + ".txt";
      saveTextAsFile(text, filename);
    });
  });
}

// ===== 文件保存：优先 downloads API，回退到 data URL 标签页方式 =====

function saveTextAsFile(text, filename) {
  if (chrome.downloads && chrome.downloads.download) {
    // Chrome standard downloads API
    var dataUrl = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
    chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: true
    }, function () {
      if (chrome.runtime.lastError) {
        console.error("[360-extension] downloads.download failed:", chrome.runtime.lastError.message);
        downloadViaTab(text, filename);
      }
    });
  } else {
    // Fallback for 360/browsers without downloads API
    downloadViaTab(text, filename);
  }
}

function downloadViaTab(text, filename) {
  // Create a minimal HTML page that auto-triggers download via blob + <a> click
  var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  var reader = new FileReader();
  reader.onload = function () {
    var dataUrl = reader.result;
    var html = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Download</title></head><body>" +
      "<a id=\"dl\" download=\"" + filename.replace(/"/g, "&quot;") + "\" href=\"" + dataUrl + "\"></a>" +
      "<script>document.getElementById('dl').click();setTimeout(function(){window.close();},2000);</" + "script>" +
      "</body></html>";
    var blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    chrome.tabs.create({ url: blobUrl, active: false }, function (tab) {
      // Tab will auto-close after download triggers
      setTimeout(function () {
        try { chrome.tabs.remove(tab.id); } catch (e) { /* ignore */ }
      }, 5000);
    });
  };
  reader.readAsDataURL(blob);
}

// 监听工具开关变化，同步右键菜单可见性
chrome.storage.onChanged.addListener(function (changes, areaName) {
  if (areaName === "local" && changes[TOOLS_STORAGE_KEY]) {
    var newConfig = changes[TOOLS_STORAGE_KEY].newValue || {};
    var txtSaverEnabled = newConfig.txtSaver === true;
    if (chrome.contextMenus) {
      chrome.contextMenus.update(CONTEXT_MENU_ID, {
        visible: txtSaverEnabled
      }, function () { void chrome.runtime.lastError; });
    }
  }
});

ensureContextMenu();
