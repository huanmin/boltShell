package com.aisshtool.controller;

import com.aisshtool.model.Connection;
import com.aisshtool.model.ErrorCode;
import com.aisshtool.service.CredentialService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.Arrays;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for ConnectionController
 */
@WebMvcTest(ConnectionController.class)
class ConnectionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private CredentialService credentialService;

    private Connection testConnection;

    @BeforeEach
    void setUp() {
        testConnection = Connection.builder()
                .id("conn-001")
                .name("Test Server")
                .host("192.168.1.100")
                .port(22)
                .username("root")
                .authType(Connection.AuthType.PASSWORD)
                .createdAt(Instant.now())
                .build();
    }

    @Test
    @DisplayName("GET /api/v1/connections - should return list of connections")
    void listConnections_shouldReturnList() throws Exception {
        // Arrange
        when(credentialService.listConnections()).thenReturn(Arrays.asList(testConnection));

        // Act & Assert
        mockMvc.perform(get("/api/v1/connections"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0].id").value("conn-001"))
                .andExpect(jsonPath("$.data[0].name").value("Test Server"))
                .andExpect(jsonPath("$.data[0].password").doesNotExist());
    }

    @Test
    @DisplayName("GET /api/v1/connections/{id} - should return connection by id")
    void getConnection_shouldReturnConnection() throws Exception {
        // Arrange
        when(credentialService.getConnection("conn-001")).thenReturn(Optional.of(testConnection));

        // Act & Assert
        mockMvc.perform(get("/api/v1/connections/conn-001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.id").value("conn-001"));
    }

    @Test
    @DisplayName("GET /api/v1/connections/{id} - should return error when not found")
    void getConnection_shouldReturnError_whenNotFound() throws Exception {
        // Arrange
        when(credentialService.getConnection("not-exist")).thenReturn(Optional.empty());

        // Act & Assert
        mockMvc.perform(get("/api/v1/connections/not-exist"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(ErrorCode.CONNECTION_NOT_FOUND.getCode()));
    }

    @Test
    @DisplayName("POST /api/v1/connections - should create connection")
    void createConnection_shouldCreate() throws Exception {
        // Arrange
        Connection newConnection = Connection.builder()
                .name("New Server")
                .host("10.0.0.1")
                .port(22)
                .username("admin")
                .authType(Connection.AuthType.PASSWORD)
                .password("secret")
                .build();

        when(credentialService.createConnection(any(Connection.class))).thenReturn(testConnection);

        // Act & Assert
        mockMvc.perform(post("/api/v1/connections")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newConnection)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.id").value("conn-001"));
    }

    @Test
    @DisplayName("PUT /api/v1/connections/{id} - should update connection")
    void updateConnection_shouldUpdate() throws Exception {
        // Arrange
        Connection updateData = Connection.builder()
                .name("Updated Name")
                .build();

        Connection updated = Connection.builder()
                .id("conn-001")
                .name("Updated Name")
                .host("192.168.1.100")
                .build();

        when(credentialService.updateConnection(eq("conn-001"), any(Connection.class)))
                .thenReturn(Optional.of(updated));

        // Act & Assert
        mockMvc.perform(put("/api/v1/connections/conn-001")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateData)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.name").value("Updated Name"));
    }

    @Test
    @DisplayName("DELETE /api/v1/connections/{id} - should delete connection")
    void deleteConnection_shouldDelete() throws Exception {
        // Arrange
        when(credentialService.deleteConnection("conn-001")).thenReturn(true);

        // Act & Assert
        mockMvc.perform(delete("/api/v1/connections/conn-001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    @Test
    @DisplayName("DELETE /api/v1/connections/{id} - should return error when not found")
    void deleteConnection_shouldReturnError_whenNotFound() throws Exception {
        // Arrange
        when(credentialService.deleteConnection("not-exist")).thenReturn(false);

        // Act & Assert
        mockMvc.perform(delete("/api/v1/connections/not-exist"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(ErrorCode.CONNECTION_NOT_FOUND.getCode()));
    }
}