package com.platform.api;

import java.time.Duration;

final class WindowParser {

    private WindowParser() {}

    static Duration parse(String window, Duration defaultValue) {
        if (window == null || window.isBlank()) {
            return defaultValue;
        }

        String w = window.trim().toLowerCase();
        try {
            if (w.endsWith("ms")) {
                return Duration.ofMillis(Long.parseLong(w.substring(0, w.length() - 2)));
            }
            if (w.endsWith("s")) {
                return Duration.ofSeconds(Long.parseLong(w.substring(0, w.length() - 1)));
            }
            if (w.endsWith("m")) {
                return Duration.ofMinutes(Long.parseLong(w.substring(0, w.length() - 1)));
            }
            if (w.endsWith("h")) {
                return Duration.ofHours(Long.parseLong(w.substring(0, w.length() - 1)));
            }
        } catch (NumberFormatException ignored) {
            return defaultValue;
        }

        return defaultValue;
    }
}

