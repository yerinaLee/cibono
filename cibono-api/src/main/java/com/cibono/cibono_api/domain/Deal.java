package com.cibono.cibono_api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
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
	
	// 행사가가 적용되는 판매 단위 (예: 1kg, 30개). 전단지에 표기가 없으면 null.
	@Column(name = "quantity", precision = 10, scale = 2)
	private BigDecimal quantity;
	
	@Column(name = "unit", length = 20)
	private String unit;
	
	@Column(name = "starts_at", nullable = false)
	private LocalDate startsAt;
	
	@Column(name = "ends_at", nullable = false)
	private LocalDate endsAt;
	
	@Column(name = "original_price")
	private Integer originalPrice;
	
	// PLUS_N | PERCENT_OFF | SPECIAL_PRICE | null
	@Column(name = "promotion_type", length = 20)
	private String promotionType;
	
	// PLUS_N 일 때: N+M 에서 N (예: 1+1 → buyQty=1, freeQty=1). dealPrice는 이미 단가로 환산됨.
	@Column(name = "buy_qty")
	private Integer buyQty;
	
	@Column(name = "free_qty")
	private Integer freeQty;
	
	@Column(name = "source", nullable = false, length = 30)
	private String source = "MANUAL";
	
	@Column(name = "created_at", nullable = false)
	private OffsetDateTime createdAt = OffsetDateTime.now();
	
}
