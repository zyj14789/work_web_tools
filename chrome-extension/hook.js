(function () {
  "use strict";
  var PATTERN = "listDataApiLog.action";
  var CAPTURE_ALL = false;
  var SHOW_LOG = false;

  var meta = document.querySelector('meta[name="cb-config"]');
  if (meta) {
    try {
      var initCfg = JSON.parse(meta.content);
      if (initCfg.pattern) PATTERN = initCfg.pattern;
      CAPTURE_ALL = !!initCfg.captureAll;
      SHOW_LOG = !!initCfg.showLog;
    } catch (ignore) {}
  }

  function log(msg) {
    try {
      document.dispatchEvent(new CustomEvent("cb-log", { detail: { msg: msg, ts: Date.now() } }));
    } catch (ignore) {}
  }

  document.addEventListener("cb-control", function (e) {
    if (!e.detail) return;
    if (e.detail.action === "setPattern" && e.detail.pattern) PATTERN = e.detail.pattern;
    if (e.detail.action === "setCaptureAll") CAPTURE_ALL = !!e.detail.value;
    if (e.detail.action === "setShowLog") SHOW_LOG = !!e.detail.value;
  });

  log("[HOOK] script loaded, PATTERN=" + PATTERN + " CAPTURE_ALL=" + CAPTURE_ALL);

  function shouldCapture(url) {
    if (CAPTURE_ALL) return true;
    return url && url.indexOf(PATTERN) !== -1;
  }

  function notify(url, body) {
    log("[HOOK] notify url=" + (url || "?").slice(-80) + " bodyLen=" + (body ? body.length : 0));
    try {
      document.dispatchEvent(new CustomEvent("cb-network-capture", {
        detail: { url: url, body: body },
      }));
    } catch (ignore) {}
    try {
      if (!document.body) return;
      var b = document.createElement("div");
      b.style.cssText =
        "position:fixed;top:8px;right:8px;z-index:2147483647;" +
        "background:#00d68f;color:#000;padding:6px 12px;border-radius:6px;" +
        "font:12px monospace;max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none;";
      b.textContent = "CB: " + (url || "?").slice(-60);
      document.body.appendChild(b);
      setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 3000);
    } catch (ignore) {}
  }

  // jQuery interception
  function setupJQueryHook() {
    if (window.jQuery) {
      log("[HOOK] jQuery found, registering ajaxComplete");
      window.jQuery(document).ajaxComplete(function (event, xhr, settings) {
        log("[HOOK] ajaxComplete fired url=" + (settings.url || "?").slice(-80));
        if (shouldCapture(settings.url)) {
          log("[HOOK] ajaxComplete MATCH, bodyLen=" + (xhr.responseText ? xhr.responseText.length : 0));
          notify(settings.url, xhr.responseText);
        }
      });
    } else {
      setTimeout(setupJQueryHook, 50);
    }
  }
  setupJQueryHook();

  // XHR patch — log every XHR regardless of jQuery
  var _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) { this._cb_u = u; return _open.apply(this, arguments); };

  var _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    var x = this, or = x.onreadystatechange;
    x.onreadystatechange = function () {
      if (x.readyState === 4) {
        log("[HOOK] XHR done url=" + (x._cb_u || "?").slice(-80));
        if (shouldCapture(x._cb_u)) notify(x._cb_u, x.responseText);
      }
      if (or) or.apply(x, arguments);
    };
    x.addEventListener("loadend", function () {
      if (shouldCapture(x._cb_u)) notify(x._cb_u, x.responseText);
    });
    return _send.apply(this, arguments);
  };

  // Fetch patch
  var _fetch = window.fetch;
  window.fetch = function (input, init) {
    var u = typeof input === "string" ? input : (input && input.url ? input.url : "");
    log("[HOOK] fetch called url=" + (u || "?").slice(-80));
    return _fetch.apply(this, arguments).then(function (r) {
      if (shouldCapture(u)) r.clone().text().then(function (t) { notify(u, t); }).catch(function () {});
      return r;
    });
  };
})();
