package com.aisshtool.security;

import com.aisshtool.security.DangerCommandChecker.RiskLevel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit tests for DangerCommandChecker
 */
class DangerCommandCheckerTest {

    private DangerCommandChecker checker;

    @BeforeEach
    void setUp() {
        checker = new DangerCommandChecker();
    }

    // ============ Critical tests ============

    @Test
    @DisplayName("Should detect rm -rf / as critical")
    void shouldDetectRmRfRoot() {
        var result = checker.check("rm -rf /");
        assertThat(result.level()).isEqualTo(RiskLevel.CRITICAL);
        assertThat(result.warnings()).isNotEmpty();
    }

    @Test
    @DisplayName("Should detect rm -rf /* as critical")
    void shouldDetectRmRfRootAll() {
        var result = checker.check("rm -rf /*");
        assertThat(result.level()).isEqualTo(RiskLevel.CRITICAL);
    }

    @Test
    @DisplayName("Should detect fork bomb as critical")
    void shouldDetectForkBomb() {
        var result = checker.check(":(){ :|:& };:");
        assertThat(result.level()).isEqualTo(RiskLevel.CRITICAL);
    }

    @Test
    @DisplayName("Should detect dd disk wipe as critical")
    void shouldDetectDdWipe() {
        var result = checker.check("dd if=/dev/zero of=/dev/sda");
        assertThat(result.level()).isEqualTo(RiskLevel.CRITICAL);
    }

    @Test
    @DisplayName("Should detect mkfs as critical")
    void shouldDetectMkfs() {
        var result = checker.check("mkfs.ext4 /dev/sda1");
        assertThat(result.level()).isEqualTo(RiskLevel.CRITICAL);
    }

    // ============ High tests ============

    @Test
    @DisplayName("Should detect shutdown as high")
    void shouldDetectShutdown() {
        var result = checker.check("shutdown now");
        assertThat(result.level()).isEqualTo(RiskLevel.HIGH);
    }

    @Test
    @DisplayName("Should detect reboot as high")
    void shouldDetectReboot() {
        var result = checker.check("reboot");
        assertThat(result.level()).isEqualTo(RiskLevel.HIGH);
    }

    @Test
    @DisplayName("Should detect rm -rf * as high")
    void shouldDetectRmRfAll() {
        var result = checker.check("rm -rf *");
        assertThat(result.level()).isEqualTo(RiskLevel.HIGH);
    }

    // ============ Medium tests ============

    @Test
    @DisplayName("Should detect rm -rf as medium")
    void shouldDetectRmRf() {
        var result = checker.check("rm -rf testdir");
        assertThat(result.level()).isEqualTo(RiskLevel.MEDIUM);
    }

    @Test
    @DisplayName("Should detect sudo rm as medium")
    void shouldDetectSudoRm() {
        var result = checker.check("sudo rm file.txt");
        assertThat(result.level()).isEqualTo(RiskLevel.MEDIUM);
    }

    // ============ Low tests ============

    @Test
    @DisplayName("Should mark ls as low")
    void shouldMarkLsAsLow() {
        var result = checker.check("ls -la");
        assertThat(result.level()).isEqualTo(RiskLevel.LOW);
        assertThat(result.warnings()).isEmpty();
    }

    @Test
    @DisplayName("Should mark cat as low")
    void shouldMarkCatAsLow() {
        var result = checker.check("cat file.txt");
        assertThat(result.level()).isEqualTo(RiskLevel.LOW);
    }

    @Test
    @DisplayName("Should mark empty command as low")
    void shouldMarkEmptyAsLow() {
        var result = checker.check("");
        assertThat(result.level()).isEqualTo(RiskLevel.LOW);
    }

    @Test
    @DisplayName("Should mark null command as low")
    void shouldMarkNullAsLow() {
        var result = checker.check(null);
        assertThat(result.level()).isEqualTo(RiskLevel.LOW);
    }

    // ============ Warning messages ============

    @Test
    @DisplayName("Should include warning messages")
    void shouldIncludeWarnings() {
        var result = checker.check("rm -rf /");
        assertThat(result.warnings())
                .anyMatch(w -> w.contains("删除"));
    }

    @Test
    @DisplayName("Should have warning for chmod -R 777 /")
    void shouldHaveWarning() {
        var result = checker.check("chmod -R 777 /");
        assertThat(result.level()).isEqualTo(RiskLevel.CRITICAL);
        assertThat(result.warnings()).hasSize(1);
    }
}