package com.cibono.cibono_api.service;

import com.cibono.cibono_api.dto.RecipeDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class FoodSafetyApiService {

    private static final Logger log = LoggerFactory.getLogger(FoodSafetyApiService.class);

    private static final String BASE = "https://openapi.foodsafetykorea.go.kr/api";

    @Value("${food.safety.api.key}")
    private String apiKey;

    private final RestTemplate rest = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    // 단일 재료로 레시피 카드 목록 검색
    public List<RecipeDto.RecipeCard> searchByIngredient(String ingredient) {
        try {
            String encoded = URLEncoder.encode(ingredient, StandardCharsets.UTF_8);
            String url = BASE + "/" + apiKey + "/COOKRCP01/json/1/10/RCP_PARTS_DTLS=" + encoded;

            String json = rest.getForObject(url, String.class);

            if (json == null || json.stripLeading().startsWith("<")) {
                log.warn("[FoodSafety] searchByIngredient({}) → HTML/XML 응답 (API 한도초과 또는 오류): {}",
                    ingredient, json == null ? "null" : json.substring(0, Math.min(300, json.length())));
                return List.of();
            }

            List<RecipeDto.RecipeCard> cards = parseCards(json);

            List<String> names = cards.stream().map(RecipeDto.RecipeCard::name).toList();
            log.info("[FoodSafety] 재료 '{}' 검색 → {}건: {}", ingredient, cards.size(), names);

            return cards;
        } catch (Exception e) {
            log.warn("[FoodSafety] searchByIngredient({}) 실패: {}", ingredient, e.getMessage());
            return List.of();
        }
    }

    // 여러 재료 순차 검색 후 합산 (식약처 API 동시 접속 차단 때문에 순차 실행)
    public List<RecipeDto.RecipeCard> searchBulk(List<String> ingredients) {
        List<String> targets = ingredients.stream().limit(4).toList();
        log.info("[FoodSafety] ===== searchBulk 시작 =====");
        log.info("[FoodSafety] 검색 재료 {}개: {}", targets.size(), targets);

        Map<String, RecipeDto.RecipeCard> seen = new LinkedHashMap<>();
        for (String ing : targets) {
            searchByIngredient(ing).forEach(card -> seen.putIfAbsent(card.name(), card));
        }

        List<String> finalNames = new ArrayList<>(seen.keySet());
        log.info("[FoodSafety] 최종 중복제거 후 {}건: {}", finalNames.size(), finalNames);
        log.info("[FoodSafety] ===== searchBulk 종료 =====");
        return new ArrayList<>(seen.values());
    }

    // 레시피명으로 상세 정보 조회
    public RecipeDto.RecipeDetail getDetail(String name) {
        try {
            String encoded = URLEncoder.encode(name, StandardCharsets.UTF_8);
            String url = BASE + "/" + apiKey + "/COOKRCP01/json/1/3/RCP_NM=" + encoded;
            log.info("[FoodSafety] getDetail 검색어: '{}' → URL: {}", name, url);

            String json = rest.getForObject(url, String.class);
            JsonNode row = mapper.readTree(json).path("COOKRCP01").path("row").path(0);

            if (row.isMissingNode()) {
                log.warn("[FoodSafety] getDetail '{}' → 결과 없음 (식약처 DB에 해당 레시피 없음)", name);
                return new RecipeDto.RecipeDetail(name, "", "", "", List.of(), List.of());
            }

            RecipeDto.RecipeDetail detail = parseDetail(row);
            log.info("[FoodSafety] getDetail '{}' → 매칭: '{}', 재료 {}개, 조리순서 {}단계",
                name, detail.title(), detail.ingredients().size(), detail.steps().size());
            return detail;
        } catch (Exception e) {
            log.warn("[FoodSafety] getDetail({}) 실패: {}", name, e.getMessage());
            return new RecipeDto.RecipeDetail(name, "", "", "", List.of(), List.of());
        }
    }

    private List<RecipeDto.RecipeCard> parseCards(String json) throws Exception {
        JsonNode rows = mapper.readTree(json).path("COOKRCP01").path("row");
        if (!rows.isArray()) return List.of();

        List<RecipeDto.RecipeCard> cards = new ArrayList<>();
        for (JsonNode row : rows) {
            String n = row.path("RCP_NM").asText().trim();
            String img = row.path("ATT_FILE_NO_MK").asText().trim();
            String partsText = row.path("RCP_PARTS_DTLS").asText().trim();
            List<String> ings = Arrays.stream(partsText.split("[,·\\n]+"))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .limit(5)
                .toList();
            if (!n.isBlank()) {
                cards.add(new RecipeDto.RecipeCard(n, img, "", ings));
            }
        }
        return cards;
    }

    private RecipeDto.RecipeDetail parseDetail(JsonNode row) {
        String title = row.path("RCP_NM").asText().trim();
        String imageUrl = row.path("ATT_FILE_NO_MK").asText().trim();
        String partsText = row.path("RCP_PARTS_DTLS").asText().trim();
        String way = row.path("RCP_WAY2").asText().trim();
        String category = row.path("RCP_PAT2").asText().trim();

        String desc = (!category.isBlank() && !way.isBlank())
            ? "[" + category + "] " + way
            : (!category.isBlank() ? "[" + category + "]" : way);

        // 재료: 쉼표/마침표/줄바꿈으로 분리
        List<String> ingredients = Arrays.stream(partsText.split("[,·\\n]+"))
            .map(String::trim)
            .filter(s -> !s.isBlank())
            .toList();

        // 조리 순서: MANUAL01 ~ MANUAL20
        List<String> steps = new ArrayList<>();
        for (int i = 1; i <= 20; i++) {
            String step = row.path(String.format("MANUAL%02d", i)).asText().trim();
            if (!step.isBlank()) steps.add(step);
        }

        return new RecipeDto.RecipeDetail(title, desc, imageUrl, "", ingredients, steps);
    }
}
