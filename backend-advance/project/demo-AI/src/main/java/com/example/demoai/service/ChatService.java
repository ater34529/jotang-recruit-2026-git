package com.example.demoai.service;

import com.example.demoai.config.ChatProperties;
import com.example.demoai.config.LlmProperties;
import com.example.demoai.dto.ChatMessage;
import com.example.demoai.dto.ChatRequest;
import com.example.demoai.dto.ChatResponse;
import com.example.demoai.dto.Choice;
import com.example.demoai.dto.ToolCall;
import com.example.demoai.memory.ChatMemoryService;
import com.example.demoai.tool.ToolRegistry;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;

@Service
public class ChatService {

    private final LlmProperties llmProperties;
    private final ChatProperties chatProperties;
    private final ChatMemoryService chatMemory;
    private final ToolRegistry toolRegistry;
    private final RestClient restClient;

    public ChatService(LlmProperties llmProperties, ChatProperties chatProperties,
                       ChatMemoryService chatMemory, ToolRegistry toolRegistry) {
        this.llmProperties = llmProperties;
        this.chatProperties = chatProperties;
        this.chatMemory = chatMemory;
        this.toolRegistry = toolRegistry;
        // 用 Spring 内置的 RestClient 直接调 OpenAI 兼容接口
        this.restClient = RestClient.builder()
                .baseUrl(llmProperties.getBaseUrl())
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + llmProperties.getApiKey())
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    // 处理一次用户提问，返回 AI 的最终文本回复
    public String chat(String sessionId, String userMessage) {
        // 1) 用户消息进历史
        chatMemory.append(sessionId, ChatMessage.user(userMessage));

        int maxRounds = Math.max(1, chatProperties.getMaxToolRounds());

        // 2) Tool Use 主循环
        for (int round = 0; round < maxRounds; round++) {
            // 取当前会话完整历史，调用模型
            ChatResponse response = callModel(chatMemory.snapshot(sessionId));
            if (response == null || response.getChoices() == null || response.getChoices().isEmpty()) {
                return "（模型未返回有效内容）";
            }

            Choice choice = response.getChoices().get(0);
            ChatMessage assistantMsg = choice.getMessage();

            // 3) 把 assistant 消息进历史：
            //    若它带 tool_calls，这就是"AI 回复的 JSON"，按要求计入上下文
            chatMemory.append(sessionId, assistantMsg);

            List<ToolCall> toolCalls = assistantMsg.getToolCalls();
            if (toolCalls != null && !toolCalls.isEmpty()) {
                // 4) 执行每个工具，把"函数返回结果"也计入上下文
                for (ToolCall tc : toolCalls) {
                    String result = toolRegistry.execute(tc.getFunction());
                    chatMemory.append(sessionId, ChatMessage.tool(tc.getId(), result));
                }
                continue; // 带着新上下文再进循环，让模型基于结果作答
            }

            // 5) 没有工具调用 => 就是给用户的最终回复
            return assistantMsg.getContent();
        }

        return "（已达到最大工具调用轮数，仍未生成最终答复）";
    }

    private ChatResponse callModel(List<ChatMessage> messages) {
        ChatRequest request = new ChatRequest(
                llmProperties.getModel(), messages, toolRegistry.toolDefinitions(), "auto");
        return restClient.post()
                .uri(llmProperties.getChatPath())
                .body(request)
                .retrieve()
                .body(ChatResponse.class);
    }
}