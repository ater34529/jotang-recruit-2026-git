package com.example.demoai.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "chat")
public class ChatProperties {
    private int maxHistoryMessages = 50;
    private int maxToolRounds = 5;
}