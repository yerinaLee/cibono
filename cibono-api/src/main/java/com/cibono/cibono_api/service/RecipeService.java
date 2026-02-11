package com.cibono.cibono_api.service;

import com.cibono.cibono_api.domain.Inventory;
import com.cibono.cibono_api.repository.InventoryRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RecipeService {
    private final InventoryRepository inventoryRepository;

    public RecipeService(InventoryRepository inventoryRepository) {
        this.inventoryRepository = inventoryRepository;
    }

    // MVP 레시피(재료 리스트만)
    private static final List<Recipe> RECIPES = List.of(
            new Recipe("계란말이", List.of("계란", "대파")),
            new Recipe("두부부침", List.of("두부", "대파")),
            new Recipe("김치볶음밥", List.of("김치", "계란")),
            new Recipe("우유 프렌치토스트", List.of("우유", "계란")),
            new Recipe("감자볶음", List.of("감자", "양파"))
    );

    // 추천 요리 score 계산 메서드
    public List<RecipeSuggestion> recommendToday(long userId){
        System.out.println("you here?2");
        List<Inventory> invs = inventoryRepository.findByUserIdOrderByExpiresAtAsc(userId);

        // 현재 냉장고에 있는 재료명
        Set<String> have = invs.stream().map(Inventory::getItemName).collect(Collectors.toSet());

        // 유통기한-expiresAt이 가까울수록 점수 높게
        Map<String, Integer> urgency = new HashMap<>();
        LocalDate today = LocalDate.now();
        for (Inventory i : invs){
            if(i.getExpiresAt() == null) continue;
            long d = Math.max(0,today.until(i.getExpiresAt()).getDays());
            int score = (int) Math.max(0, 10 -d); // D0 = 10점, D5 = 5점 ...
            urgency.put(i.getItemName(), Math.max(urgency.getOrDefault(i.getItemName(), 0), score));
        }

        List<RecipeSuggestion> suggestions = new ArrayList<>();
        for (Recipe r : RECIPES){
            int matched = 0;
            int missing = 0;
            int urgencyScore = 0;

            for (String need : r.ingredients){
                if(have.contains(need)){
                    matched++;
                    urgencyScore += urgency.getOrDefault(need, 0);
                } else {
                    missing++;
                }
            }

            // 점수 : 유통기한 임박재료 점수 + (매칭재료수*2) - (부족 재료 수 *3)
            int score = urgencyScore + matched*2 + missing*3;

            suggestions.add(new RecipeSuggestion(r.name, r.ingredients, missing, score));
        }

        System.out.println("you here?3");

        System.out.println(suggestions.stream()
                .sorted(Comparator.comparingInt(RecipeSuggestion::score).reversed())
                .limit(10)
                .toList());

        return suggestions.stream()
                .sorted(Comparator.comparingInt(RecipeSuggestion::score).reversed())
                .limit(10)
                .toList();
    }

    private record Recipe(String name, List<String> ingredients){}
    public record RecipeSuggestion(String name, List<String> ingredients, int missingCount, int score) {}

}
