package com.cibono.cibono_api.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "ingredient")
public class Ingredient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 200, unique = true)
    private String name;

    public Long getId() { return id; }
    public String getName() { return name; }
}
