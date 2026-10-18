package com.example.demouser.entity;

import lombok.Data;

@Data
public class User {
    // 对应用户表主键id
    private Long id;
    // 对应用户表姓名字段name
    private String name;
    // 对应用户表密码字段password
    private String password;
}
