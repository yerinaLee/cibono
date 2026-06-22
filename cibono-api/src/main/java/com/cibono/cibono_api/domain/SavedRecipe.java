package com.cibono.cibono_api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
@Entity
@Table(name = "saved_recipe")
public class SavedRecipe {
	
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
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
	
}