package com.aisshtool.service;

import com.aisshtool.model.AiConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Service for AI command generation
 */
@Slf4j
@Service
public class AiService {

    private final CredentialService credentialService;
    private final ObjectMapper objectMapper;
    private final WebClient webClient;

    // System prompt for command generation
    private static final String SYSTEM_PROMPT = """
        你是一个 Linux/Unix 命令行专家助手。你的任务是根据用户的自然语言描述，生成最合适的 Shell 命令。

        ## 角色定义
        你是一位经验丰富的系统管理员和 DevOps 工程师，精通各种 Linux/Unix 命令，能够快速准确地理解用户需求并生成相应的命令。

        ## 工作原则
        1. **准确性优先**: 生成的命令必须准确无误，能够完成用户描述的任务
        2. **安全意识**: 对可能造成数据丢失或系统损坏的命令，必须给出明确警告
        3. **简洁高效**: 优先使用最简洁有效的命令，避免过度复杂化
        4. **兼容性考虑**: 默认使用常见的 Linux 命令，如有特殊要求需说明

        ## 输出格式
        你必须严格按照以下 JSON 格式输出，不要输出任何其他内容：
        ```json
        {
            "command": "具体要执行的命令",
            "explanation": "命令的简要说明（一句话描述命令的作用）",
            "riskLevel": "low/medium/high/critical",
            "warnings": ["警告信息1", "警告信息2"]
        }
        ```

        ## 风险级别说明
        - low: 只读操作，无风险
        - medium: 修改文件但可恢复
        - high: 可能导致数据丢失或服务中断
        - critical: 危险操作，如删除系统文件、格式化磁盘等

        ## 示例
        用户输入: "查找当前目录下最大的10个文件"
        输出:
        ```json
        {
            "command": "du -ah . | sort -rh | head -n 10",
            "explanation": "计算当前目录下所有文件大小，按大小降序排列并显示前10个",
            "riskLevel": "low",
            "warnings": []
        }
        ```

        用户输入: "删除所有日志文件"
        输出:
        ```json
        {
            "command": "find . -name '*.log' -type f -delete",
            "explanation": "查找当前目录及子目录下所有 .log 文件并删除",
            "riskLevel": "high",
            "warnings": ["此操作将永久删除文件，无法恢复", "建议先运行 find . -name '*.log' -type f 查看将要删除的文件"]
        }
        ```

        ## 注意事项
        1. 只输出 JSON，不要输出任何解释或额外文字
        2. 命令前不要加 $ 或其他提示符
        3. 对于危险操作，必须在 warnings 中给出明确提示
        4. 如果用户描述不清晰，生成最可能的命令并在 warnings 中说明假设条件
        """;

    public AiService(CredentialService credentialService) {
        this.credentialService = credentialService;
        this.objectMapper = new ObjectMapper();
        this.webClient = WebClient.builder().build();
    }

    /**
     * Generate command from natural language description
     */
    public Optional<ACommandResult> generateCommand(String userQuery) {
        // Get active AI config
        Optional<AiConfig> configOpt = credentialService.getActiveAiConfigWithApiKey();

        if (configOpt.isEmpty()) {
            log.warn("No active AI configuration found");
            return Optional.empty();
        }

        AiConfig config = configOpt.get();

        if (config.getApiKey() == null || config.getApiKey().isEmpty()) {
            log.warn("AI API key not configured");
            return Optional.empty();
        }

        try {
            return callAiApi(config, userQuery);
        } catch (Exception e) {
            log.error("Failed to call AI API: {}", e.getMessage(), e);
            return Optional.empty();
        }
    }

    private Optional<ACommandResult> callAiApi(AiConfig config, String userQuery) {
        try {
            String baseUrl = config.getBaseUrl();
            String model = config.getModel();
            String apiKey = config.getApiKey();

            // Build request body
            Map<String, Object> requestBody = Map.of(
                    "model", model,
                    "messages", List.of(
                            Map.of("role", "system", "content", SYSTEM_PROMPT),
                            Map.of("role", "user", "content", userQuery)
                    ),
                    "temperature", 0.3,
                    "max_tokens", 500
            );

            // Handle different providers
            String url = buildApiUrl(config);

            String response = webClient.post()
                    .uri(url)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            return parseResponse(response);

        } catch (Exception e) {
            log.error("AI API call failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private String buildApiUrl(AiConfig config) {
        String baseUrl = config.getBaseUrl();
        String providerId = config.getId();

        // Remove trailing slash
        if (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
        }

        // Most OpenAI-compatible APIs use /chat/completions
        return baseUrl + "/chat/completions";
    }

    private Optional<ACommandResult> parseResponse(String response) {
        try {
            JsonNode root = objectMapper.readTree(response);
            JsonNode choices = root.path("choices");

            if (choices.isArray() && choices.size() > 0) {
                String content = choices.get(0).path("message").path("content").asText();

                // Extract JSON from markdown code block if present
                content = extractJson(content);

                // Parse the result
                JsonNode result = objectMapper.readTree(content);

                return Optional.of(new ACommandResult(
                        result.path("command").asText(),
                        result.path("explanation").asText(""),
                        result.path("riskLevel").asText("low"),
                        parseWarnings(result.path("warnings"))
                ));
            }
        } catch (Exception e) {
            log.error("Failed to parse AI response: {}", e.getMessage());
        }
        return Optional.empty();
    }

    private String extractJson(String content) {
        // Remove markdown code block if present
        if (content.contains("```json")) {
            int start = content.indexOf("```json") + 7;
            int end = content.indexOf("```", start);
            if (end > start) {
                return content.substring(start, end).trim();
            }
        }
        if (content.contains("```")) {
            int start = content.indexOf("```") + 3;
            int end = content.indexOf("```", start);
            if (end > start) {
                return content.substring(start, end).trim();
            }
        }
        return content.trim();
    }

    private List<String> parseWarnings(JsonNode warningsNode) {
        if (warningsNode.isArray()) {
            return objectMapper.convertValue(warningsNode, List.class);
        }
        return List.of();
    }

    /**
     * Result of AI command generation
     */
    public record ACommandResult(
            String command,
            String explanation,
            String riskLevel,
            List<String> warnings
    ) {}
}