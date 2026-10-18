# RabbitMQ 笔记

> 目标：能启动、会在管理界面操作、能用 Spring Boot 收发消息、遇到问题知道怎么查。
>
> 说明：下文所有 vhost、队列、交换机、routing key 都写成占位符（如“这里写队列名”），请替换成你项目实际使用的值；不同项目 vhost 不同，按项目填即可，笔记不预设任何命名。

## 0. 先记住消息流向

```text
生产者 Producer → 交换机 Exchange →（Binding + Routing Key 匹配）→ 队列 Queue → 消费者 Consumer
```

| 概念 | 作用（一句话） |
| --- | --- |
| Producer | 发消息的程序 |
| Exchange | 收消息并按规则转发，自己不存消息 |
| Queue | 真正存消息的地方 |
| Binding | 交换机与队列之间的绑定关系 |
| Routing Key | 路由键，交换机靠它决定消息去哪个队列 |
| Virtual Host | 虚拟主机，相当于命名空间，隔离不同项目的队列/交换机 |
| Channel | 连接上的轻量通道，收发消息都走它 |
| Connection | 程序到 RabbitMQ 的 TCP 连接 |

## 1. Docker 启动 RabbitMQ

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 -e RABBITMQ_DEFAULT_USER=guest -e RABBITMQ_DEFAULT_PASS=guest rabbitmq:3.13-management
```

每一步的作用：

- `docker run -d`：后台启动一个容器。
- `--name rabbitmq`：容器叫 rabbitmq，后面的 docker 命令都用这个名字。
- `-p 5672:5672`：程序连接用的端口（AMQP 协议）。
- `-p 15672:15672`：管理界面用的端口（网页）。
- `-e RABBITMQ_DEFAULT_USER=guest`：初始用户名。
- `-e RABBITMQ_DEFAULT_PASS=guest`：初始密码。
- `rabbitmq:3.13-management`：带管理界面的镜像；不加 `-management` 就没有网页。

检查是否启动成功：

```bash
docker ps                  # 能看到 rabbitmq 且状态 Up 就成功了
docker logs -f rabbitmq    # 启动失败时看日志，Ctrl + C 退出
```

浏览器打开 <http://localhost:15672>，用 `guest / guest` 登录。

日常维护命令：

```bash
docker stop rabbitmq     # 停止
docker start rabbitmq    # 启动
docker restart rabbitmq  # 重启
docker rm -f rabbitmq    # 删除容器（消息也会没，除非挂载了数据卷）
```

其他端口（了解即可）：`25672` 集群通信，`4369` 节点发现，单机不用管。

## 2. 管理界面怎么点

### 2.1 创建 Virtual Host

`Admin → Virtual Hosts → Add a new virtual host`

- Name 填你项目要用的 vhost 名（不同项目用不同 vhost，按实际填），其他默认，点 Add。
- 作用：把队列/交换机按项目隔离，避免名字冲突。

### 2.2 创建用户并授权

1. `Admin → Users → Add a user`：填用户名、密码，Tags 选 `Administrator`（学习方便）。
2. 点进该用户 → `Set permission`：Virtual Host 选你项目用的那个 vhost，三个权限都填 `.*`，点 Set permission。
- 作用：让这个用户能对你选的 vhost 里的队列/交换机读写和管理。

### 2.3 创建队列

`Queues and Streams → Add a new queue`

- Name：`这里写队列名`
- Type：`Classic`（普通队列）
- Durability：`Durable`（RabbitMQ 重启后队列还在）
- 点 Add queue。
- 作用：消息最终存在这里。

### 2.4 创建交换机

`Exchanges → Add a new exchange`

- Name：`这里写交换机名`
- Type：`direct`
- Durability：`Durable`
- 点 Add exchange。
- 作用：接收生产者的消息，再按规则转发。

### 2.5 绑定交换机和队列

点进你刚建的交换机 → `Bindings` → `Add binding`

- To queue：选你刚建的队列。
- Routing key：`这里写routingKey`（按项目实际填）。
- 点 Bind。
- 作用：告诉交换机“routing key 匹配的消息发给这个队列”。

### 2.6 发一条消息测试

点进你建的队列 → `Publish message`

- Payload：`hello rabbitmq`
- Delivery mode 选 `Persistent (2)`（持久化）
- 点 Publish message。
- 作用：队列的 Ready 数量会 +1。

### 2.7 取出消息

点进你建的队列 → `Get messages`

- Ack Mode 选 `Automatic ack`
- 点 Get messages。
- 作用：手动调试用；Get 会把消息真的取走，不是“预览”。

## 3. Spring Boot 操作（最常用）

### 3.1 加依赖

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

作用：引入 Spring AMQP 和 RabbitMQ Java 客户端，自动配置 `RabbitTemplate`。

### 3.2 配置文件

`application.yml`：

```yaml
spring:
  rabbitmq:
    host: localhost
    port: 5672            # 程序连接端口，不是 15672
    username: guest
    password: guest
    virtual-host: 这里写你项目的vhost  # 不同项目不同，按实际填
    listener:
      simple:
        acknowledge-mode: manual  # 手动 ack
        prefetch: 1               # 每次只取 1 条，处理完再取下一条
```

- `virtual-host` 填你项目实际使用的 vhost；不填默认是 `/`。
- `prefetch: 1` 能避免一个消费者抢太多消息，适合处理速度不一致的场景。
- 学习阶段先用 `manual`，能看清 ack 的作用。

### 3.3 声明队列、交换机、绑定

```java
@Configuration
public class RabbitConfig {

    // 下面三个换成你项目实际使用的名字
    public static final String EXCHANGE = "这里写交换机名";
    public static final String QUEUE = "这里写队列名";
    public static final String ROUTING_KEY = "这里写routingKey";

    @Bean
    public DirectExchange exchange() {
        // 参数：名字、是否持久化、是否自动删除
        return new DirectExchange(EXCHANGE, true, false);
    }

    @Bean
    public Queue queue() {
        // 参数：名字、是否持久化
        return new Queue(QUEUE, true);
    }

    @Bean
    public Binding binding(Queue queue, DirectExchange exchange) {
        // 把队列绑到交换机，并指定 routing key
        return BindingBuilder.bind(queue).to(exchange).with(ROUTING_KEY);
    }
}
```

作用：项目启动时自动在 RabbitMQ 上创建这些东西，不用手工去界面点。上面三个常量换成你项目实际使用的名字即可。

注意：同名队列如果已存在但参数不同（比如持久化设置不一样），启动会报 `PRECONDITION_FAILED`，删掉旧队列重建即可。

### 3.4 发送消息

```java
@RestController
public class ProducerController {

    private final RabbitTemplate rabbitTemplate;

    public ProducerController(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    @GetMapping("/send")
    public String send(@RequestParam String msg) {
        rabbitTemplate.convertAndSend(EXCHANGE, ROUTING_KEY, msg);
        return "sent: " + msg;
    }
}
```

- `convertAndSend(交换机, routing key, 消息)`：把消息交给交换机，由交换机路由。
- 访问 `http://localhost:8080/send?msg=hello` 就能发一条。

### 3.5 消费消息

```java
@Component
public class MessageConsumer {

    private static final Logger log = LoggerFactory.getLogger(MessageConsumer.class);

    @RabbitListener(queues = RabbitConfig.QUEUE)
    public void receive(String msg) {
        log.info("收到消息: {}", msg);
    }
}
```

- `@RabbitListener`：启动后自动监听指定队列。
- 方法参数类型要和发送的消息类型一致，否则会反序列化失败。

### 3.6 发送对象时配置 JSON 转换器

```java
@Bean
public MessageConverter jsonMessageConverter() {
    return new Jackson2JsonMessageConverter();
}
```

作用：默认用 JDK 序列化，换成 JSON 后消息在管理界面可读，也方便其他语言消费。

### 3.7 手动 ACK 示例

```java
@RabbitListener(queues = RabbitConfig.QUEUE)
public void receive(String msg,
                    Channel channel,
                    @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) throws IOException {
    try {
        // 业务代码写这里
        log.info("处理消息: {}", msg);
        channel.basicAck(deliveryTag, false);
    } catch (Exception e) {
        log.error("处理失败", e);
        channel.basicNack(deliveryTag, false, false);
    }
}
```

参数含义：

- `deliveryTag`：这条消息的编号，ack 时要带上。
- `basicAck(tag, false)`：处理成功，告诉 RabbitMQ 可以删掉这条消息；第二个参数 `false` 表示只确认这一条。
- `basicNack(tag, false, false)`：处理失败；第三个参数是 `requeue`，`false` 表示不重新入队（通常进死信队列），改成 `true` 会重新排队。
- `requeue=true` 要小心：如果一直处理失败，会无限重试，最好配合重试次数或死信队列。

## 4. 四种交换机类型

| 类型 | 路由规则 | 典型场景 |
| --- | --- | --- |
| `direct` | routing key 完全相等才路由 | 点对点、按级别分流 |
| `fanout` | 不看 routing key，广播给所有绑定的队列 | 通知、广播 |
| `topic` | routing key 用通配符匹配：`*` 匹配一个单词，`#` 匹配零个或多个单词 | 按业务分类订阅 |
| `headers` | 按消息 header 匹配 | 特殊匹配需求，少用 |

操作上的区别（下面的 key 只是示例，实际按你项目的 routing key 规则填）：

- `direct`：例如绑定 key 是 `error`，只有 routing key 为 `error` 的消息才会进这个队列。
- `fanout`：一个交换机绑 3 个队列，发 1 条消息，3 个队列各收到一份。
- `topic`：例如绑定 `order.*` 能收到 `order.create`；绑定 `order.#` 能收到 `order.create.success`。

Spring Boot 声明 fanout（绑定不需要 routing key）：

```java
@Bean
public FanoutExchange fanoutExchange() {
    return new FanoutExchange("这里写交换机名", true, false);
}

@Bean
public Binding fanoutBinding(Queue queue, FanoutExchange fanoutExchange) {
    return BindingBuilder.bind(queue).to(fanoutExchange);
}
```

Spring Boot 声明 topic：

```java
@Bean
public TopicExchange topicExchange() {
    return new TopicExchange("这里写交换机名", true, false);
}

@Bean
public Binding topicBinding(Queue queue, TopicExchange topicExchange) {
    return BindingBuilder.bind(queue).to(topicExchange).with("这里写routingKey或通配规则");
}
```

发送时只需要换交换机和 routing key，例如 `rabbitTemplate.convertAndSend("这里写交换机名", "这里写routingKey", msg)`。

## 5. 消息不丢的四个操作

1. **队列持久化**：声明队列时 `durable=true`，RabbitMQ 重启后队列还在。
2. **消息持久化**：发送时设置 delivery mode 为 2。
3. **消费端手动 ack**：业务处理成功后才确认。
4. **生产端 confirm**：确认消息有没有到达交换机；配合 return 处理“到了交换机但没有队列接收”。

消息持久化发送：

```java
rabbitTemplate.convertAndSend(EXCHANGE, ROUTING_KEY, msg, message -> {
    message.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
    return message;
});
```

`application.yml` 开启生产端确认：

```yaml
spring:
  rabbitmq:
    publisher-confirm-type: correlated  # 开启发送确认
    publisher-returns: true             # 开启路由失败回调
    template:
      mandatory: true                   # 路由不到队列时退回给生产者
```

回调示例：

```java
@Component
public class RabbitConfirmCallback implements RabbitTemplate.ConfirmCallback, RabbitTemplate.ReturnsCallback {

    public RabbitConfirmCallback(RabbitTemplate rabbitTemplate) {
        rabbitTemplate.setConfirmCallback(this);
        rabbitTemplate.setReturnsCallback(this);
    }

    @Override
    public void confirm(CorrelationData correlationData, boolean ack, String cause) {
        // ack=true：消息成功到达交换机；false：没到达，需要重发或记录
        if (!ack) {
            System.out.println("消息没到交换机: " + cause);
        }
    }

    @Override
    public void returnedMessage(ReturnedMessage returned) {
        // 到了交换机，但没有队列能路由（常见原因：routing key 写错）
        System.out.println("路由失败: " + returned.getReplyText());
    }
}
```

注意：confirm 只能证明消息到了交换机，不代表已经落盘、也不代表消费者处理成功，所以四件事要一起做。

## 6. 死信队列与延迟队列

### 6.1 什么情况会进死信

- 消费者 `basicNack` / `basicReject`，并且 `requeue=false`。
- 消息 TTL 过期。
- 队列超过最大长度（设置了 `x-max-length`）。

### 6.2 操作：给业务队列配死信交换机

思路：先建死信交换机 + 死信队列并绑定，再让业务队列把死信转发过去。

```java
@Bean
public DirectExchange deadLetterExchange() {
    return new DirectExchange("这里写死信交换机名", true, false);
}

@Bean
public Queue deadLetterQueue() {
    return new Queue("这里写死信队列名", true);
}

@Bean
public Binding deadLetterBinding(Queue deadLetterQueue, DirectExchange deadLetterExchange) {
    return BindingBuilder.bind(deadLetterQueue).to(deadLetterExchange).with("这里写死信routingKey");
}

@Bean
public Queue businessQueue() {
    return QueueBuilder.durable("这里写业务队列名")
            .deadLetterExchange("这里写死信交换机名")
            .deadLetterRoutingKey("这里写死信routingKey")
            .build();
}
```

- 作用：业务队列里的消息变成死信后，自动转到你配置的死信交换机，再按死信 routing key 进入死信队列。
- 之后写一个消费者监听死信队列，就能看到失败/过期的消息，方便排查或补偿。
- 界面操作对应：队列的 `Arguments` 里添加 `x-dead-letter-exchange` 和 `x-dead-letter-routing-key`。

### 6.3 延迟队列的两种做法

**方式一：TTL + 死信**

- 给队列设置 `x-message-ttl`，消息过期后进入死信队列，消费者监听死信队列。
- 缺点：队列 TTL 是按队头判断的，前面有长延迟消息会堵住后面的短延迟消息，时间不够精确。

**方式二：延迟插件（推荐）**

```bash
docker exec -it rabbitmq rabbitmq-plugins enable rabbitmq_delayed_message_exchange
```

- 作用：启用延迟消息插件。
- 界面上新建 Exchange，Type 选 `x-delayed-message`，Arguments 添加 `x-delayed-type=direct`。

Spring Boot 声明延迟交换机：

```java
@Bean
public CustomExchange delayExchange() {
    Map<String, Object> args = new HashMap<>();
    args.put("x-delayed-type", "direct");
    return new CustomExchange("这里写延迟交换机名", "x-delayed-message", true, false, args);
}
```

发送延迟消息：

```java
rabbitTemplate.convertAndSend("这里写延迟交换机名", "这里写routingKey", msg, message -> {
    message.getMessageProperties().setDelay(10000); // 10 秒后投递
    return message;
});
```

注意：插件版的延迟消息先存在交换机里，时间到了才进入队列，所以刚发送时在队列里看不到。

## 7. 常用命令速查

```bash
# 查看队列：名称、消息数、消费者数
docker exec -it rabbitmq rabbitmqctl list_queues name messages consumers

# 查看交换机
docker exec -it rabbitmq rabbitmqctl list_exchanges name type

# 查看绑定关系
docker exec -it rabbitmq rabbitmqctl list_bindings

# 查看连接
docker exec -it rabbitmq rabbitmqctl list_connections

# 查看用户和 vhost
docker exec -it rabbitmq rabbitmqctl list_users
docker exec -it rabbitmq rabbitmqctl list_vhosts

# 清空队列（消息删掉，队列还在）
docker exec -it rabbitmq rabbitmqctl purge_queue 这里写队列名

# 删除队列
docker exec -it rabbitmq rabbitmqctl delete_queue 这里写队列名
```

界面看状态：`Queues` 里的 `Ready`（待消费）、`Unacked`（已投递但没 ack）、`Total`（总数）。

## 8. 常见问题排查

1. **程序连不上**
   - 端口用 `5672`，不是 `15672`。
   - 容器是否 Up；用户名、密码、vhost 是否一致。
   - 远程访问时 `guest` 默认只能本机登录，改用自己创建的用户。
2. **管理界面打不开**
   - 镜像要带 `-management`，或执行 `rabbitmq-plugins enable rabbitmq_management`。
3. **发了消息但队列里没有**
   - 交换机类型、routing key、绑定关系是否匹配；队列名是否写错；vhost 是否选错。
4. **消息一直是 Unacked**
   - 消费者没 ack、业务卡住或抛异常；`prefetch` 太大也会一次压很多条。
5. **重复消费**
   - ack 丢失、网络抖动、消费者重启都会导致重发；消费端要做幂等（业务唯一 ID + 数据库唯一索引/Redis 去重）。
6. **启动报 PRECONDITION_FAILED**
   - 已存在的队列/交换机参数和代码声明不一致；删掉重建，或统一参数。
7. **消息堆积**
   - 增加消费者、适当提高 `prefetch`、优化消费逻辑；必要时限流或临时扩容。
