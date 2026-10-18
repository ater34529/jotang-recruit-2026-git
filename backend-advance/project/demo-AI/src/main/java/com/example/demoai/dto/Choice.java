package com.example.demoai.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class Choice {
    private ChatMessage message;
    @JsonProperty("finish_reason")
    private String finishReason;   // "tool_calls" 表示要调工具，"stop" 表示最终回复
}