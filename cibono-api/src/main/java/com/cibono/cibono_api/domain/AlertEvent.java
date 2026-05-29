package com.cibono.cibono_api.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "alert_event")
public class AlertEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "deal_id", nullable = false)
    private Long dealId;

    @Column(name = "triggered_at", nullable = false)
    private OffsetDateTime triggeredAt = OffsetDateTime.now();

    @Column(name = "seen", nullable = false)
    private boolean seen = false;

    @Column(name = "read_at")
    private OffsetDateTime readAt;

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Long getDealId() { return dealId; }
    public void setDealId(Long dealId) { this.dealId = dealId; }
    public OffsetDateTime getTriggeredAt() { return triggeredAt; }
    public boolean isSeen() { return seen; }
    public void setSeen(boolean seen) { this.seen = seen; }
    public OffsetDateTime getReadAt() { return readAt; }
    public void setReadAt(OffsetDateTime readAt) { this.readAt = readAt; }
}