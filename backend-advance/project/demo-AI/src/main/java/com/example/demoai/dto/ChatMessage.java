package com.example.demoai.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)        // null 字段不序列化进 JSON（协议里没有的键就别输出）
@JsonIgnoreProperties(ignoreUnknown = true)       // 解析模型返回时，多余字段直接忽略，容错
public class ChatMessage {

    private String role;        // system / user / assistant / tool
    private String content;     // 文本内容；assistant 发起工具调用时这里可能是 null

    // 仅 assistant 消息有：模型要求调用的工具列表（即"AI 回复的 JSON"）
    @JsonProperty("tool_calls")
    private List<ToolCall> toolCalls;

    // 仅 tool 消息有：这条结果对应哪次工具调用
    @JsonProperty("tool_call_id")
    private String toolCallId;

    public ChatMessage() {
    }

    private ChatMessage(String role, String content) {
        this.role = role;
        this.content = content;
    }

    // 便捷工厂方法，后面到处用得上
    public static ChatMessage system(String content)   { return new ChatMessage("system", content); }
    public static ChatMessage user(String content)     { return new ChatMessage("user", content); }
    public static ChatMessage assistant(String content){ return new ChatMessage("assistant", content); }

    // tool 结果消息：内容为工具返回的文本，并带上对应的 call id
    public static ChatMessage tool(String toolCallId, String content) {
        ChatMessage m = new ChatMessage("tool", content);
        m.setToolCallId(toolCallId);
        return m;
    }
}