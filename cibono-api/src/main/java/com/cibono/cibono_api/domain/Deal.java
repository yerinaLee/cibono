package com.cibono.cibono_api.domain;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name="deal")
public class Deal {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
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

    @Column(name = "source", nullable = false, length = 30)
    private String source = "MANUAL";

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    // getter/setter
    public Long getId() { return id; }
    public Long getStoreId() { return storeId; }
    public void setStoreId(Long storeId) { this.storeId = storeId; }
    public String getItemName() { return itemName; }
    public void setItemName(String itemName) { this.itemName = itemName; }
    public Integer getDealPrice() { return dealPrice; }
    public void setDealPrice(Integer dealPrice) { this.dealPrice = dealPrice; }
    public LocalDate getStartsAt() { return startsAt; }
    public void setStartsAt(LocalDate startsAt) { this.startsAt = startsAt; }
    public LocalDate getEndsAt() { return endsAt; }
    public void setEndsAt(LocalDate endsAt) { this.endsAt = endsAt; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
}
