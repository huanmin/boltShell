package com.aisshtool.controller;

import com.aisshtool.model.AiConfig;
import com.aisshtool.service.CredentialService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for AiConfigController
 */
@WebMvcTest(AiConfigController.class)
class AiConfigControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private CredentialService credentialService;

    private AiConfig testAiConfig;

    @BeforeEach
    void setUp() {
        testAiConfig = AiConfig.builder()
                .provider(AiConfig.Provider.OPENAI)
                .baseUrl("https://api.openai.com")
                .model("gpt-4o")
                .build();
    }

    @Test
    @DisplayName("GET /api/v1/ai-config - should return AI config without API key")
    void getAiConfig_shouldReturnConfig() throws Exception {
        // Arrange
        when(credentialService.getAiConfig()).thenReturn(Optional.of(testAiConfig));

        // Act & Assert
        mockMvc.perform(get("/api/v1/ai-config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.provider").value("OPENAI"))
                .andExpect(jsonPath("$.data.model").value("gpt-4o"))
                .andExpect(jsonPath("$.data.apiKey").doesNotExist())
                .andExpect(jsonPath("$.data.hasApiKey").value(false));
    }

    @Test
    @DisplayName("GET /api/v1/ai-config - should return empty when not configured")
    void getAiConfig_shouldReturnEmpty_whenNotConfigured() throws Exception {
        // Arrange
        when(credentialService.getAiConfig()).thenReturn(Optional.empty());

        // Act & Assert - data field is not present when null (due to NON_NULL)
        mockMvc.perform(get("/api/v1/ai-config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    @DisplayName("PUT /api/v1/ai-config - should update AI config")
    void updateAiConfig_shouldUpdate() throws Exception {
        // Arrange
        AiConfig updateData = AiConfig.builder()
                .provider(AiConfig.Provider.QWEN)
                .baseUrl("https://dashscope.aliyuncs.com")
                .model("qwen-turbo")
                .apiKey("sk-test-key")
                .build();

        when(credentialService.saveAiConfig(any(AiConfig.class))).thenReturn(testAiConfig);

        // Act & Assert
        mockMvc.perform(put("/api/v1/ai-config")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateData)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    @DisplayName("GET /api/v1/ai-config with hasApiKey - should return true when key exists")
    void getAiConfig_shouldReturnHasApiKeyTrue() throws Exception {
        // Arrange
        AiConfig configWithKey = AiConfig.builder()
                .provider(AiConfig.Provider.OPENAI)
                .baseUrl("https://api.openai.com")
                .model("gpt-4o")
                .apiKey("sk-xxx")
                .build();

        when(credentialService.getAiConfig()).thenReturn(Optional.of(configWithKey.toSafeCopy()));
        when(credentialService.getAiConfigWithApiKey()).thenReturn(Optional.of(configWithKey));

        // Act & Assert
        mockMvc.perform(get("/api/v1/ai-config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasApiKey").value(true));
    }
}