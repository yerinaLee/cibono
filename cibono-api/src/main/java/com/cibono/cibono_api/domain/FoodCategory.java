package com.cibono.cibono_api.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "food_category")
public class FoodCategory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, unique = true, length = 50)
    private String name;

    public Integer getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
