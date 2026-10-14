# backend-introduction

后端入门学习资料合集：**读书笔记** + **练手项目**。

围绕「一个请求从浏览器发出 → 后端处理 → 数据落库 / 缓存 / 进消息队列」这条主线，
把 HTTP、接口设计、JSON、HTTPS、MySQL、Redis、RabbitMQ、AI Agent 串了一遍，
并配了两个可以直接跑起来的最小项目。

---

## 一、内容概览

| 目录 | 内容 |
| --- | --- |
| `Notes/` | 后端入门知识笔记（HTTP / 接口 / JSON / HTTPS / MySQL / Redis / RabbitMQ / AI Agent） |
| `Projects/` | 练手项目：纯 Java 版与 Spring Boot Web 版 Hello World |
| `assets/` | 笔记与项目用到的截图 |

---

## 二、目录结构

```
backend-introduction
├── Notes
│   ├── others.md        # HTTP 请求/响应、GET vs POST、状态码、接口设计、JSON、HTTPS
│   ├── Mysql.md         # MySQL 承载量、为什么快、用 JDBC 操作
│   ├── Redis.md         # Redis 为什么快、行数据的缓存方式、用 Jedis 操作
│   ├── RabbitMQ.md      # 为什么要引入 MQ、Java 收发消息
│   └── AI Agent.md      # AI Agent 原理、大模型"记忆"的存储方案
├── Projects
│   ├── src/HelloWorld.java                 # 纯 Java 版 Hello World
│   └── demo-hello/                         # Spring Boot Web 版 Hello World
│       ├── mvnw / mvnw.cmd                 # Maven Wrapper
│       ├── pom.xml
│       └── src/main/java/com/example/demo/HelloController.java
└── assets
    └── HelloWorld.png                      # 纯 Java 版运行截图
```

---

## 三、笔记速览

### 1. Mysql

- 常规生产环境可轻松承载 **千万级（1000 万 ~ 2000 万行）** 结构化数据。
- 快的原因：B+ 树聚簇索引、多级缓存（Buffer Pool / Redo Log）、MVCC 与行级锁、CBO 优化器、读写分离与分库分表。
- 代码操作：JDBC 六步流程（加载驱动 → 获取连接 → 创建语句 → 执行 SQL → 处理结果 → 关闭资源）。

### 2. Redis

- 快的原因：自适应高效数据结构、I/O 多路复用 + 单线程事件循环、纯内存存储、单线程命令执行。
- 缓存 MySQL 一行数据的两种方式：**String + JSON** 与 **Hash**。
- 代码操作：Jedis 连接池、`set / hset / expire`，以及旁路缓存（读时回填、写时删缓存）。

### 3. RabbitMQ

- 引入 MQ 的典型场景：异步提速、解耦容错、削峰填谷、延迟队列与分布式一致性、海量数据与批量任务。
- 代码操作：`ConnectionFactory → Connection → Channel`，声明队列后用 `basicPublish` 发送、`basicConsume` 消费。

### 4. AI Agent

- Agent 如何让大模型从「只会说」变成「能做事」：感知层 + 执行层 + 记忆层，核心是工具调用、任务规划、闭环迭代。
- 大模型「记忆」有限时的存储思路：持久化落库、按需动态检索、分层管理（上下文 / 结构化库 / 向量库）。

### 5. others —— 网络与接口基础

- **HTTP 请求 / 响应的组成**：请求行 / 状态行、头部、空行、主体（Body）。
- **GET vs POST**：只读与副作用的区别、URL 参数 vs 请求体、幂等与缓存。
- **状态码**：1xx~5xx 的常见含义（200 / 201 / 204 / 301 / 302 / 304 / 400 / 401 / 403 / 404 / 500 / 502 / 503 / 504 …）。
- **接口设计**：以「获取某篇笔记详情」为例，考虑 ID 设计、登录鉴权、字段精简、错误处理、访问记录。
- **JSON**：对象与数组的语法规则，Java 用 Jackson（`ObjectMapper`）做序列化 / 反序列化。
- **HTTPS**：TLS 握手四步（能力协商 → 证书校验 → 协商会话密钥 → 加密通信），对称加密与非对称加密的分工。

---

## 四、练手项目

### 4.1 demo-hello（Spring Boot Web）

一个最小的 Spring Boot Web 应用，访问 `/hello` 返回一句话。

- 相关文件：`Projects/demo-hello/`
- 关键类：`HelloController`（`@SpringBootApplication` + `@RestController`，映射 `GET /hello`）
- 技术栈：Java 17 + Spring Boot 4.0.8（`spring-boot-starter-webmvc`）

运行（Windows，在 `Projects/demo-hello` 目录下）：

```bash
.\mvnw.cmd spring-boot:run
```

然后访问：<http://localhost:8080/hello>

预期输出：

```
Hello World From Web Application!
```

也可以直接在 IDE 里运行 `HelloController` 的 `main` 方法。

### 4.2 HelloWorld.java（纯 Java）

最简单的一行输出，用来确认 JDK 环境是否正常。

- 文件：`Projects/src/HelloWorld.java`

运行：

```bash
cd Projects\src
javac HelloWorld.java
java HelloWorld
```

预期输出：

```
Hello World From Terminal!
```

对应截图见 `assets/HelloWorld.png`。

---

## 五、环境要求

| 工具 | 版本 | 用途 |
| --- | --- | --- |
| JDK | 17 及以上 | 运行纯 Java 与 Spring Boot 项目 |
| Maven | 3.6+（或直接用项目自带 `mvnw`） | 构建 demo-hello |
| IDE | IntelliJ IDEA（可选） | 方便运行与调试 |

笔记里还涉及 MySQL、Redis、RabbitMQ，练习对应代码时需要有可连接的服务实例。

---

## 六、建议阅读顺序

1. `Mysql.md`：理解数据怎么存、怎么用代码查。
2. `Redis.md`：在 MySQL 之上加一层缓存。
3. `RabbitMQ.md`：把耗时的、需要解耦的逻辑异步化。
4. `AI Agent.md`：看看大模型是怎么被「接上手脚」的。
5. `others.md`：回头补 HTTP / 接口 / JSON / HTTPS 这些「通信基础」，把协议原理和前面的实践对上。
6. 动手跑 `Projects` 下的两个 Hello World，把环境和流程走通。
