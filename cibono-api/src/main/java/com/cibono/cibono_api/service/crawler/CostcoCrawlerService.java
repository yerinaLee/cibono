package com.cibono.cibono_api.service.crawler;

import com.cibono.cibono_api.domain.Store;
import com.cibono.cibono_api.repository.DealRepository;
import com.cibono.cibono_api.repository.StoreRepository;
import com.cibono.cibono_api.service.GeminiService;
import org.openqa.selenium.By;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * 코스트코 전단(https://www.costco.co.kr/events) 크롤러.
 *
 * 다른 마트와 달리 행사기간이 요일 고정이 아니고, 목록 페이지에 노출되는
 * '자세히 보기' 링크 개수(행사 가짓수)도 매번 달라진다. 그래서:
 *  - 목록 페이지에서 "자세히 보기" 링크만 골라 각각 방문하고,
 *  - 행사기간은 하드코딩하지 않고 전단지 이미지에서 직접 읽어낸다(processPageImagesWithPeriod).
 */
@Service
public class CostcoCrawlerService extends BaseFlyerCrawlerService {
	
	private static final String SOURCE = "COSTCO";
	private static final String EVENTS_URL = "https://www.costco.co.kr/events";
	private static final String BASE_URL = "https://www.costco.co.kr";
	
	// 코스트코 상세 페이지의 실제 이미지 클래스명이 확인되지 않아 넓게 잡음.
	// 모든 상세 페이지 상단에 공통으로 뜨는 costcologo.png는 행사기간이 없어 항상 스킵되므로 미리 제외.
	private static final String IMG_SELECTOR =
			"img[src*='.jpg']:not([src*='logo' i]), img[src*='.png']:not([src*='logo' i]), "
			+ "img[data-src*='.jpg']:not([data-src*='logo' i]), img[data-src*='.png']:not([data-src*='logo' i])";
	
	public CostcoCrawlerService(GeminiService geminiService, DealRepository dealRepository,
			StoreRepository storeRepository) {
		super(geminiService, dealRepository, storeRepository);
	}
	
	@Override
	public int crawl() {
		Optional<Store> storeOpt = findStore(SOURCE);
		if (storeOpt.isEmpty()) return 0;
		Store store = storeOpt.get();
		
		WebDriver driver = createDriver();
		int saved = 0;
		try {
			driver.get(EVENTS_URL);
			new WebDriverWait(driver, Duration.ofSeconds(10))
					.until(d -> !d.findElements(By.cssSelector("a[href*='/content/']")).isEmpty());
			
			List<String> detailUrls = collectDetailUrls(driver);
			log.info("[FlyerCrawl] 코스트코 상세 페이지 {}개 발견: {}", detailUrls.size(), detailUrls);
			
			for (String url : detailUrls) {
				try {
					driver.get(url);
					try {
						new WebDriverWait(driver, Duration.ofSeconds(40))
								.until(d -> !d.findElements(By.cssSelector(IMG_SELECTOR)).isEmpty());
					} catch (TimeoutException e) {
						// 이미지는 sip-ad-builder(ngskiphydration) 컴포넌트가 클라이언트에서 비동기로
						// fetch해 넣는 방식이라, 그 호출이 느리거나 아예 안 걸리면 40초를 기다려도
						// img가 안 뜰 수 있음. 여기서 바로 건너뛰면 processPageImagesWithPeriod의
						// 스크린샷 폴백까지 못 가니 타임아웃은 무시하고 폴백에 판단을 맡긴다.
						log.debug("[FlyerCrawl] {} 에서 이미지 대기 타임아웃, 스크린샷 폴백 시도", url);
					}
					saved += processPageImagesWithPeriod(driver, IMG_SELECTOR, store);
				} catch (Exception e) {
					log.warn("[FlyerCrawl] 코스트코 상세페이지 처리 실패({}): {}", url, e.getMessage());
				}
			}
		} finally {
			driver.quit();
		}
		log.info("[FlyerCrawl] 코스트코 완료 — {}건", saved);
		return saved;
	}
	
	/**
	 * 목록 페이지의 '자세히 보기' 링크를 중복 제거해 절대 URL로 수집.
	 *
	 * a[href*='/content/']만으로 필터링하면 헤더/푸터의 안내 페이지(개인정보처리방침,
	 * 멤버십 안내 등)까지 같이 잡혀 상세 페이지가 아닌 링크까지 크롤링하게 된다.
	 * 실제 프로모션 상세 페이지는 링크 텍스트가 "자세히 보기"로 고정되어 있어 이를 기준으로 좁힌다.
	 */
	private List<String> collectDetailUrls(WebDriver driver) {
		List<WebElement> links = driver.findElements(By.cssSelector("a[href*='/content/']"));
		Set<String> urls = new LinkedHashSet<>();
		for (WebElement link : links) {
			String text = link.getText();
			if (text == null || !text.contains("자세히 보기")) continue;
			String href = link.getAttribute("href");
			if (href == null || href.isBlank()) continue;
			urls.add(href.startsWith("http") ? href : URI.create(BASE_URL).resolve(href).toString());
		}
		return List.copyOf(urls);
	}
}
