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

import java.util.List;
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
                .id("openai")
                .name("OpenAI")
                .baseUrl("https://api.openai.com")
                .model("gpt-4o")
                .enabled(true)
                .build();
    }

    @Test
    @DisplayName("GET /api/v1/ai-config - should return all AI configs")
    void getAiConfigs_shouldReturnConfigs() throws Exception {
        // Arrange
        when(credentialService.getAiConfigs()).thenReturn(List.of(testAiConfig));

        // Act & Assert
        mockMvc.perform(get("/api/v1/ai-config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data[0].id").value("openai"))
                .andExpect(jsonPath("$.data[0].name").value("OpenAI"))
                .andExpect(jsonPath("$.data[0].model").value("gpt-4o"))
                .andExpect(jsonPath("$.data[0].apiKey").doesNotExist());
    }

    @Test
    @DisplayName("GET /api/v1/ai-config - should return empty list when no configs")
    void getAiConfigs_shouldReturnEmptyList_whenNoConfigs() throws Exception {
        // Arrange
        when(credentialService.getAiConfigs()).thenReturn(List.of());

        // Act & Assert
        mockMvc.perform(get("/api/v1/ai-config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data").isEmpty());
    }

    @Test
    @DisplayName("GET /api/v1/ai-config/{providerId} - should return config by id")
    void getAiConfigById_shouldReturnConfig() throws Exception {
        // Arrange
        when(credentialService.getAiConfig("openai")).thenReturn(Optional.of(testAiConfig));

        // Act & Assert
        mockMvc.perform(get("/api/v1/ai-config/openai"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.id").value("openai"));
    }

    @Test
    @DisplayName("GET /api/v1/ai-config/{providerId} - should return empty when not found")
    void getAiConfigById_shouldReturnEmpty_whenNotFound() throws Exception {
        // Arrange
        when(credentialService.getAiConfig("unknown")).thenReturn(Optional.empty());

        // Act & Assert
        mockMvc.perform(get("/api/v1/ai-config/unknown"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    @DisplayName("PUT /api/v1/ai-config - should save AI config")
    void saveAiConfig_shouldSave() throws Exception {
        // Arrange
        AiConfig newConfig = AiConfig.builder()
                .id("qwen")
                .name("通义千问")
                .baseUrl("https://dashscope.aliyuncs.com/compatible-mode/v1")
                .model("qwen-turbo")
                .apiKey("sk-test-key")
                .enabled(true)
                .build();

        when(credentialService.saveAiConfig(any(AiConfig.class))).thenReturn(testAiConfig);

        // Act & Assert
        mockMvc.perform(put("/api/v1/ai-config")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newConfig)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    @DisplayName("DELETE /api/v1/ai-config/{providerId} - should delete config")
    void deleteAiConfig_shouldDelete() throws Exception {
        // Arrange
        when(credentialService.deleteAiConfig("openai")).thenReturn(true);

        // Act & Assert
        mockMvc.perform(delete("/api/v1/ai-config/openai"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    @DisplayName("GET /api/v1/ai-config/active - should return active provider")
    void getActiveModelProvider_shouldReturnActive() throws Exception {
        // Arrange
        when(credentialService.getActiveModelProvider()).thenReturn("openai");

        // Act & Assert
        mockMvc.perform(get("/api/v1/ai-config/active"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.provider").value("openai"));
    }

    @Test
    @DisplayName("PUT /api/v1/ai-config/active/{providerId} - should set active provider")
    void setActiveModelProvider_shouldSet() throws Exception {
        // Act & Assert
        mockMvc.perform(put("/api/v1/ai-config/active/qwen"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        verify(credentialService).setActiveModelProvider("qwen");
    }
}