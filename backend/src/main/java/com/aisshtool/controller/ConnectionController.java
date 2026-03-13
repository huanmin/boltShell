package com.aisshtool.controller;

import com.aisshtool.model.ApiResult;
import com.aisshtool.model.Connection;
import com.aisshtool.model.ErrorCode;
import com.aisshtool.service.CredentialService;
import com.aisshtool.ssh.SshClient;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller for SSH connection management
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/connections")
@RequiredArgsConstructor
public class ConnectionController {
    
    private final CredentialService credentialService;
    private final SshClient sshClient;
    
    /**
     * List all SSH connections
     */
    @GetMapping
    public ApiResult<List<Connection>> listConnections() {
        List<Connection> connections = credentialService.listConnections();
        return ApiResult.success(connections);
    }
    
    /**
     * Get a specific connection by ID
     */
    @GetMapping("/{id}")
    public ApiResult<Connection> getConnection(@PathVariable String id) {
        return credentialService.getConnection(id)
                .map(ApiResult::success)
                .orElse(ApiResult.error(ErrorCode.CONNECTION_NOT_FOUND));
    }
    
    /**
     * Create a new SSH connection
     */
    @PostMapping
    public ApiResult<Connection> createConnection(@Valid @RequestBody Connection connection) {
        try {
            Connection created = credentialService.createConnection(connection);
            return ApiResult.success(created);
        } catch (Exception e) {
            log.error("Failed to create connection: {}", e.getMessage());
            return ApiResult.error(ErrorCode.INTERNAL_ERROR, e.getMessage());
        }
    }
    
    /**
     * Update an existing SSH connection
     */
    @PutMapping("/{id}")
    public ApiResult<Connection> updateConnection(
            @PathVariable String id,
            @RequestBody Connection connection) {
        return credentialService.updateConnection(id, connection)
                .map(ApiResult::success)
                .orElse(ApiResult.error(ErrorCode.CONNECTION_NOT_FOUND));
    }
    
    /**
     * Delete an SSH connection
     */
    @DeleteMapping("/{id}")
    public ApiResult<Void> deleteConnection(@PathVariable String id) {
        boolean deleted = credentialService.deleteConnection(id);
        if (deleted) {
            return ApiResult.success("删除成功", null);
        }
        return ApiResult.error(ErrorCode.CONNECTION_NOT_FOUND);
    }
    
    /**
     * Test SSH connection
     */
    @PostMapping("/{id}/test")
    public ApiResult<TestResult> testConnection(@PathVariable String id) {
        return credentialService.getConnectionWithCredentials(id)
                .map(conn -> {
                    try {
                        boolean connected = sshClient.connect(id);
                        if (connected) {
                            // 获取服务器信息
                            var result = sshClient.executeCommand(id, "uname -a");
                            sshClient.disconnect(id);
                            
                            return ApiResult.success(new TestResult(
                                true, 
                                "连接成功", 
                                new ServerInfo(
                                    result.output().split("\n")[0],
                                    conn.getHost(),
                                    conn.getUsername()
                                )
                            ));
                        } else {
                            return ApiResult.<TestResult>error(ErrorCode.SSH_CONNECTION_FAILED, "无法连接到服务器");
                        }
                    } catch (Exception e) {
                        log.error("Connection test failed: {}", e.getMessage());
                        return ApiResult.<TestResult>error(ErrorCode.SSH_CONNECTION_FAILED, e.getMessage());
                    }
                })
                .orElse(ApiResult.error(ErrorCode.CONNECTION_NOT_FOUND));
    }
    
    /**
     * Test SSH connection with provided credentials (for testing before save)
     */
    @PostMapping("/test")
    public ApiResult<TestResult> testConnectionDirect(@RequestBody Connection connection) {
        try {
            // Create temporary connection for testing
            String tempId = "temp-" + System.currentTimeMillis();
            
            // Create a temporary connection object
            Connection tempConn = Connection.builder()
                    .id(tempId)
                    .host(connection.getHost())
                    .port(connection.getPort() != null ? connection.getPort() : 22)
                    .username(connection.getUsername())
                    .authType(connection.getAuthType())
                    .password(connection.getPassword())
                    .privateKey(connection.getPrivateKey())
                    .build();
            
            // Add to credentials temporarily
            credentialService.addTemporaryConnection(tempConn);
            
            boolean connected = sshClient.connect(tempId);
            if (connected) {
                var result = sshClient.executeCommand(tempId, "uname -a");
                sshClient.disconnect(tempId);
                credentialService.removeTemporaryConnection(tempId);
                
                return ApiResult.success(new TestResult(
                    true, 
                    "连接成功", 
                    new ServerInfo(
                        result.output().split("\n")[0],
                        connection.getHost(),
                        connection.getUsername()
                    )
                ));
            } else {
                credentialService.removeTemporaryConnection(tempId);
                return ApiResult.<TestResult>error(ErrorCode.SSH_CONNECTION_FAILED, "无法连接到服务器");
            }
        } catch (Exception e) {
            log.error("Connection test failed: {}", e.getMessage());
            return ApiResult.<TestResult>error(ErrorCode.SSH_CONNECTION_FAILED, e.getMessage());
        }
    }
    
    /**
     * Test result DTO
     */
    public record TestResult(
            boolean success,
            String message,
            ServerInfo serverInfo
    ) {}
    
    public record ServerInfo(
            String os,
            String host,
            String username
    ) {}
}