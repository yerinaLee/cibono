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
            if (!fromCache.isEmpty()) {
                log.info("[NaverBlog] DB hit: '{}'", query);
                return fromCache;
            }
            // 역직렬화 실패(구버전 포맷 등) → 재수집 후 덮어쓰기
            log.info("[NaverBlog] 캐시 형식 불일치, 재수집: '{}'", query);
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
            if (!items.isArray()) return List.of();

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
                    imageUrl
                ));
            }
            return result;
        } catch (Exception e) {
            log.warn("[NaverBlog] fetchFromNaver 실패: {}", e.getMessage());
            return List.of();
        }
    }

    private String fetchOgImage(String url) {
        try {
            Document doc = Jsoup.connect(url)
                .timeout(4000)
                .userAgent("Mozilla/5.0")
                .get();
            Element og = doc.selectFirst("meta[property=og:image]");
            if (og != null && !og.attr("content").isBlank()) return og.attr("content");
            Element twitter = doc.selectFirst("meta[name=twitter:image]");
            return twitter != null ? twitter.attr("content") : "";
        } catch (Exception e) {
            log.debug("[NaverBlog] OG 이미지 추출 실패 {}: {}", url, e.getMessage());
            return "";
        }
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
