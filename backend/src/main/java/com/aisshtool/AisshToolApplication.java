package com.aisshtool;

import org.springframework.ai.autoconfigure.openai.OpenAiAutoConfiguration;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * AI SSH Tool Backend Application
 *
 * A local proxy service that bridges browser-based SSH operations
 * with AI-powered command suggestions.
 */
@SpringBootApplication(exclude = {OpenAiAutoConfiguration.class})
public class AisshToolApplication {

    public static void main(String[] args) {
        SpringApplication.run(AisshToolApplication.class, args);
    }
}