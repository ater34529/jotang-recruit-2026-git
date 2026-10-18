package com.example.demorabbitmq.producer;

import com.example.demorabbitmq.config.RabbitMQConfig;
import com.example.demorabbitmq.dto.TaskMessage;
import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TaskProducer {

    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;

    public TaskMessage submit(String type, String content) {
        TaskMessage message = new TaskMessage(
                UUID.randomUUID().toString(),
                type,
                content,
                System.currentTimeMillis()
        );
        try {
            String json = objectMapper.writeValueAsString(message);
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.TASK_EXCHANGE,
                    RabbitMQConfig.TASK_ROUTING_KEY,
                    json
            );
            log.info("消息已投递: taskId={}", message.getTaskId());
        } catch (Exception e) {
            throw new RuntimeException("消息投递失败", e);
        }
        return message;
    }
}