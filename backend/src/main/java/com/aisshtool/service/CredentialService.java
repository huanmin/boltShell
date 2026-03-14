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
    private List<AiConfig> aiConfigs = new ArrayList<>();
    private String activeModelProvider;
    
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
     * Get all AI configurations (without API keys)
     */
    public List<AiConfig> getAiConfigs() {
        return aiConfigs.stream()
                .map(AiConfig::toSafeCopy)
                .toList();
    }

    /**
     * Get AI configuration by provider ID
     */
    public Optional<AiConfig> getAiConfig(String providerId) {
        return aiConfigs.stream()
                .filter(c -> c.getId().equals(providerId))
                .findFirst()
                .map(AiConfig::toSafeCopy);
    }

    /**
     * Get AI configuration with API key (for internal use)
     */
    public Optional<AiConfig> getAiConfigWithApiKey(String providerId) {
        return aiConfigs.stream()
                .filter(c -> c.getId().equals(providerId))
                .findFirst();
    }

    /**
     * Get active AI configuration with API key
     */
    public Optional<AiConfig> getActiveAiConfigWithApiKey() {
        if (activeModelProvider == null) {
            return aiConfigs.stream()
                    .filter(AiConfig::isEnabled)
                    .findFirst();
        }
        return aiConfigs.stream()
                .filter(c -> c.getId().equals(activeModelProvider))
                .findFirst();
    }

    /**
     * Get active model provider ID
     */
    public String getActiveModelProvider() {
        return activeModelProvider;
    }

    /**
     * Set active model provider
     */
    public void setActiveModelProvider(String providerId) {
        this.activeModelProvider = providerId;
        saveAiConfigs();
    }

    /**
     * Save AI configuration
     */
    public AiConfig saveAiConfig(AiConfig config) {
        // Encrypt API key
        if (config.getApiKey() != null && !config.getApiKey().isEmpty()) {
            config.setApiKey(encryptionService.encrypt(config.getApiKey()));
        }

        // Update existing or add new
        Optional<AiConfig> existing = aiConfigs.stream()
                .filter(c -> c.getId().equals(config.getId()))
                .findFirst();

        if (existing.isPresent()) {
            aiConfigs.removeIf(c -> c.getId().equals(config.getId()));
        }
        aiConfigs.add(config);

        saveAiConfigs();

        log.info("Saved AI configuration: provider={}", config.getId());
        return config.toSafeCopy();
    }

    /**
     * Delete AI configuration
     */
    public boolean deleteAiConfig(String providerId) {
        boolean removed = aiConfigs.removeIf(c -> c.getId().equals(providerId));
        if (removed) {
            if (providerId.equals(activeModelProvider)) {
                activeModelProvider = null;
            }
            saveAiConfigs();
            log.info("Deleted AI configuration: {}", providerId);
        }
        return removed;
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
            aiConfigs = new ArrayList<>();
            activeModelProvider = null;
            return;
        }

        try {
            String encrypted = Files.readString(file.toPath());
            String decrypted = encryptionService.decrypt(encrypted);

            Map<String, Object> data = objectMapper.readValue(decrypted, new TypeReference<Map<String, Object>>() {});
            aiConfigs = ((List<Map<String, Object>>) data.getOrDefault("configs", new ArrayList<>()))
                    .stream()
                    .map(m -> objectMapper.convertValue(m, AiConfig.class))
                    .toList();
            activeModelProvider = (String) data.get("activeProvider");

            log.info("Loaded {} AI configs, active={}", aiConfigs.size(), activeModelProvider);
        } catch (Exception e) {
            log.error("Failed to load AI config: {}", e.getMessage());
            aiConfigs = new ArrayList<>();
            activeModelProvider = null;
        }
    }

    private void saveAiConfigs() {
        File file = new File(configService.getConfigPath(), AI_CONFIG_FILE);

        try {
            Map<String, Object> data = new HashMap<>();
            data.put("configs", aiConfigs);
            data.put("activeProvider", activeModelProvider);

            String json = objectMapper.writeValueAsString(data);
            String encrypted = encryptionService.encrypt(json);

            Files.writeString(file.toPath(), encrypted);
            log.debug("Saved {} AI configs to file", aiConfigs.size());
        } catch (Exception e) {
            log.error("Failed to save AI config: {}", e.getMessage());
            throw new RuntimeException("Failed to save AI config", e);
        }
    }
}