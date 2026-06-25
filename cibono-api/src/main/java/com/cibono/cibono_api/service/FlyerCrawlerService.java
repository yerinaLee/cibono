package com.cibono.cibono_api.service;

import com.cibono.cibono_api.domain.Deal;
import com.cibono.cibono_api.domain.Store;
import com.cibono.cibono_api.repository.DealRepository;
import com.cibono.cibono_api.repository.StoreRepository;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.Base64;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class FlyerCrawlerService {

	private static final Logger log = LoggerFactory.getLogger(FlyerCrawlerService.class);
	private static final String MARTMONSTER_BASE = "https://martmonster.com";
	private static final String USER_AGENT = "Mozilla/5.0 (compatible; CibonoBot/1.0; personal non-commercial use)";
	private static final int REQUEST_DELAY_MS = 3000;
	private static final int MAX_IMAGES_PER_STORE = 5;

	private final GeminiService geminiService;
	private final DealRepository dealRepository;
	private final StoreRepository storeRepository;
	private final RestTemplate rest = new RestTemplate();

	public FlyerCrawlerService(GeminiService geminiService, DealRepository dealRepository, StoreRepository storeRepository) {
		this.geminiService = geminiService;
		this.dealRepository = dealRepository;
		this.storeRepository = storeRepository;
	}

	public int crawlAll() {
		List<Store> stores = storeRepository.findBySourceAndActiveTrue("MARTMONSTER");
		if (stores.isEmpty()) {
			log.info("[FlyCrawl] 크롤링 대상 매장 없음. store 테이블에 source=MARTMONSTER, is_active=true 인 row 확인");
			return 0;
		}

		int total = 0;
		for (Store store : stores) {
			try {
				int count = crawlStore(store);
				total += count;
				log.info("[FlyCrawl] {} → {}건 저장 완료", store.getName(), count);
				Thread.sleep(REQUEST_DELAY_MS);
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
				break;
			} catch (Exception e) {
				log.warn("[FlyCrawl] {} 크롤링 실패: {}", store.getName(), e.getMessage());
			}
		}
		log.info("[FlyCrawl] 전체 완료 — 총 {}건 저장", total);
		return total;
	}

	private int crawlStore(Store store) throws Exception {
		String url = buildUrl(store);
		log.info("[FlyCrawl] {} 크롤링 시작: {}", store.getName(), url);

		Document doc = Jsoup.connect(url).userAgent(USER_AGENT).referrer(MARTMONSTER_BASE).timeout(15_000).get();

		LocalDate[] period = parseDates(doc.text());
		log.info("[FlyCrawl] {} 전단지 기간: {} ~ {}", store.getName(), period[0], period[1]);

		Elements flyerImgs = doc.select("img[alt*=전단지]");
		if (flyerImgs.isEmpty()) {
			log.warn("[FlyCrawl] {} 전단지 이미지 없음 (selector: img[alt*=전단지])", store.getName());
			return 0;
		}

		int saved = 0;
		int processed = 0;
		for (Element img : flyerImgs) {
			if (processed >= MAX_IMAGES_PER_STORE) break;

			String imgUrl = img.absUrl("src");
			if (imgUrl.isBlank()) continue;

			try {
				byte[] imageBytes = downloadImage(imgUrl);
				if (imageBytes == null || imageBytes.length == 0) continue;

				String base64 = Base64.getEncoder().encodeToString(imageBytes);
				List<GeminiService.FlyerDealItem> items = geminiService.parseFlyerImage(base64, "image/jpeg");
				log.info("[FlyCrawl] {} 이미지 {} → {}개 상품 추출", store.getName(), imgUrl, items.size());

				for (GeminiService.FlyerDealItem item : items) {
					if (item.itemName() == null || item.dealPrice() == null) continue;
					if (dealRepository.existsByStoreIdAndItemNameIgnoreCaseAndStartsAt(store.getId(), item.itemName(), period[0])) continue;

					Deal deal = new Deal();
					deal.setStoreId(store.getId());
					deal.setItemName(item.itemName());
					deal.setDealPrice(item.dealPrice());
					deal.setOriginalPrice(item.originalPrice());
					deal.setStartsAt(period[0]);
					deal.setEndsAt(period[1]);
					deal.setSource("ONLINE");
					dealRepository.save(deal);
					saved++;
				}

				processed++;
				Thread.sleep(REQUEST_DELAY_MS);
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
				break;
			} catch (Exception e) {
				log.warn("[FlyCrawl] {} 이미지 처리 실패 ({}): {}", store.getName(), imgUrl, e.getMessage());
			}
		}
		return saved;
	}

	private String buildUrl(Store store) {
		return MARTMONSTER_BASE + "/" + store.getRegion() + "/" + store.getStoreNo();
	}

	private byte[] downloadImage(String url) {
		HttpHeaders headers = new HttpHeaders();
		headers.set("User-Agent", USER_AGENT);
		headers.set("Referer", MARTMONSTER_BASE);
		HttpEntity<?> entity = new HttpEntity<>(headers);
		ResponseEntity<byte[]> resp = rest.exchange(url, HttpMethod.GET, entity, byte[].class);
		return resp.getBody();
	}

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
			return new LocalDate[]{ LocalDate.of(year, startMonth, startDay), LocalDate.of(endYear, endMonth, endDay) };
		}
		log.warn("[FlyCrawl] 날짜 파싱 실패 — 기본값(오늘~7일) 사용");
		LocalDate today = LocalDate.now();
		return new LocalDate[]{ today, today.plusDays(7) };
	}

}
