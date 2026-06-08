package com.cibono.cibono_api.web;

import com.cibono.cibono_api.common.UserContext;
import com.cibono.cibono_api.dto.RecipeDto;
import com.cibono.cibono_api.service.FoodSafetyApiService;
import com.cibono.cibono_api.service.NaverBlogService;
import com.cibono.cibono_api.service.RecipeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;

@RestController
public class RecipeController {

    private final RecipeService recipeService;
    private final FoodSafetyApiService foodSafetyApiService;
    private final NaverBlogService naverBlogService;

    public RecipeController(RecipeService recipeService,
                            FoodSafetyApiService foodSafetyApiService,
                            NaverBlogService naverBlogService) {
        this.recipeService = recipeService;
        this.foodSafetyApiService = foodSafetyApiService;
        this.naverBlogService = naverBlogService;
    }

    @GetMapping("/recommendations/today")
    public List<RecipeService.RecipeSuggestion> today() {
        return recipeService.recommendToday(UserContext.userId());
    }

    // 식품의약품안전처 레시피 상세 조회
    @GetMapping("/recipes/crawl")
    public RecipeDto.RecipeDetail detail(@RequestParam String name) {
        return foodSafetyApiService.getDetail(name);
    }

    // 식품의약품안전처 재료 기반 레시피 카드 목록 (ingredients=김치,계란,두부)
    @GetMapping("/recipes/crawl-bulk")
    public List<RecipeDto.RecipeCard> bulkSearch(@RequestParam String ingredients) {
        List<String> list = Arrays.stream(ingredients.split(","))
            .map(String::trim)
            .filter(s -> !s.isBlank())
            .toList();
        return foodSafetyApiService.searchBulk(list);
    }

    // 단일 재료 기반 레시피 카드 목록 (ingredient=무)
    @GetMapping("/recipes/search-by-ingredient")
    public List<RecipeDto.RecipeCard> byIngredient(@RequestParam String ingredient) {
        return foodSafetyApiService.searchByIngredient(ingredient);
    }

    // 네이버 블로그 레시피 검색 (DB 캐시 적용)
    @GetMapping("/recipes/naver-blog")
    public List<RecipeDto.BlogItem> naverBlog(@RequestParam String query) {
        return naverBlogService.searchBlogs(query);
    }
}
