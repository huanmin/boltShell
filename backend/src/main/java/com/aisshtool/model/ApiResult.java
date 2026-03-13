package com.aisshtool.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Standard API response wrapper
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResult<T> {
    
    /**
     * Response code: 0 for success, non-zero for errors
     */
    private int code;
    
    /**
     * Response message
     */
    private String message;
    
    /**
     * Response data
     */
    private T data;
    
    // ============ Factory methods ============
    
    public static <T> ApiResult<T> success(T data) {
        return ApiResult.<T>builder()
                .code(0)
                .data(data)
                .build();
    }
    
    public static <T> ApiResult<T> success(String message, T data) {
        return ApiResult.<T>builder()
                .code(0)
                .message(message)
                .data(data)
                .build();
    }
    
    public static <T> ApiResult<T> error(int code, String message) {
        return ApiResult.<T>builder()
                .code(code)
                .message(message)
                .build();
    }
    
    public static <T> ApiResult<T> error(ErrorCode errorCode) {
        return ApiResult.<T>builder()
                .code(errorCode.getCode())
                .message(errorCode.getMessage())
                .build();
    }
    
    public static <T> ApiResult<T> error(ErrorCode errorCode, String details) {
        return ApiResult.<T>builder()
                .code(errorCode.getCode())
                .message(errorCode.getMessage() + ": " + details)
                .build();
    }
}