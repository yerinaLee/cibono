package com.cibono.cibono_api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
@Entity
@Table(name = "alert_event")
public class AlertEvent {
	
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	
	@Column(name = "user_id", nullable = false)
	private Long userId;
	
	@Column(name = "deal_id", nullable = false)
	private Long dealId;
	
	@Column(name = "rule_id")
	private Long ruleId;
	
	@Column(name = "triggered_at", nullable = false)
	private OffsetDateTime triggeredAt = OffsetDateTime.now();
	
	@Column(name = "seen", nullable = false)
	private boolean seen = false;
	
	@Column(name = "read_at")
	private OffsetDateTime readAt;
	
}