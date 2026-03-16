package com.aisshtool.websocket;

import com.aisshtool.security.DangerCommandChecker;
import com.aisshtool.service.AiService;
import com.aisshtool.service.CredentialService;
import com.aisshtool.ssh.SshClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import net.schmizz.sshj.connection.channel.direct.Session;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CompletableFuture;

/**
 * WebSocket Handler for SSH terminal sessions
 */
@Slf4j
@Component
public class SshWebSocketHandler implements WebSocketHandler {

    private final SshClient sshClient;
    private final CredentialService credentialService;
    private final DangerCommandChecker dangerChecker;
    private final AiService aiService;
    private final ObjectMapper objectMapper;

    // Active WebSocket sessions
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    // WebSocket session ID -> SSH shell
    private final Map<String, Session.Shell> shells = new ConcurrentHashMap<>();

    // Command tracking: commandId -> output buffer
    private final Map<String, StringBuilder> commandOutputs = new ConcurrentHashMap<>();
    // Command tracking: commandId -> WebSocket session ID
    private final Map<String, String> commandSessionMap = new ConcurrentHashMap<>();
    // Command tracking: commandId -> original command
    private final Map<String, String> commandMap = new ConcurrentHashMap<>();

    // Prompt detection pattern (simplified - matches common shell prompts)
    private static final java.util.regex.Pattern PROMPT_PATTERN = java.util.regex.Pattern.compile(
            "[#$>]\\s*$|\\].*[$#]\\s*$"
    );

    public SshWebSocketHandler(SshClient sshClient, CredentialService credentialService,
                               DangerCommandChecker dangerChecker, AiService aiService) {
        this.sshClient = sshClient;
        this.credentialService = credentialService;
        this.dangerChecker = dangerChecker;
        this.aiService = aiService;
        this.objectMapper = new ObjectMapper();
    }
    
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String connectionId = getConnectionId(session);
        log.info("WebSocket connection established: {} -> {}", session.getId(), connectionId);

        sessions.put(session.getId(), session);

        // Process asynchronously to avoid blocking and give browser time to settle
        CompletableFuture.runAsync(() -> {
            try {
                // Small delay to let the browser fully establish the connection
                Thread.sleep(50);

                if (!session.isOpen()) {
                    log.warn("Session closed before we could start: {}", session.getId());
                    return;
                }

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

                if (!session.isOpen()) {
                    log.warn("Session closed during SSH connect: {}", session.getId());
                    return;
                }

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
            } catch (Exception e) {
                log.error("Error in async connection handler: {}", e.getMessage());
            }
        });
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
            case "ai.command.execute" -> handleAiCommandExecute(session, msgPayload);
            case "ai.command.hint" -> handleAiCommandHint(session, msgPayload);
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
    
    private void handleAiChat(WebSocketSession session, Map<String, Object> payload) {
        String message = (String) payload.get("message");
        String queryParam = (String) payload.get("query");
        final String query = queryParam != null ? queryParam : message;
        log.info("AI chat request: {}", message);

        // Use streaming AI service
        aiService.generateCommandStreaming(
                message,
                // onProgress - send partial content
                (partialContent) -> {
                    try {
                        if (session.isOpen()) {
                            sendMessage(session, Map.of(
                                    "type", "ai.progress",
                                    "payload", Map.of(
                                            "content", partialContent
                                    )
                            ));
                        }
                    } catch (Exception e) {
                        log.error("Failed to send progress: {}", e.getMessage());
                    }
                },
                // onComplete - send final result
                (result) -> {
                    try {
                        if (session.isOpen()) {
                            // Check for dangerous patterns
                            DangerCommandChecker.DangerCheckResult checkResult = dangerChecker.check(result.command());

                            // Combine AI warnings with danger checker warnings
                            List<String> allWarnings = new java.util.ArrayList<>(result.warnings());
                            allWarnings.addAll(checkResult.warnings());

                            // Use the higher risk level
                            String riskLevel = getHigherRiskLevel(result.riskLevel(), checkResult.level().getCode());

                            sendMessage(session, Map.of(
                                    "type", "ai.response",
                                    "payload", Map.of(
                                            "commandId", "cmd-" + System.currentTimeMillis(),
                                            "query", query,
                                            "command", result.command(),
                                            "explanation", result.explanation(),
                                            "riskLevel", riskLevel,
                                            "warnings", allWarnings
                                    )
                            ));
                        }
                    } catch (Exception e) {
                        log.error("Failed to send AI response: {}", e.getMessage());
                    }
                },
                // onError - send error
                (errorMessage) -> {
                    try {
                        if (session.isOpen()) {
                            sendError(session, "AI_CONFIG_ERROR", errorMessage);
                        }
                    } catch (Exception e) {
                        log.error("Failed to send error: {}", e.getMessage());
                    }
                }
        );
    }

    private String getHigherRiskLevel(String level1, String level2) {
        int priority1 = getRiskPriority(level1);
        int priority2 = getRiskPriority(level2);
        return priority1 >= priority2 ? level1 : level2;
    }

    private int getRiskPriority(String level) {
        return switch (level.toLowerCase()) {
            case "critical" -> 4;
            case "high" -> 3;
            case "medium" -> 2;
            default -> 1;
        };
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

    /**
     * Handle AI command execution with tracking
     */
    private void handleAiCommandExecute(WebSocketSession session, Map<String, Object> payload) throws IOException {
        String command = (String) payload.get("command");
        String historyId = (String) payload.get("historyId");

        if (command == null || command.isEmpty()) {
            return;
        }

        Session.Shell shell = shells.get(session.getId());
        if (shell != null) {
            // Initialize command tracking
            commandOutputs.put(historyId, new StringBuilder());
            commandSessionMap.put(historyId, session.getId());
            commandMap.put(historyId, command);

            // Notify client that we're tracking this command
            sendMessage(session, Map.of(
                    "type", "ai.command.tracking",
                    "payload", Map.of("commandId", historyId)
            ));

            // Execute the command
            shell.getOutputStream().write((command + "\n").getBytes());
            shell.getOutputStream().flush();

            log.info("Started tracking command: {} with ID: {}", command, historyId);
        }
    }

    /**
     * Handle command hint request
     */
    private void handleAiCommandHint(WebSocketSession session, Map<String, Object> payload) {
        String partialCommand = (String) payload.get("partialCommand");

        if (partialCommand == null || partialCommand.isEmpty()) {
            return;
        }

        aiService.getCommandHints(
                partialCommand,
                // onComplete
                (hints) -> {
                    try {
                        if (session.isOpen()) {
                            List<Map<String, String>> hintsList = hints.stream()
                                    .map(h -> Map.of(
                                            "command", h.command(),
                                            "description", h.description()
                                    ))
                                    .toList();

                            sendMessage(session, Map.of(
                                    "type", "ai.command.hints",
                                    "payload", Map.of("hints", hintsList)
                            ));
                        }
                    } catch (Exception e) {
                        log.error("Failed to send command hints: {}", e.getMessage());
                    }
                },
                // onError
                (errorMessage) -> {
                    log.warn("Command hint error: {}", errorMessage);
                }
        );
    }

    /**
     * Handle command completion (called when prompt is detected)
     */
    private void handleCommandComplete(String sessionId, String output) {
        // Find any commands being tracked for this session
        for (Map.Entry<String, String> entry : commandSessionMap.entrySet()) {
            String commandId = entry.getKey();
            String sId = entry.getValue();

            if (sId.equals(sessionId)) {
                StringBuilder outputBuffer = commandOutputs.get(commandId);
                String command = commandMap.get(commandId);
                String fullOutput = outputBuffer != null ? outputBuffer.toString() : "";

                // Clean up tracking
                commandOutputs.remove(commandId);
                commandSessionMap.remove(commandId);
                commandMap.remove(commandId);

                // Get session and send completion notification
                WebSocketSession session = sessions.get(sessionId);
                if (session != null && session.isOpen()) {
                    try {
                        // Send command complete notification
                        sendMessage(session, Map.of(
                                "type", "ai.command.complete",
                                "payload", Map.of(
                                        "commandId", commandId,
                                        "output", fullOutput
                                )
                        ));

                        // Analyze output for follow-up suggestions (async)
                        analyzeCommandOutputAsync(session, command, fullOutput, commandId);
                    } catch (Exception e) {
                        log.error("Failed to send command complete: {}", e.getMessage());
                    }
                }
                break;
            }
        }
    }

    /**
     * Analyze command output asynchronously for follow-up suggestions
     */
    private void analyzeCommandOutputAsync(WebSocketSession session, String command, String output, String commandId) {
        CompletableFuture.runAsync(() -> {
            try {
                aiService.analyzeCommandOutput(
                        command,
                        output,
                        // onProgress - not used for analysis
                        (partial) -> {},
                        // onComplete
                        (result) -> {
                            try {
                                if (session.isOpen() && result.followUpNeeded()) {
                                    sendMessage(session, Map.of(
                                            "type", "ai.followup",
                                            "payload", Map.of(
                                                    "commandId", commandId,
                                                    "suggestion", result.suggestion(),
                                                    "followUpCommand", result.followUpCommand()
                                            )
                                    ));
                                }
                            } catch (Exception e) {
                                log.error("Failed to send follow-up: {}", e.getMessage());
                            }
                        },
                        // onError
                        (error) -> {
                            log.warn("Failed to analyze command output: {}", error);
                        }
                );
            } catch (Exception e) {
                log.error("Error in async output analysis: {}", e.getMessage());
            }
        });
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

                        // Track command output if there's an active command for this session
                        String sessionId = session.getId();
                        for (Map.Entry<String, String> entry : commandSessionMap.entrySet()) {
                            if (entry.getValue().equals(sessionId)) {
                                String commandId = entry.getKey();
                                StringBuilder outputBuffer = commandOutputs.get(commandId);
                                if (outputBuffer != null) {
                                    outputBuffer.append(output);
                                }

                                // Check for prompt (command completion)
                                if (PROMPT_PATTERN.matcher(output).find()) {
                                    handleCommandComplete(sessionId, output);
                                }
                                break;
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.error("Output reader error: {}", e.getMessage());
            }
        });
        readerThread.setDaemon(true);
        readerThread.start();
    }
}