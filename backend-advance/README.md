# backend-advance

一个 **AI Agent / Tool Use** 学习示例：Spring Boot 后端接入小米 MiMo（OpenAI 兼容协议），让模型通过 `get_note_by_id` 工具查询 MySQL 中的笔记，再根据查询结果用自然语言回答；配套一个零构建的原生前端。

## 项目结构

```
backend-advance/
├─ project/
│  ├─ demo-AI/       # Spring Boot 后端（Java 17）
│  └─ demo-AI-web/   # 原生 HTML/CSS/JS 前端 + Python 静态代理
└─ assets/           # 运行截图
```

后端主要代码：

```
demo-AI/src/main/java/com/example/demoai/
├─ controller/ChatController.java   # POST /chat
├─ service/ChatService.java         # Tool Use 主循环
├─ memory/ChatMemoryService.java    # 按 sessionId 保存对话历史
├─ tool/ToolRegistry.java           # 工具定义与执行
├─ repository/NoteRepository.java   # JdbcTemplate 查询 notes 表
└─ config/                          # llm / chat 配置绑定
```

## 技术栈

- 后端：Java 17、Spring Boot 4.1.1、Spring MVC、JdbcTemplate、MySQL、Lombok
- 模型：小米 MiMo，`llm.base-url` 指向 OpenAI 兼容接口
- 前端：原生 HTML / CSS / JavaScript，无需 npm 构建；`server.py` 仅用 Python 标准库

## 快速开始

### 1. 准备 MySQL

后端默认连接 `localhost:3306/JotangNote`，账号密码为 `root / root`（可在 `application.yaml` 中修改）。`notes` 表至少需要以下字段：

```sql
CREATE TABLE notes (
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id     BIGINT,
    title       VARCHAR(255),
    content     LONGTEXT,
    create_time DATETIME
);
```

### 2. 启动后端

PowerShell：

```powershell
cd project\demo-AI
$env:MIMO_API_KEY = "你的 API Key"
.\mvnw.cmd spring-boot:run
```

后端默认监听 `http://localhost:8080`。API Key 只通过环境变量传入，不要写进代码或配置文件。

### 3. 启动前端

另开一个终端：

```powershell
cd project\demo-AI-web
python server.py
```

浏览器打开 <http://127.0.0.1:8000/>。前端通过 `server.py` 把同源 `POST /chat` 转发到 `http://127.0.0.1:8080/chat`，因此后端无需配置 CORS。

## 接口

`POST /chat`

请求体：

```json
{
  "sessionId": "demo-1",
  "message": "帮我看看 2 号笔记写了什么"
}
```

`sessionId` 可省略，省略时使用 `default`。同一 `sessionId` 共享对话历史。

响应：

```json
{
  "sessionId": "demo-1",
  "reply": "2 号笔记的内容是……"
}
```

curl 示例：

```powershell
curl.exe -X POST http://localhost:8080/chat `
  -H "Content-Type: application/json" `
  -d '{\"sessionId\":\"demo-1\",\"message\":\"帮我看看 2 号笔记写了什么\"}'
```

## Tool Use 流程

1. 前端发送 `sessionId + message` 到 `POST /chat`。
2. `ChatMemoryService` 把 system 提示和用户消息写入该会话历史。
3. `ChatService` 携带完整历史与工具定义调用模型。
4. 模型返回 `tool_calls` 时，`ToolRegistry` 执行 `get_note_by_id`，由 `JdbcTemplate` 查询 `notes` 表。
5. 工具结果以 `tool` 角色回填历史，再次调用模型，直到得到最终文本。
6. 单次请求最多循环 5 轮工具调用；会话历史最多保留 50 条消息。

## 主要配置

配置文件：`project/demo-AI/src/main/resources/application.yaml`

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `llm.base-url` | `https://api.xiaomimimo.com/v1` | 模型接口地址 |
| `llm.model` | `mimo-v2.6-flash` | 使用的模型 |
| `llm.api-key` | `${MIMO_API_KEY:...}` | 从环境变量 `MIMO_API_KEY` 读取 |
| `chat.max-history-messages` | `50` | 每个会话保留的最大消息数 |
| `chat.max-tool-rounds` | `5` | 单次提问的最大工具调用轮数 |
| `spring.datasource.*` | `JotangNote` / `root` | MySQL 连接信息 |

## 说明

- 会话历史保存在内存中，重启后端后会丢失；前端会话则保存在浏览器 `localStorage`。
- 对话接口为非流式返回，一次请求拿到最终答复。
- 前端支持会话管理、Markdown 渲染、Tool Use 流程展示和深浅主题，详细说明见 [`project/demo-AI-web/README.md`](project/demo-AI-web/README.md)。
