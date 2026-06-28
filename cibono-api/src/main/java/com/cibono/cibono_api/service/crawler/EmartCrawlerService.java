package com.cibono.cibono_api.service.crawler;

import com.cibono.cibono_api.domain.Store;
import com.cibono.cibono_api.repository.DealRepository;
import com.cibono.cibono_api.repository.StoreRepository;
import com.cibono.cibono_api.service.GeminiService;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;

/**
 * 이마트 전단지 크롤러.
 * '종이전단 보기' 클릭 후 모달 오픈.
 * 모달 내 모든 전단 img가 DOM에 한 번에 로드됨 — 페이지네이션 없이 전체 처리.
 */
@Service
public class EmartCrawlerService extends BaseFlyerCrawlerService {
	
	private static final String URL = "https://eapp.emart.com/webapp/product/flyer";
	// 전단 이미지 URL 패턴: stimg.emart.com/upload/news_leaflet/...
	private static final String FLYER_IMG_SELECTOR = "img[src*='news_leaflet'], img[src*='leaflet'], img[src*='flyer']";
	
	public EmartCrawlerService(GeminiService geminiService, DealRepository dealRepository,
			StoreRepository storeRepository) {
		super(geminiService, dealRepository, storeRepository);
	}
	
	@Override
	public int crawl() {
		Optional<Store> storeOpt = findStore("EMART");
		if (storeOpt.isEmpty()) return 0;
		Store store = storeOpt.get();
		
		log.info("[EmartCrawl] 이마트 전단지 크롤링 시작: {}", URL);
		WebDriver driver = createDriver();
		int saved = 0;
		try {
			driver.get(URL);
			WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(15));
			
			// '종이전단 보기' 클릭
			try {
				WebElement btn = wait.until(ExpectedConditions.elementToBeClickable(
						By.xpath("//*[contains(text(),'종이전단') or contains(text(),'종이 전단')]")));
				btn.click();
				log.info("[EmartCrawl] '종이전단 보기' 클릭 완료");
				// 모든 이미지가 DOM에 로드될 때까지 대기
				Thread.sleep(3000);
			} catch (Exception e) {
				log.warn("[EmartCrawl] '종이전단 보기' 버튼 없음 — 현재 화면으로 진행");
			}
			
			var period = thisWeekThursdayPeriod();
			// 모든 전단 이미지가 처음부터 DOM에 존재 → 한 번에 전체 처리
			saved = processPageImages(driver, FLYER_IMG_SELECTOR, store, period[0], period[1]);
			
		} catch (Exception e) {
			log.error("[EmartCrawl] 이마트 크롤링 실패: {}", e.getMessage());
		} finally {
			driver.quit();
		}
		log.info("[EmartCrawl] 완료 — {}건 저장", saved);
		return saved;
	}
	
}
