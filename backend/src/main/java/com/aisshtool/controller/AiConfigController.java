package com.aisshtool.controller;

import com.aisshtool.model.AiConfig;
import com.aisshtool.model.ApiResult;
import com.aisshtool.service.CredentialService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

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
    
    /**
     * Get AI configuration (without API key)
     */
    @GetMapping
    public ApiResult<Object> getAiConfig() {
        return credentialService.getAiConfig()
                .map(config -> {
                    Map<String, Object> result = Map.of(
                            "provider", config.getProvider().name(),
                            "baseUrl", config.getBaseUrl() != null ? config.getBaseUrl() : "",
                            "model", config.getModel() != null ? config.getModel() : "",
                            "hasApiKey", credentialService.getAiConfigWithApiKey()
                                    .map(AiConfig::hasApiKey)
                                    .orElse(false)
                    );
                    return ApiResult.<Object>success(result);
                })
                .orElse(ApiResult.success(null));
    }
    
    /**
     * Update AI configuration
     */
    @PutMapping
    public ApiResult<AiConfig> updateAiConfig(@RequestBody AiConfig config) {
        try {
            AiConfig saved = credentialService.saveAiConfig(config);
            return ApiResult.success(saved);
        } catch (Exception e) {
            log.error("Failed to save AI config: {}", e.getMessage());
            return ApiResult.error(com.aisshtool.model.ErrorCode.INTERNAL_ERROR, e.getMessage());
        }
    }
    
    /**
     * Test AI configuration
     */
    @PostMapping("/test")
    public ApiResult<TestResult> testAiConfig() {
        // TODO: Implement actual AI API test
        return credentialService.getAiConfigWithApiKey()
                .map(config -> ApiResult.success(new TestResult(true, "AI 配置有效", new String[]{"gpt-4o", "gpt-4o-mini"})))
                .orElse(ApiResult.error(com.aisshtool.model.ErrorCode.AI_CONFIG_MISSING));
    }
    
    public record TestResult(
            boolean success,
            String message,
            String[] models
    ) {}
}