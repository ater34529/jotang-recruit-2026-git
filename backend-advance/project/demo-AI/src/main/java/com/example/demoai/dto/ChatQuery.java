package com.example.demoai.dto;

import lombok.Data;

@Data
public class ChatQuery {
    private String sessionId;   // 会话标识，同一个 id 就是同一段对话
    private String message;     // 用户这次说的话
}