# redis-java-demo

用 **Java + Jedis** 操作 Redis 的入门示例，主题是：**把 MySQL 里的一行数据缓存到 Redis**。
包含两种最主流的存法（String+JSON、Hash），以及连接池、过期时间、缓存删除的完整写法。

---

## 一、环境要求

| 项目 | 版本要求 | 说明 |
| --- | --- | --- |
| JDK | 8 及以上（本项目按 11 编写） | 编译和运行 Java 代码 |
| Maven | 3.6 及以上 | 下载依赖、打包（可选，见下方“不用 Maven 也行”） |
| Redis | 5.0 及以上 | 需要一个能连上的 Redis 服务（默认 127.0.0.1:6379） |

---

## 二、目录结构

```
redis-java-demo
├── pom.xml                                        # Maven 依赖与打包配置
├── README.md                                      # 本文件
└── src/main/java/com/example/redisdemo
    ├── DemoApplication.java                       # 程序入口，串起整个演示
    ├── model/User.java                            # 代表 MySQL 表里的一行记录
    └── service/RowCacheService.java               # 两种缓存写法的具体实现
```

---

## 三、怎么跑起来

### 3.1 先准备一个 Redis

- 本机装了 Redis：直接启动 `redis-server`（默认端口 6379）。
- 用 Docker（一条命令）：
  ```bash
  docker run -d --name redis -p 6379:6379 redis:7
  ```
- 连接参数（地址、端口、密码）在 `DemoApplication.java` 第 26 行附近修改。

### 3.2 方式 A：有 Maven（推荐）

```bash
cd redis-java-demo
mvn clean package          # 编译 + 打包
java -jar target/redis-java-demo.jar
```

### 3.3 方式 B：不用 Maven，手动编译

1. 从 Maven 中央仓库下载这几个 jar：`jedis-5.2.0.jar`、`commons-pool2-2.13.1.jar`、`slf4j-api-2.0.16.jar`、`slf4j-simple-2.0.16.jar`、`gson-2.11.0.jar`，放到 `libs/` 目录。
2. 编译并运行：
   ```bash
   CP=$(ls libs/*.jar | tr '\n' ':')
   mkdir -p out
   javac -encoding UTF-8 -cp "$CP" -d out $(find src/main/java -name '*.java')
   java -cp "out:$CP" com.example.redisdemo.DemoApplication
   ```

### 3.4 运行结果（预期输出）

```
1) MySQL 里查出来的一行数据 -> User{id=1001, name='张三', age=25, phone='13800001111'}
2) [String+JSON] 写进去再读回来 -> User{id=1001, name='张三', age=25, phone='13800001111'}
3) [Hash]        写进去再读回来 -> User{id=1001, name='张三', age=25, phone='13800001111'}
4) [Hash] 只改年龄后读回来 -> User{id=1001, name='张三', age=26, phone='13800001111'}
   [Hash] 只取年龄字段     -> 26
5) 删除缓存后再读 JSON -> null（null 表示缓存已失效）
```

---

## 四、代码里讲了哪三件事

1. **连接池（JedisPool）**
   Jedis 的单个连接对象**不是线程安全的**，绝不能多个线程共用一个。
   标准做法是配一个连接池，每次用之前 `pool.getResource()` 借、用完自动归还。

2. **两种存法**
   - `String + JSON`：整行打包成一个 JSON 字符串存进去，读写都是整体操作，最简单。
   - `Hash`：每个字段占一个 field，可以只改/只取某一个字段，更灵活。

3. **缓存失效（旁路缓存套路）**
   读：先查 Redis，没有就查 MySQL，查完写回 Redis；
   写：先改 MySQL，再删掉 Redis 的缓存，让它下次自动加载最新数据。
   另外所有 Key 都设置了过期时间做兜底。

---

## 五、另外两种主流写法（供参考）

### 5.1 Lettuce（Spring Boot 2.x 之后默认使用的底层客户端）

特点：基于 Netty，**连接是线程安全的**，一个连接可以被多个线程共享，高并发下比 Jedis 更省连接。

```java
import io.lettuce.core.RedisClient;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;

public class LettuceExample {
    public static void main(String[] args) {
        RedisClient client = RedisClient.create("redis://127.0.0.1:6379");
        try (StatefulRedisConnection<String, String> conn = client.connect()) {
            RedisCommands<String, String> cmd = conn.sync();
            cmd.setex("user:1001", 1800, "{\"id\":1001,\"name\":\"张三\"}");
            System.out.println(cmd.get("user:1001"));
        }
        client.shutdown();
    }
}
```

Maven 依赖：

```xml
<dependency>
    <groupId>io.lettuce</groupId>
    <artifactId>lettuce-core</artifactId>
    <version>6.5.0.RELEASE</version>
</dependency>
```

### 5.2 Spring Data Redis（Spring Boot 项目里最常用的写法）

在 Spring Boot 项目里，几乎不用手写连接代码，注入 `RedisTemplate` 直接用。

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

```yaml
# application.yml
spring:
  redis:
    host: 127.0.0.1
    port: 6379
    lettuce:
      pool:
        max-active: 16
        max-idle: 16
        min-idle: 2
```

```java
@Service
public class UserCacheService {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    /** 方式一：String + JSON（依赖 JSON 序列化器） */
    public void saveAsJson(User user) {
        redisTemplate.opsForValue().set("user:json:" + user.getId(), user, Duration.ofMinutes(30));
    }

    public User getAsJson(long id) {
        return (User) redisTemplate.opsForValue().get("user:json:" + id);
    }

    /** 方式二：Hash */
    public void saveAsHash(User user) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", user.getId());
        map.put("name", user.getName());
        map.put("age", user.getAge());
        map.put("phone", user.getPhone());
        String key = "user:hash:" + user.getId();
        redisTemplate.opsForHash().putAll(key, map);
        redisTemplate.expire(key, Duration.ofMinutes(30));
    }

    /** 只改一个字段 */
    public void updateAge(long id, int age) {
        redisTemplate.opsForHash().put("user:hash:" + id, "age", age);
    }

    /** 删除缓存 */
    public void evict(long id) {
        redisTemplate.delete(Arrays.asList("user:json:" + id, "user:hash:" + id));
    }
}
```

> 注意：Spring Boot 默认用的是 **JDK 序列化**，存到 Redis 里会是乱码且体积大。
> 实际项目一定要自定义 `RedisTemplate`，把 key 设成 `StringRedisSerializer`、
> value 设成 `GenericJackson2JsonRedisSerializer`。

---

## 六、几个容易踩的坑

1. **同一个 Key 不能既是 String 又是 Hash**：会报 `WRONGTYPE Operation against a key
   holding the wrong kind of value`。本项目给两种方式加了不同前缀来避开它。
2. **Jedis 实例非线程安全**：务必用连接池，不要在多线程里共用一个 `Jedis` 对象。
3. **不要用 JDK 默认序列化**：存进去的可读性极差，还可能有安全风险。
4. **一定要设过期时间（TTL）**：这是缓存和数据库保持一致的兜底手段。
5. **先改数据库，再删缓存**：不要“先删缓存再改库”，否则高并发下容易把旧数据又写回缓存。
