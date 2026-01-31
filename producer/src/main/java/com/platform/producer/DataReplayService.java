package com.platform.producer;

import com.platform.events.v1.FinancialTransactionEvent;
import com.platform.events.v1.TxnStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Random;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class DataReplayService {

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final Random random = new Random();
    
    private static final String TOPIC = "financial-transactions";

    /**
     * Replays data at a fixed rate.
     * In a real project, this would read from NYC Taxi Parquet files.
     */
    @Scheduled(fixedRate = 200) // High frequency bursts
    @Transactional
    public void replayEvent() {
        for (int i = 0; i < 3; i++) {
            String transactionId = UUID.randomUUID().toString();
            
            FinancialTransactionEvent event = FinancialTransactionEvent.newBuilder()
                    .setEventId(UUID.randomUUID().toString())
                    .setTransactionId(transactionId)
                    .setOccurredAt(Instant.now())
                    .setAmountCents(random.nextInt(20000) + 100) // $1.00 to $201.00
                    .setCurrency("USD")
                    .setMerchantId("zone-" + (random.nextInt(263) + 1))
                    .setPaymentMethod(random.nextBoolean() ? "Credit Card" : "Cash")
                    .setStatus(TxnStatus.SUCCESS)
                    .setRegion("us-east-1")
                    .setTraceId(UUID.randomUUID().toString())
                    .build();

            kafkaTemplate.send(TOPIC, event.getTransactionId().toString(), event);
        }
        log.info("Sent transaction burst (3 events)");
    }
}
