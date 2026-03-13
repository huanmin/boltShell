package com.aisshtool.model;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * Error codes for API responses
 */
@Getter
@AllArgsConstructor
public enum ErrorCode {
    
    // General errors (1xxx)
    PARAM_ERROR(1001, "参数错误"),
    CONNECTION_NOT_FOUND(1002, "连接不存在"),
    CONNECTION_ALREADY_EXISTS(1003, "连接已存在"),
    
    // SSH errors (2xxx)
    SSH_CONNECTION_FAILED(2001, "SSH连接失败"),
    SSH_AUTH_FAILED(2002, "SSH认证失败"),
    SSH_SESSION_CLOSED(2003, "SSH会话已断开"),
    SSH_COMMAND_FAILED(2004, "SSH命令执行失败"),
    
    // AI errors (3xxx)
    AI_CONFIG_MISSING(3001, "AI配置缺失"),
    AI_REQUEST_FAILED(3002, "AI请求失败"),
    AI_TIMEOUT(3003, "AI请求超时"),
    
    // File errors (4xxx)
    FILE_NOT_FOUND(4001, "文件不存在"),
    FILE_UPLOAD_FAILED(4002, "文件上传失败"),
    FILE_DOWNLOAD_FAILED(4003, "文件下载失败"),
    
    // Server errors (5xxx)
    INTERNAL_ERROR(5001, "服务内部错误");
    
    private final int code;
    private final String message;
}