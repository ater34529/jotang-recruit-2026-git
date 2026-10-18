/* 本地会话存储：localStorage 持久化，刷新后仍保留对话。 */
(function (window) {
  'use strict';

  var Jotang = window.Jotang = window.Jotang || {};
  var utils = Jotang.utils;
  var keys = Jotang.STORAGE_KEYS;
  var defaults = Jotang.DEFAULT_SETTINGS;
  var MAX_MESSAGES = 200;

  function nowISO() {
    return new Date().toISOString();
  }

  function normalizeSettings(raw) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var apiBaseUrl = typeof source.apiBaseUrl === 'string' ? source.apiBaseUrl.trim() : defaults.apiBaseUrl;
    apiBaseUrl = apiBaseUrl.replace(/\/+$/, '');
    var chatPath = typeof source.chatPath === 'string' ? source.chatPath.trim() : defaults.chatPath;
    if (!chatPath) chatPath = defaults.chatPath;
    if (chatPath.charAt(0) !== '/') chatPath = '/' + chatPath;
    var timeoutMs = Number(source.timeoutMs);
    if (!Number.isFinite(timeoutMs)) timeoutMs = defaults.timeoutMs;
    timeoutMs = utils.clamp(timeoutMs, 60000, 600000);
    var modelLabel = typeof source.modelLabel === 'string' && source.modelLabel.trim()
      ? source.modelLabel.trim().slice(0, 60)
      : defaults.modelLabel;
    return {
      apiBaseUrl: apiBaseUrl,
      chatPath: chatPath,
      modelLabel: modelLabel,
      timeoutMs: timeoutMs,
      theme: source.theme === 'light' ? 'light' : 'dark'
    };
  }

  function normalizeMessage(raw, options) {
    if (!raw || typeof raw !== 'object') return null;
    var opts = options || {};
    var role = raw.role === 'assistant' ? 'assistant' : raw.role === 'user' ? 'user' : null;
    if (!role) return null;
    var status = raw.status === 'error' || raw.status === 'stopped' || raw.status === 'pending'
      ? raw.status : 'done';
    var message = {
      id: typeof raw.id === 'string' && raw.id ? raw.id : utils.uid('m-'),
      role: role,
      content: typeof raw.content === 'string' ? raw.content : '',
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowISO(),
      status: status
    };
    if (typeof raw.error === 'string' && raw.error) message.error = raw.error;
    if (typeof raw.detail === 'string' && raw.detail) message.detail = raw.detail;
    if (Number.isFinite(raw.latencyMs)) message.latencyMs = raw.latencyMs;
    if (Number.isFinite(raw.statusCode)) message.statusCode = raw.statusCode;
    /* 读取旧数据时 pending 代表刷新导致的中断；运行中写入则保留 pending。 */
    if (status === 'pending' && !opts.keepPending) {
      message.status = 'error';
      message.error = '页面刷新导致本次请求中断，请重新发送。';
    }
    return message;
  }

  function normalizeSession(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var messages = Array.isArray(raw.messages)
      ? raw.messages.map(normalizeMessage).filter(Boolean).slice(-MAX_MESSAGES)
      : [];
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : utils.uid('s-'),
      title: typeof raw.title === 'string' && raw.title.trim()
        ? raw.title.trim().slice(0, 40) : '新对话',
      titleAuto: raw.titleAuto !== false,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowISO(),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : nowISO(),
      messages: messages
    };
  }

  function makeSession() {
    var stamp = nowISO();
    return {
      id: utils.uid('s-'),
      title: '新对话',
      titleAuto: true,
      createdAt: stamp,
      updatedAt: stamp,
      messages: []
    };
  }

  function Store() {
    var storedSettings = utils.safeGetJSON(keys.settings, null);
    this.settings = normalizeSettings(storedSettings);

    var storedSessions = utils.safeGetJSON(keys.sessions, []);
    var seen = Object.create(null);
    this.sessions = (Array.isArray(storedSessions) ? storedSessions : [])
      .map(normalizeSession)
      .filter(function (session) {
        if (!session || seen[session.id]) return false;
        seen[session.id] = true;
        return true;
      })
      .slice(0, Jotang.MAX_SESSIONS);

    var storedActive = utils.safeGetRaw(keys.activeSession);
    this.activeId = storedActive && this.getSession(storedActive) ? storedActive : null;

    if (!this.sessions.length) {
      this.sessions.push(makeSession());
      this.activeId = this.sessions[0].id;
      this.persist();
    } else if (!this.activeId) {
      this.activeId = this.sessions[0].id;
      this.persist();
    }
  }

  Store.prototype.persist = function () {
    var sessionsOk = utils.safeSetJSON(keys.sessions, this.sessions);
    var activeOk = this.activeId ? utils.safeSetRaw(keys.activeSession, this.activeId) : true;
    return sessionsOk && activeOk;
  };

  Store.prototype.saveSettings = function (patch) {
    this.settings = normalizeSettings(Object.assign({}, this.settings, patch || {}));
    utils.safeSetJSON(keys.settings, this.settings);
    return this.settings;
  };

  Store.prototype.getSession = function (id) {
    for (var i = 0; i < this.sessions.length; i += 1) {
      if (this.sessions[i].id === id) return this.sessions[i];
    }
    return null;
  };

  Store.prototype.getActiveSession = function () {
    var session = this.activeId ? this.getSession(this.activeId) : null;
    if (session) return session;
    if (this.sessions.length) {
      this.activeId = this.sessions[0].id;
      this.persist();
      return this.sessions[0];
    }
    return this.createSession({ force: true });
  };

  Store.prototype.createSession = function (options) {
    var opts = options || {};
    var active = this.activeId ? this.getSession(this.activeId) : null;
    if (!opts.force && active && active.messages.length === 0) return active;

    var session = makeSession();
    this.sessions.unshift(session);
    if (this.sessions.length > Jotang.MAX_SESSIONS) {
      this.sessions = this.sessions.slice(0, Jotang.MAX_SESSIONS);
    }
    this.activeId = session.id;
    this.persist();
    return session;
  };

  Store.prototype.setActiveSession = function (id) {
    if (!this.getSession(id)) return null;
    this.activeId = id;
    this.persist();
    return this.getSession(id);
  };

  Store.prototype.touchSession = function (session) {
    if (!session) return;
    session.updatedAt = nowISO();
  };

  Store.prototype.deleteSession = function (id) {
    var existed = !!this.getSession(id);
    if (!existed) return this.getActiveSession();
    this.sessions = this.sessions.filter(function (session) { return session.id !== id; });
    if (this.activeId === id) {
      this.activeId = this.sessions.length ? this.sessions[0].id : null;
    }
    if (!this.sessions.length) {
      return this.createSession({ force: true });
    }
    this.persist();
    return this.getActiveSession();
  };

  Store.prototype.clearAllSessions = function () {
    this.sessions = [];
    this.activeId = null;
    return this.createSession({ force: true });
  };

  Store.prototype.renameSession = function (id, title) {
    var session = this.getSession(id);
    if (!session) return;
    var clean = String(title == null ? '' : title).replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!clean) return;
    session.title = clean;
    session.titleAuto = false;
    this.persist();
  };

  Store.prototype.addMessage = function (sessionId, message) {
    var session = this.getSession(sessionId);
    if (!session) return null;
    var normalized = normalizeMessage(message, { keepPending: true });
    if (!normalized) return null;
    session.messages.push(normalized);
    if (session.messages.length > MAX_MESSAGES) {
      session.messages = session.messages.slice(-MAX_MESSAGES);
    }
    this.touchSession(session);
    if (normalized.role === 'user' && session.titleAuto) {
      session.title = utils.truncate(normalized.content, 22) || '新对话';
    }
    this.persist();
    return normalized;
  };

  Store.prototype.updateMessage = function (sessionId, messageId, patch) {
    var session = this.getSession(sessionId);
    if (!session) return null;
    for (var i = 0; i < session.messages.length; i += 1) {
      if (session.messages[i].id === messageId) {
        Object.assign(session.messages[i], patch || {});
        this.touchSession(session);
        this.persist();
        return session.messages[i];
      }
    }
    return null;
  };

  Store.prototype.removeMessagesAfter = function (sessionId, messageId) {
    var session = this.getSession(sessionId);
    if (!session) return;
    var index = -1;
    for (var i = 0; i < session.messages.length; i += 1) {
      if (session.messages[i].id === messageId) {
        index = i;
        break;
      }
    }
    if (index === -1) return;
    session.messages = session.messages.slice(0, index + 1);
    this.touchSession(session);
    this.persist();
  };

  Store.prototype.countMessages = function () {
    var session = this.getActiveSession();
    return session ? session.messages.length : 0;
  };

  Jotang.store = new Store();

})(window);
