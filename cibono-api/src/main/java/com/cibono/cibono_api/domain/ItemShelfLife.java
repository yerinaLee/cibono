package com.cibono.cibono_api.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "item_shelf_life")
public class ItemShelfLife {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "item_name", nullable = false, unique = true, length = 200)
    private String itemName;

    @Column(name = "shelf_life_days", nullable = false)
    private int shelfLifeDays;

    public Long getId() { return id; }
    public String getItemName() { return itemName; }
    public int getShelfLifeDays() { return shelfLifeDays; }
}
