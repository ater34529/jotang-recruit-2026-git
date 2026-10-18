package com.example.demouser.mapper;

import com.example.demouser.entity.Note;
import com.example.demouser.entity.User;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface UserMapper {
    // 1. 注册用户，插入后自增id回填到user.id
    int insertUser(User user);
    // 2. 插入笔记，userId需提前set
    int insertNotes(Note note);
    // 3. 按用户id查其所有笔记
    List<Note> selectNotesByUserId(Long userId);
    // 4. 登录校验：按用户名查密码
    String selectPasswordByUsername(String name);
}