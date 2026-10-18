package com.example.demoredis.service;

import com.example.demoredis.entity.Note;
import com.example.demoredis.mapper.NoteMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
public class NoteService {

    private static final String CACHE_PREFIX = "note::";
    private static final long CACHE_TTL_MINUTES = 30;

    @Autowired
    private NoteMapper noteMapper;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    // 读：先查缓存，命中直接返回；未命中查库并回填缓存
    public Note getById(Long id) {
        String key = CACHE_PREFIX + id;
        Object cached = redisTemplate.opsForValue().get(key);
        if (cached != null) {
            return (Note) cached;
        }
        Note note = noteMapper.selectById(id);
        if (note != null) {
            redisTemplate.opsForValue().set(key, note, CACHE_TTL_MINUTES, TimeUnit.MINUTES);
        }
        return note;
    }

    public List<Note> getAll() {
        return noteMapper.selectAll();
    }

    // 增：新数据没有旧缓存，落库即可
    public int add(Note note) {
        return noteMapper.insert(note);
    }

    // 改：先更新数据库，再删缓存（Cache Aside）
    public int update(Note note) {
        int rows = noteMapper.updateById(note);
        redisTemplate.delete(CACHE_PREFIX + note.getId());
        return rows;
    }

    // 删：先删数据库，再删缓存
    public int delete(Long id) {
        int rows = noteMapper.deleteById(id);
        redisTemplate.delete(CACHE_PREFIX + id);
        return rows;
    }
}