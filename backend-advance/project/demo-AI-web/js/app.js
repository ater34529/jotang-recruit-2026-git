/* 应用入口：渲染、事件、对话流程与状态联动。 */
(function (window, document) {
  'use strict';

  var Jotang = window.Jotang;
  if (!Jotang || !Jotang.store) return;

  var store = Jotang.store;
  var utils = Jotang.utils;
  var markdown = Jotang.markdown;
  var api = Jotang.api;
  var workflowSteps = Jotang.WORKFLOW || [];
  var MAX_INPUT = Jotang.MAX_INPUT || 4000;

  function $(id) {
    return document.getElementById(id);
  }

  var el = {
    sidebar: $('sidebar'),
    sessionList: $('sessionList'),
    sessionCount: $('sessionCount'),
    newChatBtn: $('newChatBtn'),
    openMapBtn: $('openMapBtn'),
    openSettingsBtn: $('openSettingsBtn'),
    serviceCard: $('serviceCard'),
    sidebarStatusDot: $('sidebarStatusDot'),
    serviceLabel: $('serviceLabel'),
    serviceDetail: $('serviceDetail'),
    themeBtn: $('themeBtn'),
    closeSidebarBtn: $('closeSidebarBtn'),
    menuBtn: $('menuBtn'),
    sessionTitle: $('sessionTitle'),
    sessionMeta: $('sessionMeta'),
    statusChip: $('statusChip'),
    statusChipText: $('statusChipText'),
    modelLabel: $('modelLabel'),
    insightsBtn: $('insightsBtn'),
    chatScroll: $('chatScroll'),
    welcome: $('welcome'),
    connectionBanner: $('connectionBanner'),
    connectionBannerText: $('connectionBannerText'),
    retryHealthBtn: $('retryHealthBtn'),
    promptGrid: $('promptGrid'),
    messages: $('messages'),
    composer: $('composer'),
    input: $('input'),
    sendBtn: $('sendBtn'),
    charCount: $('charCount'),
    insights: $('insights'),
    tabPipeline: $('tabPipeline'),
    tabMap: $('tabMap'),
    panelPipeline: $('panelPipeline'),
    panelMap: $('panelMap'),
    closeInsightsBtn: $('closeInsightsBtn'),
    pipelineState: $('pipelineState'),
    workflowList: $('workflowList'),
    metricMessages: $('metricMessages'),
    metricLatency: $('metricLatency'),
    metricMode: $('metricMode'),
    copyInspectorBtn: $('copyInspectorBtn'),
    inspectorRequestTab: $('inspectorRequestTab'),
    inspectorResponseTab: $('inspectorResponseTab'),
    inspectorMeta: $('inspectorMeta'),
    inspectorPre: $('inspectorPre'),
    learningMap: $('learningMap'),
    settingsDialog: $('settingsDialog'),
    settingsForm: $('settingsForm'),
    settingApiBase: $('settingApiBase'),
    settingChatPath: $('settingChatPath'),
    settingTimeout: $('settingTimeout'),
    settingModel: $('settingModel'),
    clearAllBtn: $('clearAllBtn'),
    resetSettingsBtn: $('resetSettingsBtn'),
    confirmDialog: $('confirmDialog'),
    confirmTitle: $('confirmTitle'),
    confirmMessage: $('confirmMessage'),
    confirmOkBtn: $('confirmOkBtn'),
    confirmCancelBtn: $('confirmCancelBtn'),
    confirmCloseBtn: $('confirmCloseBtn'),
    toast: $('toast'),
    toastText: $('toastText'),
    toastIcon: $('toastIcon'),
    backdrop: $('backdrop')
  };

  var state = {
    busy: false,
    abortController: null,
    stopRequested: false,
    health: 'checking',
    healthChecking: false,
    inspectorTab: 'request',
    snapshot: {
      request: null,
      response: null,
      requestAt: null,
      responseAt: null,
      endpoint: ''
    },
    workflowTimers: [],
    workflowStep: -1,
    toastTimer: null,
    confirmAction: null
  };

  function icon(name, cls) {
    return utils.icon(name, cls || 'icon');
  }

  function activeSession() {
    return store.getActiveSession();
  }

  function escapeAttr(value) {
    return utils.escapeHtml(value);
  }

  /* ---------------- 静态区块 ---------------- */
  function renderPrompts() {
    el.promptGrid.innerHTML = (Jotang.PROMPTS || []).map(function (prompt, index) {
      return '<button class="prompt-card" type="button" data-prompt="' + index + '">' +
        '<span class="prompt-icon">' + icon(prompt.icon) + '</span>' +
        '<span class="prompt-copy">' +
          '<span class="prompt-title">' + utils.escapeHtml(prompt.title) + '</span>' +
          '<span class="prompt-desc">' + utils.escapeHtml(prompt.desc) + '</span>' +
        '</span>' +
        icon('arrow-right', 'icon prompt-arrow') +
      '</button>';
    }).join('');
  }

  function renderWorkflow() {
    el.workflowList.innerHTML = workflowSteps.map(function (step, index) {
      return '<li class="pipeline-step" data-step="' + index + '">' +
        '<span class="step-dot">' + (index + 1) + '</span>' +
        '<span class="step-copy">' +
          '<strong>' + utils.escapeHtml(step.title) + '</strong>' +
          '<small>' + utils.escapeHtml(step.desc) + '</small>' +
        '</span>' +
      '</li>';
    }).join('');
  }

  function renderLearningMap() {
    el.learningMap.innerHTML = (Jotang.LEARNING_MAP || []).map(function (card) {
      return '<article class="map-card' + (card.active ? ' is-active' : '') + '">' +
        '<div class="map-card-head">' +
          '<span class="map-repo">' + utils.escapeHtml(card.repo) + '</span>' +
          '<span class="map-badge">' + utils.escapeHtml(card.badge) + '</span>' +
        '</div>' +
        '<h3>' + utils.escapeHtml(card.title) + '</h3>' +
        '<p class="map-summary">' + utils.escapeHtml(card.summary) + '</p>' +
        '<ul class="map-points">' + card.points.map(function (point) {
          return '<li>' + utils.escapeHtml(point) + '</li>';
        }).join('') + '</ul>' +
        '<div class="map-endpoints">' + card.endpoints.map(function (endpoint) {
          return '<code>' + utils.escapeHtml(endpoint) + '</code>';
        }).join('') + '</div>' +
      '</article>';
    }).join('');
  }

  /* ---------------- 会话列表 ---------------- */
  function renderSessionList() {
    el.sessionCount.textContent = String(store.sessions.length);
    el.sessionList.innerHTML = store.sessions.map(function (session) {
      var active = session.id === store.activeId;
      var last = session.messages[session.messages.length - 1];
      var meta = session.messages.length
        ? session.messages.length + ' 条 · ' + utils.formatRelative(session.updatedAt)
        : '空白对话';
      if (last && last.status === 'pending') meta = '正在生成…';
      return '<div class="session-item' + (active ? ' is-active' : '') + '" data-session-id="' + escapeAttr(session.id) + '">' +
        '<button class="session-main" type="button" data-action="open" title="' + escapeAttr(session.title) + '"' +
          (active ? ' aria-current="true"' : '') + '>' +
          '<span class="session-icon">' + icon('chat') + '</span>' +
          '<span class="session-copy">' +
            '<strong>' + utils.escapeHtml(session.title) + '</strong>' +
            '<small>' + utils.escapeHtml(meta) + '</small>' +
          '</span>' +
        '</button>' +
        '<button class="session-del" type="button" data-action="delete" aria-label="删除会话" title="删除会话">' +
          icon('trash') +
        '</button>' +
      '</div>';
    }).join('');
    if (!store.sessions.length) {
      el.sessionList.innerHTML = '<p class="session-empty">' + icon('chat') + '还没有对话</p>';
    }
  }

  /* ---------------- 顶栏与指标 ---------------- */
  function updateHeader() {
    var session = activeSession();
    if (!session) return;
    el.sessionTitle.textContent = session.title;
    if (session.messages.length) {
      el.sessionMeta.textContent = session.messages.length + ' 条消息 · 更新于 ' +
        utils.formatRelative(session.updatedAt);
    } else {
      el.sessionMeta.textContent = '准备开始 · 会话保存在本机';
    }
    el.sessionTitle.title = session.title;
    document.title = session.messages.length ? session.title + ' · Jotang AI' : 'Jotang AI · 笔记智能助手';
  }

  function lastAssistant(session) {
    if (!session) return null;
    for (var i = session.messages.length - 1; i >= 0; i -= 1) {
      if (session.messages[i].role === 'assistant') return session.messages[i];
    }
    return null;
  }

  function updateMetrics() {
    var session = activeSession();
    var last = lastAssistant(session);
    el.metricMessages.textContent = String(session ? session.messages.length : 0);
    el.metricLatency.textContent = last && Number.isFinite(last.latencyMs)
      ? utils.formatDuration(last.latencyMs)
      : '—';
    el.metricMode.textContent = store.settings.apiBaseUrl ? '直连' : '代理';
  }

  /* ---------------- 消息渲染 ---------------- */
  function renderActions(message) {
    if (message.status === 'pending') return '';
    return '<div class="message-actions">' +
      '<button class="msg-action" type="button" data-action="copy" data-message-id="' +
        escapeAttr(message.id) + '">' + icon('copy') + '复制</button>' +
      '<button class="msg-action" type="button" data-action="retry" data-message-id="' +
        escapeAttr(message.id) + '">' + icon('refresh') + '重试</button>' +
    '</div>';
  }

  function renderMessage(message) {
    var isUser = message.role === 'user';
    var roleName = isUser ? '你' : 'Jotang';
    var statusClass = '';
    var bubble = '';

    if (isUser) {
      bubble = '<div class="bubble is-plain">' + utils.escapeHtml(message.content) + '</div>';
    } else if (message.status === 'pending') {
      statusClass = ' is-pending';
      bubble = '<div class="bubble">' +
        '<span class="typing" aria-label="正在生成"><span></span><span></span><span></span></span>' +
        '<p class="pending-hint">正在分析问题，必要时会调用 <code>get_note_by_id</code> 查询 MySQL…</p>' +
      '</div>';
    } else if (message.status === 'error') {
      statusClass = ' is-error';
      bubble = '<div class="bubble error-bubble">' +
        '<div class="error-head">' + icon('alert') + '<span>请求失败</span>' +
          (message.statusCode ? '<span class="error-type">HTTP ' + utils.escapeHtml(message.statusCode) + '</span>' : '') +
        '</div>' +
        '<p class="error-message">' + utils.escapeHtml(message.error || '未知错误，请稍后重试。') + '</p>' +
        (message.detail ? '<pre class="error-detail">' + utils.escapeHtml(message.detail) + '</pre>' : '') +
        '<div class="error-actions">' +
          '<button class="btn btn-ghost btn-sm" type="button" data-action="retry" data-message-id="' +
            escapeAttr(message.id) + '">' + icon('refresh') + '重新发送</button>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-action="copy-error" data-message-id="' +
            escapeAttr(message.id) + '">' + icon('copy') + '复制错误</button>' +
        '</div>' +
      '</div>';
    } else if (message.status === 'stopped') {
      statusClass = ' is-stopped';
      bubble = '<div class="bubble">' +
        '<p class="message-note">' + icon('stop') + '已停止本次回复。</p>' +
        '<div class="error-actions">' +
          '<button class="btn btn-ghost btn-sm" type="button" data-action="retry" data-message-id="' +
            escapeAttr(message.id) + '">' + icon('refresh') + '重新生成</button>' +
        '</div>' +
      '</div>';
    } else {
      var content = markdown.render(message.content);
      bubble = '<div class="bubble">' +
        (content || '<p class="pending-hint">（后端返回了空回复）</p>') +
      '</div>';
    }

    var meta = '';
    if (!isUser && message.status === 'done' && (message.statusCode || Number.isFinite(message.latencyMs))) {
      meta = '<div class="message-meta">' +
        (message.statusCode ? '<span class="meta-chip">HTTP ' + utils.escapeHtml(message.statusCode) + '</span>' : '') +
        (Number.isFinite(message.latencyMs)
          ? '<span class="meta-chip is-ok">' + icon('clock') + utils.formatDuration(message.latencyMs) + '</span>'
          : '') +
      '</div>';
    }

    return '<article class="message message-' + (isUser ? 'user' : 'assistant') + statusClass +
        '" data-message-id="' + escapeAttr(message.id) + '">' +
      '<span class="message-avatar">' + icon(isUser ? 'pencil' : 'spark') + '</span>' +
      '<div class="message-body">' +
        '<div class="message-head">' +
          '<strong>' + roleName + '</strong>' +
          '<span class="message-time">' + utils.escapeHtml(utils.formatTime(message.createdAt)) + '</span>' +
          (message.status === 'pending' ? '<span class="stream-state">正在生成</span>' : '') +
        '</div>' +
        bubble + meta + renderActions(message) +
      '</div>' +
    '</article>';
  }

  function renderChat(options) {
    var opts = options || {};
    var session = activeSession();
    if (!session) return;
    el.messages.innerHTML = session.messages.map(renderMessage).join('');
    el.welcome.hidden = session.messages.length > 0;
    updateHeader();
    updateMetrics();
    if (opts.scroll) scrollToBottom();
  }

  function scrollToBottom() {
    window.requestAnimationFrame(function () {
      el.chatScroll.scrollTop = el.chatScroll.scrollHeight;
    });
  }

  /* ---------------- 轻提示 ---------------- */
  function showToast(message, type, duration) {
    var kind = type || 'success';
    window.clearTimeout(state.toastTimer);
    el.toast.className = 'toast is-visible' + (kind === 'error' ? ' is-error' : kind === 'info' ? ' is-info' : '');
    el.toastIcon.innerHTML = icon(kind === 'error' ? 'alert' : kind === 'info' ? 'spark' : 'check');
    el.toastText.textContent = message;
    state.toastTimer = window.setTimeout(function () {
      el.toast.classList.remove('is-visible');
    }, duration || 2600);
  }

  /* ---------------- 工作流 ---------------- */
  function clearWorkflowTimers() {
    state.workflowTimers.forEach(function (timer) { window.clearTimeout(timer); });
    state.workflowTimers = [];
  }

  function setWorkflow(states, status, label) {
    var nodes = el.workflowList.children;
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      node.classList.remove('is-active', 'is-done', 'is-error');
      var next = states[i] || 'idle';
      if (next !== 'idle') node.classList.add('is-' + next);
    }
    el.pipelineState.dataset.state = status;
    el.pipelineState.textContent = label;
  }

  function resetWorkflow() {
    clearWorkflowTimers();
    state.workflowStep = -1;
    setWorkflow([], 'idle', '待命');
  }

  function startWorkflow() {
    clearWorkflowTimers();
    state.workflowStep = 0;
    var states = workflowSteps.map(function (_, index) { return index === 0 ? 'active' : 'idle'; });
    setWorkflow(states, 'running', '运行中');
    var delays = [320, 760, 1240, 1780];
    delays.forEach(function (delay, index) {
      state.workflowTimers.push(window.setTimeout(function () {
        state.workflowStep = index + 1;
        var next = workflowSteps.map(function (_, i) {
          if (i < index + 1) return 'done';
          return i === index + 1 ? 'active' : 'idle';
        });
        setWorkflow(next, 'running', '运行中');
      }, delay));
    });
  }

  function finishWorkflow(ok, stopped) {
    clearWorkflowTimers();
    if (ok) {
      setWorkflow(workflowSteps.map(function () { return 'done'; }), 'done', '完成');
      return;
    }
    if (stopped) {
      var idle = workflowSteps.map(function () { return 'idle'; });
      setWorkflow(idle, 'idle', '已停止');
      return;
    }
    var current = Math.max(0, state.workflowStep);
    var states = workflowSteps.map(function (_, index) {
      if (index < current) return 'done';
      return index === current ? 'error' : 'idle';
    });
    setWorkflow(states, 'error', '失败');
  }

  /* ---------------- 接口快照 ---------------- */
  function endpointLabel() {
    return api.endpoint(store.settings);
  }

  function renderInspector() {
    var isRequest = state.inspectorTab === 'request';
    var payload;
    var meta;
    if (isRequest) {
      payload = state.snapshot.request || Jotang.EXAMPLES.request;
      meta = state.snapshot.request
        ? 'POST ' + state.snapshot.endpoint + ' · ' + utils.formatTime(state.snapshot.requestAt)
        : '等待第一次请求';
    } else if (!state.snapshot.response) {
      payload = Jotang.EXAMPLES.response;
      meta = '尚未收到响应';
    } else {
      var snapshot = state.snapshot.response;
      payload = snapshot.body || {
        error: snapshot.error,
        detail: snapshot.detail
      };
      meta = (snapshot.statusCode ? 'HTTP ' + snapshot.statusCode + ' · ' : '') +
        (Number.isFinite(snapshot.latencyMs) ? utils.formatDuration(snapshot.latencyMs) + ' · ' : '') +
        utils.formatTime(state.snapshot.responseAt);
    }
    el.inspectorMeta.textContent = meta;
    el.inspectorPre.textContent = utils.prettyJSON(payload);
    syncInspectorTabs();
  }

  function syncInspectorTabs() {
    var isRequest = state.inspectorTab === 'request';
    el.inspectorRequestTab.classList.toggle('is-active', isRequest);
    el.inspectorResponseTab.classList.toggle('is-active', !isRequest);
    el.inspectorRequestTab.setAttribute('aria-selected', String(isRequest));
    el.inspectorResponseTab.setAttribute('aria-selected', String(!isRequest));
  }

  function switchInspector(tab) {
    state.inspectorTab = tab === 'response' ? 'response' : 'request';
    renderInspector();
  }

  function recordRequest(sessionId, message) {
    state.snapshot = {
      request: { sessionId: sessionId, message: message },
      response: null,
      requestAt: new Date().toISOString(),
      responseAt: null,
      endpoint: endpointLabel()
    };
    state.inspectorTab = 'request';
    renderInspector();
  }

  function recordResponse(data, statusCode, latencyMs) {
    state.snapshot.response = {
      statusCode: statusCode,
      latencyMs: latencyMs,
      body: data
    };
    state.snapshot.responseAt = new Date().toISOString();
    state.inspectorTab = 'response';
    renderInspector();
  }

  function recordError(error, latencyMs) {
    state.snapshot.response = {
      statusCode: error.statusCode,
      latencyMs: latencyMs,
      error: error.message,
      detail: error.detail,
      type: error.type
    };
    state.snapshot.responseAt = new Date().toISOString();
    state.inspectorTab = 'response';
    renderInspector();
  }

  /* ---------------- 连接状态 ---------------- */
  function setHealth(kind, label, detail) {
    state.health = kind;
    var chipDot = el.statusChip.querySelector('.status-dot');
    if (chipDot) chipDot.dataset.state = kind;
    el.sidebarStatusDot.dataset.state = kind;
    el.statusChip.dataset.state = kind;
    el.statusChipText.textContent = label;
    el.serviceLabel.textContent = kind === 'online'
      ? (store.settings.apiBaseUrl ? '直连模式' : 'demo-AI 在线')
      : kind === 'offline' ? '未连接后端' : '正在检测服务';
    el.serviceDetail.textContent = detail || (store.settings.apiBaseUrl
      ? store.settings.apiBaseUrl + store.settings.chatPath
      : 'localhost:8080 · POST /chat');
  }

  function showConnectionBanner(show, text) {
    el.connectionBanner.hidden = !show;
    if (text) el.connectionBannerText.textContent = text;
  }

  function checkHealth(manual) {
    if (state.healthChecking) return;
    state.healthChecking = true;
    el.serviceCard.classList.add('is-checking');
    setHealth('checking', '检测中', '正在检查 /__health…');

    api.health().then(function (result) {
      if (result.mode === 'direct') {
        setHealth('online', '直连', result.backend + store.settings.chatPath);
        showConnectionBanner(false);
        if (manual) showToast('直连模式已启用，实际连通性以对话请求为准。', 'info');
        return;
      }
      if (result.reachable) {
        setHealth('online', '在线', 'localhost:8080 · POST /chat');
        showConnectionBanner(false);
        if (manual) showToast('demo-AI 在线，可以开始对话。');
      } else {
        setHealth('offline', '未连接', '点击卡片重新检测');
        showConnectionBanner(true, 'Python 代理已启动，但 localhost:8080 的 demo-AI 没有响应。请先启动后端。');
        if (manual) showToast('代理正常，但 demo-AI 后端未响应。', 'error');
      }
    }).catch(function () {
      setHealth('offline', '未连接', '点击卡片重新检测');
      showConnectionBanner(true, store.settings.apiBaseUrl
        ? '无法确认直连地址是否可用；发送消息时会再次尝试连接。'
        : '未检测到本地代理。请在 demo-AI-web 目录运行 python server.py。');
      if (manual) showToast('未检测到本地代理服务。', 'error');
    }).finally(function () {
      state.healthChecking = false;
      el.serviceCard.classList.remove('is-checking');
    });
  }

  /* ---------------- 输入区 ---------------- */
  function updateCharCount() {
    var length = el.input.value.length;
    el.charCount.textContent = length + ' / ' + MAX_INPUT;
    el.charCount.classList.toggle('is-limit', length >= MAX_INPUT * 0.9);
    el.input.style.height = 'auto';
    el.input.style.height = Math.min(Math.max(el.input.scrollHeight, 24), 168) + 'px';
  }

  function setBusy(busy) {
    state.busy = busy;
    el.sendBtn.classList.toggle('is-stop', busy);
    var label = busy ? '停止生成' : '发送消息';
    el.sendBtn.setAttribute('aria-label', label);
    el.sendBtn.title = label;
    el.messages.setAttribute('aria-busy', String(busy));
  }

  function focusInput() {
    if (window.matchMedia('(max-width: 900px)').matches) return;
    window.setTimeout(function () {
      try { el.input.focus({ preventScroll: true }); } catch (e) { el.input.focus(); }
    }, 60);
  }

  /* ---------------- 对话发送 ---------------- */
  function findMessage(session, id) {
    if (!session) return null;
    for (var i = 0; i < session.messages.length; i += 1) {
      if (session.messages[i].id === id) return { message: session.messages[i], index: i };
    }
    return null;
  }

  function renderAfterRequest(sessionId, shouldScroll) {
    renderSessionList();
    if (store.activeId === sessionId) {
      renderChat({ scroll: shouldScroll });
    }
  }

  function stopGeneration() {
    if (!state.busy || !state.abortController) return;
    state.stopRequested = true;
    state.abortController.abort();
    showToast('正在停止生成…', 'info', 1000);
  }

  function sendMessage(raw, options) {
    var opts = options || {};
    var text = String(raw == null ? '' : raw).replace(/\r\n/g, '\n').trim();

    if (!text) {
      showToast('请先输入一个问题。', 'info');
      return false;
    }
    if (text.length > MAX_INPUT) {
      showToast('消息不能超过 ' + MAX_INPUT + ' 个字符。', 'error');
      return false;
    }
    if (state.busy) {
      showToast('正在生成回复，请稍候或先停止。', 'info');
      return false;
    }

    var session = activeSession();
    if (!session) return false;

    var existing = opts.existingUserId ? findMessage(session, opts.existingUserId) : null;
    if (opts.existingUserId && !existing) {
      showToast('找不到原始提问，无法重试。', 'error');
      return false;
    }

    if (!existing) {
      var userMessage = store.addMessage(session.id, {
        role: 'user',
        content: text,
        status: 'done'
      });
      if (!userMessage) {
        showToast('消息保存失败，请检查浏览器存储空间。', 'error');
        return false;
      }
    }

    var pending = store.addMessage(session.id, {
      role: 'assistant',
      content: '',
      status: 'pending'
    });
    if (!pending) {
      showToast('消息保存失败，请检查浏览器存储空间。', 'error');
      return false;
    }

    if (!opts.existingUserId) {
      el.input.value = '';
      updateCharCount();
    }

    recordRequest(session.id, text);
    startWorkflow();
    setBusy(true);
    renderSessionList();
    renderChat({ scroll: true });
    closeDrawers();

    var controller = new AbortController();
    state.abortController = controller;
    state.stopRequested = false;
    var startedAt = window.performance && performance.now ? performance.now() : Date.now();

    api.chat({
      sessionId: session.id,
      message: text,
      signal: controller.signal
    }).then(function (result) {
      var latency = Math.round((window.performance && performance.now ? performance.now() : Date.now()) - startedAt);
      var reply = result.data.reply;
      store.updateMessage(session.id, pending.id, {
        content: reply,
        status: 'done',
        latencyMs: latency,
        statusCode: result.statusCode
      });
      recordResponse(result.data, result.statusCode, latency);
      finishWorkflow(true);
      renderAfterRequest(session.id, true);
      if (store.activeId !== session.id) {
        showToast('另一个对话收到新回复。', 'success');
      }
    }).catch(function (error) {
      var latency = Math.round((window.performance && performance.now ? performance.now() : Date.now()) - startedAt);
      var aborted = error && error.type === 'aborted';
      if (aborted) {
        store.updateMessage(session.id, pending.id, {
          content: '',
          status: 'stopped',
          latencyMs: latency
        });
      } else {
        store.updateMessage(session.id, pending.id, {
          content: '',
          status: 'error',
          error: (error && error.message) || '请求失败，请稍后重试。',
          detail: (error && error.detail) || '',
          statusCode: error && error.statusCode
        });
      }
      recordError(error || { message: '请求失败' }, latency);
      finishWorkflow(false, aborted);
      renderAfterRequest(session.id, true);
      if (!aborted) {
        showToast(utils.truncate((error && error.message) || '请求失败，请稍后重试。', 90), 'error', 4200);
      }
    }).finally(function () {
      state.abortController = null;
      state.stopRequested = false;
      setBusy(false);
      renderSessionList();
      if (store.activeId === session.id) updateMetrics();
      focusInput();
    });

    return true;
  }

  function retryMessage(messageId) {
    if (state.busy) {
      showToast('正在生成回复，请稍候或先停止。', 'info');
      return;
    }
    var session = activeSession();
    var found = findMessage(session, messageId);
    if (!found) {
      showToast('找不到这条消息。', 'error');
      return;
    }
    var target = found.message;
    if (target.role !== 'user') {
      var previousUser = null;
      for (var i = found.index - 1; i >= 0; i -= 1) {
        if (session.messages[i].role === 'user') {
          previousUser = session.messages[i];
          break;
        }
      }
      if (!previousUser) {
        showToast('这条回复没有对应的提问。', 'error');
        return;
      }
      target = previousUser;
    }
    store.removeMessagesAfter(session.id, target.id);
    renderSessionList();
    renderChat({ scroll: true });
    sendMessage(target.content, { existingUserId: target.id });
  }

  function copyMessage(messageId, errorOnly) {
    var session = activeSession();
    var found = findMessage(session, messageId);
    if (!found) return;
    var message = found.message;
    var text = message.content;
    if (errorOnly || message.status === 'error') {
      text = (message.error || '') + (message.detail ? '\n\n' + message.detail : '');
    }
    utils.copyText(text || message.content || '').then(function (ok) {
      showToast(ok ? '已复制到剪贴板。' : '复制失败，请手动选择文本。', ok ? 'success' : 'error');
    });
  }

  /* ---------------- 抽屉与主题 ---------------- */
  function updateBackdrop() {
    var sidebarOpen = el.sidebar.classList.contains('is-open') &&
      window.matchMedia('(max-width: 900px)').matches;
    var insightsOpen = el.insights.classList.contains('is-open') &&
      window.matchMedia('(max-width: 1180px)').matches;
    el.backdrop.hidden = !(sidebarOpen || insightsOpen);
    el.insightsBtn.setAttribute('aria-expanded', String(el.insights.classList.contains('is-open')));
    el.menuBtn.setAttribute('aria-expanded', String(el.sidebar.classList.contains('is-open')));
  }

  function openSidebar() {
    el.sidebar.classList.add('is-open');
    updateBackdrop();
  }

  function closeSidebar() {
    el.sidebar.classList.remove('is-open');
    updateBackdrop();
  }

  function openInsights() {
    el.insights.classList.add('is-open');
    updateBackdrop();
  }

  function closeInsights() {
    el.insights.classList.remove('is-open');
    updateBackdrop();
  }

  function closeDrawers() {
    el.sidebar.classList.remove('is-open');
    el.insights.classList.remove('is-open');
    updateBackdrop();
  }

  function applyTheme(theme) {
    var next = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'light' ? '#f5f6fa' : '#080c14');
    var label = el.themeBtn.querySelector('.theme-toggle-label');
    if (label) label.textContent = next === 'light' ? '浅色模式' : '深色模式';
    el.themeBtn.setAttribute('aria-pressed', String(next === 'light'));
  }

  function toggleTheme() {
    var next = store.settings.theme === 'light' ? 'dark' : 'light';
    store.saveSettings({ theme: next });
    applyTheme(next);
    showToast(next === 'light' ? '已切换为浅色模式。' : '已切换为深色模式。', 'info', 1600);
  }

  /* ---------------- 右侧标签 ---------------- */
  function switchTab(name) {
    var isMap = name === 'map';
    el.tabPipeline.classList.toggle('is-active', !isMap);
    el.tabMap.classList.toggle('is-active', isMap);
    el.tabPipeline.setAttribute('aria-selected', String(!isMap));
    el.tabMap.setAttribute('aria-selected', String(isMap));
    el.panelPipeline.hidden = isMap;
    el.panelMap.hidden = !isMap;
  }

  /* ---------------- 弹窗 ---------------- */
  function openDialog(dialog) {
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', 'open');
  }

  function closeDialog(dialog) {
    if (!dialog || !dialog.open) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  function promptConfirm(config) {
    state.confirmAction = config.onConfirm || null;
    el.confirmTitle.textContent = config.title || '确认操作';
    el.confirmMessage.textContent = config.message || '';
    el.confirmOkBtn.textContent = config.okText || '确认';
    el.confirmOkBtn.className = 'btn ' + (config.danger === false ? 'btn-primary' : 'btn-danger');
    openDialog(el.confirmDialog);
  }

  function closeConfirm() {
    state.confirmAction = null;
    closeDialog(el.confirmDialog);
  }

  function syncSettingsForm() {
    var settings = store.settings;
    el.settingApiBase.value = settings.apiBaseUrl;
    el.settingChatPath.value = settings.chatPath;
    el.settingTimeout.value = String(Math.round(settings.timeoutMs / 1000));
    el.settingModel.value = settings.modelLabel;
    el.settingApiBase.removeAttribute('aria-invalid');
    var radio = el.settingsForm.querySelector('input[name="theme"][value="' + settings.theme + '"]');
    if (radio) radio.checked = true;
  }

  function openSettings() {
    syncSettingsForm();
    openDialog(el.settingsDialog);
    window.setTimeout(function () {
      try { el.settingApiBase.focus({ preventScroll: true }); } catch (e) { el.settingApiBase.focus(); }
    }, 60);
  }

  function clearSnapshot() {
    state.snapshot = {
      request: null,
      response: null,
      requestAt: null,
      responseAt: null,
      endpoint: ''
    };
    state.inspectorTab = 'request';
    renderInspector();
  }

  function saveSettings(event) {
    event.preventDefault();
    var base = el.settingApiBase.value.trim();
    if (base) {
      var parsed = null;
      try { parsed = new URL(base); } catch (e) { parsed = null; }
      if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
        el.settingApiBase.setAttribute('aria-invalid', 'true');
        showToast('API 地址需要以 http:// 或 https:// 开头。', 'error');
        el.settingApiBase.focus();
        return;
      }
    }

    var path = el.settingChatPath.value.trim() || Jotang.DEFAULT_SETTINGS.chatPath;
    if (path.charAt(0) !== '/') path = '/' + path;

    var seconds = Number(el.settingTimeout.value);
    if (!Number.isFinite(seconds) || seconds < 60 || seconds > 600) {
      showToast('超时时间需要在 60 到 600 秒之间。', 'error');
      el.settingTimeout.focus();
      return;
    }

    var themeInput = el.settingsForm.querySelector('input[name="theme"]:checked');
    var saved = store.saveSettings({
      apiBaseUrl: base,
      chatPath: path,
      timeoutMs: Math.round(seconds * 1000),
      modelLabel: el.settingModel.value.trim(),
      theme: themeInput ? themeInput.value : store.settings.theme
    });

    applyTheme(saved.theme);
    el.modelLabel.textContent = saved.modelLabel;
    el.settingApiBase.removeAttribute('aria-invalid');
    closeDialog(el.settingsDialog);
    updateMetrics();
    checkHealth(false);
    showToast('设置已保存。');
    focusInput();
  }

  function resetSettingsForm() {
    var defaults = Jotang.DEFAULT_SETTINGS;
    el.settingApiBase.value = defaults.apiBaseUrl;
    el.settingChatPath.value = defaults.chatPath;
    el.settingTimeout.value = String(Math.round(defaults.timeoutMs / 1000));
    el.settingModel.value = defaults.modelLabel;
    el.settingApiBase.removeAttribute('aria-invalid');
    var radio = el.settingsForm.querySelector('input[name="theme"][value="' + defaults.theme + '"]');
    if (radio) radio.checked = true;
    showToast('已填入默认设置，点击保存后生效。', 'info');
  }

  function askClearAll() {
    var count = store.sessions.length;
    promptConfirm({
      title: '清空全部对话？',
      message: '将删除本机保存的 ' + count + ' 个对话及其全部消息，操作不可撤销。',
      okText: '全部删除',
      onConfirm: function () {
        if (state.busy) {
          showToast('正在生成回复，请先停止后再清空。', 'info');
          return;
        }
        store.clearAllSessions();
        resetWorkflow();
        clearSnapshot();
        closeDialog(el.settingsDialog);
        renderSessionList();
        renderChat({ scroll: false });
        closeDrawers();
        showToast('已清空全部本地对话。');
      }
    });
  }

  function askDeleteSession(id) {
    if (state.busy) {
      showToast('正在生成回复，请先停止后再删除。', 'info');
      return;
    }
    var session = store.getSession(id);
    if (!session) return;
    promptConfirm({
      title: '删除这个对话？',
      message: '「' + session.title + '」及其 ' + session.messages.length + ' 条消息将从本机删除，操作不可撤销。',
      okText: '删除对话',
      onConfirm: function () {
        var wasActive = store.activeId === id;
        store.deleteSession(id);
        renderSessionList();
        if (wasActive) {
          resetWorkflow();
          renderChat({ scroll: true });
          updateMetrics();
        }
        showToast('对话已删除。');
      }
    });
  }

  /* ---------------- 会话切换 ---------------- */
  function newChat() {
    if (state.busy) {
      showToast('正在生成回复，请稍候或先停止。', 'info');
      return;
    }
    var before = store.activeId;
    var current = activeSession();
    var alreadyEmpty = current && current.messages.length === 0;
    var session = store.createSession();
    renderSessionList();
    renderChat({ scroll: false });
    el.chatScroll.scrollTop = 0;
    if (session.id === before && alreadyEmpty) {
      showToast('当前已经是空白对话。', 'info', 1800);
    } else {
      resetWorkflow();
      clearSnapshot();
    }
    closeDrawers();
    focusInput();
  }

  function openSession(id) {
    if (!store.getSession(id)) return;
    if (store.activeId !== id) {
      store.setActiveSession(id);
      renderSessionList();
      renderChat({ scroll: true });
      updateMetrics();
      if (!state.busy) resetWorkflow();
    }
    closeDrawers();
    focusInput();
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    el.newChatBtn.addEventListener('click', newChat);
    el.themeBtn.addEventListener('click', toggleTheme);
    el.menuBtn.addEventListener('click', openSidebar);
    el.closeSidebarBtn.addEventListener('click', closeSidebar);
    el.backdrop.addEventListener('click', closeDrawers);

    el.insightsBtn.addEventListener('click', function () {
      if (!window.matchMedia('(max-width: 1180px)').matches) {
        showToast('运行轨迹已在右侧常驻显示。', 'info', 1600);
        return;
      }
      if (el.insights.classList.contains('is-open')) closeInsights();
      else openInsights();
    });
    el.closeInsightsBtn.addEventListener('click', closeInsights);

    el.openMapBtn.addEventListener('click', function () {
      switchTab('map');
      closeSidebar();
      openInsights();
    });
    el.openSettingsBtn.addEventListener('click', openSettings);
    el.serviceCard.addEventListener('click', function () { checkHealth(true); });
    el.statusChip.addEventListener('click', function () { checkHealth(true); });
    el.retryHealthBtn.addEventListener('click', function () { checkHealth(true); });

    el.tabPipeline.addEventListener('click', function () { switchTab('pipeline'); });
    el.tabMap.addEventListener('click', function () { switchTab('map'); });
    el.inspectorRequestTab.addEventListener('click', function () { switchInspector('request'); });
    el.inspectorResponseTab.addEventListener('click', function () { switchInspector('response'); });
    el.copyInspectorBtn.addEventListener('click', function () {
      utils.copyText(el.inspectorPre.textContent).then(function (ok) {
        showToast(ok ? '接口快照已复制。' : '复制失败，请手动选择文本。', ok ? 'success' : 'error');
      });
    });

    el.sessionList.addEventListener('click', function (event) {
      var item = event.target.closest('[data-session-id]');
      if (!item) return;
      var action = event.target.closest('[data-action]');
      var id = item.getAttribute('data-session-id');
      if (action && action.getAttribute('data-action') === 'delete') {
        askDeleteSession(id);
        return;
      }
      openSession(id);
    });

    el.promptGrid.addEventListener('click', function (event) {
      var card = event.target.closest('[data-prompt]');
      if (!card) return;
      var index = Number(card.getAttribute('data-prompt'));
      var prompt = Jotang.PROMPTS[index];
      if (!prompt) return;
      if (state.busy) {
        showToast('正在生成回复，请稍候或先停止。', 'info');
        return;
      }
      sendMessage(prompt.text);
    });

    el.messages.addEventListener('click', function (event) {
      var action = event.target.closest('[data-action]');
      if (!action) return;
      var messageId = action.getAttribute('data-message-id');
      var name = action.getAttribute('data-action');
      if (name === 'copy') copyMessage(messageId, false);
      else if (name === 'copy-error') copyMessage(messageId, true);
      else if (name === 'retry') retryMessage(messageId);
    });

    el.composer.addEventListener('submit', function (event) {
      event.preventDefault();
      if (state.busy) {
        stopGeneration();
        return;
      }
      sendMessage(el.input.value);
    });

    el.input.addEventListener('input', updateCharCount);
    el.input.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      if (state.busy) {
        showToast('正在生成回复，请稍候或点击停止。', 'info', 1600);
        return;
      }
      sendMessage(el.input.value);
    });

    el.settingsForm.addEventListener('submit', saveSettings);
    el.resetSettingsBtn.addEventListener('click', resetSettingsForm);
    el.clearAllBtn.addEventListener('click', askClearAll);
    el.settingApiBase.addEventListener('input', function () {
      el.settingApiBase.removeAttribute('aria-invalid');
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-close-dialog]'), function (button) {
      button.addEventListener('click', function () {
        var dialog = button.closest('dialog');
        if (dialog) closeDialog(dialog);
      });
    });

    el.confirmCancelBtn.addEventListener('click', closeConfirm);
    el.confirmCloseBtn.addEventListener('click', closeConfirm);
    el.confirmOkBtn.addEventListener('click', function () {
      var action = state.confirmAction;
      state.confirmAction = null;
      closeDialog(el.confirmDialog);
      if (typeof action === 'function') action();
    });

    [el.settingsDialog, el.confirmDialog].forEach(function (dialog) {
      dialog.addEventListener('click', function (event) {
        if (event.target !== dialog) return;
        if (dialog === el.confirmDialog) closeConfirm();
        else closeDialog(dialog);
      });
    });

    el.confirmDialog.addEventListener('close', function () {
      state.confirmAction = null;
    });

    document.addEventListener('keydown', function (event) {
      if (event.altKey && !event.ctrlKey && !event.metaKey && (event.key === 'n' || event.key === 'N')) {
        event.preventDefault();
        newChat();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'k') {
        event.preventDefault();
        el.input.focus();
        return;
      }
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
        closeDrawers();
      }
    });

    window.addEventListener('resize', utils.debounce(function () {
      if (!window.matchMedia('(max-width: 900px)').matches) el.sidebar.classList.remove('is-open');
      if (!window.matchMedia('(max-width: 1180px)').matches) el.insights.classList.remove('is-open');
      updateBackdrop();
    }, 120));
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    applyTheme(store.settings.theme);
    el.modelLabel.textContent = store.settings.modelLabel;

    renderPrompts();
    renderWorkflow();
    renderLearningMap();
    resetWorkflow();
    renderSessionList();
    renderChat({ scroll: true });
    renderInspector();
    updateMetrics();
    updateCharCount();
    bindEvents();

    checkHealth(false);
    focusInput();
  }

  init();









})(window, document);
