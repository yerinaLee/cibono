package com.cibono.cibono_api.service;

import com.cibono.cibono_api.domain.Inventory;
import com.cibono.cibono_api.domain.Recipe;
import com.cibono.cibono_api.dto.RecipeDto;
import com.cibono.cibono_api.repository.InventoryRepository;
import com.cibono.cibono_api.repository.RecipeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RecipeService {

	private static final Logger log = LoggerFactory.getLogger(RecipeService.class);

	private final InventoryRepository inventoryRepository;
	private final RecipeRepository recipeRepository;
	private final NaverBlogService naverBlogService;

	public RecipeService(InventoryRepository inventoryRepository, RecipeRepository recipeRepository, NaverBlogService naverBlogService) {
		this.inventoryRepository = inventoryRepository;
		this.recipeRepository = recipeRepository;
		this.naverBlogService = naverBlogService;
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
			if (i.getExpiresAt() == null) {continue;}
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
			suggestions.add(new RecipeSuggestion(
							r.getName(),
							r.getImageUrl(),
							r.getIngredients(),
							missing,
							score,
							r.getCookingTime(),
							r.getCuisineType()));
		}
		
		List<RecipeSuggestion> top = suggestions.stream()
				.sorted(Comparator.comparingInt(RecipeSuggestion::score).reversed())
				.limit(50)
				.toList();

		// 네이버 블로그 이미지 호출 임시 비활성화 (프론트 이미지 숨김 + 추천 응답 속도/타임아웃 방지)
		// return top.stream().map(this::withNaverBlogImage).toList();
		return top;
	}

	// 추천 카드 이미지: 레시피명으로 네이버 블로그 검색해서 첫 번째 결과의 이미지를 사용
	private RecipeSuggestion withNaverBlogImage(RecipeSuggestion s) {
		String blogImage = resolveFirstNaverBlogImage(s.name());
		if (blogImage == null) {
			return s;
		}
		return new RecipeSuggestion(s.name(), blogImage, s.ingredients(), s.missingCount(), s.score(), s.cookingTime(), s.cuisineType());
	}

	private String resolveFirstNaverBlogImage(String recipeName) {
		try {
			List<RecipeDto.BlogItem> blogs = naverBlogService.searchBlogs(recipeName);
			// 첫 번째 결과의 og:image 추출이 실패해 비어 있을 수 있으므로,
			// 이미지가 실제로 있는 "첫 번째 블로그"의 이미지를 사용한다.
			for (RecipeDto.BlogItem blog : blogs) {
				String imageUrl = blog.imageUrl();
				if (imageUrl != null && !imageUrl.isBlank()) {
					return imageUrl;
				}
			}
			return null;
		} catch (Exception e) {
			log.warn("[Recommend] '{}' 네이버 블로그 이미지 조회 실패: {}", recipeName, e.getMessage());
			return null;
		}
	}
	
	private static String norm(String s) {
		return s == null ? "" : s.replaceAll("\\s+", "").toLowerCase();
	}
	
	private boolean matchesHave(Set<String> haveNorm, String need) {
		String n = norm(need);
		if (n.isEmpty()) {return false;}
		if (n.length() < 2) {return haveNorm.contains(n);}
		if (haveNorm.contains(n)) {return true;}
		return haveNorm.stream()
				.anyMatch(h -> h.length() >= 2 && (h.contains(n) || n.contains(h)));
	}
	
	private int getUrgencyScore(Map<String, Integer> urgencyNorm, String needNorm) {
		Integer direct = urgencyNorm.get(needNorm);
		if (direct != null) {return direct;}
		if (needNorm.length() < 2) {return 0;}
		return urgencyNorm.entrySet().stream()
				.filter(e -> e.getKey().length() >= 2
						&& (e.getKey().contains(needNorm) || needNorm.contains(e.getKey())))
				.mapToInt(Map.Entry::getValue)
				.max()
				.orElse(0);
	}
	
	public record RecipeSuggestion(String name, String imageUrl, List<String> ingredients, int missingCount, int score, int cookingTime, String cuisineType) {}
	
}
