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

    private String id;  // provider id: openai, anthropic, google, qwen, kimi, minimax, zhipu, custom
    private String name;  // display name
    private String baseUrl;
    private String model;

    // Sensitive - not returned in API responses
    private transient String apiKey;

    private Map<String, Object> extraConfig;

    private boolean enabled;

    /**
     * Create a copy without sensitive data for API responses
     */
    public AiConfig toSafeCopy() {
        return AiConfig.builder()
                .id(this.id)
                .name(this.name)
                .baseUrl(this.baseUrl)
                .model(this.model)
                .extraConfig(this.extraConfig)
                .enabled(this.enabled)
                .build();
    }

    /**
     * Check if API key is configured
     */
    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isEmpty();
    }
}