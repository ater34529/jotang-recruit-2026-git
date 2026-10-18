package com.example.demorabbitmq.controller;

import com.example.demorabbitmq.dto.TaskMessage;
import com.example.demorabbitmq.producer.TaskProducer;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskProducer taskProducer;

    @PostMapping
    public Map<String, Object> submitTask(@RequestParam String type,
                                          @RequestParam String content) {
        TaskMessage message = taskProducer.submit(type, content);
        return Map.of(
                "code", 200,
                "message", "任务已提交,正在后台处理",
                "taskId", message.getTaskId()
        );
    }
}
