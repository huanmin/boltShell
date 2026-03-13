package com.aisshtool.controller;

import com.aisshtool.model.ApiResult;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.management.ManagementFactory;
import java.lang.management.RuntimeMXBean;
import java.time.Duration;
import java.util.Map;

/**
 * REST Controller for health check and service status
 */
@RestController
@RequestMapping("/api/v1")
public class HealthController {
    
    @Value("${spring.application.name}")
    private String applicationName;
    
    @Value("${app.version:1.0.0}")
    private String version;
    
    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ApiResult<Map<String, Object>> health() {
        RuntimeMXBean runtime = ManagementFactory.getRuntimeMXBean();
        long uptimeSeconds = runtime.getUptime() / 1000;
        
        Map<String, Object> data = Map.of(
                "status", "healthy",
                "version", version,
                "javaVersion", System.getProperty("java.version"),
                "uptime", uptimeSeconds,
                "application", applicationName
        );
        
        return ApiResult.success(data);
    }
    
    /**
     * Root endpoint - basic info
     */
    @GetMapping
    public ApiResult<Map<String, String>> index() {
        return ApiResult.success(Map.of(
                "name", "AI SSH Tool API",
                "version", version,
                "docs", "/api/v1/docs"
        ));
    }
}