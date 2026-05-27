package com.cibono.cibono_api.service;

import com.cibono.cibono_api.domain.Inventory;
import com.cibono.cibono_api.domain.Recipe;
import com.cibono.cibono_api.repository.InventoryRepository;
import com.cibono.cibono_api.repository.RecipeRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RecipeService {

    private final InventoryRepository inventoryRepository;
    private final RecipeRepository recipeRepository;

    public RecipeService(InventoryRepository inventoryRepository, RecipeRepository recipeRepository) {
        this.inventoryRepository = inventoryRepository;
        this.recipeRepository = recipeRepository;
    }

    public List<RecipeSuggestion> recommendToday(long userId) {
        List<Inventory> invs = inventoryRepository.findByUserIdOrderByExpiresAtAsc(userId);
        List<Recipe> recipes = recipeRepository.findAll();

        Set<String> have = invs.stream()
                .map(Inventory::getItemName)
                .collect(Collectors.toSet());

        Map<String, Integer> urgency = new HashMap<>();
        LocalDate today = LocalDate.now();
        for (Inventory i : invs) {
            if (i.getExpiresAt() == null) continue;
            long d = Math.max(0, today.until(i.getExpiresAt()).getDays());
            int score = (int) Math.max(0, 10 - d);
            urgency.merge(i.getItemName(), score, Math::max);
        }

        List<RecipeSuggestion> suggestions = new ArrayList<>();
        for (Recipe r : recipes) {
            int matched = 0, missing = 0, urgencyScore = 0;
            for (String need : r.getIngredients()) {
                if (have.contains(need)) {
                    matched++;
                    urgencyScore += urgency.getOrDefault(need, 0);
                } else {
                    missing++;
                }
            }
            int score = urgencyScore + matched * 2 - missing * 3;
            suggestions.add(new RecipeSuggestion(r.getName(), r.getIngredients(), missing, score, r.getCookingTime()));
        }

        return suggestions.stream()
                .sorted(Comparator.comparingInt(RecipeSuggestion::score).reversed())
                .limit(10)
                .toList();
    }

    public record RecipeSuggestion(String name, List<String> ingredients, int missingCount, int score, int cookingTime) {}
}
