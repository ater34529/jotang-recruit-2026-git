package com.example.demoai.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ToolCall {
    private String id;                 // 本次调用的唯一 id，后面 tool 结果要用它对应
    private String type = "function";  // OpenAI 协议固定值
    private FunctionCall function;     // 调哪个函数、传什么参数
}