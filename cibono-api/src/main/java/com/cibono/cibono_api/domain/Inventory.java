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
@Table(name = "inventory")
public class Inventory {
	
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	
	@Column(name = "user_id", nullable = false)
	private Long userId;
	
	@Column(name = "item_name", nullable = false, length = 200)
	private String itemName;
	
	@Column(name = "quantity", nullable = false, precision = 10, scale = 2)
	private BigDecimal quantity = BigDecimal.ONE;
	
	@Column(name = "unit", length = 20)
	private String unit;
	
	@Column(name = "storage", nullable = false, length = 20)
	private String storage; // FRIDGE/FREEZER/PANTRY
	
	@Column(name = "purchased_at")
	private LocalDate purchasedAt;
	
	@Column(name = "expires_at")
	private LocalDate expiresAt;
	
	@Column(name = "created_at", nullable = false)
	private OffsetDateTime createdAt = OffsetDateTime.now();
	
	@Column(name = "category_id")
	private Integer categoryId;
	
	@Column(name = "is_favorite", nullable = false)
	private Boolean favorite = false;
	
}
