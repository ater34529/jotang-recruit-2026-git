/* 全局配置：主题、接口、提示词、学习地图。 */
(function (window) {
  'use strict';

  var Jotang = window.Jotang = window.Jotang || {};

  Jotang.STORAGE_KEYS = {
    settings: 'jotang-ai:settings:v1',
    sessions: 'jotang-ai:sessions:v1',
    activeSession: 'jotang-ai:active-session:v1'
  };

  Jotang.DEFAULT_SETTINGS = {
    /* 空字符串表示使用同源代理（server.py 会把 /chat 转发给 demo-AI） */
    apiBaseUrl: '',
    chatPath: '/chat',
    modelLabel: 'mimo-v2.6-flash',
    timeoutMs: 180000,
    theme: 'dark'
  };

  Jotang.MAX_INPUT = 4000;
  Jotang.MAX_SESSIONS = 40;

  Jotang.PROMPTS = [
    {
      icon: 'file',
      title: '读取一篇笔记',
      text: '帮我看看 2 号笔记写了什么',
      desc: '单次工具调用'
    },
    {
      icon: 'clock',
      title: '取结构化字段',
      text: '2 号笔记的标题和创建时间是什么？',
      desc: '标题 · 时间 · 用户 ID'
    },
    {
      icon: 'code',
      title: '让模型做总结',
      text: '用三句话总结 2 号笔记的内容',
      desc: '基于笔记全文作答'
    },
    {
      icon: 'database',
      title: '连续查询',
      text: '对比 1 号和 2 号笔记的内容',
      desc: '多轮 Tool Use'
    }
  ];

  /* 与 demo-AI 的 service/tool 结构一一对应，仅作教学展示。 */
  Jotang.WORKFLOW = [
    {
      icon: 'chat',
      title: '浏览器发起提问',
      desc: 'POST /chat · sessionId + message'
    },
    {
      icon: 'server',
      title: 'ChatService 写入会话记忆',
      desc: 'system prompt + 用户消息进入内存历史'
    },
    {
      icon: 'cpu',
      title: 'MiMo 决定下一步',
      desc: '返回文本，或发起 tool_calls'
    },
    {
      icon: 'database',
      title: '执行 get_note_by_id',
      desc: 'JdbcTemplate 查询 MySQL 的 notes 表'
    },
    {
      icon: 'spark',
      title: '基于结果生成回答',
      desc: '工具结果回填上下文，最多循环 5 轮'
    }
  ];

  /* 三份 README 的浓缩版学习地图。 */
  Jotang.LEARNING_MAP = [
    {
      repo: 'backend-introduction',
      badge: '01 · 基础',
      title: '一次请求的完整旅程',
      summary: '读书笔记：从浏览器到数据库，再把中间件逐个接上。',
      points: [
        'HTTP 请求/响应、GET 与 POST、常见状态码',
        'JSON 与 Jackson、HTTPS / TLS 握手',
        'MySQL、Redis、RabbitMQ 各自解决什么问题'
      ],
      endpoints: ['GET /hello', 'HelloWorld.java']
    },
    {
      repo: 'backend-beginner',
      badge: '02 · 实践',
      title: 'CRUD 与中间件落地',
      summary: '以 Java + Spring Boot 为主线，把数据、缓存、消息队列写成可运行示例。',
      points: [
        'demo-user：注册、登录与笔记查询',
        'demo-redis：笔记 CRUD + 旁路缓存',
        'demo-RabbitMQ：生产者 / 交换机 / 队列 / 消费者'
      ],
      endpoints: ['POST /user/register', 'GET /notes', 'POST /api/tasks']
    },
    {
      repo: 'backend-advance',
      badge: '03 · 进阶',
      title: 'AI Agent + Tool Use',
      summary: '本前端真正连接的一站：大模型通过工具读取 MySQL，再组织自然语言回答。',
      points: [
        'ChatMemoryService 用 sessionId 维护上下文',
        'OpenAI 兼容协议：messages + tools + tool_choice',
        'ToolRegistry 执行 get_note_by_id，结果回填后继续推理'
      ],
      endpoints: ['POST /chat', 'get_note_by_id'],
      active: true
    }
  ];

  Jotang.EXAMPLES = {
    request: {
      sessionId: '…',
      message: '帮我看看 1 号笔记写了什么'
    },
    response: {
      sessionId: '…',
      reply: '2 号笔记的内容如下：…'
    }
  };
})(window);
