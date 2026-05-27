package com.cibono.cibono_api.domain;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "recipe")
public class Recipe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "cooking_time", nullable = false)
    private int cookingTime;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "recipe_ingredient", joinColumns = @JoinColumn(name = "recipe_id"))
    @Column(name = "ingredient_name", length = 200)
    private List<String> ingredients = new ArrayList<>();

    public Long getId() { return id; }
    public String getName() { return name; }
    public int getCookingTime() { return cookingTime; }
    public List<String> getIngredients() { return ingredients; }
}
