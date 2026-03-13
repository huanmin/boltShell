package com.aisshtool.service;

import com.aisshtool.model.AppConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Service for managing application configuration
 * 
 * Handles reading and writing of config.json file
 */
@Slf4j
@Service
public class ConfigService {
    
    private static final String CONFIG_FILE = "config.json";
    
    private final String configPath;
    private final ObjectMapper objectMapper;
    
    private AppConfig appConfig;
    
    public ConfigService() {
        this(System.getProperty("user.home") + "/.ai-ssh-tool");
    }
    
    public ConfigService(String configPath) {
        this.configPath = configPath;
        this.objectMapper = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .enable(SerializationFeature.INDENT_OUTPUT);
    }
    
    @PostConstruct
    public void init() {
        loadAppConfig();
    }
    
    /**
     * Load application configuration from file
     * Creates default config if file doesn't exist
     */
    public AppConfig loadAppConfig() {
        File configFile = new File(configPath, CONFIG_FILE);
        
        if (!configFile.exists()) {
            log.info("Config file not found, creating default configuration");
            ensureConfigDirectory();
            appConfig = AppConfig.defaultConfig();
            saveAppConfig(appConfig);
            return appConfig;
        }
        
        try {
            String content = Files.readString(configFile.toPath());
            appConfig = objectMapper.readValue(content, AppConfig.class);
            log.info("Loaded configuration from {}", configFile.getAbsolutePath());
            return appConfig;
        } catch (IOException e) {
            log.warn("Failed to parse config file, using default configuration: {}", e.getMessage());
            appConfig = AppConfig.defaultConfig();
            return appConfig;
        }
    }
    
    /**
     * Save application configuration to file
     */
    public void saveAppConfig(AppConfig config) {
        ensureConfigDirectory();
        File configFile = new File(configPath, CONFIG_FILE);
        
        try {
            String json = objectMapper.writeValueAsString(config);
            Files.writeString(configFile.toPath(), json);
            this.appConfig = config;
            log.info("Saved configuration to {}", configFile.getAbsolutePath());
        } catch (IOException e) {
            log.error("Failed to save configuration: {}", e.getMessage());
            throw new RuntimeException("Failed to save configuration", e);
        }
    }
    
    /**
     * Get current application configuration
     */
    public AppConfig getAppConfig() {
        if (appConfig == null) {
            loadAppConfig();
        }
        return appConfig;
    }
    
    /**
     * Get config directory path
     */
    public String getConfigPath() {
        return configPath;
    }
    
    private void ensureConfigDirectory() {
        File dir = new File(configPath);
        if (!dir.exists()) {
            boolean created = dir.mkdirs();
            if (created) {
                log.info("Created config directory: {}", configPath);
            }
        }
    }
}