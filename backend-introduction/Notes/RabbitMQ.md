## 一、除了我们刚才提到的“耗时任务等一下再处理”，通常还有什么样的情况和原因，会让一个项目引入 MQ？
### 1.提升接口响应与用户体验
当核心业务流程里混着短信通知、文件转码、数据导出这类不影响主结果的慢操作时，不用等这些任务全跑完再给用户返回结果，  
只把核心业务落库，剩下的全部丢进MQ异步处理，直接把接口响应从秒级压缩到毫秒级，用户全程无感知等待。

### 2.解耦链路与提升系统容错
核心业务服务不用直接对接所有下游系统，只需要往MQ投递一条事件消息，后续所有下游逻辑全靠订阅消费完成。  
哪怕某个下游服务临时宕机，消息也会安全暂存在队列里，等服务恢复后自动续处理，完全不会影响主业务正常运行，新增下游业务也不用修改核心服务的代码。

### 3.扛住峰值流量削峰填谷
面对秒杀、大促这类瞬间涌入的超高峰值请求，直接用MQ把全部请求先承接下来，下游服务不用硬扛瞬时流量，完全按照自己的最大处理能力匀速消费，  
既不会出现系统被打垮的情况，也不用为了几小时的峰值采购大量闲置服务器。

### 4.覆盖延迟与分布式一致性场景
不用额外开发定时任务轮询数据库，靠MQ的延迟队列就能精准实现订单超时取消、到期提醒这类定时触发需求；  
遇到支付、订单、库存跨多服务的分布式场景，用MQ的事务消息机制，能避免出现“钱扣了库存没扣”这类数据不一致问题，保障多系统业务状态最终完全对齐。

### 5.高效处理海量数据与批量任务
系统产生的海量日志、埋点数据全部先丢进MQ，再由大数据组件异步消费分析，完全不会占用主业务的资源；  
批量发通知、全量数据同步这类大任务，拆成消息扔进队列后，靠横向扩展消费者节点就能并行处理，几小时的工作量十几分钟就能跑完。
## 二、如何使用你所选择的编程语言通过代码来向 RabbitMQ 发送消息, 并从其中接收消息？
### 1. 环境准备
首先，需要在项目中引入 RabbitMQ 的 Java 客户端依赖，在 pom.xml 中添加以下依赖
```xml
<dependency>
    <groupId>com.rabbitmq</groupId>
    <artifactId>amqp-client</artifactId>
    <version>版本</version>
</dependency>
```
### 2. 核心概念简述
‌ConnectionFactory‌：用于创建与 RabbitMQ服务器连接的工厂类。  
‌Connection‌：代表应用程序与 RabbitMQ 之间的 TCP 连接。  
‌Channel‌：信道，是进行消息读写的轻量级连接，大多数 API 操作都在 Channel 上执行。  
‌Queue‌：消息存储的容器。  
‌Producer‌：发送消息的一方。  
‌Consumer‌：接收并处理消息的一方。
### 3. 发送消息（生产者 Producer）
生产者负责创建连接、声明队列并将消息发送到队列中。
```java
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;

import java.nio.charset.StandardCharsets;

public class Send {
    // 定义队列名称
    private final static String QUEUE_NAME = "hello";

    public static void main(String[] argv) throws Exception {
        // 1. 创建连接工厂
        ConnectionFactory factory = new ConnectionFactory();
        factory.setHost("localhost"); // 设置 RabbitMQ 服务器地址，默认 localhost
        // 如果有用户名密码，需额外设置:
        // factory.setUsername("guest");
        // factory.setPassword("guest");

        // 2. 建立连接和创建通道
        // 使用 try-with-resources 确保连接和通道在使用后自动关闭
        try (Connection connection = factory.newConnection();
             Channel channel = connection.createChannel()) {
            
            // 3. 声明队列
            // 参数说明: queue, durable, exclusive, autoDelete, arguments
            // durable=true 表示队列持久化，即使重启 RabbitMQ 队列依然存在
            channel.queueDeclare(QUEUE_NAME, true, false, false, null);

            // 4. 准备消息内容
            String message = "Hello World!";

            // 5. 发送消息
            // 参数说明: exchange, routingKey, props, body
            // 这里使用默认交换机("")，routingKey 即为队列名
            channel.basicPublish("", QUEUE_NAME, null, message.getBytes(StandardCharsets.UTF_8));
            
            System.out.println(" [x] Sent '" + message + "'");
        }
    }
}
```
### 4. 接收消息（消费者 Consumer）
消费者负责监听队列，当有消息到达时进行处理。为了保持程序持续运行以接收消息，通常需要使用回调机制或阻塞主线程。
```java
import com.rabbitmq.client.*;

import java.nio.charset.StandardCharsets;

public class Receive {
    private final static String QUEUE_NAME = "hello";

    public static void main(String[] argv) throws Exception {
        // 1. 创建连接工厂
        ConnectionFactory factory = new ConnectionFactory();
        factory.setHost("localhost");

        // 2. 建立连接和创建通道
        Connection connection = factory.newConnection();
        Channel channel = connection.createChannel();

        // 3. 声明队列
        // 消费者端也需要声明队列，以确保队列存在。如果队列已存在，此操作无副作用。
        channel.queueDeclare(QUEUE_NAME, true, false, false, null);

        System.out.println(" [*] Waiting for messages. To exit press CTRL+C");

        // 4. 创建消费者回调
        DeliverCallback deliverCallback = (consumerTag, delivery) -> {
            String message = new String(delivery.getBody(), StandardCharsets.UTF_8);
            System.out.println(" [x] Received '" + message + "'");
            
            // 业务逻辑处理...
            
            // 5. 手动确认消息 (如果开启了手动确认模式)
            // 注意：basicConsume 默认是自动确认(autoAck=true)，若设为 false 则需手动调用 basicAck
            // channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);
        };

        // 6. 开始消费
        // 参数: queue, autoAck, callback
        // autoAck=true 表示消息一旦投递给消费者即视为成功，RabbitMQ会立即删除消息
        boolean autoAck = true; 
        channel.basicConsume(QUEUE_NAME, autoAck, deliverCallback, consumerTag -> { });
        
        // 注意：在实际应用中，通常需要保持主线程存活，或者使用 Spring 等框架管理生命周期
        // 此处仅为演示，实际运行可能需要 Thread.sleep 或其他阻塞方式防止程序立即退出
    }
}
```
