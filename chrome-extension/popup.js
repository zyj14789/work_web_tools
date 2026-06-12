(function () {
  "use strict";

  var TOOLS_STORAGE_KEY = "cb_tools_config";
  var SETTINGS_STORAGE_KEY = "cb_tool_settings";

  var DEFAULT_DOMAINS = ["hrmobi.cn", "yumobi.cn", "focusmob.cn"];

  var TOOL_SETTING_SCHEMAS = {
    floatingBall: {
      fields: [
        { key: "targetUrl", label: "跳转地址", placeholder: "https://k7nw4n6635.coze.site/", type: "url" },
        { key: "interceptPattern", label: "拦截地址后缀", placeholder: "listDataApiLog.action", type: "text" },
        { key: "flashDuration", label: "闪烁时长(秒)", placeholder: "0.5", type: "number" },
        { key: "captureAll", label: "全局捕获(调试)", placeholder: "false", type: "toggle" },
        { key: "showLog", label: "调试日志窗", placeholder: "false", type: "toggle" },
      ],
      hasDomainManager: true,
    },
    txtSaver: {
      fields: [
        { key: "filenamePrefix", label: "文件名前缀", placeholder: "selected-text", type: "text" },
      ],
      hasDomainManager: false,
    },
    clipboardShelf: {
      fields: [],
      hasDomainManager: false,
    },
  };

  var TOOLS = [
    {
      id: "floatingBall",
      name: "悬浮球",
      description: "可拖动的悬浮球，点击跳转至目标页面",
      icon: "转",
      enabled: true,
    },
    {
      id: "txtSaver",
      name: "文本保存",
      description: "选中文本右键，保存为txt文件",
      icon: "存",
      enabled: true,
    },
    {
      id: "clipboardShelf",
      name: "临存台面",
      description: "保存最近复制记录，点击粘贴",
      icon: "台",
      enabled: true,
    },
  ];

  var toolList = document.getElementById("toolList");
  var statusText = document.getElementById("statusText");
  var statusDot = document.getElementById("statusDot");

  var currentExpanded = null;
  var currentTabHostname = null;

  // ===== Storage helpers =====
  function getConfig() {
    return new Promise(function (resolve) {
      chrome.storage.local.get(TOOLS_STORAGE_KEY, function (result) {
        var stored = result[TOOLS_STORAGE_KEY] || {};
        var merged = {};
        TOOLS.forEach(function (tool) {
          merged[tool.id] = stored[tool.id] !== undefined ? stored[tool.id] : tool.enabled;
        });
        resolve(merged);
      });
    });
  }

  function getSettings() {
    return new Promise(function (resolve) {
      chrome.storage.local.get(SETTINGS_STORAGE_KEY, function (result) {
        resolve(result[SETTINGS_STORAGE_KEY] || {});
      });
    });
  }

  function saveSettingField(toolId, fieldKey, value) {
    return new Promise(function (resolve) {
      getSettings().then(function (settings) {
        if (!settings[toolId]) settings[toolId] = {};
        settings[toolId][fieldKey] = value;
        var data = {};
        data[SETTINGS_STORAGE_KEY] = settings;
        chrome.storage.local.set(data, resolve);
      });
    });
  }

  function saveAllSettings(toolId, settingsObj) {
    return new Promise(function (resolve) {
      getSettings().then(function (settings) {
        if (!settings[toolId]) settings[toolId] = {};
        for (var k in settingsObj) {
          settings[toolId][k] = settingsObj[k];
        }
        var data = {};
        data[SETTINGS_STORAGE_KEY] = settings;
        chrome.storage.local.set(data, resolve);
      });
    });
  }

  // ===== Get current tab hostname =====
  function getCurrentTabHostname() {
    return new Promise(function (resolve) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs && tabs[0] && tabs[0].url) {
          try {
            var url = new URL(tabs[0].url);
            resolve(url.hostname);
          } catch (e) {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
  }

  // ===== Main render =====
  async function loadAndRender() {
    var config = await getConfig();
    var settings = await getSettings();
    currentTabHostname = await getCurrentTabHostname();
    renderToolCards(config, settings);
    updateStatus();
  }

  function renderToolCards(config, settings) {
    toolList.innerHTML = "";

    TOOLS.forEach(function (tool) {
      var enabled = config[tool.id] === true;
      var wasExpanded = currentExpanded === tool.id;
      var schema = TOOL_SETTING_SCHEMAS[tool.id];
      var toolSettings = settings[tool.id] || {};

      var card = document.createElement("div");
      card.className = "tool-card" + (enabled ? " enabled" : "");
      card.dataset.toolId = tool.id;

      var html = "";

      // Header
      html += '<div class="tool-card-header">';
      html += '<div class="tool-icon"><span>' + tool.icon + '</span></div>';
      html += '<div class="tool-info">';
      html += '<div class="tool-name">' + tool.name + '</div>';
      html += '<div class="tool-desc">' + tool.description + '</div>';
      html += '</div>';
      html += '<div class="tool-chevron">&#9660;</div>';
      html += '<label class="toggle">';
      html += '<input type="checkbox" ' + (enabled ? "checked" : "") + ' data-tool-id="' + tool.id + '">';
      html += '<span class="toggle-slider"></span>';
      html += '</label>';
      html += '</div>';

      // Settings panel
      if (schema) {
        html += '<div class="tool-settings"><div class="settings-inner">';

        if (schema.fields) {
          schema.fields.forEach(function (field) {
            var currentValue = toolSettings[field.key] || "";

            if (field.type === "toggle") {
              var checked = currentValue === true || currentValue === "true";
              html += '<div>';
              html += '<div class="settings-row settings-row-toggle">';
              html += '<label class="toggle-inline">';
              html += '<input type="checkbox" ' + (checked ? "checked" : "") + ' data-field="' + field.key + '" data-tool="' + tool.id + '">';
              html += '<span class="toggle-slider"></span>';
              html += '</label>';
              html += '<span class="toggle-label-text">' + field.label + '</span>';
              html += '</div>';
              html += '<span class="settings-saved-hint" data-tool="' + tool.id + '" data-field="' + field.key + '">已保存</span>';
              html += '</div>';
            } else {
              var inputType = field.type === "number" ? "number" : "text";
              var stepAttr = field.type === "number" ? ' step="0.1" min="0.1"' : "";
              html += '<div>';
              html += '<div class="settings-label">' + field.label + '</div>';
              html += '<div class="settings-row">';
              html += '<input class="settings-input" type="' + inputType + '" placeholder="' + field.placeholder + '" value="' + escapeHtml(currentValue) + '" data-field="' + field.key + '" data-tool="' + tool.id + '"' + stepAttr + '>';
              html += '<button class="settings-save-btn" data-tool="' + tool.id + '" data-field="' + field.key + '">保存</button>';
              html += '</div>';
              html += '<span class="settings-saved-hint" data-tool="' + tool.id + '" data-field="' + field.key + '">已保存</span>';
              html += '</div>';
            }
          });
        }

        // Domain manager
        if (schema.hasDomainManager) {
          var customDomains = toolSettings.allowedDomains || [];
          var allAllowed = DEFAULT_DOMAINS.concat(customDomains);
          var currentAlreadyAdded = currentTabHostname && allAllowed.indexOf(currentTabHostname) !== -1;

          html += '<div class="domain-section">';
          html += '<div class="domain-divider"></div>';

          html += '<div class="settings-label">生效域名</div>';
          html += '<div class="domain-tag-list">';
          DEFAULT_DOMAINS.forEach(function (d) {
            html += '<span class="domain-tag domain-tag-default">' + d + '</span>';
          });
          html += '</div>';

          if (currentTabHostname && !currentAlreadyAdded) {
            html += '<div class="settings-label" style="margin-top:10px">添加当前站点</div>';
            html += '<div class="domain-add-row">';
            html += '<span class="current-hostname">' + escapeHtml(currentTabHostname) + '</span>';
            html += '<button class="domain-add-btn" data-tool="' + tool.id + '">添加</button>';
            html += '</div>';
          }

          if (customDomains.length > 0) {
            html += '<div class="settings-label" style="margin-top:10px">已添加</div>';
            html += '<div class="domain-list" data-tool="' + tool.id + '">';
            customDomains.forEach(function (d) {
              html += renderDomainItem(tool.id, d);
            });
            html += '</div>';
          }

          html += '</div>';
        }

        html += '</div></div>';
      }

      card.innerHTML = html;

      // === Event bindings ===

      var header = card.querySelector(".tool-card-header");
      header.addEventListener("click", function (e) {
        if (e.target.closest(".toggle") || e.target.closest(".toggle-inline")) return;
        toggleExpand(tool.id);
      });

      var mainCheckbox = card.querySelector("input[type=checkbox][data-tool-id]");
      if (mainCheckbox) {
        mainCheckbox.addEventListener("change", function (e) {
          e.stopPropagation();
          onToggle(tool.id, e.target.checked);
        });
      }

      var saveBtns = card.querySelectorAll(".settings-save-btn");
      saveBtns.forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var fieldKey = btn.dataset.field;
          var input = card.querySelector('input[data-field="' + fieldKey + '"]');
          if (!input) return;
          onSaveField(tool.id, fieldKey, input.value.trim(), card);
        });
      });

      var inputs = card.querySelectorAll(".settings-input");
      inputs.forEach(function (input) {
        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.stopPropagation();
            var fieldKey = input.dataset.field;
            onSaveField(tool.id, fieldKey, input.value.trim(), card);
          }
        });
        input.addEventListener("click", function (e) {
          e.stopPropagation();
        });
      });

      var toggleCheckboxes = card.querySelectorAll("input[type=checkbox][data-field]");
      toggleCheckboxes.forEach(function (cb) {
        cb.addEventListener("change", function (e) {
          e.stopPropagation();
          var fieldKey = cb.dataset.field;
          onSaveField(tool.id, fieldKey, cb.checked, card);
        });
      });

      var addBtn = card.querySelector(".domain-add-btn");
      if (addBtn) {
        addBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          onAddDomain(tool.id);
        });
      }

      var editBtns = card.querySelectorAll(".domain-edit-btn");
      editBtns.forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          onEditDomain(tool.id, btn.dataset.domain, card);
        });
      });

      var delBtns = card.querySelectorAll(".domain-del-btn");
      delBtns.forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          onDeleteDomain(tool.id, btn.dataset.domain);
        });
      });

      toolList.appendChild(card);

      if (wasExpanded) {
        card.classList.add("expanded");
      }
    });
  }

  function renderDomainItem(toolId, domain) {
    return (
      '<div class="domain-item" data-domain="' + domain + '">' +
      '<span class="domain-item-text">' + escapeHtml(domain) + '</span>' +
      '<div class="domain-item-actions">' +
      '<button class="domain-edit-btn" data-domain="' + domain + '" data-tool="' + toolId + '">编辑</button>' +
      '<button class="domain-del-btn" data-domain="' + domain + '" data-tool="' + toolId + '">删除</button>' +
      '</div>' +
      '</div>'
    );
  }

  // ===== Actions =====
  function toggleExpand(toolId) {
    if (currentExpanded === toolId) {
      currentExpanded = null;
    } else {
      currentExpanded = toolId;
    }
    document.querySelectorAll(".tool-card").forEach(function (card) {
      var id = card.dataset.toolId;
      if (id === currentExpanded) {
        card.classList.add("expanded");
      } else {
        card.classList.remove("expanded");
      }
    });
  }

  async function onSaveField(toolId, fieldKey, value, card) {
    await saveSettingField(toolId, fieldKey, value);
    var hint = card.querySelector('.settings-saved-hint[data-tool="' + toolId + '"][data-field="' + fieldKey + '"]');
    if (hint) {
      hint.classList.add("show");
      setTimeout(function () { hint.classList.remove("show"); }, 1500);
    }
  }

  async function onAddDomain(toolId) {
    if (!currentTabHostname) return;
    var settings = await getSettings();
    var toolSettings = settings[toolId] || {};
    var domains = toolSettings.allowedDomains || [];
    if (domains.indexOf(currentTabHostname) === -1) {
      domains.push(currentTabHostname);
      await saveAllSettings(toolId, { allowedDomains: domains });
      refresh();
    }
  }

  async function onDeleteDomain(toolId, domain) {
    var settings = await getSettings();
    var toolSettings = settings[toolId] || {};
    var domains = (toolSettings.allowedDomains || []).filter(function (d) { return d !== domain; });
    await saveAllSettings(toolId, { allowedDomains: domains });
    refresh();
  }

  function onEditDomain(toolId, oldDomain, card) {
    var item = card.querySelector('.domain-item[data-domain="' + oldDomain + '"]');
    if (!item) return;

    var editHtml =
      '<div class="domain-edit-row">' +
      '<input class="domain-edit-input" type="text" value="' + escapeHtml(oldDomain) + '" data-old="' + escapeHtml(oldDomain) + '" data-tool="' + toolId + '">' +
      '<button class="domain-edit-confirm" data-tool="' + toolId + '" data-old="' + escapeHtml(oldDomain) + '">确认</button>' +
      '<button class="domain-edit-cancel" data-tool="' + toolId + '">取消</button>' +
      '</div>';

    item.outerHTML = editHtml;

    var editRow = card.querySelector(".domain-edit-row");
    if (!editRow) return;

    var confirmBtn = editRow.querySelector(".domain-edit-confirm");
    var cancelBtn = editRow.querySelector(".domain-edit-cancel");
    var editInput = editRow.querySelector(".domain-edit-input");

    confirmBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      onConfirmEditDomain(toolId, oldDomain, editInput.value.trim());
    });

    cancelBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      refresh();
    });

    editInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.stopPropagation();
        onConfirmEditDomain(toolId, oldDomain, editInput.value.trim());
      } else if (e.key === "Escape") {
        refresh();
      }
    });

    editInput.addEventListener("click", function (e) { e.stopPropagation(); });
    editInput.focus();
    editInput.select();
  }

  async function onConfirmEditDomain(toolId, oldDomain, newDomain) {
    if (!newDomain || newDomain === oldDomain) {
      refresh();
      return;
    }
    var settings = await getSettings();
    var toolSettings = settings[toolId] || {};
    var domains = (toolSettings.allowedDomains || []).map(function (d) {
      return d === oldDomain ? newDomain : d;
    });
    await saveAllSettings(toolId, { allowedDomains: domains });
    refresh();
  }

  async function refresh() {
    var config = await getConfig();
    var settings = await getSettings();
    renderToolCards(config, settings);
    updateStatus();
  }

  async function onToggle(toolId, enabled) {
    var config = await getConfig();
    config[toolId] = enabled;
    var data = {};
    data[TOOLS_STORAGE_KEY] = config;
    chrome.storage.local.set(data, function () {
      refresh();
    });
  }

  function updateStatus() {
    var cards = toolList.querySelectorAll(".tool-card.enabled");
    var count = cards.length;
    statusText.textContent = "已激活 " + count + " 个工具";

    if (count === 0) {
      statusDot.style.background = "#555770";
      statusDot.style.boxShadow = "none";
    } else {
      statusDot.style.background = "var(--success)";
      statusDot.style.boxShadow = "0 0 8px var(--success-glow)";
    }
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== Init =====
  loadAndRender();
})();