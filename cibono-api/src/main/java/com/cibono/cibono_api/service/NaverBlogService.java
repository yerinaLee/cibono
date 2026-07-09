package com.cibono.cibono_api.service;

import com.cibono.cibono_api.domain.BlogSearchCache;
import com.cibono.cibono_api.dto.RecipeDto;
import com.cibono.cibono_api.repository.BlogSearchCacheRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class NaverBlogService {
	
	private static final Logger log = LoggerFactory.getLogger(NaverBlogService.class);
	
	private static final String NAVER_BLOG_URL = "https://openapi.naver.com/v1/search/blog.json";
	
	@Value("${naver.client.id}")
	private String clientId;
	
	@Value("${naver.client.secret}")
	private String clientSecret;
	
	private final BlogSearchCacheRepository cacheRepo;
	private final ObjectMapper mapper = new ObjectMapper();
	private final RestTemplate rest = new RestTemplate();
	
	public NaverBlogService(BlogSearchCacheRepository cacheRepo) {
		this.cacheRepo = cacheRepo;
	}
	
	public List<RecipeDto.BlogItem> searchBlogs(String query) {
		Optional<BlogSearchCache> cached = cacheRepo.findById(query);
		if (cached.isPresent()) {
			List<RecipeDto.BlogItem> fromCache = deserialize(cached.get().getResultJson());
			boolean hasImage = fromCache.stream().anyMatch(b -> b.imageUrl() != null && !b.imageUrl().isBlank());
			if (!fromCache.isEmpty() && hasImage) {
				log.info("[NaverBlog] DB hit: '{}'", query);
				return fromCache;
			}
			// 역직렬화 실패 또는 이미지 없는 구버전 캐시 → 재수집 후 덮어쓰기
			log.info("[NaverBlog] 캐시 재수집 (이미지 없음 또는 형식 불일치): '{}'", query);
		}
		
		List<RecipeDto.BlogItem> items = fetchFromNaver(query + " 레시피");
		
		if (!items.isEmpty()) {
			BlogSearchCache entry = cached.orElse(new BlogSearchCache());
			entry.setQuery(query);
			entry.setResultJson(serialize(items));
			entry.setCachedAt(LocalDateTime.now());
			cacheRepo.save(entry);
			log.info("[NaverBlog] cached {} items for '{}'", items.size(), query);
		}
		return items;
	}
	
	private List<RecipeDto.BlogItem> fetchFromNaver(String query) {
		try {
			String encoded = URLEncoder.encode(query, StandardCharsets.UTF_8);
			URI uri = URI.create(NAVER_BLOG_URL + "?query=" + encoded + "&display=5&sort=sim");
			
			HttpHeaders headers = new HttpHeaders();
			headers.set("X-Naver-Client-Id", clientId);
			headers.set("X-Naver-Client-Secret", clientSecret);
			
			ResponseEntity<String> response = rest.exchange(uri, HttpMethod.GET, new HttpEntity<>(headers), String.class);
			log.info("[NaverBlog] fetchFromNaver '{}' → HTTP {}", query, response.getStatusCode());
			
			JsonNode items = mapper.readTree(response.getBody()).path("items");
			if (!items.isArray()) {
				return List.of();
			}
			
			List<RecipeDto.BlogItem> result = new ArrayList<>();
			for (JsonNode item : items) {
				String link = item.path("link").asText();
				String imageUrl = fetchOgImage(link);
				result.add(new RecipeDto.BlogItem(
						stripHtml(item.path("title").asText()),
						link,
						stripHtml(item.path("description").asText()),
						item.path("bloggername").asText(),
						item.path("postdate").asText(),
						imageUrl));
			}
			return result;
		} catch (Exception e) {
			log.warn("[NaverBlog] fetchFromNaver 실패: {}", e.getMessage());
			return List.of();
		}
	}
	
	private String fetchOgImage(String url) {
		// 네이버 블로그 데스크탑은 JS 렌더링 → 모바일 URL로 교체해야 정적 HTML에서 OG 태그 추출 가능
		String targetUrl = url.replace("://blog.naver.com/", "://m.blog.naver.com/");
		log.info("[OG] 요청 URL: {}", targetUrl);
		try {
			Document doc = fetchDoc(targetUrl);
			log.info("[OG] 페이지 타이틀: {}", doc.title());

			String image = extractImage(doc);
			if (!image.isBlank()) {
				log.info("[OG] 최종 이미지 URL: {}", image);
				return image;
			}

			// 본문이 iframe(#mainFrame) 안에 있는 경우(네이버 블로그 특유 구조) → iframe 문서에서 재추출
			Element frame = doc.selectFirst("iframe#mainFrame");
			if (frame != null) {
				String frameUrl = frame.absUrl("src");
				if (!frameUrl.isBlank()) {
					log.info("[OG] mainFrame 추적: {}", frameUrl);
					String frameImage = extractImage(fetchDoc(frameUrl));
					if (!frameImage.isBlank()) {
						log.info("[OG] 최종 이미지 URL (iframe): {}", frameImage);
						return frameImage;
					}
				}
			}

			log.warn("[OG] OG 이미지 없음: {}", targetUrl);
			return "";
		} catch (Exception e) {
			log.warn("[OG] 이미지 추출 실패 {}: {} - {}", targetUrl, e.getClass().getSimpleName(), e.getMessage());
			return "";
		}
	}

	private Document fetchDoc(String targetUrl) throws java.io.IOException {
		return Jsoup.connect(targetUrl)
				.timeout(5000)
				.userAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1")
				.header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
				.header("Accept-Language", "ko-KR,ko;q=0.9")
				.followRedirects(true)
				.get();
	}

	// og:image → og:image:url → twitter:image → link[rel=image_src] 순으로 이미지 추출
	private String extractImage(Document doc) {
		String[] selectors = {
				"meta[property=og:image]",
				"meta[property=og:image:url]",
				"meta[name=twitter:image]",
				"link[rel=image_src]"
		};
		for (String selector : selectors) {
			Element el = doc.selectFirst(selector);
			if (el != null) {
				String content = el.hasAttr("content") ? el.attr("content") : el.attr("href");
				if (content != null && !content.isBlank()) {
					return toHttps(content);
				}
			}
		}
		return "";
	}
	
	private String toHttps(String url) {
		if (url == null || url.isBlank()) {return "";}
		return url.startsWith("http://") ? "https://" + url.substring(7) : url;
	}
	
	private String stripHtml(String html) {
		return html
				.replaceAll("<[^>]+>", "")
				.replace("&lt;", "<")
				.replace("&gt;", ">")
				.replace("&amp;", "&")
				.replace("&quot;", "\"")
				.trim();
	}
	
	private String serialize(List<RecipeDto.BlogItem> items) {
		try {
			return mapper.writeValueAsString(items);
		} catch (Exception e) {
			return "[]";
		}
	}
	
	private List<RecipeDto.BlogItem> deserialize(String json) {
		try {
			return mapper.readValue(json, new TypeReference<List<RecipeDto.BlogItem>>() {});
		} catch (Exception e) {
			return List.of();
		}
	}
	
}
