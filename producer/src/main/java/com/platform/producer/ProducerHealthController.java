package com.platform.producer;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Minimal "Actuator-like" health endpoint so the frontend can call
 * {@code /actuator/health} without requiring the Spring Boot Actuator dependency.
 */
@RestController
@RequestMapping("/actuator")
public class ProducerHealthController {

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }
}

