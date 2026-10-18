package com.example.demorabbitmq.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TaskMessage {
    private String taskId;
    private String type;
    private String content;
    private long createTime;
}