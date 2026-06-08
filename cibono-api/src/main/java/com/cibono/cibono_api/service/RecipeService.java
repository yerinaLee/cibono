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

        Set<String> haveNorm = invs.stream()
                .map(i -> norm(i.getItemName()))
                .collect(Collectors.toSet());

        Map<String, Integer> urgencyNorm = new HashMap<>();
        LocalDate today = LocalDate.now();
        for (Inventory i : invs) {
            if (i.getExpiresAt() == null) continue;
            long d = Math.max(0, today.until(i.getExpiresAt()).getDays());
            int score = (int) Math.max(0, 10 - d);
            urgencyNorm.merge(norm(i.getItemName()), score, Math::max);
        }

        List<RecipeSuggestion> suggestions = new ArrayList<>();
        for (Recipe r : recipes) {
            int matched = 0, missing = 0, urgencyScore = 0;
            for (String need : r.getIngredients()) {
                if (matchesHave(haveNorm, need)) {
                    matched++;
                    urgencyScore += getUrgencyScore(urgencyNorm, norm(need));
                } else {
                    missing++;
                }
            }
            // 레시피 임박점수 매김
            int score = urgencyScore + matched * 2 - missing * 3;
            suggestions.add(new RecipeSuggestion(r.getName(), r.getIngredients(), missing, score, r.getCookingTime(), r.getCuisineType()));
        }

        return suggestions.stream()
                .sorted(Comparator.comparingInt(RecipeSuggestion::score).reversed())
                .limit(50)
                .toList();
    }

    private static String norm(String s) {
        return s == null ? "" : s.replaceAll("\\s+", "").toLowerCase();
    }

    private boolean matchesHave(Set<String> haveNorm, String need) {
        String n = norm(need);
        if (n.isEmpty()) return false;
        if (n.length() < 2) return haveNorm.contains(n);
        if (haveNorm.contains(n)) return true;
        return haveNorm.stream().anyMatch(h -> h.length() >= 2 && (h.contains(n) || n.contains(h)));
    }

    private int getUrgencyScore(Map<String, Integer> urgencyNorm, String needNorm) {
        Integer direct = urgencyNorm.get(needNorm);
        if (direct != null) return direct;
        if (needNorm.length() < 2) return 0;
        return urgencyNorm.entrySet().stream()
                .filter(e -> e.getKey().length() >= 2 && (e.getKey().contains(needNorm) || needNorm.contains(e.getKey())))
                .mapToInt(Map.Entry::getValue)
                .max().orElse(0);
    }

    public record RecipeSuggestion(String name, List<String> ingredients, int missingCount, int score, int cookingTime, String cuisineType) {}
}
