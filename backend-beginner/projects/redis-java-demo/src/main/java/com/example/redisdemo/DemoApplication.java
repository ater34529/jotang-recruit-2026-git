package com.example.redisdemo;

import com.example.redisdemo.model.User;
import com.example.redisdemo.service.RowCacheService;
import redis.clients.jedis.JedisPool;
import redis.clients.jedis.JedisPoolConfig;

import java.time.Duration;

/**
 * 程序入口：完整演示「把 MySQL 的一行数据缓存到 Redis」的两种形式。
 *
 * 运行前请确保本机有一个 Redis 在 127.0.0.1:6379 上运行。
 */
public class DemoApplication {

    public static void main(String[] args) {

        // ---------- 第 1 步：配置连接池 ----------
        JedisPoolConfig config = new JedisPoolConfig();
        config.setMaxTotal(16);                        // 池里最多 16 个连接
        config.setMaxIdle(16);                         // 最多空闲 16 个
        config.setMinIdle(2);                          // 至少保持 2 个空闲连接
        config.setMaxWait(Duration.ofMillis(2000));    // 借不到连接时最多等 2 秒

        // ---------- 第 2 步：创建连接池（Jedis 通过它拿到连接）----------
        // 参数按你自己的 Redis 地址改：config, host, port, [password]
        try (JedisPool jedisPool = new JedisPool(config, "127.0.0.1", 6379)) {

            RowCacheService cache = new RowCacheService(jedisPool);

            // 假装这是从 MySQL 里查出来的一行数据
            User row = new User(1001L, "张三", 25, "13800001111");
            System.out.println("1) MySQL 里查出来的一行数据 -> " + row);

            // 方式一：String + JSON
            cache.saveRowAsJson(row);
            System.out.println("2) [String+JSON] 写进去再读回来 -> " + cache.getRowFromJson(1001));

            // 方式二：Hash
            cache.saveRowAsHash(row);
            System.out.println("3) [Hash]        写进去再读回来 -> " + cache.getRowFromHash(1001));

            // Hash 的杀手锏：只改一个字段
            cache.updateAgeInHash(1001, 26);
            System.out.println("4) [Hash] 只改年龄后读回来 -> " + cache.getRowFromHash(1001));
            System.out.println("   [Hash] 只取年龄字段     -> " + cache.getAgeFromHash(1001));

            // 改完 MySQL 后删缓存，让下次读取自动加载最新数据
            cache.evict(1001);
            System.out.println("5) 删除缓存后再读 JSON -> " + cache.getRowFromJson(1001) + "（null 表示缓存已失效）");
        }
    }
}
