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

    @Column(name = "cuisine_type", nullable = false, length = 20)
    private String cuisineType;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "recipe_ingredient",
        joinColumns = @JoinColumn(name = "recipe_id"),
        inverseJoinColumns = @JoinColumn(name = "ingredient_id")
    )
    private List<Ingredient> ingredientEntities = new ArrayList<>();

    public Long getId() { return id; }
    public String getName() { return name; }
    public int getCookingTime() { return cookingTime; }
    public String getCuisineType() { return cuisineType; }
    public List<String> getIngredients() {
        return ingredientEntities.stream().map(Ingredient::getName).toList();
    }
}
