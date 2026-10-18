package com.example.demoai.controller;

import com.example.demoai.dto.ChatQuery;
import com.example.demoai.service.ChatService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/chat")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping
    public Map<String, Object> chat(@RequestBody ChatQuery query) {
        // sessionId 没传就用一个默认会话，方便测试
        String sessionId = (query.getSessionId() == null || query.getSessionId().isBlank())
                ? "default" : query.getSessionId();

        String reply = chatService.chat(sessionId, query.getMessage());

        Map<String, Object> body = new HashMap<>();
        body.put("sessionId", sessionId);
        body.put("reply", reply);
        return body;   // 由 Jackson 自动转成 JSON 返回
    }
}