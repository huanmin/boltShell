package com.aisshtool.controller;

import com.aisshtool.model.ApiResult;
import com.aisshtool.model.ErrorCode;
import com.aisshtool.ssh.SshClient;
import com.aisshtool.ssh.SshClient.FileInfo;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * REST Controller for SFTP file operations
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/connections/{connectionId}/files")
@RequiredArgsConstructor
public class FileController {
    
    private final SshClient sshClient;
    
    /**
     * List directory contents
     */
    @GetMapping
    public ApiResult<List<FileInfo>> listDirectory(
            @PathVariable String connectionId,
            @RequestParam(defaultValue = "/") String path) {
        
        try {
            // Normalize path
            String normalizedPath = normalizePath(path);
            
            List<FileInfo> files = sshClient.listDirectory(connectionId, normalizedPath);
            return ApiResult.success(files);
        } catch (Exception e) {
            log.error("Failed to list directory: {}", e.getMessage());
            return ApiResult.error(ErrorCode.INTERNAL_ERROR, "无法列出目录: " + e.getMessage());
        }
    }
    
    /**
     * Download file or directory
     */
    @GetMapping("/download")
    public void downloadFile(
            @PathVariable String connectionId,
            @RequestParam String path,
            @RequestParam(required = false) Boolean isDirectory,
            HttpServletResponse response) {
        
        try {
            String normalizedPath = normalizePath(path);
            String fileName = getFileName(normalizedPath);
            
            // Determine if it's a directory
            boolean isDir = Boolean.TRUE.equals(isDirectory);
            
            if (isDir) {
                // Download as ZIP
                response.setContentType("application/zip");
                response.setHeader(HttpHeaders.CONTENT_DISPOSITION, 
                    "attachment; filename=\"" + URLEncoder.encode(fileName + ".zip", StandardCharsets.UTF_8) + "\"");
                
                try (ZipOutputStream zos = new ZipOutputStream(response.getOutputStream())) {
                    downloadDirectoryAsZip(connectionId, normalizedPath, fileName, zos);
                }
            } else {
                // Download single file
                response.setContentType(MediaType.APPLICATION_OCTET_STREAM_VALUE);
                response.setHeader(HttpHeaders.CONTENT_DISPOSITION, 
                    "attachment; filename=\"" + URLEncoder.encode(fileName, StandardCharsets.UTF_8) + "\"");
                
                try (InputStream is = sshClient.downloadFile(connectionId, normalizedPath)) {
                    is.transferTo(response.getOutputStream());
                }
            }
        } catch (Exception e) {
            log.error("Failed to download: {}", e.getMessage());
            try {
                response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "下载失败: " + e.getMessage());
            } catch (Exception ignored) {}
        }
    }
    
    /**
     * Upload file
     */
    @PostMapping("/upload")
    public ApiResult<Void> uploadFile(
            @PathVariable String connectionId,
            @RequestParam String path,
            @RequestParam("file") MultipartFile file) {
        
        try {
            String normalizedPath = normalizePath(path);
            String fileName = file.getOriginalFilename();
            String remotePath = normalizedPath + "/" + fileName;
            
            sshClient.uploadFile(connectionId, remotePath, file.getInputStream());
            
            return ApiResult.success("上传成功", null);
        } catch (Exception e) {
            log.error("Failed to upload file: {}", e.getMessage());
            return ApiResult.error(ErrorCode.INTERNAL_ERROR, "上传失败: " + e.getMessage());
        }
    }
    
    /**
     * Delete file or directory
     */
    @DeleteMapping
    public ApiResult<Void> delete(
            @PathVariable String connectionId,
            @RequestParam String path,
            @RequestParam boolean isDirectory) {
        
        try {
            String normalizedPath = normalizePath(path);
            sshClient.delete(connectionId, normalizedPath, isDirectory);
            return ApiResult.success("删除成功", null);
        } catch (Exception e) {
            log.error("Failed to delete: {}", e.getMessage());
            return ApiResult.error(ErrorCode.INTERNAL_ERROR, "删除失败: " + e.getMessage());
        }
    }
    
    /**
     * Create directory
     */
    @PostMapping("/mkdir")
    public ApiResult<Void> mkdir(
            @PathVariable String connectionId,
            @RequestParam String path) {
        
        try {
            String normalizedPath = normalizePath(path);
            sshClient.mkdir(connectionId, normalizedPath);
            return ApiResult.success("创建成功", null);
        } catch (Exception e) {
            log.error("Failed to create directory: {}", e.getMessage());
            return ApiResult.error(ErrorCode.INTERNAL_ERROR, "创建失败: " + e.getMessage());
        }
    }
    
    /**
     * Normalize path (remove trailing slash, handle . and ..)
     */
    private String normalizePath(String path) {
        if (path == null || path.isEmpty()) {
            return "/";
        }
        
        // Remove trailing slash
        if (path.length() > 1 && path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }
        
        return path;
    }
    
    /**
     * Get file name from path
     */
    private String getFileName(String path) {
        if (path == null || path.isEmpty() || path.equals("/")) {
            return "root";
        }
        
        int lastSlash = path.lastIndexOf('/');
        if (lastSlash >= 0 && lastSlash < path.length() - 1) {
            return path.substring(lastSlash + 1);
        }
        
        return path;
    }
    
    /**
     * Recursively download directory as ZIP
     */
    private void downloadDirectoryAsZip(String connectionId, String dirPath, String basePath, ZipOutputStream zos) throws IOException {
        List<FileInfo> files = sshClient.listDirectory(connectionId, dirPath);
        
        for (FileInfo file : files) {
            String entryName = basePath + "/" + file.name();
            String filePath = dirPath + "/" + file.name();
            
            if (file.isDirectory()) {
                // Add directory entry
                zos.putNextEntry(new ZipEntry(entryName + "/"));
                zos.closeEntry();
                
                // Recursively add contents
                downloadDirectoryAsZip(connectionId, filePath, entryName, zos);
            } else {
                // Add file entry
                zos.putNextEntry(new ZipEntry(entryName));
                
                try (InputStream is = sshClient.downloadFile(connectionId, filePath)) {
                    is.transferTo(zos);
                }
                
                zos.closeEntry();
            }
        }
    }
}