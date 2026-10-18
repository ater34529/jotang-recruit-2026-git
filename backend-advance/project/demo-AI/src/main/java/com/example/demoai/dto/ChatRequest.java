package com.example.demoai.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatRequest {
    private String model;
    private List<ChatMessage> messages;              // 完整对话历史（含工具JSON/结果）
    private List<Map<String, Object>> tools;         // 工具定义
    @JsonProperty("tool_choice")
    private String toolChoice;                       // "auto" 让模型自己决定是否调用

    public ChatRequest(String model, List<ChatMessage> messages,
                       List<Map<String, Object>> tools, String toolChoice) {
        this.model = model;
        this.messages = messages;
        this.tools = tools;
        this.toolChoice = toolChoice;
    }
}