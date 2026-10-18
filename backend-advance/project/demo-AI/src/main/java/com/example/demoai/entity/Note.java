package com.example.demoai.entity;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class Note {
    private Long id;
    private String title;
    private String content;
    // 关联 user 表主键
    private Long userId;
    private LocalDateTime createTime;
}