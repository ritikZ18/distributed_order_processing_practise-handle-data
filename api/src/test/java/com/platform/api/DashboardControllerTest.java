package com.platform.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("DashboardController Unit Tests")
class DashboardControllerTest {

    private MockMvc mockMvc;

    @Mock
    private AggregateRepository aggregateRepository;

    @InjectMocks
    private DashboardController dashboardController;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(dashboardController).build();
    }

    @Test
    @DisplayName("GET /api/v1/analytics/health returns UP status")
    void healthEndpoint_ReturnsUp() throws Exception {
        mockMvc.perform(get("/api/v1/analytics/health"))
                .andExpect(status().isOk())
                .andExpect(content().string("UP"));
    }

    @Test
    @DisplayName("GET /api/v1/analytics/merchant/{id} returns merchant stats")
    void getMerchantStats_ReturnsList() throws Exception {
        // Arrange
        MerchantAggregate aggregate = new MerchantAggregate();
        aggregate.setMerchantId("zone-1");
        aggregate.setWindowStart(Instant.now());
        aggregate.setTotalRevenue(50000L);
        aggregate.setTransactionCount(100L);

        List<MerchantAggregate> mockStats = Arrays.asList(aggregate);
        when(aggregateRepository.findByMerchantId("zone-1")).thenReturn(mockStats);

        // Act & Assert
        mockMvc.perform(get("/api/v1/analytics/merchant/zone-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].merchantId").value("zone-1"))
                .andExpect(jsonPath("$[0].totalRevenue").value(50000))
                .andExpect(jsonPath("$[0].transactionCount").value(100));
    }

    @Test
    @DisplayName("GET /api/v1/analytics/merchant/{id} returns empty list when no data")
    void getMerchantStats_ReturnsEmptyWhenNoData() throws Exception {
        // Arrange
        when(aggregateRepository.findByMerchantId("unknown-zone")).thenReturn(Collections.emptyList());

        // Act & Assert
        mockMvc.perform(get("/api/v1/analytics/merchant/unknown-zone"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$").isEmpty());
    }
}
