package com.aisshtool.websocket;

import com.aisshtool.security.DangerCommandChecker;
import com.aisshtool.service.CredentialService;
import com.aisshtool.ssh.SshClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import net.schmizz.sshj.connection.channel.direct.Session;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket Handler for SSH terminal sessions
 */
@Slf4j
@Component
public class SshWebSocketHandler implements WebSocketHandler {
    
    private final SshClient sshClient;
    private final CredentialService credentialService;
    private final DangerCommandChecker dangerChecker;
    private final ObjectMapper objectMapper;
    
    // Active WebSocket sessions
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    // WebSocket session ID -> SSH shell
    private final Map<String, Session.Shell> shells = new ConcurrentHashMap<>();
    
    public SshWebSocketHandler(SshClient sshClient, CredentialService credentialService, 
                               DangerCommandChecker dangerChecker) {
        this.sshClient = sshClient;
        this.credentialService = credentialService;
        this.dangerChecker = dangerChecker;
        this.objectMapper = new ObjectMapper();
    }
    
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String connectionId = getConnectionId(session);
        log.info("WebSocket connection established: {} -> {}", session.getId(), connectionId);
        
        sessions.put(session.getId(), session);
        
        // Send connection status
        sendMessage(session, Map.of(
                "type", "connection.status",
                "payload", Map.of(
                        "status", "connecting",
                        "sessionId", session.getId()
                )
        ));
        
        // Connect to SSH server
        boolean connected = sshClient.connect(connectionId);
        
        if (connected) {
            sendMessage(session, Map.of(
                    "type", "connection.status",
                    "payload", Map.of(
                            "status", "connected",
                            "sessionId", session.getId()
                    )
            ));
            
            // Start shell
            try {
                Session.Shell shell = sshClient.startShell(connectionId);
                shells.put(session.getId(), shell);
                
                // Start output reader thread
                startOutputReader(session, shell);
                
            } catch (Exception e) {
                log.error("Failed to start shell: {}", e.getMessage());
                sendError(session, "SSH_SESSION_ERROR", "Failed to start shell: " + e.getMessage());
            }
        } else {
            sendError(session, "SSH_CONNECTION_FAILED", "Failed to connect to SSH server");
        }
    }
    
    @Override
    public void handleMessage(WebSocketSession session, WebSocketMessage<?> message) throws Exception {
        if (!(message instanceof TextMessage)) {
            return;
        }
        
        String payload = ((TextMessage) message).getPayload();
        @SuppressWarnings("unchecked")
        Map<String, Object> msg = objectMapper.readValue(payload, Map.class);
        
        String type = (String) msg.get("type");
        @SuppressWarnings("unchecked")
        Map<String, Object> msgPayload = (Map<String, Object>) msg.get("payload");
        
        switch (type) {
            case "terminal.input" -> handleTerminalInput(session, msgPayload);
            case "terminal.resize" -> handleTerminalResize(session, msgPayload);
            case "ai.chat" -> handleAiChat(session, msgPayload);
            case "ai.confirm" -> handleAiConfirm(session, msgPayload);
            case "ping" -> sendMessage(session, Map.of("type", "pong", "payload", Map.of()));
        }
    }
    
    private void handleTerminalInput(WebSocketSession session, Map<String, Object> payload) throws IOException {
        String data = (String) payload.get("data");
        Session.Shell shell = shells.get(session.getId());
        
        if (shell != null && data != null) {
            shell.getOutputStream().write(data.getBytes());
            shell.getOutputStream().flush();
        }
    }
    
    private void handleTerminalResize(WebSocketSession session, Map<String, Object> payload) {
        Integer cols = (Integer) payload.get("cols");
        Integer rows = (Integer) payload.get("rows");
        log.debug("Terminal resize: {}x{}", cols, rows);
        // TODO: Implement PTY resize
    }
    
    private void handleAiChat(WebSocketSession session, Map<String, Object> payload) throws IOException {
        String message = (String) payload.get("message");
        log.info("AI chat request: {}", message);
        
        // TODO: Integrate with Spring AI
        // For now, return a mock response
        String suggestedCommand = generateMockCommand(message);
        
        // Check for dangerous patterns
        DangerCommandChecker.DangerCheckResult checkResult = dangerChecker.check(suggestedCommand);
        
        sendMessage(session, Map.of(
                "type", "ai.response",
                "payload", Map.of(
                        "commandId", "cmd-" + System.currentTimeMillis(),
                        "command", suggestedCommand,
                        "explanation", "根据您的描述生成的命令",
                        "riskLevel", checkResult.level().getCode(),
                        "warnings", checkResult.warnings()
                )
        ));
    }
    
    private void handleAiConfirm(WebSocketSession session, Map<String, Object> payload) throws IOException {
        String commandId = (String) payload.get("commandId");
        String action = (String) payload.get("action");
        String command = (String) payload.get("command");
        
        if ("execute".equals(action) && command != null) {
            // Execute command
            Session.Shell shell = shells.get(session.getId());
            if (shell != null) {
                shell.getOutputStream().write((command + "\n").getBytes());
                shell.getOutputStream().flush();
                
                sendMessage(session, Map.of(
                        "type", "command.result",
                        "payload", Map.of(
                                "commandId", commandId,
                                "command", command,
                                "status", "executed"
                        )
                ));
            }
        }
    }
    
    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        log.error("WebSocket transport error: {}", exception.getMessage());
    }
    
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        log.info("WebSocket connection closed: {} - {}", session.getId(), status);
        
        sessions.remove(session.getId());
        shells.remove(session.getId());
        
        String connectionId = getConnectionId(session);
        sshClient.disconnect(connectionId);
    }
    
    @Override
    public boolean supportsPartialMessages() {
        return false;
    }
    
    private String getConnectionId(WebSocketSession session) {
        String query = session.getUri().getQuery();
        if (query != null && query.contains("connectionId=")) {
            return query.split("connectionId=")[1].split("&")[0];
        }
        return "unknown";
    }
    
    private void sendMessage(WebSocketSession session, Map<String, Object> message) throws IOException {
        if (session.isOpen()) {
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
        }
    }
    
    private void sendError(WebSocketSession session, String code, String message) throws IOException {
        sendMessage(session, Map.of(
                "type", "error",
                "payload", Map.of("code", code, "message", message)
        ));
    }
    
    private void startOutputReader(WebSocketSession session, Session.Shell shell) {
        Thread readerThread = new Thread(() -> {
            try {
                byte[] buffer = new byte[4096];
                int len;
                while ((len = shell.getInputStream().read(buffer)) != -1) {
                    if (session.isOpen()) {
                        String output = new String(buffer, 0, len);
                        sendMessage(session, Map.of(
                                "type", "terminal.output",
                                "payload", Map.of("data", output)
                        ));
                    }
                }
            } catch (Exception e) {
                log.error("Output reader error: {}", e.getMessage());
            }
        });
        readerThread.setDaemon(true);
        readerThread.start();
    }
    
    private String generateMockCommand(String message) {
        // Simple mock command generation based on keywords
        if (message.contains("最大") || message.contains("大文件")) {
            return "du -ah . | sort -rh | head -n 10";
        } else if (message.contains("进程") || message.contains("cpu")) {
            return "ps aux --sort=-%cpu | head -n 10";
        } else if (message.contains("内存")) {
            return "free -h";
        } else if (message.contains("磁盘") || message.contains("空间")) {
            return "df -h";
        } else if (message.contains("日志")) {
            return "tail -n 100 /var/log/syslog";
        } else if (message.contains("端口") || message.contains("网络")) {
            return "netstat -tuln";
        } else {
            return "ls -la";
        }
    }
}