package com.example.demoai.repository;

import com.example.demoai.entity.Note;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.util.List;

@Repository
public class NoteRepository {

    private final JdbcTemplate jdbcTemplate;

    // 构造器注入：Spring 会自动把配好的 JdbcTemplate 传进来
    public NoteRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // 把结果集的一行 -> 一个 Note 对象
    private final RowMapper<Note> rowMapper = (rs, rowNum) -> {
        Note note = new Note();
        note.setId(rs.getLong("id"));
        note.setTitle(rs.getString("title"));
        note.setContent(rs.getString("content"));
        note.setUserId(rs.getLong("user_id"));
        Timestamp ts = rs.getTimestamp("create_time");
        if (ts != null) {
            note.setCreateTime(ts.toLocalDateTime());
        }
        return note;
    };

    // 按 ID 查笔记全文；查不到返回 null
    public Note findById(Long id) {
        String sql = "select id, user_id, title, content, create_time from notes where id = ?";
        List<Note> list = jdbcTemplate.query(sql, rowMapper, id);
        return list.isEmpty() ? null : list.get(0);
    }
}