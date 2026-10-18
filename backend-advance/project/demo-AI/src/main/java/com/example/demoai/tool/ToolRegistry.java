package com.example.demoai.tool;

import com.example.demoai.dto.FunctionCall;
import com.example.demoai.entity.Note;
import com.example.demoai.repository.NoteRepository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class ToolRegistry {

    private final NoteRepository noteRepository;
    private final ObjectMapper objectMapper;

    public ToolRegistry(NoteRepository noteRepository, ObjectMapper objectMapper) {
        this.noteRepository = noteRepository;
        this.objectMapper = objectMapper;
    }

    // ===== ① 工具定义：发给模型的 tools 数组（OpenAI 兼容的 function schema）=====
    public List<Map<String, Object>> toolDefinitions() {
        // 参数 id 的类型说明
        Map<String, Object> idProp = Map.of(
                "type", "integer",
                "description", "笔记的唯一ID"
        );
        // 参数整体是一个 object，包含必填的 id
        Map<String, Object> parameters = Map.of(
                "type", "object",
                "properties", Map.of("id", idProp),
                "required", List.of("id")
        );
        // function 定义
        Map<String, Object> function = new LinkedHashMap<>();
        function.put("name", "get_note_by_id");
        function.put("description", "根据笔记ID查询该笔记的标题与正文全文");
        function.put("parameters", parameters);

        Map<String, Object> tool = new LinkedHashMap<>();
        tool.put("type", "function");
        tool.put("function", function);

        return List.of(tool);
    }

    // ===== ② 工具执行：根据模型返回的 tool_call 真正执行，返回结果文本 =====
    public String execute(FunctionCall functionCall) {
        String name = functionCall.getName();
        String arguments = functionCall.getArguments(); // 是个 JSON 字符串，如 {"id":1}

        if ("get_note_by_id".equals(name)) {
            try {
                JsonNode args = objectMapper.readTree(
                        (arguments == null || arguments.isBlank()) ? "{}" : arguments);
                JsonNode idNode = args.get("id");
                if (idNode == null || idNode.isNull()) {
                    return "{\"error\":\"缺少参数 id\"}";
                }
                long id = idNode.asLong();
                Note note = noteRepository.findById(id);
                if (note == null) {
                    return "{\"error\":\"未找到 id 为 " + id + " 的笔记\"}";
                }
                // 把整篇笔记（含正文全文）序列化成 JSON，作为工具结果回传给模型
                return objectMapper.writeValueAsString(note);
            } catch (Exception e) {
                return "{\"error\":\"工具执行失败: " + e.getMessage() + "\"}";
            }
        }
        return "{\"error\":\"未知工具: " + name + "\"}";
    }
}