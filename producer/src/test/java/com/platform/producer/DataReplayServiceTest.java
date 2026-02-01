package com.platform.producer;

import com.platform.events.v1.FinancialTransactionEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("DataReplayService Unit Tests")
class DataReplayServiceTest {

    @Mock
    private KafkaTemplate<String, Object> kafkaTemplate;

    @Captor
    private ArgumentCaptor<Object> eventCaptor;

    @Captor
    private ArgumentCaptor<String> keyCaptor;

    private DataReplayService dataReplayService;

    @BeforeEach
    void setUp() {
        dataReplayService = new DataReplayService(kafkaTemplate);
    }

    @Test
    @DisplayName("replayEvent sends 3 events per invocation")
    void replayEvent_SendsThreeEvents() {
        // Act
        dataReplayService.replayEvent();

        // Assert - verify 3 events were sent
        verify(kafkaTemplate, times(3)).send(
                eq("financial-transactions"),
                keyCaptor.capture(),
                eventCaptor.capture()
        );

        assertThat(eventCaptor.getAllValues()).hasSize(3);
    }

    @Test
    @DisplayName("replayEvent sends valid FinancialTransactionEvent")
    void replayEvent_SendsValidEvent() {
        // Act
        dataReplayService.replayEvent();

        // Assert
        verify(kafkaTemplate, atLeastOnce()).send(
                eq("financial-transactions"),
                anyString(),
                eventCaptor.capture()
        );

        Object sentEvent = eventCaptor.getValue();
        assertThat(sentEvent).isInstanceOf(FinancialTransactionEvent.class);

        FinancialTransactionEvent event = (FinancialTransactionEvent) sentEvent;
        assertThat(event.getEventId()).isNotNull();
        assertThat(event.getTransactionId()).isNotNull();
        assertThat(event.getAmountCents()).isBetween(100L, 20100L);
        assertThat(event.getCurrency().toString()).isEqualTo("USD");
        assertThat(event.getMerchantId().toString()).startsWith("zone-");
        assertThat(event.getRegion().toString()).isEqualTo("us-east-1");
    }

    @Test
    @DisplayName("replayEvent uses transaction ID as Kafka key")
    void replayEvent_UsesTransactionIdAsKey() {
        // Act
        dataReplayService.replayEvent();

        // Assert
        verify(kafkaTemplate, atLeastOnce()).send(
                eq("financial-transactions"),
                keyCaptor.capture(),
                eventCaptor.capture()
        );

        String key = keyCaptor.getValue();
        FinancialTransactionEvent event = (FinancialTransactionEvent) eventCaptor.getValue();

        assertThat(key).isEqualTo(event.getTransactionId().toString());
    }
}
