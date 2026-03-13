package com.aisshtool.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Application configuration model (stored in config.json)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AppConfig {
    
    private String version;
    private AppSettings app;
    private ServerSettings server;
    private SshSettings ssh;
    private AiSettings ai;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AppSettings {
        private String language;
        private String theme;
        private Integer fontSize;
        private Integer terminalFontSize;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ServerSettings {
        private Integer port;
        private String host;
        private String logLevel;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SshSettings {
        private Integer connectTimeout;
        private Integer keepAliveInterval;
        private Integer maxSessions;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AiSettings {
        private Boolean enabled;
        private Integer timeout;
        private Integer maxTokens;
    }
    
    /**
     * Create default configuration
     */
    public static AppConfig defaultConfig() {
        return AppConfig.builder()
                .version("1.0.0")
                .app(AppSettings.builder()
                        .language("zh-CN")
                        .theme("dark")
                        .fontSize(14)
                        .terminalFontSize(12)
                        .build())
                .server(ServerSettings.builder()
                        .port(18080)
                        .host("127.0.0.1")
                        .logLevel("info")
                        .build())
                .ssh(SshSettings.builder()
                        .connectTimeout(30000)
                        .keepAliveInterval(30000)
                        .maxSessions(10)
                        .build())
                .ai(AiSettings.builder()
                        .enabled(true)
                        .timeout(60000)
                        .maxTokens(4096)
                        .build())
                .build();
    }
}