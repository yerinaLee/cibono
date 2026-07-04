package com.cibono.cibono_api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Getter
@Setter
@Entity
@Table(name = "price_alert")
public class PriceAlert {
	
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	
	@Column(name = "user_id", nullable = false)
	private Long userId;
	
	@Column(name = "item_name", nullable = false, length = 200)
	private String itemName;
	
	@Column(name = "anchor_price", nullable = false)
	private Integer anchorPrice;
	
	@Column(name = "threshold_type", nullable = false, length = 10)
	private String thresholdType = "LTE"; // MVP: LTE만 사용
	
	@Column(name = "threshold_value", precision = 10, scale = 2)
	private BigDecimal thresholdValue;
	
	@Column(name = "is_enabled", nullable = false)
	private boolean isEnabled = true;
	
	@Column(name = "store_id")
	private Long storeId;
	
	// 특정 단위(예: kg)일 때만 매칭. null이면 단위 무관하게 매칭(기존 동작 유지).
	@Column(name = "unit", length = 20)
	private String unit;
	
	// 특정 수량(예: 2kg)일 때만 매칭. null이면 수량 무관하게 매칭.
	@Column(name = "quantity", precision = 10, scale = 2)
	private BigDecimal quantity;
	
	@Column(name = "created_at", nullable = false)
	private OffsetDateTime createdAt = OffsetDateTime.now();
	
}
