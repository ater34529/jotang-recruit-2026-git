package com.example.redisdemo.service;

import com.example.redisdemo.model.User;
import com.google.gson.Gson;
import redis.clients.jedis.Jedis;
import redis.clients.jedis.JedisPool;

import java.util.HashMap;
import java.util.Map;

/**
 * 演示：把 MySQL 的一行数据缓存进 Redis 的两种形式。
 *
 * 所有 Redis 命令都通过 Jedis 这个“桥梁”发出去；
 * 连接统一从连接池 JedisPool 里借，用完自动归还（try-with-resources）。
 *
 * 小提示：真实项目里同一条数据只会选一种形式，Key 直接用 "user:{id}" 就够了。
 * 这里为了让两种方式能在同一个程序里同时演示，给 Key 分别加了 json / hash 前缀——
 * 否则同一个 Key 先当字符串、又当哈希使用，Redis 会直接报 WRONGTYPE 错误。
 */
public class RowCacheService {

    /** 缓存过期时间（秒）。作用：兜底，即使忘了删缓存，到点也会自动失效。 */
    private static final long TTL_SECONDS = 60 * 30L;

    private final JedisPool jedisPool;
    private final Gson gson = new Gson();

    public RowCacheService(JedisPool jedisPool) {
        this.jedisPool = jedisPool;
    }

    /** 方式一的 Key，例如 user:json:1001 */
    private static String jsonKey(long id) {
        return "user:json:" + id;
    }

    /** 方式二的 Key，例如 user:hash:1001 */
    private static String hashKey(long id) {
        return "user:hash:" + id;
    }

    // ==================== 方式一：String + JSON ====================

    /**
     * 把一整行数据序列化成 JSON 字符串，整体塞进 Redis 的 String 类型。
     */
    public void saveRowAsJson(User user) {
        String key = jsonKey(user.getId());
        // {"id":1001,"name":"张三","age":25,"phone":"13800001111"}
        String value = gson.toJson(user);
        try (Jedis jedis = jedisPool.getResource()) {
            // setex = set + expire，写入的同时设置过期时间
            jedis.setex(key, TTL_SECONDS, value);
        }
    }

    /** 读取：整体取出 JSON 字符串，再反序列化成 Java 对象。 */
    public User getRowFromJson(long id) {
        try (Jedis jedis = jedisPool.getResource()) {
            String value = jedis.get(jsonKey(id));
            return value == null ? null : gson.fromJson(value, User.class);
        }
    }

    // ==================== 方式二：Hash ====================

    /**
     * 把一行数据的每个字段，分别写进同一个 Redis Hash 的不同 field。
     * 相当于 Redis 里也存了一张“有列名的小表”。
     */
    public void saveRowAsHash(User user) {
        String key = hashKey(user.getId());
        Map<String, String> fields = new HashMap<>();
        fields.put("id", String.valueOf(user.getId()));
        fields.put("name", user.getName());
        fields.put("age", String.valueOf(user.getAge()));
        fields.put("phone", user.getPhone());

        try (Jedis jedis = jedisPool.getResource()) {
            // hset 一次性写入多个 field
            jedis.hset(key, fields);
            jedis.expire(key, TTL_SECONDS);
        }
    }

    /** 读取整行：HGETALL 一次把所有字段取回来，再拼成对象。 */
    public User getRowFromHash(long id) {
        try (Jedis jedis = jedisPool.getResource()) {
            Map<String, String> fields = jedis.hgetAll(hashKey(id));
            if (fields == null || fields.isEmpty()) {
                return null;
            }
            User u = new User();
            u.setId(Long.parseLong(fields.get("id")));
            u.setName(fields.get("name"));
            u.setAge(Integer.parseInt(fields.get("age")));
            u.setPhone(fields.get("phone"));
            return u;
        }
    }

    /** 只改一个字段（只改年龄）：Hash 方式最大的优势，不用把整行读出来再写回去。 */
    public void updateAgeInHash(long id, int newAge) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.hset(hashKey(id), "age", String.valueOf(newAge));
        }
    }

    /** 只取一个字段（只查年龄），不用把整行数据都拉回来。 */
    public Integer getAgeFromHash(long id) {
        try (Jedis jedis = jedisPool.getResource()) {
            String age = jedis.hget(hashKey(id), "age");
            return age == null ? null : Integer.valueOf(age);
        }
    }

    // ==================== 缓存失效 ====================

    /**
     * 删除缓存。MySQL 数据改完之后调用它（先改库、再删缓存），
     * 下次读取时发现缓存为空，会自动从 MySQL 重新加载最新数据。
     */
    public void evict(long id) {
        try (Jedis jedis = jedisPool.getResource()) {
            jedis.del(jsonKey(id), hashKey(id));
        }
    }
}
