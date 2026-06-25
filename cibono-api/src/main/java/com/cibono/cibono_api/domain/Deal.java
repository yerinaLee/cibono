package com.cibono.cibono_api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Getter
@Setter
@Entity
@Table(name = "deal")
public class Deal {
	
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	
	@Column(name = "store_id")
	private Long storeId; // MVP: store 엔티티 연관관계 대신 ID로만 처리(단순)
	
	@Column(name = "item_name", nullable = false, length = 200)
	private String itemName;
	
	@Column(name = "deal_price", nullable = false)
	private Integer dealPrice;
	
	@Column(name = "starts_at", nullable = false)
	private LocalDate startsAt;
	
	@Column(name = "ends_at", nullable = false)
	private LocalDate endsAt;
	
	@Column(name = "original_price")
	private Integer originalPrice;
	
	@Column(name = "source", nullable = false, length = 30)
	private String source = "MANUAL";
	
	@Column(name = "created_at", nullable = false)
	private OffsetDateTime createdAt = OffsetDateTime.now();
	
}
