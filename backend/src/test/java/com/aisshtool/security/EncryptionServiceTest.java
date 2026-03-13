package com.aisshtool.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit tests for EncryptionService
 * 
 * TDD Red phase: Define expected behavior through tests
 */
class EncryptionServiceTest {

    private EncryptionService encryptionService;
    
    @BeforeEach
    void setUp() {
        encryptionService = new EncryptionService();
    }
    
    // ============ encrypt/decrypt tests ============
    
    @Test
    @DisplayName("Should encrypt and decrypt string successfully")
    void encryptDecrypt_shouldReturnOriginalString() {
        // Arrange
        String original = "my-super-secret-password-123!";
        
        // Act
        String encrypted = encryptionService.encrypt(original);
        String decrypted = encryptionService.decrypt(encrypted);
        
        // Assert
        assertThat(encrypted).isNotEqualTo(original);
        assertThat(decrypted).isEqualTo(original);
    }
    
    @Test
    @DisplayName("Should produce different ciphertext for same plaintext")
    void encrypt_shouldProduceDifferentCiphertext() {
        // Arrange
        String plaintext = "same-password";
        
        // Act
        String encrypted1 = encryptionService.encrypt(plaintext);
        String encrypted2 = encryptionService.encrypt(plaintext);
        
        // Assert - due to random IV, ciphertext should be different
        assertThat(encrypted1).isNotEqualTo(encrypted2);
        
        // But both should decrypt to the same value
        assertThat(encryptionService.decrypt(encrypted1)).isEqualTo(plaintext);
        assertThat(encryptionService.decrypt(encrypted2)).isEqualTo(plaintext);
    }
    
    @Test
    @DisplayName("Should handle empty string")
    void encryptDecrypt_shouldHandleEmptyString() {
        // Arrange
        String original = "";
        
        // Act
        String encrypted = encryptionService.encrypt(original);
        String decrypted = encryptionService.decrypt(encrypted);
        
        // Assert
        assertThat(decrypted).isEmpty();
    }
    
    @Test
    @DisplayName("Should handle long string")
    void encryptDecrypt_shouldHandleLongString() {
        // Arrange
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 10000; i++) {
            sb.append("a");
        }
        String original = sb.toString();
        
        // Act
        String encrypted = encryptionService.encrypt(original);
        String decrypted = encryptionService.decrypt(encrypted);
        
        // Assert
        assertThat(decrypted).hasSize(10000);
        assertThat(decrypted).isEqualTo(original);
    }
    
    @Test
    @DisplayName("Should handle special characters")
    void encryptDecrypt_shouldHandleSpecialCharacters() {
        // Arrange
        String original = "密码测试！@#$%^&*(){}[]|\\:;\"'<>,.?/~`";
        
        // Act
        String encrypted = encryptionService.encrypt(original);
        String decrypted = encryptionService.decrypt(encrypted);
        
        // Assert
        assertThat(decrypted).isEqualTo(original);
    }
    
    @Test
    @DisplayName("Should handle multiline string")
    void encryptDecrypt_shouldHandleMultilineString() {
        // Arrange
        String original = """
            -----BEGIN RSA PRIVATE KEY-----
            MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7MbzYLdZ7ZvVy7F7V
            multiple
            lines
            here
            -----END RSA PRIVATE KEY-----
            """;
        
        // Act
        String encrypted = encryptionService.encrypt(original);
        String decrypted = encryptionService.decrypt(encrypted);
        
        // Assert
        assertThat(decrypted).isEqualTo(original);
    }
    
    @Test
    @DisplayName("Should throw exception for invalid ciphertext")
    void decrypt_shouldThrowForInvalidCiphertext() {
        // Arrange
        String invalidCiphertext = "not-valid-base64!!!";
        
        // Act & Assert
        assertThatThrownBy(() -> encryptionService.decrypt(invalidCiphertext))
                .isInstanceOf(RuntimeException.class);
    }
    
    @Test
    @DisplayName("Should throw exception for tampered ciphertext")
    void decrypt_shouldThrowForTamperedCiphertext() {
        // Arrange
        String original = "secret-data";
        String encrypted = encryptionService.encrypt(original);
        String tampered = encrypted.substring(0, encrypted.length() - 5) + "XXXXX";
        
        // Act & Assert
        assertThatThrownBy(() -> encryptionService.decrypt(tampered))
                .isInstanceOf(RuntimeException.class);
    }
    
    @Test
    @DisplayName("Should handle null input gracefully")
    void encrypt_shouldHandleNull() {
        // Act
        String encrypted = encryptionService.encrypt(null);
        
        // Assert
        assertThat(encrypted).isNull();
    }
    
    @Test
    @DisplayName("Should handle null ciphertext gracefully")
    void decrypt_shouldHandleNull() {
        // Act
        String decrypted = encryptionService.decrypt(null);
        
        // Assert
        assertThat(decrypted).isNull();
    }
}