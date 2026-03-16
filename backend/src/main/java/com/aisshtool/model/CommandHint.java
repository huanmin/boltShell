package com.aisshtool.model;

/**
 * Command hint for auto-completion
 */
public record CommandHint(
    String command,
    String description
) {}