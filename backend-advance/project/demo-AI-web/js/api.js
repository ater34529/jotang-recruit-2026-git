/* 后端接口封装：POST /chat 与本地代理健康检查。 */
(function (window) {
  'use strict';

  var Jotang = window.Jotang = window.Jotang || {};

  function ApiError(message, options) {
    Error.call(this, message);
    this.name = 'ApiError';
    this.message = message;
    this.type = (options && options.type) || 'api';
    this.statusCode = options && options.statusCode;
    this.detail = options && options.detail ? String(options.detail) : '';
    if (Error.captureStackTrace) Error.captureStackTrace(this, ApiError);
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  function endpoint(settings) {
    var base = (settings.apiBaseUrl || '').replace(/\/+$/, '');
    var path = settings.chatPath || '/chat';
    if (path.charAt(0) !== '/') path = '/' + path;
    return base + path;
  }

  function extractDetail(data, raw) {
    if (data && typeof data === 'object') {
      var candidate = data.message || data.error || data.detail;
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    }
    return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  }

  function humanizeHttpError(status, data, raw) {
    var detail = extractDetail(data, raw);
    if (status === 401 || status === 403) {
      return '大模型鉴权失败（HTTP ' + status + '）。请检查 demo-AI 启动时是否设置了 MIMO_API_KEY。';
    }
    if (status === 404) {
      return '接口不存在（HTTP 404）。请检查设置中的接口路径，或确认 demo-AI 使用 POST /chat。';
    }
    if (status === 400 || status === 422) {
      return '请求参数不被接受（HTTP ' + status + '）。' + (detail ? '后端返回：' + detail : '');
    }
    if (status === 429) {
      return '请求太频繁或模型额度受限（HTTP 429），请稍后再试。';
    }
    if (status >= 500) {
      return '后端处理失败（HTTP ' + status + '）。' + (detail ? '详情：' + detail : '请查看 demo-AI 控制台日志。');
    }
    return '请求失败（HTTP ' + status + '）。' + (detail ? '详情：' + detail : '');
  }

  async function chat(payload) {
    var settings = Jotang.store.settings;
    var url = endpoint(settings);
    var timeoutMs = Jotang.utils.clamp(Number(settings.timeoutMs) || 180000, 60000, 600000);
    var controller = new AbortController();
    var externalSignal = payload.signal;
    var timedOut = false;
    var timer = window.setTimeout(function () {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    function forwardAbort() {
      controller.abort();
    }
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', forwardAbort, { once: true });
    }

    try {
      var response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sessionId: payload.sessionId,
          message: payload.message
        }),
        signal: controller.signal,
        cache: 'no-store',
        mode: settings.apiBaseUrl ? 'cors' : 'same-origin'
      });

      var raw = await response.text();
      var data = null;
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch (e) {
          data = null;
        }
      }

      if (!response.ok) {
        throw new ApiError(humanizeHttpError(response.status, data, raw), {
          type: 'http',
          statusCode: response.status,
          detail: extractDetail(data, raw)
        });
      }

      if (!data || typeof data !== 'object' || typeof data.reply !== 'string') {
        throw new ApiError('后端返回格式不正确：期望 JSON { sessionId, reply }。', {
          type: 'format',
          statusCode: response.status,
          detail: String(raw || '').slice(0, 800)
        });
      }

      return { data: data, raw: raw, statusCode: response.status };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error && error.name === 'AbortError') {
        if (timedOut) {
          throw new ApiError('请求超时（' + Math.round(timeoutMs / 1000) + ' 秒）。模型或数据库响应较慢，请稍后重试。', {
            type: 'timeout'
          });
        }
        throw new ApiError('已停止本次回复。', { type: 'aborted' });
      }
      throw new ApiError(
        settings.apiBaseUrl
          ? '无法连接 ' + settings.apiBaseUrl + '。请确认 demo-AI 已启动，并允许浏览器跨域访问。'
          : '无法连接对话服务。请确认 python server.py 与 demo-AI（localhost:8080）都已启动。',
        {
          type: 'network',
          detail: error && error.message ? error.message : String(error)
        }
      );
    } finally {
      window.clearTimeout(timer);
      if (externalSignal) externalSignal.removeEventListener('abort', forwardAbort);
    }
  }

  async function health() {
    var settings = Jotang.store.settings;
    if (settings.apiBaseUrl) {
      return { mode: 'direct', reachable: null, backend: settings.apiBaseUrl };
    }

    var controller = new AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, 5000);
    try {
      var response = await fetch('/__health', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var data = await response.json();
      return {
        mode: 'proxy',
        reachable: data && data.reachable === true,
        backend: (data && data.backend) || 'http://localhost:8080'
      };
    } finally {
      window.clearTimeout(timer);
    }
  }

  Jotang.api = {
    ApiError: ApiError,
    chat: chat,
    health: health,
    endpoint: endpoint
  };
})(window);
