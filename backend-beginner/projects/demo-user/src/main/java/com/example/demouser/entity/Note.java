package com.example.demouser.entity;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class Note {
    // notes表自增主键
    private Long id;
    private String title;
    private String content;
    // 关联user表主键，类型要和User.id一致
    private Long userId;
    private LocalDateTime createTime;
}