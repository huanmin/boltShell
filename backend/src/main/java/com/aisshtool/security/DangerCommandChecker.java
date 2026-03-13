package com.aisshtool.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Detects dangerous shell commands
 * 
 * Uses pre-compiled regex patterns for performance.
 */
@Slf4j
@Component
public class DangerCommandChecker {
    
    // Pre-compiled patterns for critical risk
    private static final Pattern[] CRITICAL_PATTERNS = compilePatterns(
            "rm\\s+-rf\\s+/(\\s|$)",           // rm -rf /
            "rm\\s+-rf\\s+/\\*(\\s|$)",        // rm -rf /*
            "rm\\s+-rf\\s+~(\\s|$)",           // rm -rf ~
            "rm\\s+-rf\\s+~\\*(\\s|$)",        // rm -rf ~*
            "dd\\s+if=/dev/zero\\s+of=/dev/",  // dd disk wipe
            "dd\\s+if=/dev/null\\s+of=/dev/",  // dd disk wipe
            "mkfs\\.",                          // mkfs
            ":\\(\\)\\s*\\{\\s*:\\|:&\\s*\\};\\s*:", // fork bomb
            ">.*/dev/sd[a-z]",                  // redirect to disk
            "chmod\\s+-R\\s+777\\s+/",          // chmod 777 /
            "chown\\s+-R\\s+.*\\s+/"            // chown -R /
    );
    
    // Pre-compiled patterns for high risk
    private static final Pattern[] HIGH_PATTERNS = compilePatterns(
            "rm\\s+-rf\\s+\\*",                // rm -rf *
            "rm\\s+-rf\\s+\\.\\*",             // rm -rf .*
            "shutdown",                        // shutdown
            "reboot",                          // reboot
            "halt",                            // halt
            "init\\s+0",                       // init 0
            "init\\s+6",                       // init 6
            "kill\\s+-9\\s+-1",               // kill -9 -1
            "killall\\s+.*",                   // killall
            "chmod\\s+777"                     // chmod 777
    );
    
    // Pre-compiled patterns for medium risk
    private static final Pattern[] MEDIUM_PATTERNS = compilePatterns(
            "rm\\s+-rf",                       // rm -rf
            "rm\\s+-r",                        // rm -r
            "mv\\s+.*/dev/null",              // mv to /dev/null
            ">(\\s*)/dev/null",               // redirect to /dev/null
            "sudo\\s+rm"                       // sudo rm
    );
    
    // Warning messages corresponding to patterns
    private static final String[] CRITICAL_WARNINGS = {
            "将删除整个系统根目录",
            "将删除整个系统根目录",
            "将删除用户主目录",
            "将删除用户主目录",
            "将清空磁盘数据",
            "将清空磁盘数据",
            "将格式化磁盘",
            "Fork炸弹，将导致系统崩溃",
            "将清空磁盘",
            "将修改整个系统权限，存在安全风险",
            "将修改整个系统所有者，存在安全风险"
    };
    
    private static final String[] HIGH_WARNINGS = {
            "将删除当前目录所有文件",
            "将删除所有隐藏文件",
            "将关闭系统",
            "将重启系统",
            "将停止系统",
            "将关闭系统",
            "将重启系统",
            "将杀死所有进程",
            "将杀死指定名称的所有进程",
            "设置不安全的权限"
    };
    
    private static final String[] MEDIUM_WARNINGS = {
            "强制删除文件",
            "递归删除目录",
            "将移动文件到/dev/null",
            "重定向到/dev/null",
            "使用sudo删除文件"
    };
    
    /**
     * Check command for dangerous patterns
     */
    public DangerCheckResult check(String command) {
        if (command == null || command.trim().isEmpty()) {
            return new DangerCheckResult(RiskLevel.LOW, List.of());
        }
        
        List<String> warnings = new ArrayList<>();
        RiskLevel maxLevel = RiskLevel.LOW;
        
        // Check critical patterns
        for (int i = 0; i < CRITICAL_PATTERNS.length; i++) {
            if (CRITICAL_PATTERNS[i].matcher(command).find()) {
                warnings.add("⚠️ " + CRITICAL_WARNINGS[i]);
                maxLevel = RiskLevel.CRITICAL;
            }
        }
        
        // Check high patterns (only if not already critical)
        if (maxLevel != RiskLevel.CRITICAL) {
            for (int i = 0; i < HIGH_PATTERNS.length; i++) {
                if (HIGH_PATTERNS[i].matcher(command).find()) {
                    warnings.add("⚠️ " + HIGH_WARNINGS[i]);
                    maxLevel = RiskLevel.HIGH;
                }
            }
        }
        
        // Check medium patterns (only if still low)
        if (maxLevel == RiskLevel.LOW) {
            for (int i = 0; i < MEDIUM_PATTERNS.length; i++) {
                if (MEDIUM_PATTERNS[i].matcher(command).find()) {
                    warnings.add("⚠️ " + MEDIUM_WARNINGS[i]);
                    maxLevel = RiskLevel.MEDIUM;
                }
            }
        }
        
        return new DangerCheckResult(maxLevel, warnings);
    }
    
    /**
     * Helper method to compile patterns array
     */
    private static Pattern[] compilePatterns(String... regexes) {
        Pattern[] patterns = new Pattern[regexes.length];
        for (int i = 0; i < regexes.length; i++) {
            patterns[i] = Pattern.compile(regexes[i]);
        }
        return patterns;
    }
    
    public enum RiskLevel {
        LOW("low", "安全"),
        MEDIUM("medium", "中等风险"),
        HIGH("high", "高风险"),
        CRITICAL("critical", "危险");
        
        private final String code;
        private final String label;
        
        RiskLevel(String code, String label) {
            this.code = code;
            this.label = label;
        }
        
        public String getCode() { return code; }
        public String getLabel() { return label; }
    }
    
    public record DangerCheckResult(RiskLevel level, List<String> warnings) {}
}