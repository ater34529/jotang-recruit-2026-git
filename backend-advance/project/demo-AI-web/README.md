# Jotang AI · 笔记智能助手（前端）

零构建的原生 HTML / CSS / JavaScript 前端，对接 `backend-advance/project/demo-AI` 的 `POST /chat`。
界面包含会话管理、Markdown 渲染、Tool Use 流程可视化、请求 / 响应快照、主题切换和移动端抽屉。

```
demo-AI-web/
├─ index.html
├─ server.py          # 静态服务器 + /chat 反向代理 + /__health
├─ css/
│  ├─ tokens.css      # 设计令牌、深浅主题
│  ├─ layout.css      # 三栏布局、响应式抽屉
│  └─ components.css  # 组件与状态样式
└─ js/
   ├─ theme-init.js   # 首屏防闪烁
   ├─ config.js       # 默认设置、提示词、学习地图
   ├─ utils.js        # 转义、时间、剪贴板、localStorage
   ├─ markdown.js     # 轻量 Markdown，转义后再渲染
   ├─ store.js        # 会话持久化
   ├─ api.js          # 请求、超时、错误归一化
   └─ app.js          # 渲染与交互入口
```

## 1. 启动后端 demo-AI

先确保 MySQL 可访问，并准备好小米 MiMo 的 API Key：

```powershell
cd C:\Users\Lenovo\Desktop\learning\backend-advance\project\demo-AI
$env:MIMO_API_KEY = "你的 API Key"
.\mvnw.cmd spring-boot:run
```

后端默认监听 `http://localhost:8080`，对话接口为 `POST /chat`，请求体：

```json
{ "sessionId": "会话 id", "message": "帮我看看 2 号笔记写了什么" }
```

成功响应：

```json
{ "sessionId": "会话 id", "reply": "……" }
```

## 2. 启动前端

另开一个终端：

```powershell
cd C:\Users\Lenovo\Desktop\learning\backend-advance\project\demo-AI-web
python server.py
```

浏览器打开 <http://127.0.0.1:8000/>。

`server.py` 只依赖 Python 标准库，做三件事：

- 提供当前目录的静态文件（`index.html`、`css`、`js`）；
- 将同源的 `POST /chat` 转发到 `http://127.0.0.1:8080/chat`，因此不需要改后端 CORS；
- 提供 `GET /__health`，前端用它显示“在线 / 未连接”状态。

常用参数：

```powershell
python server.py --port 8001                 # 换端口
python server.py --backend http://localhost:8080
python server.py --open                      # 启动后自动打开浏览器
python server.py --timeout 300               # 调整 /chat 代理超时
```

## 3. 设置项

点击左侧底部的“设置”可以调整：

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| API 地址 | 空 | 空 = 同源代理 `/chat`；填写 `http://localhost:8080` = 浏览器直连 |
| 对话接口路径 | `/chat` | 后端对话接口 |
| 请求超时 | 180 秒 | 前端 `fetch` 超时，60 ~ 600 秒 |
| 模型显示名称 | `mimo-v2.6-flash` | 仅影响界面展示 |
| 界面主题 | 深色 | 也可用侧边栏底部按钮切换 |

> 推荐保持 API 地址为空，使用 `server.py` 代理。直连模式需要 demo-AI 自己返回 CORS 响应头，而当前后端没有配置 CORS。

## 4. 交互说明

- `Enter` 发送，`Shift + Enter` 换行；生成过程中发送按钮变为“停止”。
- `Alt + N` 新对话，`Ctrl/Cmd + K` 聚焦输入框，`Esc` 关闭移动端抽屉。
- 消息支持复制、重试；错误消息可以复制错误详情。
- 每条回复显示 HTTP 状态码与耗时；右侧“接口快照”保留最后一次请求 / 响应。
- 会话保存在浏览器 `localStorage`，刷新页面不会丢失：
  - `jotang-ai:settings:v1`
  - `jotang-ai:sessions:v1`
  - `jotang-ai:active-session:v1`

## 5. 排错

| 现象 | 处理 |
| --- | --- |
| 页面显示“未连接后端” | 确认 demo-AI 已启动、端口是 8080；访问 <http://127.0.0.1:8000/__health> 查看 `reachable` |
| `502 bad_gateway` | `server.py` 正常，但 demo-AI 没启动或端口不对；检查后端控制台 |
| `HTTP 401 / 403` | 启动后端前没有设置 `MIMO_API_KEY`，或 Key 无效 |
| `HTTP 500` | 查看 demo-AI 日志；常见原因是 MySQL 未启动、`JotangNote` 库或 `notes` 表不存在 |
| 请求很慢 | 默认超时 180 秒；Tool Use 可能调用多轮模型，可在设置中调大 |
| 修改 JS/CSS 后没变化 | 页面已使用 `Cache-Control: no-store`，强制刷新 `Ctrl + F5` 即可 |
| 端口 8000 被占用 | `python server.py --port 8001` |

前端不会把 API Key 写入任何文件，Key 只应通过环境变量交给后端。
