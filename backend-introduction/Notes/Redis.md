## 一、Redis 为什么这么快?
### 1.自适应高效数据结构，操作复杂度拉满
Redis 对外提供的5种基础数据类型，底层都做了针对性的极致优化，还会根据数据规模自动切换最优编码：

字符串用SDS实现，可常数时间获取长度，减少不必要的内存重分配。

小数据场景下用ZIPLIST/LISTPACK紧凑编码，连续内存访问效率极高；大数据场景自动切换为哈希表、跳表等结构，保证O(1)或O(logN)的操作复杂度。

有序集合用跳表实现，范围查询效率远超普通平衡树，轻松支撑排行榜等高频场景。
### 2. I/O多路复用，单线程处理上万并发
Redis 基于epoll/kqueue实现事件驱动的I/O多路复用模型：

用单线程的事件循环同时监听上万条客户端连接，所有网络操作都是非阻塞的，避免了为每个连接创建线程的资源浪费。

通过Reactor模式统一处理文件事件（客户端连接）和时间事件（过期键清理），用极少的资源就能支撑高并发请求，不会出现多线程架构下的连接数瓶颈。
### 3.纯内存存储，彻底告别磁盘IO瓶颈
Redis 所有数据完全常驻内存，内存读写延迟是纳秒级，而磁盘哪怕是SSD的访问延迟也在微秒到毫秒级，两者性能相差3~5个数量级。

所有GET/SET操作全程不碰磁盘，单次请求耗时仅0.1~1ms，比磁盘数据库快上百倍。

持久化相关的RDB快照、AOF日志写入全部异步化，主线程完全不用等待磁盘IO完成，不会被阻塞拖慢性能。
默认采用jemalloc内存分配器，高效管理内存碎片，适配不同大小的键值对场景，避免内存分配的额外开销。
### 4. 单线程命令执行，消除多线程冗余开销
Redis 核心命令执行由单线程完成，这是它性能高效的关键设计：

天然避免了多线程上下文切换的CPU消耗，也无需处理复杂的锁竞争、死锁等并发问题，CPU算力全部用在数据操作上。

单线程保证了所有命令的原子性执行，无需额外同步机制，代码逻辑更简洁高效。
## 二、在 MySQL 中的一行数据, 你可以以什么样的形式存到 Redis 中作为缓存?
### 1. String + JSON序列化形式
将整行MySQL数据序列化为JSON字符串，存入Redis的String类型中，Key通常设计为表名:主键值的格式，比如user:1001。
### 2.Redis Hash结构形式
将MySQL行的每个字段作为Hash的一个field，字段值作为对应的value，整行数据直接存入一个Hash对象中。
## 三、如何使用你所选择的编程语言来通过代码操作 Redis?
### 第一步：加依赖‌（Maven 的 pom.xml）
```xml

    redis.clients</groupId>
    jedis</artifactId>
    5.2.0</version>
</dependency>
<!-- 把 Java 对象和 JSON 互相转换用 -->

    com.google.code.gson</groupId>
    gson</artifactId>
    2.11.0</version>
</dependency>
```
### 第二步：建连接池‌
```java
JedisPoolConfig config = new JedisPoolConfig();
config.setMaxTotal(16);                     // 池里最多 16 个连接
config.setMaxIdle(16);                      // 最多空闲 16 个
config.setMinIdle(2);                       // 至少保持 2 个空闲
config.setMaxWait(Duration.ofMillis(2000)); // 借不到连接时最多等 2 秒

try (JedisPool jedisPool = new JedisPool(config, "127.0.0.1", 6379)) {
    RowCacheService cache = new RowCacheService(jedisPool);
    // ... 干活
}
```
### 第三步：发命令‌——所有操作都是 jedisPool.getResource() 借一个 Jedis，用完自动归还：
```java
try (Jedis jedis = jedisPool.getResource()) {
    jedis.set("key", "value");
    String v = jedis.get("key");
}
```
### 补充：第二题的实现方式
#### 方式一：String + JSON
```java
// 写：整行序列化成 JSON 字符串，setex 顺带设置 30 分钟过期
public void saveRowAsJson(User user) {
    String json = gson.toJson(user);   // {"id":1001,"name":"张三","age":25,"phone":"138..."}
    try (Jedis jedis = jedisPool.getResource()) {
        jedis.setex("user:1001", 1800, json);
    }
}

// 读：整体取出，再反序列化成对象
public User getRowFromJson(long id) {
    try (Jedis jedis = jedisPool.getResource()) {
        String json = jedis.get("user:" + id);
        return json == null ? null : gson.fromJson(json, User.class);
    }
}
```
#### 方式二：Hash
```java
// 写：每个字段分别塞进同一个 Hash
Map<String, String> fields = new HashMap<>();
fields.put("id", "1001");
fields.put("name", "张三");
fields.put("age", "25");
try (Jedis jedis = jedisPool.getResource()) {
    jedis.hset("user:1001", fields);
    jedis.expire("user:1001", 1800);
}

// 只改一个字段：不用读整行，这是 Hash 最大的优势
jedis.hset("user:1001", "age", "26");

// 只取一个字段
String age = jedis.hget("user:1001", "age");
```
### 旁路缓存
```java
// 读：先查 Redis，没有再查 MySQL，查到后写回 Redis
public User getUser(long id) {
    User cached = cache.getRowFromJson(id);
    if (cached != null) return cached;
    User fromDb = mysql.queryById(id);   // 查数据库
    if (fromDb != null) cache.saveRowAsJson(fromDb); // 写回缓存
    return fromDb;
}

// 写：先改 MySQL，再删掉 Redis 缓存（不是改缓存，是删）
public void updateUser(User user) {
    mysql.update(user);        // 先改库
    cache.evict(user.getId()); // 再删缓存，下次读自动加载新数据
}
```
