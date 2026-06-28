package com.cibono.cibono_api.service.crawler;

import com.cibono.cibono_api.domain.Store;
import com.cibono.cibono_api.repository.DealRepository;
import com.cibono.cibono_api.repository.StoreRepository;
import com.cibono.cibono_api.service.GeminiService;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;

/**
 * GS더프레시 전단지 크롤러.
 * 전체 전단 img가 DOM에 한 번에 로드됨 — 페이지네이션 없이 전체 처리.
 */
@Service
public class GsFreshCrawlerService extends BaseFlyerCrawlerService {
	
	private static final String URL = "https://web.gsretail.me/Viewer/gsp2/";
	private static final String FLYER_IMG_SELECTOR = "img.pageImage, img[src*='gsretail'], img[src*='Viewer'], img[src*='flyer']";
	
	public GsFreshCrawlerService(GeminiService geminiService, DealRepository dealRepository, StoreRepository storeRepository) {
		super(geminiService, dealRepository, storeRepository);
	}
	
	@Override
	public int crawl() {
		Optional<Store> storeOpt = findStore("GS_FRESH");
		if (storeOpt.isEmpty()) return 0;
		Store store = storeOpt.get();
		
		log.info("[GsFreshCrawl] GS더프레시 전단지 크롤링 시작: {}", URL);
		WebDriver driver = createDriver();
		int saved = 0;
		try {
			driver.get(URL);
			new WebDriverWait(driver, Duration.ofSeconds(15))
					.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("body")));
			// 모든 페이지 img가 DOM에 미리 로드될 때까지 대기
			Thread.sleep(3000);
			
			var period = thisWeekWednesdayPeriod();
			// 전체 전단 img가 DOM에 한 번에 존재 → 한 번에 전체 처리 (이마트와 동일 구조)
			saved = processPageImages(driver, FLYER_IMG_SELECTOR, store, period[0], period[1]);
			
		} catch (Exception e) {
			log.error("[GsFreshCrawl] GS더프레시 크롤링 실패: {}", e.getMessage());
		} finally {
			driver.quit();
		}
		log.info("[GsFreshCrawl] 완료 — {}건 저장", saved);
		return saved;
	}
	
}
