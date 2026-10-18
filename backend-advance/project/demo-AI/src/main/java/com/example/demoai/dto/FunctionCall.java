package com.example.demoai.dto;

import lombok.Data;

@Data
public class FunctionCall {
    private String name;
    // 注意：arguments 是一个 JSON 字符串，例如 "{\"id\":1}"
    private String arguments;
}