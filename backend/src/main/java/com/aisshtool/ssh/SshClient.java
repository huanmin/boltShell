package com.aisshtool.ssh;

import com.aisshtool.model.Connection;
import com.aisshtool.security.EncryptionService;
import com.aisshtool.service.CredentialService;
import lombok.extern.slf4j.Slf4j;
import net.schmizz.sshj.SSHClient;
import net.schmizz.sshj.connection.channel.direct.PTYMode;
import net.schmizz.sshj.connection.channel.direct.Session;
import net.schmizz.sshj.sftp.SFTPClient;
import net.schmizz.sshj.sftp.RemoteResourceInfo;
import net.schmizz.sshj.transport.verification.OpenSSHKnownHosts;
import net.schmizz.sshj.transport.verification.PromiscuousVerifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * SSH Client wrapper using SSHJ
 */
@Slf4j
@Component
public class SshClient {
    
    private final CredentialService credentialService;
    private final EncryptionService encryptionService;
    private final Map<String, SSHClient> activeClients = new ConcurrentHashMap<>();
    private final Map<String, Session> activeSessions = new ConcurrentHashMap<>();
    private final Map<String, SFTPClient> sftpClients = new ConcurrentHashMap<>();
    
    @Value("${app.ssh.verify-host-key:true}")
    private boolean verifyHostKey;
    
    @Value("${app.ssh.known-hosts-file:#{systemProperties['user.home'] + '/.ssh/known_hosts'}")
    private String knownHostsFile;
    
    public SshClient(CredentialService credentialService, EncryptionService encryptionService) {
        this.credentialService = credentialService;
        this.encryptionService = encryptionService;
    }
    
    /**
     * Connect to SSH server
     */
    public boolean connect(String connectionId) {
        Connection conn = credentialService.getConnectionWithCredentials(connectionId)
                .orElse(null);
        
        if (conn == null) {
            log.error("Connection not found: {}", connectionId);
            return false;
        }
        
        log.info("Connecting to {}:{} as {} (authType={})", 
                conn.getHost(), conn.getPort(), conn.getUsername(), conn.getAuthType());
        
        try {
            SSHClient client = new SSHClient();
            
            // Configure host key verification
            if (verifyHostKey) {
                Path knownHostsPath = Paths.get(knownHostsFile);
                if (Files.exists(knownHostsPath)) {
                    try {
                        client.addHostKeyVerifier(new OpenSSHKnownHosts(knownHostsPath.toFile()));
                        log.info("Using known_hosts file: {}", knownHostsPath);
                    } catch (Exception e) {
                        log.warn("Failed to load known_hosts: {}, using promiscuous verifier", e.getMessage());
                        client.addHostKeyVerifier(new PromiscuousVerifier());
                    }
                } else {
                    log.warn("known_hosts file not found at {}, host key verification disabled", knownHostsPath);
                    client.addHostKeyVerifier(new PromiscuousVerifier());
                }
            } else {
                log.info("Host key verification is DISABLED");
                client.addHostKeyVerifier(new PromiscuousVerifier());
            }
            
            client.setConnectTimeout(30000);
            
            log.info("Connecting to {}:{}...", conn.getHost(), conn.getPort());
            client.connect(conn.getHost(), conn.getPort());
            
            // Authenticate
            if (conn.getAuthType() == Connection.AuthType.PASSWORD) {
                String password = conn.getPassword();
                // Decrypt password if it's encrypted
                if (password != null && isEncrypted(password)) {
                    log.info("Decrypting stored password...");
                    password = encryptionService.decrypt(password);
                }
                log.info("Authenticating with password (length={})", password != null ? password.length() : "null");
                if (password == null || password.isEmpty()) {
                    log.error("Password is null or empty!");
                    client.disconnect();
                    return false;
                }
                client.authPassword(conn.getUsername(), password);
            } else {
                // Key-based auth
                client.authPublickey(conn.getUsername());
            }
            
            activeClients.put(connectionId, client);
            credentialService.updateLastConnected(connectionId);
            
            log.info("Connected to {}:{}", conn.getHost(), conn.getPort());
            return true;
            
        } catch (Exception e) {
            log.error("Failed to connect to {}: {} - {}", conn.getHost(), e.getClass().getSimpleName(), e.getMessage());
            return false;
        }
    }
    
    /**
     * Get or create SFTP client
     */
    public SFTPClient getSftpClient(String connectionId) throws IOException {
        // Check if we already have an SFTP client
        SFTPClient sftp = sftpClients.get(connectionId);
        if (sftp != null) {
            return sftp;
        }
        
        // Check if SSH client exists and is connected
        SSHClient client = activeClients.get(connectionId);
        if (client == null || !client.isConnected()) {
            // Try to connect
            if (!connect(connectionId)) {
                throw new IOException("Failed to connect to SSH server");
            }
            client = activeClients.get(connectionId);
        }
        
        // Create SFTP client
        sftp = client.newSFTPClient();
        sftpClients.put(connectionId, sftp);
        log.info("Created SFTP client for {}", connectionId);
        
        return sftp;
    }
    
    /**
     * List directory contents
     */
    public List<FileInfo> listDirectory(String connectionId, String path) throws IOException {
        SFTPClient sftp = getSftpClient(connectionId);
        List<FileInfo> files = new ArrayList<>();
        
        try {
            List<RemoteResourceInfo> items = sftp.ls(path);
            for (RemoteResourceInfo item : items) {
                files.add(new FileInfo(
                    item.getName(),
                    path + "/" + item.getName(),
                    item.isDirectory(),
                    item.getAttributes().getSize(),
                    item.getAttributes().getMtime() * 1000, // Convert to milliseconds
                    item.getAttributes().getMode().toString()
                ));
            }
        } catch (Exception e) {
            log.error("Failed to list directory {}: {}", path, e.getMessage());
            throw new IOException("Failed to list directory: " + e.getMessage());
        }
        
        return files;
    }
    
    /**
     * Download file
     */
    public InputStream downloadFile(String connectionId, String remotePath) throws IOException {
        SFTPClient sftp = getSftpClient(connectionId);
        
        try {
            // Create a temporary file
            Path tempFile = Files.createTempFile("sftp-download-", ".tmp");
            sftp.get(remotePath, tempFile.toString());
            
            // Return input stream
            return Files.newInputStream(tempFile);
        } catch (Exception e) {
            log.error("Failed to download file {}: {}", remotePath, e.getMessage());
            throw new IOException("Failed to download file: " + e.getMessage());
        }
    }
    
    /**
     * Upload file
     */
    public void uploadFile(String connectionId, String remotePath, InputStream inputStream) throws IOException {
        SFTPClient sftp = getSftpClient(connectionId);
        
        try {
            // Create temp file from input stream
            Path tempFile = Files.createTempFile("sftp-upload-", ".tmp");
            Files.copy(inputStream, tempFile, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            
            sftp.put(tempFile.toString(), remotePath);
            
            // Cleanup temp file
            Files.deleteIfExists(tempFile);
            
            log.info("Uploaded file to {}", remotePath);
        } catch (Exception e) {
            log.error("Failed to upload file {}: {}", remotePath, e.getMessage());
            throw new IOException("Failed to upload file: " + e.getMessage());
        }
    }
    
    /**
     * Delete file or directory
     */
    public void delete(String connectionId, String path, boolean isDirectory) throws IOException {
        SFTPClient sftp = getSftpClient(connectionId);
        
        try {
            if (isDirectory) {
                sftp.rmdir(path);
            } else {
                sftp.rm(path);
            }
            log.info("Deleted: {}", path);
        } catch (Exception e) {
            log.error("Failed to delete {}: {}", path, e.getMessage());
            throw new IOException("Failed to delete: " + e.getMessage());
        }
    }
    
    /**
     * Create directory
     */
    public void mkdir(String connectionId, String path) throws IOException {
        SFTPClient sftp = getSftpClient(connectionId);
        
        try {
            sftp.mkdir(path);
            log.info("Created directory: {}", path);
        } catch (Exception e) {
            log.error("Failed to create directory {}: {}", path, e.getMessage());
            throw new IOException("Failed to create directory: " + e.getMessage());
        }
    }
    
    /**
     * Start an interactive shell session
     */
    public Session.Shell startShell(String connectionId) throws IOException {
        SSHClient client = activeClients.get(connectionId);
        if (client == null) {
            throw new IOException("Not connected: " + connectionId);
        }
        
        Session session = client.startSession();
        session.allocatePTY("xterm-256color", 120, 40, 640, 480, Map.of(
                PTYMode.ONLCR, 1,
                PTYMode.ECHO, 1
        ));
        
        Session.Shell shell = session.startShell();
        activeSessions.put(connectionId, session);
        
        log.info("Started shell for {}", connectionId);
        return shell;
    }
    
    /**
     * Execute a command and return output
     */
    public CommandResult executeCommand(String connectionId, String command) {
        SSHClient client = activeClients.get(connectionId);
        if (client == null) {
            return new CommandResult(-1, "", "Not connected");
        }
        
        try (Session session = client.startSession()) {
            Session.Command cmd = session.exec(command);
            
            String output = readStream(cmd.getInputStream(), 1024 * 1024); // 1MB limit
            String error = readStream(cmd.getErrorStream(), 1024 * 1024);
            
            cmd.join();
            
            return new CommandResult(cmd.getExitStatus(), output, error);
            
        } catch (Exception e) {
            log.error("Failed to execute command: {}", e.getMessage());
            return new CommandResult(-1, "", e.getMessage());
        }
    }
    
    /**
     * Disconnect from server
     */
    public void disconnect(String connectionId) {
        // Close SFTP client
        SFTPClient sftp = sftpClients.remove(connectionId);
        if (sftp != null) {
            try {
                sftp.close();
            } catch (Exception e) {
                log.warn("Failed to close SFTP client: {}", e.getMessage());
            }
        }
        
        // Close session
        Session session = activeSessions.remove(connectionId);
        if (session != null) {
            try {
                session.close();
            } catch (Exception e) {
                log.warn("Failed to close session: {}", e.getMessage());
            }
        }
        
        // Close SSH client
        SSHClient client = activeClients.remove(connectionId);
        if (client != null) {
            try {
                client.disconnect();
                log.info("Disconnected: {}", connectionId);
            } catch (Exception e) {
                log.warn("Failed to disconnect: {}", e.getMessage());
            }
        }
    }
    
    /**
     * Check if connected
     */
    public boolean isConnected(String connectionId) {
        SSHClient client = activeClients.get(connectionId);
        return client != null && client.isConnected();
    }
    
    /**
     * Check if a string looks like encrypted data (Base64)
     */
    private boolean isEncrypted(String value) {
        if (value == null || value.isEmpty()) {
            return false;
        }
        // Encrypted values are Base64 and typically longer than 20 chars
        return value.length() > 20 && value.matches("^[A-Za-z0-9+/]+=*$");
    }
    
    /**
     * Read stream with size limit to prevent OOM
     */
    private String readStream(InputStream is, int maxSize) throws IOException {
        byte[] buffer = new byte[4096];
        StringBuilder sb = new StringBuilder();
        int totalRead = 0;
        int len;
        
        while ((len = is.read(buffer)) != -1) {
            totalRead += len;
            if (totalRead > maxSize) {
                log.warn("Stream output exceeded max size ({}), truncating", maxSize);
                sb.append("\n[Output truncated - exceeded ").append(maxSize).append(" bytes]");
                break;
            }
            sb.append(new String(buffer, 0, len));
        }
        return sb.toString();
    }
    
    public record CommandResult(int exitCode, String output, String error) {}
    
    public record FileInfo(
        String name,
        String path,
        boolean isDirectory,
        long size,
        long modifiedTime,
        String permissions
    ) {}
}