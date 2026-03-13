package com.aisshtool.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * AI Provider configuration model
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AiConfig {
    
    private Provider provider;
    private String baseUrl;
    private String model;
    
    // Sensitive - not returned in API responses
    private transient String apiKey;
    
    private Map<String, Object> extraConfig;
    
    public enum Provider {
        OPENAI,
        AZURE,
        QWEN,
        DEEPSEEK,
        CUSTOM
    }
    
    /**
     * Create a copy without sensitive data for API responses
     */
    public AiConfig toSafeCopy() {
        return AiConfig.builder()
                .provider(this.provider)
                .baseUrl(this.baseUrl)
                .model(this.model)
                .extraConfig(this.extraConfig)
                .build();
    }
    
    /**
     * Check if API key is configured
     */
    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isEmpty();
    }
}