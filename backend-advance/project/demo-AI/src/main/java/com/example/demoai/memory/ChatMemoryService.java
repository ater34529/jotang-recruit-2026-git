package com.example.demoai.memory;

import com.example.demoai.config.ChatProperties;
import com.example.demoai.dto.ChatMessage;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ChatMemoryService {

    // key = sessionId，value = 该会话的完整消息历史（含 user/assistant/tool 全部角色）
    private final Map<String, List<ChatMessage>> sessions = new ConcurrentHashMap<>();

    private final ChatProperties chatProperties;

    public ChatMemoryService(ChatProperties chatProperties) {
        this.chatProperties = chatProperties;
    }

    // 会话的系统提示：告诉模型它是笔记助手、可以调用工具
    private static final String SYSTEM_PROMPT =
            "你是一个笔记助手。当用户想查看某篇笔记的具体内容时，请调用 get_note_by_id 工具，" +
                    "参数 id 为笔记的整数编号。请根据工具返回的笔记内容再作答，用中文回复。";

    // 获取（或首次创建）某会话的消息列表；创建时把 system 提示放在最前面
    private List<ChatMessage> getOrCreate(String sessionId) {
        return sessions.computeIfAbsent(sessionId, id -> {
            List<ChatMessage> list = new ArrayList<>();
            list.add(ChatMessage.system(SYSTEM_PROMPT));
            return list;
        });
    }

    // 追加一条消息进历史（Tool Use 循环里，assistant 的 tool_calls、tool 的结果都通过它落库）
    public void append(String sessionId, ChatMessage message) {
        List<ChatMessage> list = getOrCreate(sessionId);
        synchronized (list) {   // 对同一会话的写操作串行化，避免并发下历史错乱
            list.add(message);
            trim(list);
        }
    }

    // 取一份历史快照（拷贝），用来发给模型；拷贝出去可避免遍历时被并发修改
    public List<ChatMessage> snapshot(String sessionId) {
        List<ChatMessage> list = getOrCreate(sessionId);
        synchronized (list) {
            return new ArrayList<>(list);
        }
    }

    // 超出上限就丢弃最旧的非 system 消息（索引 0 永远是 system，要保留）
    private void trim(List<ChatMessage> list) {
        int max = chatProperties.getMaxHistoryMessages();
        if (max <= 0) {
            return;
        }
        while (list.size() > max && list.size() > 1) {
            list.remove(1);
        }
    }
}