package com.example.demoredis.mapper;

import com.example.demoredis.entity.Note;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface NoteMapper {
    // 按id查单条
    Note selectById(Long id);
    // 查全部
    List<Note> selectAll();
    // 新增，插入后自增id回填到note.id
    int insert(Note note);
    // 按id更新
    int updateById(Note note);
    // 按id删除
    int deleteById(Long id);
}