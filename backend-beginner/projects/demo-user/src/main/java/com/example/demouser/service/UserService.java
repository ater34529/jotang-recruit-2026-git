package com.example.demouser.service;

import com.example.demouser.entity.Note;
import com.example.demouser.entity.User;
import com.example.demouser.mapper.UserMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service  // 注解①：告诉Spring"这是个干活的类，启动时帮我创建一个实例管起来"
public class UserService {

    @Autowired  // 注解②：告诉Spring"把UserMapper的实例自动塞给我，我用它调数据库"
    private UserMapper userMapper;

    // 注册：插用户 → 拿回填id → 插笔记。加@Transactional表示这两步要么全成功要么全失败
    @Transactional
    public Long register(String name, String password, String title, String content) {
        // 第1步：组装User对象
        User user = new User();
        user.setName(name);
        user.setPassword(password);
        // 调用你在XML里写的 insertUser 那条SQL
        userMapper.insertUser(user);
        // ★关键时刻：上一步XML里的 useGeneratedKeys 生效了，数据库生成的自增id已经装进user.getId()

        // 第2步：组装Note对象，把刚拿到的用户id关联进去
        Note note = new Note();
        note.setUserId(user.getId());  // ← 还记得板块1注释里"后面插主表要用到user.id"吗？就是这里！
        note.setTitle(title);
        note.setContent(content);
        userMapper.insertNotes(note);

        // 把新用户id返回，方便测试
        return user.getId();
    }

    // 登录：查密码比对
    public boolean login(String name, String password) {
        String realPassword = userMapper.selectPasswordByUsername(name);
        // realPassword可能是null（用户不存在），必须先判空，否则会空指针报错
        if (realPassword == null) {
            return false;
        }
        return realPassword.equals(password);
    }

    // 查某人的所有笔记
    public List<Note> getNotes(Long userId) {
        return userMapper.selectNotesByUserId(userId);
    }
}
