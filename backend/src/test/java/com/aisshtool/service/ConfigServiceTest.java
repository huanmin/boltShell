package com.aisshtool.service;

import com.aisshtool.model.AppConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit tests for ConfigService
 * 
 * TDD Red phase: Define expected behavior through tests
 */
class ConfigServiceTest {

    @TempDir
    Path tempDir;
    
    private ConfigService configService;
    private File configDir;
    
    @BeforeEach
    void setUp() {
        configDir = tempDir.toFile();
        configService = new ConfigService(configDir.getAbsolutePath());
    }
    
    // ============ loadAppConfig tests ============
    
    @Test
    @DisplayName("Should create default config when config file does not exist")
    void loadAppConfig_shouldCreateDefault_whenNotExists() {
        // Arrange - config file doesn't exist
        
        // Act
        AppConfig config = configService.loadAppConfig();
        
        // Assert
        assertThat(config).isNotNull();
        assertThat(config.getVersion()).isEqualTo("1.0.0");
        assertThat(config.getApp().getLanguage()).isEqualTo("zh-CN");
        assertThat(config.getServer().getPort()).isEqualTo(18080);
    }
    
    @Test
    @DisplayName("Should load existing config when file exists")
    void loadAppConfig_shouldLoadExisting_whenFileExists() throws Exception {
        // Arrange - create a config file
        String json = """
            {
              "version": "1.0.0",
              "app": {
                "language": "en-US",
                "theme": "light",
                "fontSize": 16,
                "terminalFontSize": 14
              },
              "server": {
                "port": 9090,
                "host": "localhost",
                "logLevel": "debug"
              },
              "ssh": {
                "connectTimeout": 60000,
                "keepAliveInterval": 15000,
                "maxSessions": 5
              },
              "ai": {
                "enabled": false,
                "timeout": 30000,
                "maxTokens": 2048
              }
            }
            """;
        File configFile = new File(configDir, "config.json");
        java.nio.file.Files.writeString(configFile.toPath(), json);
        
        // Act
        AppConfig config = configService.loadAppConfig();
        
        // Assert
        assertThat(config).isNotNull();
        assertThat(config.getApp().getLanguage()).isEqualTo("en-US");
        assertThat(config.getApp().getTheme()).isEqualTo("light");
        assertThat(config.getServer().getPort()).isEqualTo(9090);
        assertThat(config.getSsh().getConnectTimeout()).isEqualTo(60000);
        assertThat(config.getAi().getEnabled()).isFalse();
    }
    
    @Test
    @DisplayName("Should save config to file")
    void saveAppConfig_shouldWriteFile() {
        // Arrange
        AppConfig config = AppConfig.defaultConfig();
        config.getApp().setLanguage("en-US");
        config.getServer().setPort(9090);
        
        // Act
        configService.saveAppConfig(config);
        
        // Assert - file should exist and contain the saved values
        File configFile = new File(configDir, "config.json");
        assertThat(configFile).exists();
        
        AppConfig loaded = configService.loadAppConfig();
        assertThat(loaded.getApp().getLanguage()).isEqualTo("en-US");
        assertThat(loaded.getServer().getPort()).isEqualTo(9090);
    }
    
    @Test
    @DisplayName("Should create config directory if not exists")
    void init_shouldCreateDirectory() {
        // Arrange - use a non-existent subdirectory
        File newDir = new File(tempDir.toFile(), "new-config-dir");
        assertThat(newDir).doesNotExist();
        
        // Act
        ConfigService newService = new ConfigService(newDir.getAbsolutePath());
        AppConfig config = newService.loadAppConfig();
        
        // Assert
        assertThat(newDir).exists();
        assertThat(config).isNotNull();
    }
    
    @Test
    @DisplayName("Should handle corrupted config file gracefully")
    void loadAppConfig_shouldHandleCorruptedFile() throws Exception {
        // Arrange - write invalid JSON
        File configFile = new File(configDir, "config.json");
        java.nio.file.Files.writeString(configFile.toPath(), "invalid json {{{");
        
        // Act - should fallback to default config
        AppConfig config = configService.loadAppConfig();
        
        // Assert
        assertThat(config).isNotNull();
        assertThat(config.getVersion()).isEqualTo("1.0.0");
    }
}