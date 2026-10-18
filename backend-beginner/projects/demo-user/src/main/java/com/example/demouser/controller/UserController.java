package com.example.demouser.controller;

import com.example.demouser.entity.Note;
import com.example.demouser.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController  // 注解③：这是接单员，返回值自动转成JSON给浏览器
@RequestMapping("/user")  // 本类所有URL都以 /user 开头
public class UserController {

    @Autowired
    private UserService userService;  // Spring自动把仓库里的UserService塞过来

    // POST /user/register?name=张三&password=123&title=第一篇&content=你好
    @PostMapping("/register")
    public String register(@RequestParam String name,
                           @RequestParam String password,
                           @RequestParam String title,
                           @RequestParam String content) {
        Long userId = userService.register(name, password, title, content);
        return "注册成功，新用户id=" + userId;
    }

    // POST /user/login?name=张三&password=123
    @PostMapping("/login")
    public String login(@RequestParam String name, @RequestParam String password) {
        boolean ok = userService.login(name, password);
        return ok ? "登录成功" : "账号或密码错误";
    }

    // GET /user/notes?userId=1
    @GetMapping("/notes")
    public List<Note> notes(@RequestParam Long userId) {
        return userService.getNotes(userId);
    }
}