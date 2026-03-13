package com.aisshtool.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Set;

/**
 * Service for AES-256-GCM encryption and decryption
 * 
 * Uses a securely generated random key stored in the application config directory.
 * Key file permissions are restricted to owner-only (600).
 */
@Slf4j
@Service
public class EncryptionService {
    
    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH = 12;  // 96 bits
    private static final int GCM_TAG_LENGTH = 128; // 128 bits
    private static final int AES_KEY_LENGTH = 256; // 256 bits
    private static final String KEY_FILE_NAME = "master.key";
    
    private final SecretKey secretKey;
    private final Path keyFilePath;
    
    @Value("${app.config.path:#{systemProperties['user.home'] + '/.ai-ssh-tool'}}")
    private String configPath;
    
    public EncryptionService() {
        this.keyFilePath = Paths.get(
            System.getProperty("user.home"), 
            ".ai-ssh-tool", 
            KEY_FILE_NAME
        );
        this.secretKey = generateOrLoadKey();
    }
    
    /**
     * Encrypt a string using AES-256-GCM
     * 
     * @param plaintext the text to encrypt
     * @return Base64 encoded ciphertext (IV + encrypted data)
     */
    public String encrypt(String plaintext) {
        if (plaintext == null) {
            return null;
        }
        
        try {
            // Generate random IV for each encryption
            byte[] iv = new byte[GCM_IV_LENGTH];
            SecureRandom random = new SecureRandom();
            random.nextBytes(iv);
            
            // Initialize cipher
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            GCMParameterSpec spec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, spec);
            
            // Encrypt
            byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            
            // Combine IV + encrypted data
            byte[] combined = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(encrypted, 0, combined, iv.length, encrypted.length);
            
            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            log.error("Encryption failed: {}", e.getMessage());
            throw new RuntimeException("Encryption failed", e);
        }
    }
    
    /**
     * Decrypt a string using AES-256-GCM
     * 
     * @param ciphertext Base64 encoded ciphertext (IV + encrypted data)
     * @return decrypted plaintext
     */
    public String decrypt(String ciphertext) {
        if (ciphertext == null) {
            return null;
        }
        
        try {
            // Decode Base64
            byte[] combined = Base64.getDecoder().decode(ciphertext);
            
            // Validate minimum length
            if (combined.length < GCM_IV_LENGTH + 16) {
                throw new RuntimeException("Invalid ciphertext: too short");
            }
            
            // Extract IV and encrypted data
            byte[] iv = new byte[GCM_IV_LENGTH];
            byte[] encrypted = new byte[combined.length - GCM_IV_LENGTH];
            System.arraycopy(combined, 0, iv, 0, GCM_IV_LENGTH);
            System.arraycopy(combined, GCM_IV_LENGTH, encrypted, 0, encrypted.length);
            
            // Initialize cipher
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            GCMParameterSpec spec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, spec);
            
            // Decrypt
            byte[] decrypted = cipher.doFinal(encrypted);
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("Decryption failed: {}", e.getMessage());
            throw new RuntimeException("Decryption failed", e);
        }
    }
    
    /**
     * Generate or load encryption key from file
     * 
     * On first run, generates a random 256-bit AES key and stores it
     * in the config directory with owner-only permissions (600).
     * 
     * On subsequent runs, loads the existing key from file.
     */
    private SecretKey generateOrLoadKey() {
        try {
            // Check if key file exists
            if (Files.exists(keyFilePath)) {
                log.info("Loading encryption key from: {}", keyFilePath);
                byte[] keyBytes = Files.readAllBytes(keyFilePath);
                
                if (keyBytes.length != 32) { // 256 bits = 32 bytes
                    log.warn("Invalid key file, regenerating...");
                    return generateAndSaveKey();
                }
                
                return new SecretKeySpec(keyBytes, "AES");
            }
            
            // First run - generate new key
            return generateAndSaveKey();
            
        } catch (Exception e) {
            log.error("Failed to load/generate encryption key: {}", e.getMessage());
            throw new RuntimeException("Failed to initialize encryption", e);
        }
    }
    
    /**
     * Generate a new random key and save to file
     */
    private SecretKey generateAndSaveKey() throws Exception {
        log.info("Generating new encryption key...");
        
        // Use strong random number generator
        KeyGenerator keyGen = KeyGenerator.getInstance("AES");
        keyGen.init(AES_KEY_LENGTH, SecureRandom.getInstanceStrong());
        SecretKey key = keyGen.generateKey();
        
        // Create config directory if not exists
        Path configDir = keyFilePath.getParent();
        if (!Files.exists(configDir)) {
            Files.createDirectories(configDir);
            log.info("Created config directory: {}", configDir);
        }
        
        // Save key with restricted permissions (owner read/write only)
        Set<PosixFilePermission> perms = Set.of(
            PosixFilePermission.OWNER_READ,
            PosixFilePermission.OWNER_WRITE
        );
        
        // Create file with permissions
        Files.createDirectories(configDir);
        Files.write(keyFilePath, key.getEncoded());
        
        // Set file permissions after write
        Files.setPosixFilePermissions(keyFilePath, perms);
        
        log.info("Saved encryption key to: {} (permissions: 600)", keyFilePath);
        
        return key;
    }
}