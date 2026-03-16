package com.aisshtool.service;

import com.aisshtool.model.AiConfig;
import com.aisshtool.model.CommandHint;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.ArrayList;
import java.util.function.Consumer;

/**
 * Service for AI command generation with streaming support
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
     * Generate command from natural language description (non-streaming)
     */
    public Optional<ACommandResult> generateCommand(String userQuery) {
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

    /**
     * Generate command with streaming output
     * @param userQuery The user's question
     * @param onProgress Callback for streaming progress (receives partial text)
     * @param onComplete Callback when complete (receives final result)
     * @param onError Callback on error
     */
    public void generateCommandStreaming(
            String userQuery,
            Consumer<String> onProgress,
            Consumer<ACommandResult> onComplete,
            Consumer<String> onError
    ) {
        Optional<AiConfig> configOpt = credentialService.getActiveAiConfigWithApiKey();

        if (configOpt.isEmpty()) {
            onError.accept("未配置 AI 模型");
            return;
        }

        AiConfig config = configOpt.get();

        if (config.getApiKey() == null || config.getApiKey().isEmpty()) {
            onError.accept("未配置 API 密钥");
            return;
        }

        try {
            callAiApiStreaming(config, userQuery, onProgress, onComplete, onError);
        } catch (Exception e) {
            log.error("Failed to call AI API: {}", e.getMessage(), e);
            onError.accept("调用 AI API 失败: " + e.getMessage());
        }
    }

    private Optional<ACommandResult> callAiApi(AiConfig config, String userQuery) {
        try {
            String baseUrl = config.getBaseUrl();
            String model = config.getModel();
            String apiKey = config.getApiKey();

            Map<String, Object> requestBody = Map.of(
                    "model", model,
                    "messages", List.of(
                            Map.of("role", "system", "content", SYSTEM_PROMPT),
                            Map.of("role", "user", "content", userQuery)
                    ),
                    "temperature", 0.3,
                    "max_tokens", 500
            );

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

    private void callAiApiStreaming(
            AiConfig config,
            String userQuery,
            Consumer<String> onProgress,
            Consumer<ACommandResult> onComplete,
            Consumer<String> onError
    ) {
        String url = buildApiUrl(config);
        String apiKey = config.getApiKey();
        String model = config.getModel();

        // Build streaming request
        Map<String, Object> requestBody = Map.of(
                "model", model,
                "messages", List.of(
                        Map.of("role", "system", "content", SYSTEM_PROMPT),
                        Map.of("role", "user", "content", userQuery)
                ),
                "temperature", 0.3,
                "max_tokens", 500,
                "stream", true
        );

        StringBuilder fullContent = new StringBuilder();

        webClient.post()
                .uri(url)
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToFlux(String.class)
                .doOnNext(chunk -> {
                    // Parse SSE data
                    if (chunk.startsWith("data: ")) {
                        String data = chunk.substring(6).trim();
                        if (data.equals("[DONE]")) {
                            return;
                        }
                        try {
                            JsonNode root = objectMapper.readTree(data);
                            JsonNode delta = root.path("choices").get(0).path("delta");
                            String content = delta.path("content").asText("");
                            if (!content.isEmpty()) {
                                fullContent.append(content);
                                onProgress.accept(content);
                            }
                        } catch (Exception e) {
                            log.debug("Failed to parse chunk: {}", e.getMessage());
                        }
                    }
                })
                .doOnComplete(() -> {
                    // Parse the final result
                    try {
                        String content = extractJson(fullContent.toString());
                        JsonNode result = objectMapper.readTree(content);

                        ACommandResult commandResult = new ACommandResult(
                                result.path("command").asText(),
                                result.path("explanation").asText(""),
                                result.path("riskLevel").asText("low"),
                                parseWarnings(result.path("warnings"))
                        );
                        onComplete.accept(commandResult);
                    } catch (Exception e) {
                        log.error("Failed to parse final result: {}", e.getMessage());
                        // If parsing fails, try to extract command from raw content
                        onError.accept("AI 响应解析失败");
                    }
                })
                .doOnError(error -> {
                    log.error("Streaming error: {}", error.getMessage());
                    onError.accept("AI API 调用失败: " + error.getMessage());
                })
                .subscribe();
    }

    private String buildApiUrl(AiConfig config) {
        String baseUrl = config.getBaseUrl();

        if (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
        }

        return baseUrl + "/chat/completions";
    }

    private Optional<ACommandResult> parseResponse(String response) {
        try {
            JsonNode root = objectMapper.readTree(response);
            JsonNode choices = root.path("choices");

            if (choices.isArray() && choices.size() > 0) {
                String content = choices.get(0).path("message").path("content").asText();
                content = extractJson(content);
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

    /**
     * Result of command output analysis
     */
    public record FollowUpResult(
            boolean success,
            String summary,
            boolean followUpNeeded,
            String suggestion,
            String followUpCommand,
            String reason
    ) {}

    // System prompt for command output analysis
    private static final String OUTPUT_ANALYSIS_PROMPT = """
        你是一个 Linux 命令行助手。分析命令执行结果，判断命令是否成功执行，并给出后续建议。

        ## 输出格式
        你必须严格按照以下 JSON 格式输出，不要输出任何其他内容：
        ```json
        {
            "success": true/false,
            "summary": "执行结果摘要（一句话）",
            "followUpNeeded": true/false,
            "suggestion": "后续建议（如需要）",
            "followUpCommand": "后续建议命令（如需要，不要加$前缀）",
            "reason": "建议原因"
        }
        ```

        ## 分析要点
        1. 检查命令输出中是否有错误信息
        2. 判断命令是否成功完成
        3. 如果有错误，给出解决建议
        4. 如果需要后续操作，给出建议命令

        ## 示例
        命令: apt update
        输出: ... Get:1 http://archive.ubuntu.com/ubuntu jammy InRelease ... Done.
        结果:
        ```json
        {
            "success": true,
            "summary": "软件包列表已成功更新",
            "followUpNeeded": true,
            "suggestion": "可以升级已安装的软件包",
            "followUpCommand": "apt upgrade -y",
            "reason": "更新后通常需要升级软件包"
        }
        ```

        命令: ls /nonexistent
        输出: ls: cannot access '/nonexistent': No such file or directory
        结果:
        ```json
        {
            "success": false,
            "summary": "目录不存在",
            "followUpNeeded": false,
            "suggestion": "检查路径是否正确，或创建该目录",
            "followUpCommand": "",
            "reason": ""
        }
        ```
        """;

    // System prompt for command hints
    private static final String COMMAND_HINT_PROMPT = """
        你是一个 Linux 命令行助手。根据用户输入的部分命令，提供可能的命令补全建议。

        ## 输出格式
        你必须严格按照以下 JSON 格式输出，不要输出任何其他内容：
        ```json
        {
            "hints": [
                {"command": "完整命令", "description": "命令说明"},
                ...
            ]
        }
        ```

        ## 规则
        1. 提供 3-5 个最相关的命令补全
        2. 每个建议包含完整命令和简短说明
        3. 按相关性排序
        4. 如果是子命令，只显示子命令部分

        ## 示例
        输入: sudo apt
        输出:
        ```json
        {
            "hints": [
                {"command": "sudo apt update", "description": "更新软件包数据库"},
                {"command": "sudo apt upgrade", "description": "升级所有可升级的软件包"},
                {"command": "sudo apt install <package>", "description": "安装指定软件包"},
                {"command": "sudo apt remove <package>", "description": "移除软件包"},
                {"command": "sudo apt search <keyword>", "description": "搜索软件包"}
            ]
        }
        ```

        输入: docker
        输出:
        ```json
        {
            "hints": [
                {"command": "docker ps", "description": "列出运行中的容器"},
                {"command": "docker images", "description": "列出本地镜像"},
                {"command": "docker run <image>", "description": "运行容器"},
                {"command": "docker exec -it <container> bash", "description": "进入容器终端"},
                {"command": "docker logs <container>", "description": "查看容器日志"}
            ]
        }
        ```
        """;

    /**
     * Analyze command output and provide follow-up suggestions
     */
    public void analyzeCommandOutput(
            String command,
            String output,
            Consumer<String> onProgress,
            Consumer<FollowUpResult> onComplete,
            Consumer<String> onError
    ) {
        Optional<AiConfig> configOpt = credentialService.getActiveAiConfigWithApiKey();

        if (configOpt.isEmpty()) {
            onError.accept("未配置 AI 模型");
            return;
        }

        AiConfig config = configOpt.get();

        if (config.getApiKey() == null || config.getApiKey().isEmpty()) {
            onError.accept("未配置 API 密钥");
            return;
        }

        try {
            String userMessage = String.format("命令: %s\n输出:\n%s", command, output);
            callAiApiForAnalysis(config, userMessage, onProgress, onComplete, onError);
        } catch (Exception e) {
            log.error("Failed to analyze command output: {}", e.getMessage(), e);
            onError.accept("分析命令输出失败: " + e.getMessage());
        }
    }

    /**
     * Get command hints for partial input
     */
    public void getCommandHints(
            String partialCommand,
            Consumer<List<CommandHint>> onComplete,
            Consumer<String> onError
    ) {
        Optional<AiConfig> configOpt = credentialService.getActiveAiConfigWithApiKey();

        if (configOpt.isEmpty()) {
            onError.accept("未配置 AI 模型");
            return;
        }

        AiConfig config = configOpt.get();

        if (config.getApiKey() == null || config.getApiKey().isEmpty()) {
            onError.accept("未配置 API 密钥");
            return;
        }

        try {
            callAiApiForHints(config, partialCommand, onComplete, onError);
        } catch (Exception e) {
            log.error("Failed to get command hints: {}", e.getMessage(), e);
            onError.accept("获取命令提示失败: " + e.getMessage());
        }
    }

    private void callAiApiForAnalysis(
            AiConfig config,
            String userMessage,
            Consumer<String> onProgress,
            Consumer<FollowUpResult> onComplete,
            Consumer<String> onError
    ) {
        String url = buildApiUrl(config);
        String apiKey = config.getApiKey();
        String model = config.getModel();

        Map<String, Object> requestBody = Map.of(
                "model", model,
                "messages", List.of(
                        Map.of("role", "system", "content", OUTPUT_ANALYSIS_PROMPT),
                        Map.of("role", "user", "content", userMessage)
                ),
                "temperature", 0.3,
                "max_tokens", 500,
                "stream", true
        );

        StringBuilder fullContent = new StringBuilder();

        webClient.post()
                .uri(url)
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToFlux(String.class)
                .doOnNext(chunk -> {
                    if (chunk.startsWith("data: ")) {
                        String data = chunk.substring(6).trim();
                        if (data.equals("[DONE]")) {
                            return;
                        }
                        try {
                            JsonNode root = objectMapper.readTree(data);
                            JsonNode delta = root.path("choices").get(0).path("delta");
                            String content = delta.path("content").asText("");
                            if (!content.isEmpty()) {
                                fullContent.append(content);
                                onProgress.accept(content);
                            }
                        } catch (Exception e) {
                            log.debug("Failed to parse chunk: {}", e.getMessage());
                        }
                    }
                })
                .doOnComplete(() -> {
                    try {
                        String content = extractJson(fullContent.toString());
                        JsonNode result = objectMapper.readTree(content);

                        FollowUpResult followUpResult = new FollowUpResult(
                                result.path("success").asBoolean(true),
                                result.path("summary").asText(""),
                                result.path("followUpNeeded").asBoolean(false),
                                result.path("suggestion").asText(""),
                                result.path("followUpCommand").asText(""),
                                result.path("reason").asText("")
                        );
                        onComplete.accept(followUpResult);
                    } catch (Exception e) {
                        log.error("Failed to parse analysis result: {}", e.getMessage());
                        onError.accept("解析分析结果失败");
                    }
                })
                .doOnError(error -> {
                    log.error("Analysis API error: {}", error.getMessage());
                    onError.accept("分析 API 调用失败: " + error.getMessage());
                })
                .subscribe();
    }

    private void callAiApiForHints(
            AiConfig config,
            String partialCommand,
            Consumer<List<CommandHint>> onComplete,
            Consumer<String> onError
    ) {
        String url = buildApiUrl(config);
        String apiKey = config.getApiKey();
        String model = config.getModel();

        Map<String, Object> requestBody = Map.of(
                "model", model,
                "messages", List.of(
                        Map.of("role", "system", "content", COMMAND_HINT_PROMPT),
                        Map.of("role", "user", "content", partialCommand)
                ),
                "temperature", 0.3,
                "max_tokens", 500
        );

        try {
            String response = webClient.post()
                    .uri(url)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            List<CommandHint> hints = parseHintsResponse(response);
            onComplete.accept(hints);
        } catch (Exception e) {
            log.error("Failed to get hints: {}", e.getMessage());
            onError.accept("获取提示失败: " + e.getMessage());
        }
    }

    private List<CommandHint> parseHintsResponse(String response) {
        try {
            JsonNode root = objectMapper.readTree(response);
            JsonNode choices = root.path("choices");

            if (choices.isArray() && choices.size() > 0) {
                String content = choices.get(0).path("message").path("content").asText();
                content = extractJson(content);
                JsonNode result = objectMapper.readTree(content);
                JsonNode hintsNode = result.path("hints");

                if (hintsNode.isArray()) {
                    List<CommandHint> hints = new ArrayList<>();
                    for (JsonNode hintNode : hintsNode) {
                        hints.add(new CommandHint(
                                hintNode.path("command").asText(),
                                hintNode.path("description").asText("")
                        ));
                    }
                    return hints;
                }
            }
        } catch (Exception e) {
            log.error("Failed to parse hints response: {}", e.getMessage());
        }
        return List.of();
    }
}