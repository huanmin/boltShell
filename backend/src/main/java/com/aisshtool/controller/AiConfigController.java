package com.aisshtool.controller;

import com.aisshtool.model.AiConfig;
import com.aisshtool.model.ApiResult;
import com.aisshtool.service.CredentialService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * REST Controller for AI configuration management
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ai-config")
@RequiredArgsConstructor
public class AiConfigController {

    private final CredentialService credentialService;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /**
     * Get all AI configurations
     */
    @GetMapping
    public ApiResult<List<AiConfig>> getAiConfigs() {
        return ApiResult.success(credentialService.getAiConfigs());
    }

    /**
     * Get active model provider
     */
    @GetMapping("/active")
    public ApiResult<Map<String, String>> getActiveModelProvider() {
        String active = credentialService.getActiveModelProvider();
        return ApiResult.success(Map.of("provider", active != null ? active : ""));
    }

    /**
     * Set active model provider
     */
    @PutMapping("/active/{providerId}")
    public ApiResult<Void> setActiveModelProvider(@PathVariable String providerId) {
        credentialService.setActiveModelProvider(providerId);
        return ApiResult.success(null);
    }

    /**
     * Get AI configuration by provider ID
     */
    @GetMapping("/{providerId}")
    public ApiResult<AiConfig> getAiConfig(@PathVariable String providerId) {
        return credentialService.getAiConfig(providerId)
                .map(ApiResult::success)
                .orElse(ApiResult.success(null));
    }

    /**
     * Save AI configuration
     */
    @PutMapping
    public ApiResult<AiConfig> saveAiConfig(@RequestBody AiConfig config) {
        try {
            AiConfig saved = credentialService.saveAiConfig(config);
            return ApiResult.success(saved);
        } catch (Exception e) {
            log.error("Failed to save AI config: {}", e.getMessage());
            return ApiResult.error(com.aisshtool.model.ErrorCode.INTERNAL_ERROR, e.getMessage());
        }
    }

    /**
     * Delete AI configuration
     */
    @DeleteMapping("/{providerId}")
    public ApiResult<Void> deleteAiConfig(@PathVariable String providerId) {
        boolean deleted = credentialService.deleteAiConfig(providerId);
        return deleted ? ApiResult.success(null) : ApiResult.error(com.aisshtool.model.ErrorCode.PARAM_ERROR, "配置不存在");
    }

    /**
     * Test AI configuration
     */
    @PostMapping("/test")
    public ApiResult<TestResult> testAiConfig(@RequestBody TestRequest request) {
        try {
            String providerId = request.getProviderId();
            String baseUrl = request.getBaseUrl();
            String model = request.getModel();
            String apiKey = request.getApiKey();

            if (apiKey == null || apiKey.isEmpty()) {
                // Try to get from saved config
                apiKey = credentialService.getAiConfigWithApiKey(providerId)
                        .map(AiConfig::getApiKey)
                        .orElse(null);
            }

            if (apiKey == null || apiKey.isEmpty()) {
                return ApiResult.error(com.aisshtool.model.ErrorCode.AI_CONFIG_MISSING, "请提供 API 密钥");
            }

            // Test connection based on provider
            TestResult result = switch (providerId) {
                case "anthropic" -> testAnthropic(baseUrl, model, apiKey);
                case "google" -> testGoogle(baseUrl, model, apiKey);
                default -> testOpenAICompatible(baseUrl, model, apiKey);
            };

            return ApiResult.success(result);
        } catch (Exception e) {
            log.error("Test AI config failed: {}", e.getMessage());
            return ApiResult.success(new TestResult(false, "连接失败: " + e.getMessage(), null));
        }
    }

    private TestResult testOpenAICompatible(String baseUrl, String model, String apiKey) {
        try {
            // 确保 baseUrl 不以 / 结尾，避免双斜杠
            String cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
            String url = cleanBaseUrl + "/chat/completions";

            // 添加 stream: false 确保非流式响应
            String body = String.format("""
                {
                    "model": "%s",
                    "messages": [{"role": "user", "content": "Hi"}],
                    "max_tokens": 10,
                    "stream": false
                }
                """, model);

            log.info("Testing API: {} with model: {}", url, model);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .timeout(Duration.ofSeconds(30))
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            log.info("API response status: {}, body: {}", response.statusCode(),
                response.body().length() > 500 ? response.body().substring(0, 500) + "..." : response.body());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return new TestResult(true, "连接成功！API 配置有效", null);
            } else {
                String errorMsg = parseErrorMessage(response.body());
                log.error("API test failed: {}", errorMsg);
                return new TestResult(false, "API 返回错误 (" + response.statusCode() + "): " + errorMsg, null);
            }
        } catch (Exception e) {
            log.error("API test exception: {}", e.getMessage(), e);
            return new TestResult(false, "连接失败: " + e.getMessage(), null);
        }
    }

    private TestResult testAnthropic(String baseUrl, String model, String apiKey) {
        try {
            String url = "https://api.anthropic.com/v1/messages";
            String body = String.format("""
                {
                    "model": "%s",
                    "max_tokens": 10,
                    "messages": [{"role": "user", "content": "Hi"}]
                }
                """, model);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", "2023-06-01")
                    .timeout(Duration.ofSeconds(30))
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return new TestResult(true, "连接成功！API 配置有效", null);
            } else {
                String errorMsg = parseErrorMessage(response.body());
                return new TestResult(false, "API 返回错误: " + errorMsg, null);
            }
        } catch (Exception e) {
            return new TestResult(false, "连接失败: " + e.getMessage(), null);
        }
    }

    private TestResult testGoogle(String baseUrl, String model, String apiKey) {
        try {
            String url = String.format("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey);
            String body = """
                {
                    "contents": [{"parts": [{"text": "Hi"}]}]
                }
                """;

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(30))
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return new TestResult(true, "连接成功！API 配置有效", null);
            } else {
                String errorMsg = parseErrorMessage(response.body());
                return new TestResult(false, "API 返回错误: " + errorMsg, null);
            }
        } catch (Exception e) {
            return new TestResult(false, "连接失败: " + e.getMessage(), null);
        }
    }

    private String parseErrorMessage(String responseBody) {
        try {
            if (responseBody.contains("\"error\"")) {
                int start = responseBody.indexOf("\"message\"");
                if (start > 0) {
                    int valueStart = responseBody.indexOf(":", start) + 2;
                    int valueEnd = responseBody.indexOf("\"", valueStart + 1);
                    return responseBody.substring(valueStart, valueEnd);
                }
            }
            return responseBody.substring(0, Math.min(100, responseBody.length()));
        } catch (Exception e) {
            return "未知错误";
        }
    }

    public record TestResult(
            boolean success,
            String message,
            String[] models
    ) {}

    public record TestRequest(
            String providerId,
            String baseUrl,
            String model,
            String apiKey
    ) {
        public String getProviderId() { return providerId; }
        public String getBaseUrl() { return baseUrl; }
        public String getModel() { return model; }
        public String getApiKey() { return apiKey; }
    }
}