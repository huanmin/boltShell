package com.aisshtool.service;

import com.aisshtool.model.AiConfig;
import com.aisshtool.model.Connection;
import com.aisshtool.security.EncryptionService;
import com.fasterxml.jackson.core.type.TypeReference;
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
import java.time.Instant;
import java.util.*;

/**
 * Service for managing SSH credentials and AI configuration
 * 
 * Handles encrypted storage of sensitive data
 */
@Slf4j
@Service
public class CredentialService {
    
    private static final String CREDENTIALS_FILE = "credentials.enc";
    private static final String AI_CONFIG_FILE = "ai-config.enc";
    
    private final ConfigService configService;
    private final EncryptionService encryptionService;
    private final ObjectMapper objectMapper;
    
    private List<Connection> connections = new ArrayList<>();
    private AiConfig aiConfig;
    
    public CredentialService(ConfigService configService, EncryptionService encryptionService) {
        this.configService = configService;
        this.encryptionService = encryptionService;
        this.objectMapper = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .enable(SerializationFeature.INDENT_OUTPUT);
    }
    
    @PostConstruct
    public void init() {
        loadCredentials();
        loadAiConfig();
    }
    
    // ============ Connection Management ============
    
    /**
     * List all connections (without sensitive data)
     */
    public List<Connection> listConnections() {
        return connections.stream()
                .map(Connection::toSafeCopy)
                .toList();
    }
    
    /**
     * Get connection by ID
     */
    public Optional<Connection> getConnection(String id) {
        return connections.stream()
                .filter(c -> c.getId().equals(id))
                .findFirst()
                .map(Connection::toSafeCopy);
    }
    
    /**
     * Get connection with credentials (for internal use)
     */
    public Optional<Connection> getConnectionWithCredentials(String id) {
        return connections.stream()
                .filter(c -> c.getId().equals(id))
                .findFirst();
    }
    
    /**
     * Create a new connection
     */
    public Connection createConnection(Connection connection) {
        // Generate ID
        String id = "conn-" + UUID.randomUUID().toString().substring(0, 8);
        connection.setId(id);
        connection.setCreatedAt(Instant.now());
        
        // Only encrypt and save sensitive data if rememberCredential is true
        boolean shouldSave = Boolean.TRUE.equals(connection.getRememberCredential());
        
        if (shouldSave) {
            // Encrypt sensitive data for persistent storage
            if (connection.getPassword() != null) {
                connection.setPassword(encryptionService.encrypt(connection.getPassword()));
            }
            if (connection.getPrivateKey() != null) {
                connection.setPrivateKey(encryptionService.encrypt(connection.getPrivateKey()));
            }
            if (connection.getPassphrase() != null) {
                connection.setPassphrase(encryptionService.encrypt(connection.getPassphrase()));
            }
        } else {
            // Clear sensitive data - don't save
            connection.setPassword(null);
            connection.setPrivateKey(null);
            connection.setPassphrase(null);
        }
        
        connections.add(connection);
        saveCredentials();
        
        log.info("Created connection: {} ({}) - credentials {}saved", 
                connection.getName(), id, shouldSave ? "" : "not ");
        return connection.toSafeCopy();
    }
    
    /**
     * Update an existing connection
     */
    public Optional<Connection> updateConnection(String id, Connection updates) {
        Optional<Connection> existing = connections.stream()
                .filter(c -> c.getId().equals(id))
                .findFirst();
        
        if (existing.isEmpty()) {
            return Optional.empty();
        }
        
        Connection conn = existing.get();
        
        // Update fields
        if (updates.getName() != null) conn.setName(updates.getName());
        if (updates.getHost() != null) conn.setHost(updates.getHost());
        if (updates.getPort() != null) conn.setPort(updates.getPort());
        if (updates.getUsername() != null) conn.setUsername(updates.getUsername());
        if (updates.getAuthType() != null) conn.setAuthType(updates.getAuthType());
        
        // Update sensitive fields
        if (updates.getPassword() != null) {
            conn.setPassword(encryptionService.encrypt(updates.getPassword()));
        }
        if (updates.getPrivateKey() != null) {
            conn.setPrivateKey(encryptionService.encrypt(updates.getPrivateKey()));
        }
        if (updates.getPassphrase() != null) {
            conn.setPassphrase(encryptionService.encrypt(updates.getPassphrase()));
        }
        
        saveCredentials();
        log.info("Updated connection: {}", id);
        
        return Optional.of(conn.toSafeCopy());
    }
    
    /**
     * Delete a connection
     */
    public boolean deleteConnection(String id) {
        boolean removed = connections.removeIf(c -> c.getId().equals(id));
        if (removed) {
            saveCredentials();
            log.info("Deleted connection: {}", id);
        }
        return removed;
    }
    
    /**
     * Update last connected time
     */
    public void updateLastConnected(String id) {
        connections.stream()
                .filter(c -> c.getId().equals(id))
                .findFirst()
                .ifPresent(conn -> {
                    conn.setLastConnectedAt(Instant.now());
                    saveCredentials();
                });
    }
    
    // ============ AI Configuration ============

    /**
     * Get AI configuration (without API key)
     */
    public Optional<AiConfig> getAiConfig() {
        return Optional.ofNullable(aiConfig)
                .map(AiConfig::toSafeCopy);
    }
    
    /**
     * Get AI configuration with API key (for internal use)
     */
    public Optional<AiConfig> getAiConfigWithApiKey() {
        return Optional.ofNullable(aiConfig);
    }
    
    /**
     * Save AI configuration
     */
    public AiConfig saveAiConfig(AiConfig config) {
        // Encrypt API key
        if (config.getApiKey() != null) {
            config.setApiKey(encryptionService.encrypt(config.getApiKey()));
        }
        
        this.aiConfig = config;
        saveAiConfigToFile();
        
        log.info("Saved AI configuration: provider={}", config.getProvider());
        return config.toSafeCopy();
    }
    
    // ============ Temporary Connection (for testing) ============
    
    /**
     * Add a temporary connection for testing (not persisted)
     */
    public void addTemporaryConnection(Connection connection) {
        connections.add(connection);
    }
    
    /**
     * Remove a temporary connection
     */
    public void removeTemporaryConnection(String id) {
        connections.removeIf(c -> c.getId().equals(id));
    }
    
    // ============ Persistence ============
    
    private void loadCredentials() {
        File file = new File(configService.getConfigPath(), CREDENTIALS_FILE);
        
        if (!file.exists()) {
            log.info("Credentials file not found, starting with empty list");
            connections = new ArrayList<>();
            return;
        }
        
        try {
            String encrypted = Files.readString(file.toPath());
            String decrypted = encryptionService.decrypt(encrypted);
            
            Map<String, List<Connection>> data = objectMapper.readValue(
                    decrypted,
                    new TypeReference<Map<String, List<Connection>>>() {}
            );
            
            connections = data.getOrDefault("connections", new ArrayList<>());
            log.info("Loaded {} connections from credentials file", connections.size());
        } catch (Exception e) {
            log.error("Failed to load credentials: {}", e.getMessage());
            connections = new ArrayList<>();
        }
    }
    
    private void saveCredentials() {
        File file = new File(configService.getConfigPath(), CREDENTIALS_FILE);
        
        try {
            Map<String, List<Connection>> data = new HashMap<>();
            data.put("connections", connections);
            
            String json = objectMapper.writeValueAsString(data);
            String encrypted = encryptionService.encrypt(json);
            
            Files.writeString(file.toPath(), encrypted);
            log.debug("Saved {} connections to credentials file", connections.size());
        } catch (Exception e) {
            log.error("Failed to save credentials: {}", e.getMessage());
            throw new RuntimeException("Failed to save credentials", e);
        }
    }
    
    private void loadAiConfig() {
        File file = new File(configService.getConfigPath(), AI_CONFIG_FILE);
        
        if (!file.exists()) {
            log.info("AI config file not found");
            aiConfig = null;
            return;
        }
        
        try {
            String encrypted = Files.readString(file.toPath());
            String decrypted = encryptionService.decrypt(encrypted);
            
            aiConfig = objectMapper.readValue(decrypted, AiConfig.class);
            log.info("Loaded AI config: provider={}", aiConfig.getProvider());
        } catch (Exception e) {
            log.error("Failed to load AI config: {}", e.getMessage());
            aiConfig = null;
        }
    }
    
    private void saveAiConfigToFile() {
        File file = new File(configService.getConfigPath(), AI_CONFIG_FILE);
        
        try {
            String json = objectMapper.writeValueAsString(aiConfig);
            String encrypted = encryptionService.encrypt(json);
            
            Files.writeString(file.toPath(), encrypted);
            log.debug("Saved AI config to file");
        } catch (Exception e) {
            log.error("Failed to save AI config: {}", e.getMessage());
            throw new RuntimeException("Failed to save AI config", e);
        }
    }
}