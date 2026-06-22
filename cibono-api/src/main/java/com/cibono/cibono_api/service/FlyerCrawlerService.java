package com.cibono.cibono_api.service;

import com.cibono.cibono_api.domain.Deal;
import com.cibono.cibono_api.repository.DealRepository;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * martmonster.com 에서 마트 전단지 이미지를 가져와 Gemini Vision으로 파싱 후 Deal 테이블에 저장.
 *
 * 이용약관 검토:
 * - 영리 목적 복제/배포는 사전 승낙 필요(제13조 2항) → 개인 비영리 앱이므로 해당 없음
 * - 서버에 무리를 주는 행위 금지(제11조 1항 11호) → 요청 간 딜레이로 준수
 * - robots.txt: /market/ 경로는 차단, 개별 매장 페이지(/seoul/*, /gyeonggi/*)는 허용
 */
@Service
public class FlyerCrawlerService {
	
	private static final Logger log = LoggerFactory.getLogger(FlyerCrawlerService.class);
	private static final String BASE_URL = "https://martmonster.com";
	private static final String USER_AGENT = "Mozilla/5.0 (compatible; CibonoBot/1.0; personal non-commercial use)";
	private static final int REQUEST_DELAY_MS = 3000;
	private static final int MAX_IMAGES_PER_STORE = 5;
	
	// 설정 형식: "이마트 용산점|https://martmonster.com/seoul/2517|2517"
	// 여러 매장은 쉼표로 구분
	@Value("${flyer.crawl.stores:}")
	private String storeConfig;
	
	private final GeminiService geminiService;
	private final DealRepository dealRepository;
	private final RestTemplate rest = new RestTemplate();
	
	public FlyerCrawlerService(GeminiService geminiService, DealRepository dealRepository) {
		this.geminiService = geminiService;
		this.dealRepository = dealRepository;
	}
	
	public int crawlAll() {
		List<StoreEntry> stores = parseStoreConfig();
		if (stores.isEmpty()) {
			log.info("[FlyCrawl] 설정된 매장 없음. application.properties의 flyer.crawl.stores 확인");
			return 0;
		}
		
		int total = 0;
		for (StoreEntry store : stores) {
			try {
				int count = crawlStore(store);
				total += count;
				log.info("[FlyCrawl] {} → {}건 저장 완료", store.name(), count);
				Thread.sleep(REQUEST_DELAY_MS);
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
				break;
			} catch (Exception e) {
				log.warn("[FlyCrawl] {} 크롤링 실패: {}", store.name(), e.getMessage());
			}
		}
		log.info("[FlyCrawl] 전체 완료 — 총 {}건 저장", total);
		return total;
	}
	
	private int crawlStore(StoreEntry store) throws Exception {
		log.info("[FlyCrawl] {} 크롤링 시작: {}", store.name(), store.url());
		
		Document doc = Jsoup.connect(store.url()).userAgent(USER_AGENT).referrer(BASE_URL).timeout(15_000).get();
		
		LocalDate[] period = parseDates(doc.text());
		log.info("[FlyCrawl] {} 전단지 기간: {} ~ {}", store.name(), period[0], period[1]);
		
		Elements flyerImgs = doc.select("img[alt*=전단지]");
		if (flyerImgs.isEmpty()) {
			log.warn("[FlyCrawl] {} 전단지 이미지 없음 (selector: img[alt*=전단지])", store.name());
			return 0;
		}
		
		int saved = 0;
		int processed = 0;
		for (Element img : flyerImgs) {
			if (processed >= MAX_IMAGES_PER_STORE) {
				break;
			}
			
			String imgUrl = img.absUrl("src");
			if (imgUrl.isBlank()) {
				continue;
			}
			
			try {
				byte[] imageBytes = downloadImage(imgUrl);
				if (imageBytes == null || imageBytes.length == 0) {
					continue;
				}
				
				String base64 = Base64.getEncoder().encodeToString(imageBytes);
				List<GeminiService.FlyerDealItem> items = geminiService.parseFlyerImage(base64, "image/jpeg");
				log.info("[FlyCrawl] {} 이미지 {} → {}개 상품 추출", store.name(), imgUrl, items.size());
				
				for (GeminiService.FlyerDealItem item : items) {
					if (item.itemName() == null || item.dealPrice() == null) {
						continue;
					}
					if (dealRepository.existsByStoreIdAndItemNameIgnoreCaseAndStartsAt(store.storeId(), item.itemName(), period[0])) {
						continue;
					}
					
					Deal deal = new Deal();
					deal.setStoreId(store.storeId());
					deal.setItemName(item.itemName());
					deal.setDealPrice(item.dealPrice());
					deal.setOriginalPrice(item.originalPrice());
					deal.setStartsAt(period[0]);
					deal.setEndsAt(period[1]);
					deal.setSource("FLYER_CRAWL");
					dealRepository.save(deal);
					saved++;
				}
				
				processed++;
				Thread.sleep(REQUEST_DELAY_MS);
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
				break;
			} catch (Exception e) {
				log.warn("[FlyCrawl] {} 이미지 처리 실패 ({}): {}", store.name(), imgUrl, e.getMessage());
			}
		}
		return saved;
	}
	
	private byte[] downloadImage(String url) {
		HttpHeaders headers = new HttpHeaders();
		headers.set("User-Agent", USER_AGENT);
		headers.set("Referer", BASE_URL);
		HttpEntity<?> entity = new HttpEntity<>(headers);
		ResponseEntity<byte[]> resp = rest.exchange(url, HttpMethod.GET, entity, byte[].class);
		return resp.getBody();
	}
	
	// "2026년 6월 18일(목) ~ 6월 24일(수)" 형태 파싱
	private static final Pattern DATE_PATTERN = Pattern
			.compile("(\\d{4})년\\s*(\\d{1,2})월\\s*(\\d{1,2})일[^~～\\d]*[~～][^\\d]*(\\d{1,2})월\\s*(\\d{1,2})일");
	
	private LocalDate[] parseDates(String pageText) {
		Matcher m = DATE_PATTERN.matcher(pageText);
		if (m.find()) {
			int year = Integer.parseInt(m.group(1));
			int startMonth = Integer.parseInt(m.group(2));
			int startDay = Integer.parseInt(m.group(3));
			int endMonth = Integer.parseInt(m.group(4));
			int endDay = Integer.parseInt(m.group(5));
			int endYear = (endMonth < startMonth) ? year + 1 : year;
			return new LocalDate[] { LocalDate.of(year, startMonth, startDay),
					LocalDate.of(endYear, endMonth, endDay) };
		}
		log.warn("[FlyCrawl] 날짜 파싱 실패 — 기본값(오늘~7일) 사용");
		LocalDate today = LocalDate.now();
		return new LocalDate[] { today, today.plusDays(7) };
	}
	
	private List<StoreEntry> parseStoreConfig() {
		if (storeConfig == null || storeConfig.isBlank()) {
			return List.of();
		}
		
		List<StoreEntry> entries = new ArrayList<>();
		for (String raw : storeConfig.split(",")) {
			String[] parts = raw.trim().split("\\|");
			if (parts.length != 3) {
				log.warn("[FlyCrawl] 잘못된 매장 설정 (형식: 매장명|URL|storeId): {}", raw.trim());
				continue;
			}
			try {
				entries.add(new StoreEntry(parts[0].trim(), parts[1].trim(), Long.parseLong(parts[2].trim())));
			} catch (NumberFormatException e) {
				log.warn("[FlyCrawl] storeId 파싱 실패: {}", raw.trim());
			}
		}
		return entries;
	}
	
	private record StoreEntry(String name, String url, Long storeId) {
	}
	
}
