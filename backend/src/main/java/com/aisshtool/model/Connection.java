package com.aisshtool.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * SSH Connection configuration model
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Connection {
    
    private String id;
    private String name;
    private String host;
    private Integer port;
    private String username;
    private AuthType authType;
    
    // Sensitive fields - use write-only for serialization (can be received but not returned)
    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.WRITE_ONLY)
    private String password;
    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.WRITE_ONLY)
    private String privateKey;
    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.WRITE_ONLY)
    private String passphrase;
    
    // 是否保存凭证
    private Boolean rememberCredential;
    
    private Instant createdAt;
    private Instant lastConnectedAt;
    
    public enum AuthType {
        PASSWORD,
        KEY
    }
    
    /**
     * Create a copy without sensitive data for API responses
     */
    public Connection toSafeCopy() {
        return Connection.builder()
                .id(this.id)
                .name(this.name)
                .host(this.host)
                .port(this.port)
                .username(this.username)
                .authType(this.authType)
                .rememberCredential(this.rememberCredential)
                .createdAt(this.createdAt)
                .lastConnectedAt(this.lastConnectedAt)
                .build();
    }
}