(function () {
  "use strict";

  // ============================================================
  //  Step 0: Inject hook.js into page MAIN world via <script src>
  // ============================================================

  // Hook injection is deferred to after-settings-read (see initHook below)

  // ============================================================
  //  Step 1: Log window (ISOLATED world, collects logs from both worlds)
  // ============================================================

  var SHOW_LOG = false;
  var logEntries = [];
  var logEl = null;
  var MAX_LOG = 50;

  function ensureLogWindow() {
    if (logEl) return;
    logEl = document.createElement("div");
    logEl.id = "cb-debug-log";
    logEl.style.cssText =
      "display:none;position:fixed;top:48px;right:8px;z-index:2147483646;" +
      "width:360px;max-height:320px;overflow-y:auto;" +
      "background:rgba(10,12,18,0.94);color:#c0c0c0;" +
      "font:11px/1.5 monospace;padding:8px;border-radius:6px;" +
      "border:1px solid rgba(255,255,255,0.1);";
    document.body.appendChild(logEl);
  }

  function log(msg, source) {
    source = source || "CS";
    var now = new Date();
    var time = now.toTimeString().slice(0, 8) + "." + String(now.getMilliseconds()).padStart(3, "0");
    var entry = time + " [" + source + "] " + msg;
    logEntries.push(entry);
    if (logEntries.length > MAX_LOG) logEntries.shift();

    if (SHOW_LOG) {
      ensureLogWindow();
      if (logEl) {
        logEl.style.display = "block";
        logEl.textContent = logEntries.join("\n");
        logEl.scrollTop = logEl.scrollHeight;
      }
    }
  }

  function setShowLog(v) {
    SHOW_LOG = !!v;
    log("log window " + (SHOW_LOG ? "ON" : "OFF"));
    if (!SHOW_LOG && logEl) {
      logEl.style.display = "none";
    } else if (SHOW_LOG) {
      ensureLogWindow();
      if (logEl) {
        logEl.style.display = "block";
        logEl.textContent = logEntries.join("\n");
      }
    }
  }

  // Listen for logs from MAIN world (hook.js dispatches cb-log CustomEvents)
  document.addEventListener("cb-log", function (e) {
    if (e.detail && e.detail.msg) log(e.detail.msg, "HK");
  });

  log("content.js loaded, waiting for settings to inject hook.js");

  // ============================================================
  //  Config keys
  // ============================================================

  var TOOLS_STORAGE_KEY = "cb_tools_config";
  var SETTINGS_STORAGE_KEY = "cb_tool_settings";

  var DEFAULT_TARGET_URL = "https://k7nw4n6635.coze.site/";
  var DEFAULT_INTERCEPT_PATTERN = "listDataApiLog.action";
  var DEFAULT_FLASH_DURATION = 0.5;

  var DEFAULT_DOMAINS = ["hrmobi.cn", "yumobi.cn", "focusmob.cn"];

  var DEFAULT_TOOLS = {
    floatingBall: {
      id: "floatingBall",
      name: "悬浮球",
      description: "可拖动的悬浮球，点击跳转至目标页面",
      enabled: true,
      icon: "转",
    },
    txtSaver: {
      id: "txtSaver",
      name: "文本保存",
      description: "选中文本右键，保存为txt文件",
      enabled: true,
      icon: "存",
    },
  };

  var activeTools = {};

  // ===== Domain =====
  function matchesDomain(hostname, domain) {
    return hostname === domain || hostname.endsWith("." + domain);
  }

  function isDomainAllowed(hostname) {
    for (var i = 0; i < DEFAULT_DOMAINS.length; i++) {
      if (matchesDomain(hostname, DEFAULT_DOMAINS[i])) return true;
    }
    return false;
  }

  function getCustomDomains() {
    return new Promise(function (resolve) {
      chrome.storage.local.get(SETTINGS_STORAGE_KEY, function (result) {
        var settings = result[SETTINGS_STORAGE_KEY] || {};
        var domains = (settings.floatingBall && settings.floatingBall.allowedDomains) || [];
        resolve(domains);
      });
    });
  }

  function isDomainAllowedAsync(hostname) {
    if (isDomainAllowed(hostname)) return Promise.resolve(true);
    return getCustomDomains().then(function (domains) {
      for (var i = 0; i < domains.length; i++) {
        if (matchesDomain(hostname, domains[i])) return true;
      }
      return false;
    });
  }

  function getToolSettings() {
    return new Promise(function (resolve) {
      chrome.storage.local.get(SETTINGS_STORAGE_KEY, function (result) {
        var settings = result[SETTINGS_STORAGE_KEY] || {};
        resolve(settings.floatingBall || {});
      });
    });
  }

  function pushConfigToMain() {
    getToolSettings().then(function (s) {
      log("pushConfig: pattern=" + (s.interceptPattern || DEFAULT_INTERCEPT_PATTERN) +
        " captureAll=" + (!!(s.captureAll === true || s.captureAll === "true")) +
        " showLog=" + (!!(s.showLog === true || s.showLog === "true")));

      setShowLog(s.showLog === true || s.showLog === "true");

      document.dispatchEvent(new CustomEvent("cb-control", {
        detail: { action: "setPattern", pattern: s.interceptPattern || DEFAULT_INTERCEPT_PATTERN },
      }));
      document.dispatchEvent(new CustomEvent("cb-control", {
        detail: { action: "setCaptureAll", value: s.captureAll === true || s.captureAll === "true" },
      }));
      document.dispatchEvent(new CustomEvent("cb-control", {
        detail: { action: "setShowLog", value: s.showLog === true || s.showLog === "true" },
      }));
    });
  }

  // ===== Clipboard =====
  function copyToClipboard(text) {
    try {
      // Prefer async clipboard API (works on HTTPS / localhost)
      navigator.clipboard.writeText(text).catch(function () {
        fallbackCopy(text);
      });
      log("clipboard writeText called, len=" + text.length);
    } catch (e) {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;left:-9999px";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      log("clipboard execCommand " + (ok ? "OK" : "FAIL") + ", len=" + text.length);
    } catch (e) {
      log("clipboard ERROR: " + e);
    }
  }

  // ============================================================
  //  Network listener
  // ============================================================

  // Inject hook.js AFTER settings are loaded, so meta has correct values
  getToolSettings().then(function (s) {
    var cfg = {
      pattern: s.interceptPattern || DEFAULT_INTERCEPT_PATTERN,
      captureAll: s.captureAll === true || s.captureAll === "true",
      showLog: s.showLog === true || s.showLog === "true",
    };
    log("injecting hook.js with " + JSON.stringify(cfg));

    var meta = document.createElement("meta");
    meta.name = "cb-config";
    meta.content = JSON.stringify(cfg);
    (document.head || document.documentElement).appendChild(meta);

    var hookScript = document.createElement("script");
    hookScript.src = chrome.runtime.getURL("hook.js");
    (document.head || document.documentElement).appendChild(hookScript);

    setShowLog(cfg.showLog);
  });

  pushConfigToMain();

  document.addEventListener("cb-network-capture", function (e) {
    if (!e.detail) { log("capture event no detail"); return; }
    var body = e.detail.body;
    var url = e.detail.url || "?";
    log("capture EVENT url=" + url.slice(-80) + " bodyLen=" + (body ? body.length : 0));

    if (!body) { log("capture SKIP: empty body"); return; }

    var parsed;
    try {
      parsed = JSON.parse(body);
      log("capture JSON OK, keys=" + Object.keys(parsed).length);
    } catch (err) {
      log("capture SKIP: not JSON —" + String(err).slice(0, 60));
      return;
    }

    var jsonStr = JSON.stringify(parsed, null, 2);
    copyToClipboard(jsonStr);

    var ballTool = activeTools.floatingBall;
    if (ballTool && typeof ballTool.flash === "function") {
      log("capture FLASH");
      ballTool.flash();
    } else {
      log("capture NOFLASH: ballTool=" + (ballTool ? "exists" : "null"));
    }
  });

  // ===== Floating ball (deferred until <body> exists) =====
  function initFloatingBall() {
    log("initFloatingBall, hostname=" + window.location.hostname);
    ToolRegistry.syncTools();
  }

  if (document.body) {
    initFloatingBall();
  } else {
    log("body not ready, waiting for DOMContentLoaded");
    document.addEventListener("DOMContentLoaded", initFloatingBall);
  }

  // ============================================================
  //  Tool: 悬浮球
  // ============================================================
  var FloatingBallTool = {
    POS_STORAGE_KEY: "cb_floating_ball_pos",
    BALL_SIZE: 56,
    ball: null, restoreTab: null,
    isDragging: false, dragStartX: 0, dragStartY: 0, ballStartX: 0, ballStartY: 0,
    hasMoved: false, isHidden: false,
    boundHandlers: {},

    getTargetUrl: function () {
      var self = this;
      return new Promise(function (resolve) {
        chrome.storage.local.get(SETTINGS_STORAGE_KEY, function (result) {
          var s = (result[SETTINGS_STORAGE_KEY] && result[SETTINGS_STORAGE_KEY].floatingBall) || {};
          resolve(s.targetUrl || DEFAULT_TARGET_URL);
        });
      });
    },

    create: function () {
      var self = this;
      isDomainAllowedAsync(window.location.hostname).then(function (allowed) {
        log("ball create: domain allowed=" + allowed);
        if (!allowed) return;
        self._doCreate();
      });
    },

    _doCreate: function () {
      log("ball _doCreate");
      this.ball = document.createElement("div");
      this.ball.id = "cb-floating-ball";
      this.ball.title = "点击跳转 | 右键隐藏";
      this.ball.innerHTML = '<span class="cb-icon">转</span>';
      this.ball.style.right = "24px";
      this.ball.style.bottom = "80px";

      this.restoreTab = document.createElement("div");
      this.restoreTab.id = "cb-restore-tab";
      this.restoreTab.title = "显示悬浮球";
      this.restoreTab.innerHTML = '<span class="cb-restore-text">转</span>';

      document.body.appendChild(this.ball);
      document.body.appendChild(this.restoreTab);
      this.bindEvents();
      this.loadPosition();
    },

    flash: function () {
      if (!this.ball) return;
      var self = this;
      getToolSettings().then(function (s) {
        var d = parseFloat(s.flashDuration);
        if (isNaN(d) || d <= 0) d = DEFAULT_FLASH_DURATION;
        var ms = d * 1000;
        var wasHidden = self.isHidden;
        if (wasHidden) self.ball.classList.remove("hidden");
        self.ball.style.animation = "cb-flash " + d + "s ease-in-out";
        setTimeout(function () {
          self.ball.style.animation = "";
          if (wasHidden) self.ball.classList.add("hidden");
        }, ms);
      });
    },

    bindEvents: function () {
      this.boundHandlers.onDragStart = this.onDragStart.bind(this);
      this.boundHandlers.onDragMove = this.onDragMove.bind(this);
      this.boundHandlers.onDragEnd = this.onDragEnd.bind(this);
      this.boundHandlers.onClick = this.onClick.bind(this);
      this.boundHandlers.onContextMenu = this.onContextMenu.bind(this);
      this.boundHandlers.onRestoreClick = this.onRestoreClick.bind(this);
      this.boundHandlers.onKeyDown = this.onKeyDown.bind(this);
      this.boundHandlers.onResize = this.onResize.bind(this);

      this.ball.addEventListener("mousedown", this.boundHandlers.onDragStart, { passive: false });
      this.ball.addEventListener("touchstart", this.boundHandlers.onDragStart, { passive: false });
      this.ball.addEventListener("click", this.boundHandlers.onClick);
      this.ball.addEventListener("contextmenu", this.boundHandlers.onContextMenu);
      this.restoreTab.addEventListener("click", this.boundHandlers.onRestoreClick);
      document.addEventListener("keydown", this.boundHandlers.onKeyDown);
      window.addEventListener("resize", this.boundHandlers.onResize);
    },

    unbindEvents: function () {
      if (!this.ball) return;
      this.ball.removeEventListener("mousedown", this.boundHandlers.onDragStart);
      this.ball.removeEventListener("touchstart", this.boundHandlers.onDragStart);
      this.ball.removeEventListener("click", this.boundHandlers.onClick);
      this.ball.removeEventListener("contextmenu", this.boundHandlers.onContextMenu);
      if (this.restoreTab) this.restoreTab.removeEventListener("click", this.boundHandlers.onRestoreClick);
      document.removeEventListener("keydown", this.boundHandlers.onKeyDown);
      window.removeEventListener("resize", this.boundHandlers.onResize);
    },

    onClick: function (e) {
      if (this.hasMoved) return;
      this.getTargetUrl().then(function (url) { window.open(url, "_blank"); });
    },

    onContextMenu: function (e) { e.preventDefault(); this.hide(); },
    onRestoreClick: function () { this.show(); },

    onKeyDown: function (e) {
      if (e.ctrlKey && e.shiftKey && e.key === "B") {
        e.preventDefault();
        this.isHidden ? this.show() : this.hide();
      }
    },

    onDragStart: function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      this.isDragging = true;
      this.hasMoved = false;
      this.ball.classList.add("dragging");

      var cx = e.touches ? e.touches[0].clientX : e.clientX;
      var cy = e.touches ? e.touches[0].clientY : e.clientY;
      this.dragStartX = cx;
      this.dragStartY = cy;

      var rect = this.ball.getBoundingClientRect();
      this.ballStartX = rect.left;
      this.ballStartY = rect.top;

      this.ball.style.right = "";
      this.ball.style.bottom = "";
      this.ball.style.left = this.ballStartX + "px";
      this.ball.style.top = this.ballStartY + "px";

      document.addEventListener("mousemove", this.boundHandlers.onDragMove, { passive: false });
      document.addEventListener("mouseup", this.boundHandlers.onDragEnd);
      document.addEventListener("touchmove", this.boundHandlers.onDragMove, { passive: false });
      document.addEventListener("touchend", this.boundHandlers.onDragEnd);
    },

    onDragMove: function (e) {
      if (!this.isDragging) return;
      e.preventDefault();
      var cx = e.touches ? e.touches[0].clientX : e.clientX;
      var cy = e.touches ? e.touches[0].clientY : e.clientY;
      var dx = cx - this.dragStartX, dy = cy - this.dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.hasMoved = true;
      this.ball.style.left = this.clampX(this.ballStartX + dx) + "px";
      this.ball.style.top = this.clampY(this.ballStartY + dy) + "px";
    },

    onDragEnd: function () {
      if (!FloatingBallTool.isDragging) return;
      FloatingBallTool.isDragging = false;
      FloatingBallTool.ball.classList.remove("dragging");
      var rect = FloatingBallTool.ball.getBoundingClientRect();
      FloatingBallTool.savePosition(rect.left, rect.top);
      document.removeEventListener("mousemove", FloatingBallTool.boundHandlers.onDragMove);
      document.removeEventListener("mouseup", FloatingBallTool.boundHandlers.onDragEnd);
      document.removeEventListener("touchmove", FloatingBallTool.boundHandlers.onDragMove);
      document.removeEventListener("touchend", FloatingBallTool.boundHandlers.onDragEnd);
    },

    onResize: function () {
      if (!this.ball) return;
      var r = this.ball.getBoundingClientRect();
      this.ball.style.left = this.clampX(r.left) + "px";
      this.ball.style.top = this.clampY(r.top) + "px";
    },

    clampX: function (x) { return Math.max(0, Math.min(x, window.innerWidth - this.BALL_SIZE)); },
    clampY: function (y) { return Math.max(0, Math.min(y, window.innerHeight - this.BALL_SIZE)); },

    savePosition: function (l, t) {
      var d = {}; d[this.POS_STORAGE_KEY] = { left: l, top: t };
      chrome.storage.local.set(d);
    },

    loadPosition: function () {
      var self = this;
      chrome.storage.local.get(this.POS_STORAGE_KEY, function (r) {
        var p = r[self.POS_STORAGE_KEY];
        if (p && typeof p.left === "number") {
          self.ball.style.left = self.clampX(p.left) + "px";
          self.ball.style.top = self.clampY(p.top) + "px";
          self.ball.style.right = ""; self.ball.style.bottom = "";
        }
      });
    },

    hide: function () {
      this.isHidden = true;
      this.ball.classList.add("hidden");
      this.restoreTab.classList.add("visible");
    },

    show: function () {
      this.isHidden = false;
      this.ball.classList.remove("hidden");
      this.restoreTab.classList.remove("visible");
    },

    destroy: function () {
      this.unbindEvents();
      if (this.ball) { this.ball.remove(); this.ball = null; }
      if (this.restoreTab) { this.restoreTab.remove(); this.restoreTab = null; }
    },
  };

  // ============================================================

  // ============================================================
  //  Tool: 文本保存（下载逻辑由 background 的 executeScript 注入）
  // ============================================================
  var TxtSaverTool = {
    create: function () {
      log("TxtSaverTool created (background handles download)");
    },
    destroy: function () {
      log("TxtSaverTool destroyed");
    },
  };

  // ============================================================
  //  Tool Registry
  // ============================================================
  var ToolRegistry = {
    constructors: { floatingBall: FloatingBallTool, txtSaver: TxtSaverTool },

    syncTools: async function () {
      var config = await this.getFullConfig();
      for (var id in this.constructors) {
        var shouldRun = config[id] !== false;
        var isActive = !!activeTools[id];
        if (shouldRun && !isActive) this.activateTool(id);
        else if (!shouldRun && isActive) this.deactivateTool(id);
      }
    },

    getFullConfig: function () {
      return new Promise(function (resolve) {
        chrome.storage.local.get(TOOLS_STORAGE_KEY, function (result) {
          var stored = result[TOOLS_STORAGE_KEY] || {};
          var merged = {};
          for (var id in DEFAULT_TOOLS) merged[id] = stored[id] !== undefined ? stored[id] : DEFAULT_TOOLS[id].enabled;
          resolve(merged);
        });
      });
    },

    activateTool: function (id) {
      if (activeTools[id]) return;
      var t = this.constructors[id];
      if (!t) return;
      if (typeof t.create === "function") t.create();
      activeTools[id] = t;
    },

    deactivateTool: function (id) {
      var t = activeTools[id];
      if (!t) return;
      if (typeof t.destroy === "function") t.destroy();
      delete activeTools[id];
    },
  };

  chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName === "local" && (changes[TOOLS_STORAGE_KEY] || changes[SETTINGS_STORAGE_KEY])) {
      if (changes[SETTINGS_STORAGE_KEY]) {
        log("storage changed, pushing config");
        pushConfigToMain();
        if (activeTools.floatingBall) {
          ToolRegistry.deactivateTool("floatingBall");
          ToolRegistry.activateTool("floatingBall");
        }
      }
      ToolRegistry.syncTools();
    }
  });
})();
