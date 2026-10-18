package com.example.demorabbitmq.consumer;

import com.example.demorabbitmq.config.RabbitMQConfig;
import com.example.demorabbitmq.dto.TaskMessage;
import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class TaskConsumer {

    private final ObjectMapper objectMapper;

    @RabbitListener(queues = RabbitMQConfig.TASK_QUEUE)
    public void handleTask(String json) throws Exception {
        TaskMessage message = objectMapper.readValue(json, TaskMessage.class);
        log.info("收到任务: taskId={}, type={}, content={}, 排队耗时={}ms",
                message.getTaskId(), message.getType(), message.getContent(),
                System.currentTimeMillis() - message.getCreateTime());

        try {
            TimeUnit.SECONDS.sleep(5);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        log.info("任务完成: taskId={}", message.getTaskId());
    }
}