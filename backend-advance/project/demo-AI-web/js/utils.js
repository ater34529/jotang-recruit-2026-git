/* 通用工具：转义、时间、复制、存储、图标。 */
(function (window) {
  'use strict';

  var Jotang = window.Jotang = window.Jotang || {};
  var HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return HTML_ESCAPE[ch];
    });
  }

  function uid(prefix) {
    var random;
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      random = window.crypto.randomUUID();
    } else {
      random = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }
    return (prefix || '') + random;
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function toDate(value) {
    var date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatTime(value) {
    var date = toDate(value);
    if (!date) return '';
    return pad2(date.getHours()) + ':' + pad2(date.getMinutes());
  }

  function formatRelative(value) {
    var date = toDate(value);
    if (!date) return '';
    var diff = Date.now() - date.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    if (diff < 172800000) return '昨天';
    var now = new Date();
    if (date.getFullYear() === now.getFullYear()) {
      return pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
    }
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms < 0) return '—';
    if (ms < 1000) return Math.max(1, Math.round(ms)) + ' ms';
    if (ms < 60000) return (ms / 1000).toFixed(1) + ' s';
    var minutes = Math.floor(ms / 60000);
    var seconds = Math.round((ms % 60000) / 1000);
    return minutes + 'm ' + seconds + 's';
  }

  function truncate(value, max) {
    var text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    return text.slice(0, Math.max(1, max - 1)).trim() + '…';
  }

  function icon(name, className) {
    return '<svg class="' + (className || 'icon') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      var self = this;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { fn.apply(self, args); }, wait);
    };
  }

  function safeGetJSON(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function safeSetJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function safeSetRaw(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function safeGetRaw(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      /* ignore */
    }
  }

  async function copyText(text) {
    var value = String(text == null ? '' : text);
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (e) {
        /* 继续尝试兜底方案 */
      }
    }
    try {
      var area = document.createElement('textarea');
      area.value = value;
      area.setAttribute('readonly', 'readonly');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      area.style.pointerEvents = 'none';
      document.body.appendChild(area);
      area.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch (e) {
      return false;
    }
  }

  function downloadText(filename, text) {
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function sanitizeUrl(value) {
    var url = String(value == null ? '' : value).trim();
    if (!url) return null;
    if (/^(https?:|mailto:)/i.test(url)) return url;
    if (url.charAt(0) === '#') return url;
    return null;
  }

  function prettyJSON(value) {
    if (value == null) return '';
    try {
      return JSON.stringify(value, null, 2);
    } catch (e) {
      return String(value);
    }
  }

  Jotang.utils = {
    escapeHtml: escapeHtml,
    uid: uid,
    formatTime: formatTime,
    formatRelative: formatRelative,
    formatDuration: formatDuration,
    truncate: truncate,
    icon: icon,
    clamp: clamp,
    debounce: debounce,
    safeGetJSON: safeGetJSON,
    safeSetJSON: safeSetJSON,
    safeSetRaw: safeSetRaw,
    safeGetRaw: safeGetRaw,
    safeRemove: safeRemove,
    copyText: copyText,
    downloadText: downloadText,
    sanitizeUrl: sanitizeUrl,
    prettyJSON: prettyJSON
  };
})(window);
