package com.platform.producer;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
@RequestMapping("/api/v1/producer")
@RequiredArgsConstructor
public class ProducerStatusController {

    private final DataReplayService dataReplayService;

    @GetMapping("/stats")
    public ProducerStats stats() {
        return new ProducerStats(
                dataReplayService.getTotalEventsSent(),
                dataReplayService.getLastEventSentAt()
        );
    }

    public record ProducerStats(long totalEventsSent, Instant lastEventSentAt) {}
}

