package com.cibono.cibono_api.service.crawler;

import com.cibono.cibono_api.domain.Deal;
import com.cibono.cibono_api.domain.Store;
import com.cibono.cibono_api.repository.DealRepository;
import com.cibono.cibono_api.repository.StoreRepository;
import com.cibono.cibono_api.service.GeminiService;
import io.github.bonigarcia.wdm.WebDriverManager;
import org.openqa.selenium.By;
import org.openqa.selenium.Cookie;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

public abstract class BaseFlyerCrawlerService {
	
	protected final Logger log = LoggerFactory.getLogger(getClass());
	
	protected static final int MAX_PAGES = 10;
	protected static final int PAGE_DELAY_MS = 2000;
	
	protected final GeminiService geminiService;
	protected final DealRepository dealRepository;
	protected final StoreRepository storeRepository;
	private final RestTemplate rest = new RestTemplate();
	
	protected BaseFlyerCrawlerService(GeminiService geminiService, DealRepository dealRepository, StoreRepository storeRepository) {
		this.geminiService = geminiService;
		this.dealRepository = dealRepository;
		this.storeRepository = storeRepository;
	}
	
	protected WebDriver createDriver() {
		WebDriverManager.chromedriver().setup();
		ChromeOptions options = new ChromeOptions();
		options.addArguments("--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
				"--window-size=1280,900", "--disable-gpu");
		return new ChromeDriver(options);
	}
	
	/**
	 * 페이지에서 전단 img 요소들을 찾아 이미지를 다운로드 후 Gemini 파싱까지 수행.
	 * 이미지를 찾지 못하면 스크린샷으로 폴백.
	 * @return 총 저장 건수
	 */
	@SuppressWarnings("deprecation")
	protected int processPageImages(WebDriver driver, String imgSelector, Store store,
			LocalDate start, LocalDate end) {
		List<WebElement> imgs = driver.findElements(By.cssSelector(imgSelector));
		
		if (imgs.isEmpty()) {
			log.debug("[FlyerCrawl] img 요소 없음({}), 스크린샷으로 폴백", imgSelector);
			return processScreenshot(driver, store, start, end);
		}
		
		// data-src 우선 사용 — 지연 로딩되는 이미지는 화면에 보이기 전까지 src 속성 자체가 없고
		// data-src에만 실제 URL이 들어있음(이마트 확인됨). src만 있는 경우를 위해 폴백 유지.
		// distinct는 이마트처럼 전체 페이지 이미지가 DOM에 미리 로드되는 경우 중복 처리 방지용.
		List<String> uniqueSrcs = imgs.stream()
				.map(img -> {
					String dataSrc = img.getAttribute("data-src");
					if (dataSrc != null && !dataSrc.isBlank()) return dataSrc;
					return img.getAttribute("src");
				})
				.filter(src -> src != null && !src.isBlank())
				.distinct()
				.collect(Collectors.toList());
		
		if (uniqueSrcs.isEmpty()) {
			log.debug("[FlyerCrawl] 유효한 src 없음, 스크린샷으로 폴백");
			return processScreenshot(driver, store, start, end);
		}
		
		log.info("[FlyerCrawl] 고유 이미지 {}개 처리 시작", uniqueSrcs.size());
		int saved = 0;
		for (String src : uniqueSrcs) {
			try {
				byte[] imageBytes = downloadImage(driver, src);
				if (imageBytes == null || imageBytes.length == 0) continue;
				
				String base64 = Base64.getEncoder().encodeToString(imageBytes);
				String mimeType = src.toLowerCase().contains(".png") ? "image/png" : "image/jpeg";
				var items = geminiService.parseFlyerImage(base64, mimeType);
				log.info("[FlyerCrawl] 이미지({}) → {}개 상품 추출", src, items.size());
				saved += saveDeals(items, store, start, end);
			} catch (Exception e) {
				log.warn("[FlyerCrawl] 이미지 처리 실패({}): {}", src, e.getMessage());
			}
		}
		return saved;
	}
	
	/** 스크린샷을 찍어 Gemini 파싱 후 저장 */
	protected int processScreenshot(WebDriver driver, Store store, LocalDate start, LocalDate end) {
		try {
			byte[] bytes = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
			String base64 = Base64.getEncoder().encodeToString(bytes);
			var items = geminiService.parseFlyerImage(base64, "image/png");
			log.info("[FlyerCrawl] 스크린샷 → {}개 상품 추출", items.size());
			return saveDeals(items, store, start, end);
		} catch (Exception e) {
			log.warn("[FlyerCrawl] 스크린샷 처리 실패: {}", e.getMessage());
			return 0;
		}
	}
	
	/** Selenium 세션 쿠키를 포함해 이미지 다운로드 */
	protected byte[] downloadImage(WebDriver driver, String imageUrl) {
		String cookieStr = driver.manage().getCookies().stream()
				.map(Cookie::toString)
				.collect(Collectors.joining("; "));
		
		HttpHeaders headers = new HttpHeaders();
		headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
		headers.set("Referer", driver.getCurrentUrl());
		if (!cookieStr.isBlank()) headers.set("Cookie", cookieStr);
		
		ResponseEntity<byte[]> resp = rest.exchange(
				imageUrl, HttpMethod.GET, new HttpEntity<>(headers), byte[].class);
		return resp.getBody();
	}
	
	protected Optional<Store> findStore(String source) {
		List<Store> stores = storeRepository.findBySourceAndActiveTrue(source);
		if (stores.isEmpty()) {
			log.warn("[FlyerCrawl] source={} 인 활성 store가 없음 — 크롤링 건너뜀", source);
			return Optional.empty();
		}
		return Optional.of(stores.get(0));
	}
	
	protected int saveDeals(List<GeminiService.FlyerDealItem> items, Store store,
			LocalDate start, LocalDate end) {
		int saved = 0;
		for (GeminiService.FlyerDealItem item : items) {
			if (item.itemName() == null || item.dealPrice() == null) continue;
			if (dealRepository.existsByStoreIdAndItemNameIgnoreCaseAndStartsAt(
					store.getId(), item.itemName(), start)) continue;
			
			// PLUS_N이면 dealPrice를 실질 단가로 환산 (예: 1+1 3000원 → 1500원)
			int effectivePrice = item.dealPrice();
			if ("PLUS_N".equals(item.promotionType())
					&& item.buyQty() != null && item.freeQty() != null
					&& (item.buyQty() + item.freeQty()) > 0) {
				effectivePrice = item.dealPrice() / (item.buyQty() + item.freeQty());
			}
			
			Deal deal = new Deal();
			deal.setStoreId(store.getId());
			deal.setItemName(item.itemName());
			deal.setDealPrice(effectivePrice);
			deal.setOriginalPrice(item.originalPrice());
			deal.setPromotionType(item.promotionType());
			deal.setBuyQty(item.buyQty());
			deal.setFreeQty(item.freeQty());
			deal.setStartsAt(start);
			deal.setEndsAt(end);
			deal.setSource("CRAWL");
			dealRepository.save(deal);
			saved++;
		}
		return saved;
	}
	
	/** 이번 주 목요일부터 다음 수요일까지 (롯데/이마트 주기) */
	protected LocalDate[] thisWeekThursdayPeriod() {
		LocalDate thursday = LocalDate.now().with(TemporalAdjusters.nextOrSame(DayOfWeek.THURSDAY));
		return new LocalDate[]{ thursday, thursday.plusDays(6) };
	}
	
	/** 이번 주 수요일부터 다음 화요일까지 (GS더프레시 주기) */
	protected LocalDate[] thisWeekWednesdayPeriod() {
		LocalDate wednesday = LocalDate.now().with(TemporalAdjusters.nextOrSame(DayOfWeek.WEDNESDAY));
		return new LocalDate[]{ wednesday, wednesday.plusDays(6) };
	}
	
	public abstract int crawl();
	
}
