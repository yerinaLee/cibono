package com.cibono.cibono_api.dto;

import java.util.List;

public class RecipeDto {

    public record RecipeCard(
        String name,
        String imageUrl,
        String sourceUrl,
        List<String> ingredients
    ) {}

    public record RecipeDetail(
        String title,
        String description,
        String imageUrl,
        String sourceUrl,
        List<String> ingredients,
        List<String> steps
    ) {}

    public record BlogItem(
        String title,
        String link,
        String description,
        String bloggername,
        String postdate,
        String imageUrl
    ) {}
}
