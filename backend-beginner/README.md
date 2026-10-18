# backend-beginner

后端入门学习仓库：以 **Java + Spring Boot** 为主线，配合 MySQL、Redis、RabbitMQ 的笔记和可运行示例，记录从基础 CRUD 到缓存、消息队列的学习过程。

## 目录结构

```text
backend-beginner/
├── assets/                 # 学习过程中的截图
│   ├── Mysql/
│   ├── RabbitMQ/
│   └── Redis/
├── notes/                  # 学习笔记
│   ├── MySQL.md
│   ├── RabbitMQ.md
│   └── Redis.md
└── projects/               # 示例代码
    ├── demo-user/          # Spring Boot + MyBatis + MySQL
    ├── demo-redis/         # Spring Boot + Redis 缓存
    ├── redis-java-demo/    # Java + Jedis 独立示例
    └── demo-RabbitMQ/      # Spring Boot + RabbitMQ
```

## 技术栈

| 分类 | 技术 |
| --- | --- |
| 语言 / 构建 | Java 17、Maven |
| 框架 | Spring Boot 4.1.1、Spring Web MVC、MyBatis |
| 数据库 | MySQL |
| 缓存 | Redis、Spring Data Redis、Jedis |
| 消息队列 | RabbitMQ、Spring AMQP |

## 模块一览

| 模块 | 说明 | 主要接口 |
| --- | --- | --- |
| [demo-user](projects/demo-user) | 用户注册、登录与笔记查询，入门 Spring Boot + MyBatis 分层写法 | `/user/register`、`/user/login`、`/user/notes` |
| [demo-redis](projects/demo-redis) | 笔记 CRUD，并在查询中接入 Redis 缓存 | `/notes` |
| [redis-java-demo](projects/redis-java-demo) | 不依赖 Spring，用 Jedis 演示把 MySQL 一行数据缓存到 Redis（String+JSON、Hash） | 控制台程序 |
| [demo-RabbitMQ](projects/demo-RabbitMQ) | 异步任务投递与消费，演示生产者 / 交换机 / 队列 / 消费者 | `/api/tasks` |

## 快速开始

### 1. 环境准备

- JDK 17 及以上（`redis-java-demo` 按 JDK 11 编写）
- Maven 3.6+，或直接使用各模块自带的 `mvnw`
- MySQL、Redis、RabbitMQ 已启动

Redis 和 RabbitMQ 可以用 Docker 快速启动：

```bash
docker run -d --name redis -p 6379:6379 redis:7

docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=guest \
  -e RABBITMQ_DEFAULT_PASS=guest \
  rabbitmq:3.13-management
```

RabbitMQ 管理界面：<http://localhost:15672>（`guest / guest`）。

> 数据库地址、账号密码等配置见各模块的 `src/main/resources/application.yml`（`demo-redis` 为 `application.yaml`）。

### 2. 运行 Spring Boot 模块

```bash
cd projects/demo-user
.\mvnw.cmd spring-boot:run
```

`demo-redis`、`demo-RabbitMQ` 同理。三个模块默认都使用 `8080` 端口，同时运行时请注意修改 `server.port`。

### 3. 运行 redis-java-demo

```bash
cd projects/redis-java-demo
mvn clean package
java -jar target/redis-java-demo.jar
```

更详细的说明见 [redis-java-demo/README.md](projects/redis-java-demo/README.md)。

### 4. 接口示例

```bash
# demo-user：注册
curl -X POST "http://localhost:8080/user/register?name=张三&password=123&title=第一篇&content=你好"

# demo-redis：按 id 查询笔记
curl "http://localhost:8080/notes/1"

# demo-RabbitMQ：提交异步任务
curl -X POST "http://localhost:8080/api/tasks?type=note&content=测试任务"
```

## 学习笔记

| 笔记 | 内容 |
| --- | --- |
| [MySQL.md](notes/MySQL.md) | Windows 服务、连接、库表操作、数据增删改查等常用命令 |
| [Redis.md](notes/Redis.md) | Redis 简介、安装配置、数据类型与常用命令 |
| [RabbitMQ.md](notes/RabbitMQ.md) | Docker 启动、管理界面操作、Spring Boot 收发消息、消息可靠性、死信 / 延迟队列与问题排查 |
