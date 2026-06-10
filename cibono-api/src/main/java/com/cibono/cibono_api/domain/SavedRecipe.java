package com.cibono.cibono_api.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "saved_recipe")
public class SavedRecipe {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "recipe_name", nullable = false, length = 500)
    private String recipeName;

    @Column(name = "image_url", length = 1000)
    private String imageUrl;

    @Column(name = "source_type", length = 50)
    private String sourceType; // FOOD_SAFETY, BLOG

    @Column(name = "source_url", length = 1000)
    private String sourceUrl;

    @Column(name = "ingredients", columnDefinition = "TEXT")
    private String ingredients; // comma-separated

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getRecipeName() { return recipeName; }
    public void setRecipeName(String recipeName) { this.recipeName = recipeName; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }
    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }
    public String getIngredients() { return ingredients; }
    public void setIngredients(String ingredients) { this.ingredients = ingredients; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}