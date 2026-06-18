(function () {
  "use strict";
  // ===== 360: safe chrome API wrappers (survive extension reload) =====
  var _chromeOk = true;
  function _checkChrome() {
    if (!_chromeOk) return false;
    try { if (!chrome.runtime || !chrome.runtime.id) { _chromeOk = false; return false; } }
    catch (e) { _chromeOk = false; return false; }
    return true;
  }
  function safeGet(keys, cb) {
    if (!_checkChrome()) return;
    try { safeGet(keys, cb); } catch (e) {}
  }
  function safeSet(data, cb) {
    if (!_checkChrome()) return;
    try { safeSet(data, cb); } catch (e) {}
  }


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


  // 360-compatible hook URL resolution with fallback
  function getHookUrl() {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
        return chrome.runtime.getURL("hook.js");
      }
    } catch (e) {
      console.error("[360-extension] chrome.runtime.getURL failed:", e);
    }
    try {
      if (typeof chrome !== "undefined" && chrome.extension && chrome.extension.getURL) {
        return chrome.extension.getURL("hook.js");
      }
    } catch (e) {
      console.error("[360-extension] chrome.extension.getURL failed:", e);
    }
    console.error("[360-extension] Cannot resolve hook.js URL - hook injection skipped");
    return null;
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
    clipboardShelf: {
      id: "clipboardShelf",
      name: "临存台面",
      description: "保存最近复制记录，点击粘贴",
      enabled: true,
      icon: "台",
    },
  };
var activeTools = {};
var _firstCaptureDone = false;

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
      safeGet(SETTINGS_STORAGE_KEY, function (result) {
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
      safeGet(SETTINGS_STORAGE_KEY, function (result) {
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
    var hookUrl = getHookUrl();
    if (!hookUrl) { log("hook URL resolution failed, hook.js not injected"); return; }
    hookScript.src = hookUrl;
    hookScript.onerror = function () { console.error("[360-extension] hook.js failed to load from: " + hookUrl); };
    (document.head || document.documentElement).appendChild(hookScript);

    setShowLog(cfg.showLog);
  });

  pushConfigToMain();

  function onNetworkCapture(e) {
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
      log("capture SKIP: not JSON " + String(err).slice(0, 60));
      return;
    }

    var jsonStr = JSON.stringify(parsed, null, 2);
    // Skip clipboard write on first capture to preserve user's existing clipboard
    if (_firstCaptureDone) {
      copyToClipboard(jsonStr);
    } else {
      _firstCaptureDone = true;
      log("capture FIRST: skipped clipboard write to preserve user data");
    }

    var ballTool = activeTools.floatingBall;
    if (ballTool && typeof ballTool.flash === "function") {
      log("capture FLASH");
      ballTool.flash();
    } else {
      log("capture NOFLASH: ballTool=" + (ballTool ? "exists" : "null"));
    }
  }

  document.addEventListener("cb-network-capture", onNetworkCapture);

  // ============================================================
  //  IframeCaptureManager - always-active network capture injection
  //  into iframes. Shared by floatingBall (flash on capture) and
  //  clipboardShelf (populate captures). Runs independently of
  //  tool enable/disable toggles so network capture survives
  //  individual tool destruction.
  // ============================================================
  var IframeCaptureManager = {
    _hookedIframeDocs: new Set(),
    _iframes: new Map(),

    init: function () {
      var self = this;
      // Hook existing iframes
      var iframes = document.querySelectorAll("iframe");
      for (var i = 0; i < iframes.length; i++) {
        self._hookIframe(iframes[i]);
      }
      // Watch for dynamically added iframes
      this._observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          m.addedNodes.forEach(function (node) {
            if (node.nodeName === "IFRAME") {
              self._hookIframe(node);
            } else if (node.querySelectorAll) {
              var nested = node.querySelectorAll("iframe");
              for (var j = 0; j < nested.length; j++) {
                self._hookIframe(nested[j]);
              }
            }
          });
        });
      });
      this._observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
      });
      log("IframeCaptureManager init");
    },

    _hookIframe: function (iframe) {
      if (this._iframes.has(iframe)) return;
      var self = this;
      var onLoad = function () {
        self._injectIntoIframeDoc(iframe);
      };
      iframe.addEventListener("load", onLoad);
      this._iframes.set(iframe, { _onLoad: onLoad });
      // If already loaded, inject immediately
      if (iframe.contentDocument && iframe.contentDocument.readyState === "complete") {
        onLoad();
      }
    },

    _injectIntoIframeDoc: function (iframe) {
      try {
        var doc = iframe.contentDocument;
        if (!doc) return;
        if (this._hookedIframeDocs.has(doc)) return;
        this._hookedIframeDocs.add(doc);
        // Read config from main page meta
        var mainMeta = document.querySelector('meta[name="cb-config"]');
        var cfgContent = mainMeta ? mainMeta.content : '{"pattern":"listDataApiLog.action","captureAll":false,"showLog":false}';
        var meta = doc.createElement("meta");
        meta.name = "cb-config";
        meta.content = cfgContent;
        (doc.head || doc.documentElement).appendChild(meta);
        var script = doc.createElement("script");
        var hookUrl = getHookUrl();
        if (!hookUrl) return;
        script.src = hookUrl;
        script.onerror = function () { console.error("[360-extension] hook.js failed to load in iframe from: " + hookUrl); };
        (doc.head || doc.documentElement).appendChild(script);
        doc.addEventListener("cb-network-capture", onNetworkCapture);
        log("IframeCaptureManager: injected hook into iframe");
      } catch (e) {
        // Cross-origin iframe - silently skip
      }
    },
  };

  // ===== Floating ball (deferred until <body> exists) =====
  function initFloatingBall() {
    log("initTools, hostname=" + window.location.hostname);
    IframeCaptureManager.init();
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
        safeGet(SETTINGS_STORAGE_KEY, function (result) {
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

      this.ball.addEventListener("pointerdown", this.boundHandlers.onDragStart, { passive: false });
      this.ball.addEventListener("pointermove", this.boundHandlers.onDragMove, { passive: false });
      this.ball.addEventListener("pointerup", this.boundHandlers.onDragEnd);
      this.ball.addEventListener("pointercancel", this.boundHandlers.onDragEnd);
      this.ball.addEventListener("click", this.boundHandlers.onClick);
      this.ball.addEventListener("contextmenu", this.boundHandlers.onContextMenu);
      this.restoreTab.addEventListener("click", this.boundHandlers.onRestoreClick);
      document.addEventListener("keydown", this.boundHandlers.onKeyDown);
      window.addEventListener("resize", this.boundHandlers.onResize);
    },

    unbindEvents: function () {
      if (!this.ball) return;
      this.ball.removeEventListener("pointerdown", this.boundHandlers.onDragStart);
      this.ball.removeEventListener("pointermove", this.boundHandlers.onDragMove);
      this.ball.removeEventListener("pointerup", this.boundHandlers.onDragEnd);
      this.ball.removeEventListener("pointercancel", this.boundHandlers.onDragEnd);
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

      // Pointer capture keeps all subsequent events on the ball,
      // preventing detachment during fast drags.
      if (this.ball.setPointerCapture) {
        this.ball.setPointerCapture(e.pointerId);
      }

      this.isDragging = true;
      this.hasMoved = false;
      this.ball.classList.add("dragging");

      var cx = e.clientX;
      var cy = e.clientY;
      this.dragStartX = cx;
      this.dragStartY = cy;

      var rect = this.ball.getBoundingClientRect();
      this.ballStartX = rect.left;
      this.ballStartY = rect.top;

      this.ball.style.right = "";
      this.ball.style.bottom = "";
      this.ball.style.left = this.ballStartX + "px";
      this.ball.style.top = this.ballStartY + "px";
    },

    onDragMove: function (e) {
      if (!this.isDragging) return;
      e.preventDefault();
      var dx = e.clientX - this.dragStartX, dy = e.clientY - this.dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.hasMoved = true;
      this.ball.style.left = this.clampX(this.ballStartX + dx) + "px";
      this.ball.style.top = this.clampY(this.ballStartY + dy) + "px";
    },

    onDragEnd: function (e) {
      if (!FloatingBallTool.isDragging) return;
      FloatingBallTool.isDragging = false;
      FloatingBallTool.ball.classList.remove("dragging");

      if (e && FloatingBallTool.ball.releasePointerCapture) {
        FloatingBallTool.ball.releasePointerCapture(e.pointerId);
      }

      var rect = FloatingBallTool.ball.getBoundingClientRect();
      FloatingBallTool.savePosition(rect.left, rect.top);
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
      safeSet(d);
    },

    loadPosition: function () {
      var self = this;
      safeGet(this.POS_STORAGE_KEY, function (r) {
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
  var TxtSaverTool = {
    create: function () {
      log("TxtSaverTool created (background handles download)");
    },
    destroy: function () {
      log("TxtSaverTool destroyed");
    },
  };

  // ============================================================
  //  Tool: 临存台面 (Clipboard Shelf)
  // ============================================================
  var ClipboardShelfTool = {
    STORAGE_KEY: "cb_clipboard_shelf",
    COLLAPSED_STORAGE_KEY: "cb_shelf_collapsed",
    MAX_ITEMS: 10,
    panel: null, itemList: null, toggleBtn: null, isVisible: true,
    items: [],

    create: function () {
      var self = this;
      log("ClipboardShelfTool create");
      this.loadAndRender();
      this.bindCopyListener();
    },

    destroy: function () {
      log("ClipboardShelfTool destroy");
      this.unbindCopyListener();
      document.removeEventListener("mousemove", this._onDragMove);
      document.removeEventListener("mouseup", this._onDragEnd);
      document.removeEventListener("touchmove", this._onDragMove);
      document.removeEventListener("touchend", this._onDragEnd);
      if (this._onDocClick) {
        document.removeEventListener("click", this._onDocClick, true);
        this._onDocClick = null;
      }
      if (this.panel) { this.panel.remove(); this.panel = null; this.itemList = null; this.toggleBtn = null; this._opacityPopup = null; }
    },

    loadAndRender: function () {
      var self = this;
      if (!this.panel) this.buildPanel();
      safeGet(this.STORAGE_KEY, function (result) {
        self.items = result[self.STORAGE_KEY] || [];
        if (self.panel) self.renderList();
      });
    },

    buildPanel: function () {
      var self = this;

      // Container
      this.panel = document.createElement("div");
      this.panel.id = "cb-clipboard-shelf";

      // Header
      var header = document.createElement("div");
      header.className = "cb-shelf-header";

      // Left-side buttons group
      var leftGroup = document.createElement("div");
      leftGroup.className = "cb-shelf-left-btns";

      // Drag handle
      var dragBtn = document.createElement("button");
      dragBtn.className = "cb-shelf-drag-btn";
      dragBtn.title = "按住拖动窗口";
      dragBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="3" cy="2" r="1.2" fill="currentColor"/><circle cx="7" cy="2" r="1.2" fill="currentColor"/><circle cx="3" cy="6" r="1.2" fill="currentColor"/><circle cx="7" cy="6" r="1.2" fill="currentColor"/><circle cx="3" cy="10" r="1.2" fill="currentColor"/><circle cx="7" cy="10" r="1.2" fill="currentColor"/></svg>';
      dragBtn.addEventListener("mousedown", function (e) { e.stopPropagation(); e.preventDefault(); self.onDragStart(e); });
      dragBtn.addEventListener("touchstart", function (e) { e.stopPropagation(); e.preventDefault(); self.onDragStart(e); });
      leftGroup.appendChild(dragBtn);

      // Opacity button
      var opacityBtn = document.createElement("button");
      opacityBtn.className = "cb-shelf-opacity-btn";
      opacityBtn.title = "透明度设置";
      opacityBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6 1 A5 5 0 0 1 6 11" fill="currentColor" opacity="0.5"/></svg>';
      opacityBtn.addEventListener("click", function (e) { e.stopPropagation(); self.toggleOpacityPopup(); });
      leftGroup.appendChild(opacityBtn);

      header.appendChild(leftGroup);

      // Title
      var title = document.createElement("span");
      title.className = "cb-shelf-title";
      title.textContent = "临存台面";
      header.appendChild(title);

      // Toggle button
      this.toggleBtn = document.createElement("button");
      this.toggleBtn.className = "cb-shelf-toggle";
      this.toggleBtn.title = "折叠/展开";
      this.toggleBtn.textContent = "\u2212";
      this.toggleBtn.addEventListener("click", function (e) { e.stopPropagation(); self.togglePanel(); });
      header.appendChild(this.toggleBtn);

      // Clear button
      var clearBtn = document.createElement("button");
      clearBtn.className = "cb-shelf-clear";
      clearBtn.title = "清空记录";
      clearBtn.textContent = "清空";
      clearBtn.addEventListener("click", function (e) { e.stopPropagation(); self.clearAll(); });
      header.appendChild(clearBtn);

      this.panel.appendChild(header);

      // Item list
      this.itemList = document.createElement("div");
      this.itemList.className = "cb-shelf-list";
      this.panel.appendChild(this.itemList);

      // Empty placeholder
      var empty = document.createElement("div");
      empty.className = "cb-shelf-empty";
      empty.textContent = "暂无复制记录";
      empty.id = "cb-shelf-empty-msg";
      this.itemList.appendChild(empty);

      document.body.appendChild(this.panel);

      // Opacity popup (hidden by default)
      this.buildOpacityPopup();

      // Load saved opacity
      this.loadOpacity();
      // Restore collapsed state
      this.loadCollapsedState();
      this.renderList();

      // Bind drag handlers on document
      this._onDragMove = this.onDragMove.bind(this);
      this._onDragEnd = this.onDragEnd.bind(this);
    },

    loadCollapsedState: function () {
      var self = this;
      safeGet(this.COLLAPSED_STORAGE_KEY, function (result) {
        var collapsed = result[self.COLLAPSED_STORAGE_KEY];
        if (collapsed && self.itemList && self.toggleBtn) {
          self.itemList.style.display = "none";
          self.toggleBtn.textContent = "+";
        }
      });
    },

    renderList: function () {
      if (!this.itemList) return;
      var self = this;

      // Remove old items, keep empty msg
      var oldItems = this.itemList.querySelectorAll(".cb-shelf-item");
      oldItems.forEach(function (el) { el.remove(); });

      var emptyMsg = document.getElementById("cb-shelf-empty-msg");
      if (this.items.length === 0) {
        if (emptyMsg) emptyMsg.style.display = "block";
        return;
      }
      if (emptyMsg) emptyMsg.style.display = "none";

      for (var i = 0; i < this.items.length; i++) {
        var item = this.items[i];
        var el = document.createElement("div");
        el.className = "cb-shelf-item";
        el.title = item.text;
        el.textContent = item.text;
        el.setAttribute("data-index", i);

        // Do paste on mousedown -- before browser has any chance to move focus
        el.addEventListener("mousedown", function (e) {
          e.preventDefault();  // stop default: no text selection, no focus change
          e.stopPropagation();
          var idx = parseInt(this.getAttribute("data-index"));
          self.pasteItem(idx);
        });
        this.itemList.appendChild(el);
      }
    },

    bindCopyListener: function () {
      var self = this;
      this._onCopy = this.onCopy.bind(this);
      this._hookedIframes = [];

      // Top-level document
      document.addEventListener("copy", this._onCopy);

      // Hook existing iframes
      var iframes = document.querySelectorAll("iframe");
      for (var i = 0; i < iframes.length; i++) {
        self._hookIframe(iframes[i]);
      }

      // Watch for dynamically added iframes
      this._iframeObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          m.addedNodes.forEach(function (node) {
            if (node.nodeName === "IFRAME") {
              self._hookIframe(node);
            } else if (node.querySelectorAll) {
              var nested = node.querySelectorAll("iframe");
              for (var j = 0; j < nested.length; j++) {
                self._hookIframe(nested[j]);
              }
            }
          });
        });
      });
      this._iframeObserver.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
      });
    },

    _hookIframe: function (iframe) {
      // Avoid duplicate hooks on the same iframe element
      if (this._hookedIframes.some(function (h) { return h.iframe === iframe; })) return;

      var self = this;
      var onLoad = function () {
        self._attachCopyToIframeDoc(iframe, onLoad);
      };

      iframe.addEventListener("load", onLoad);
      this._hookedIframes.push({ iframe: iframe, doc: null, _onLoad: onLoad });

      // If the iframe is already loaded, hook immediately
      if (iframe.contentDocument && iframe.contentDocument.readyState === "complete") {
        onLoad();
      }
    },

    _attachCopyToIframeDoc: function (iframe, onLoad) {
      try {
        var doc = iframe.contentDocument;
        if (!doc) return;
        // Skip if we already hooked this exact document object (handles re-load of same doc)
        var entry = this._hookedIframes.filter(function (h) { return h.iframe === iframe; })[0];
        if (entry && entry.doc === doc) return;
        doc.addEventListener("copy", this._onCopy);
        if (entry) entry.doc = doc;
        log("ClipboardShelf: hooked iframe " + (iframe.src || "(srcdoc)").slice(0, 60));
      } catch (e) {
        // Cross-origin iframe -- can't access, silently skip
      }
    },


    unbindCopyListener: function () {
      if (this._onCopy) {
        document.removeEventListener("copy", this._onCopy);
        // Clean up iframe listeners (both load and copy)
        if (this._hookedIframes) {
          for (var i = 0; i < this._hookedIframes.length; i++) {
            var h = this._hookedIframes[i];
            // Remove load listener from the iframe element
            if (h._onLoad) {
              h.iframe.removeEventListener("load", h._onLoad);
            }
            // Remove copy listener from the hooked document
            if (h.doc) {
              try { h.doc.removeEventListener("copy", this._onCopy); } catch (e) {}
            }
          }
          this._hookedIframes = [];
        }
        // Network capture listeners on iframe docs are shared infrastructure
        // (floatingBall depends on them), so they are NOT removed here.
        this._onCopy = null;
      }
      if (this._iframeObserver) {
        this._iframeObserver.disconnect();
        this._iframeObserver = null;
      }
    },

    onCopy: function (e) {
      var text = "";

      // Use the document where the event originated (works for iframe copy events)
      var targetDoc = e.target && e.target.ownerDocument;
      if (!targetDoc) return;

      // Check input/textarea active element first (their selection is not via getSelection)
      var el = targetDoc.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
        var start = el.selectionStart;
        var end = el.selectionEnd;
        if (start !== undefined && end !== undefined && start < end) {
          text = el.value.substring(start, end).trim();
        }
      }

      // Fallback: document-level selection (from the event's document)
      if (!text) {
        var selection = targetDoc.defaultView.getSelection();
        if (selection && !selection.isCollapsed) {
          text = selection.toString().trim();
        }
      }

      if (!text) return;
      this.addItem(text);
    },

    addItem: function (text) {
      var self = this;

      // Deduplicate: if same text already exists, remove it first
      this.items = this.items.filter(function (item) { return item.text !== text; });

      this.items.unshift({
        text: text,
        time: Date.now()
      });

      // Trim to MAX_ITEMS
      if (this.items.length > this.MAX_ITEMS) {
        this.items = this.items.slice(0, this.MAX_ITEMS);
      }

      this.persistAndRender();
    },

    persistAndRender: function () {
      var self = this;
      var data = {};
      data[this.STORAGE_KEY] = this.items;
      safeSet(data, function () {
        if (self.panel) self.renderList();
      });
    },

    pasteItem: function (index) {
      var item = this.items[index];
      if (!item) return;

      var text = item.text;

      // Copy to clipboard
      try {
        navigator.clipboard.writeText(text).then(function () {
          log("ClipboardShelf: copied to clipboard, len=" + text.length);
        }).catch(function () {
          fallbackCopy(text);
          log("ClipboardShelf: fallback copy, len=" + text.length);
        });
      } catch (err) {
        fallbackCopy(text);
        log("ClipboardShelf: fallback copy (try), len=" + text.length);
      }

      // Capture focused element now (mousedown hasn't moved focus yet)
      var target = document.activeElement;
      // Drill into same-origin iframes
      if (target && target.tagName === 'IFRAME') {
        try {
          var iframeDoc = target.contentDocument;
          if (iframeDoc && iframeDoc.activeElement) {
            target = iframeDoc.activeElement;
          }
        } catch (e) {}
      }
      this.tryPasteToFocused(text, target);
    },

    tryPasteToFocused: function (text, targetEl) {
      var el = targetEl || document.activeElement;
      if (!el) return;

      var tag = el.tagName.toLowerCase();
      var isEditable = el.isContentEditable ||
        tag === "input" || tag === "textarea" ||
        (el.getAttribute && el.getAttribute("role") === "textbox");

      if (!isEditable) return;

      // Focus is restored inside double-rAF callback below
      
      var self = this;
      var doPaste = function () {
        try {
          if (tag === "input" || tag === "textarea") {
            var start = el.selectionStart;
            var end = el.selectionEnd;
            if (start !== undefined && end !== undefined) {
              var before = el.value.substring(0, start);
              var after = el.value.substring(end);
              el.value = before + text + after;
              var newPos = start + text.length;
              el.setSelectionRange(newPos, newPos);
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
              el.focus();
              return;
            }
          }

          if (el.isContentEditable || (el.getAttribute && el.getAttribute("role") === "textbox")) {
            var ownerDoc = el.ownerDocument || document;
            var sel = ownerDoc.defaultView.getSelection();
            if (sel.rangeCount > 0) {
              var range = sel.getRangeAt(0);
              range.deleteContents();
              var textNode = ownerDoc.createTextNode(text);
              range.insertNode(textNode);
              range.setStartAfter(textNode);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.focus();
              return;
            }
          }
        } catch (err) {
          log("ClipboardShelf: paste error " + err);
        }
      };

      // Delay paste until click chain fully completes
      setTimeout(function () {
        el.focus();
        setTimeout(doPaste, 50);
      }, 50);
    },

    togglePanel: function () {
      if (!this.itemList) return;
      var list = this.itemList;
      var collapsed;
      if (list.style.display === "none") {
        list.style.display = "";
        this.toggleBtn.textContent = "\u2212";
        collapsed = false;
      } else {
        list.style.display = "none";
        this.toggleBtn.textContent = "+";
        collapsed = true;
      }
      // Persist collapsed state
      var data = {};
      data[this.COLLAPSED_STORAGE_KEY] = collapsed;
      safeSet(data);
    },

    clearAll: function () {
      this.items = [];
      var data = {};
      data[this.STORAGE_KEY] = [];
      var self = this;
      safeSet(data, function () {
        if (self.panel) self.renderList();
      });
    },

    // ===== Drag =====
    onDragStart: function (e) {
      this._dragging = true;
      this._dragStartX = e.touches ? e.touches[0].clientX : e.clientX;
      this._dragStartY = e.touches ? e.touches[0].clientY : e.clientY;
      var rect = this.panel.getBoundingClientRect();
      this._panelStartX = rect.left;
      this._panelStartY = rect.top;

      // Switch from right/top positioning to left/top for smooth drag
      this.panel.style.right = "";
      this.panel.style.top = "";
      this.panel.style.left = this._panelStartX + "px";
      this.panel.style.top = this._panelStartY + "px";
      this.panel.style.transition = "none";
      this.panel.classList.add("cb-shelf-dragging");

      document.addEventListener("mousemove", this._onDragMove, { passive: false });
      document.addEventListener("mouseup", this._onDragEnd);
      document.addEventListener("touchmove", this._onDragMove, { passive: false });
      document.addEventListener("touchend", this._onDragEnd);
    },

    onDragMove: function (e) {
      if (!this._dragging) return;
      e.preventDefault();
      var cx = e.touches ? e.touches[0].clientX : e.clientX;
      var cy = e.touches ? e.touches[0].clientY : e.clientY;
      var dx = cx - this._dragStartX;
      var dy = cy - this._dragStartY;
      this.panel.style.left = Math.max(0, Math.min(this._panelStartX + dx, window.innerWidth - this.panel.offsetWidth)) + "px";
      this.panel.style.top = Math.max(0, Math.min(this._panelStartY + dy, window.innerHeight - 40)) + "px";
    },

    onDragEnd: function () {
      if (!this._dragging) return;
      this._dragging = false;
      this.panel.classList.remove("cb-shelf-dragging");
      this.panel.style.transition = "";
      document.removeEventListener("mousemove", this._onDragMove);
      document.removeEventListener("mouseup", this._onDragEnd);
      document.removeEventListener("touchmove", this._onDragMove);
      document.removeEventListener("touchend", this._onDragEnd);
    },

    // ===== Opacity =====
    OPACITY_STORAGE_KEY: "cb_shelf_opacity",

    buildOpacityPopup: function () {
      var self = this;
      this._opacityPopup = document.createElement("div");
      this._opacityPopup.className = "cb-shelf-opacity-popup";
      this._opacityPopup.style.display = "none";

      var presets = [100, 80, 60, 40, 20];
      for (var i = 0; i < presets.length; i++) {
        (function (val) {
          var opt = document.createElement("div");
          opt.className = "cb-shelf-opacity-opt";
          opt.textContent = val + "%";
          opt.setAttribute("data-val", val);
          opt.addEventListener("click", function (e) {
            e.stopPropagation();
            self.setOpacity(val);
          });
          self._opacityPopup.appendChild(opt);
        })(presets[i]);
      }

      // Close popup when clicking outside
      this._onDocClick = function (e) {
        if (self._opacityPopup && !self._opacityPopup.contains(e.target) &&
            !e.target.closest(".cb-shelf-opacity-btn")) {
          self._opacityPopup.style.display = "none";
        }
      };
      document.addEventListener("click", this._onDocClick, true);

      this.panel.appendChild(this._opacityPopup);
    },

    setOpacity: function (pct) {
      var opacity = pct / 100;
      this.panel.style.setProperty("--shelf-bg-opacity", opacity);
      this._currentOpacity = pct;

      // Highlight active
      var opts = this._opacityPopup.querySelectorAll(".cb-shelf-opacity-opt");
      opts.forEach(function (o) {
        o.classList.toggle("active", parseInt(o.getAttribute("data-val")) === pct);
      });

      this._opacityPopup.style.display = "none";

      // Persist
      var data = {};
      data[this.OPACITY_STORAGE_KEY] = pct;
      safeSet(data);
    },

    loadOpacity: function () {
      var self = this;
      safeGet(this.OPACITY_STORAGE_KEY, function (result) {
        var pct = result[self.OPACITY_STORAGE_KEY] || 88;
        self.panel.style.setProperty("--shelf-bg-opacity", pct / 100);
        self._currentOpacity = pct;

        var opts = self._opacityPopup.querySelectorAll(".cb-shelf-opacity-opt");
        opts.forEach(function (o) {
          o.classList.toggle("active", parseInt(o.getAttribute("data-val")) === pct);
        });
      });
    },

    toggleOpacityPopup: function () {
      if (!this._opacityPopup) return;
      var popup = this._opacityPopup;
      var currentPct = this._currentOpacity;
      if (popup.style.display === "none") {
        popup.style.display = "block";
        // Update active highlight
        var opts = popup.querySelectorAll(".cb-shelf-opacity-opt");
        opts.forEach(function (o) {
          o.classList.toggle("active", parseInt(o.getAttribute("data-val")) === currentPct);
        });
      } else {
        popup.style.display = "none";
      }
    },
  };

  // ============================================================
  //  Tool Registry
  // ============================================================
  var ToolRegistry = {
    constructors: { floatingBall: FloatingBallTool, txtSaver: TxtSaverTool, clipboardShelf: ClipboardShelfTool },

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
        safeGet(TOOLS_STORAGE_KEY, function (result) {
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
    if (areaName !== "local") return;

    // Cross-tab sync for clipboard shelf
    var shelfChange = changes["cb_clipboard_shelf"];
    if (shelfChange && shelfChange.newValue) {
      var shelfTool = activeTools.clipboardShelf;
      if (shelfTool && shelfTool.panel) {
        shelfTool.items = shelfChange.newValue;
        shelfTool.renderList();
        log("ClipboardShelf: synced from another tab, items=" + shelfChange.newValue.length);
      }
    }

    if (changes[TOOLS_STORAGE_KEY] || changes[SETTINGS_STORAGE_KEY]) {
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
