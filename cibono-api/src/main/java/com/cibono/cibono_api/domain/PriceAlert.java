package com.cibono.cibono_api.domain;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "price_alert")
public class PriceAlert {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
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

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getItemName() { return itemName; }
    public void setItemName(String itemName) { this.itemName = itemName; }
    public Integer getAnchorPrice() { return anchorPrice; }
    public void setAnchorPrice(Integer anchorPrice) { this.anchorPrice = anchorPrice; }
    public String getThresholdType() { return thresholdType; }
    public void setThresholdType(String thresholdType) { this.thresholdType = thresholdType; }
}
