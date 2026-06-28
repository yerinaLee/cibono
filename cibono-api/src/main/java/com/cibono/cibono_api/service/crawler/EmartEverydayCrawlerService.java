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
 * 이마트 에브리데이 전단지 크롤러.
 * 한 페이지에 전단 이미지가 모두 표시됨 — 페이지네이션 없음.
 * '이번주 전단' 버튼 클릭 후 전단 img들을 다운로드해 Gemini에 전달.
 */
@Service
public class EmartEverydayCrawlerService extends BaseFlyerCrawlerService {
	
	private static final String MAIN_URL = "https://emile.emarteveryday.co.kr/";
	private static final String FLYER_IMG_SELECTOR = "img[src*='exhibition'], img[src*='flyer'], img[src*='leaflet'], .exhibition img, [class*='view'] img";
	
	public EmartEverydayCrawlerService(GeminiService geminiService, DealRepository dealRepository, StoreRepository storeRepository) {
		super(geminiService, dealRepository, storeRepository);
	}
	
	@Override
	public int crawl() {
		Optional<Store> storeOpt = findStore("EMART_EVERYDAY");
		if (storeOpt.isEmpty()) return 0;
		Store store = storeOpt.get();
		
		log.info("[EmartEverydayCrawl] 이마트에브리데이 전단지 크롤링 시작: {}", MAIN_URL);
		WebDriver driver = createDriver();
		int saved = 0;
		try {
			driver.get(MAIN_URL);
			WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(15));
			
			// '이번주 전단' 버튼 클릭
			WebElement btn = wait.until(ExpectedConditions.elementToBeClickable(
					By.xpath("//button[contains(text(),'이번주 전단') or contains(text(),'이번 주 전단')]" +
							" | //a[contains(text(),'이번주 전단') or contains(text(),'이번 주 전단')]")));
			btn.click();
			log.info("[EmartEverydayCrawl] '이번주 전단' 클릭 완료");
			Thread.sleep(3000);
			
			var period = thisWeekThursdayPeriod();
			
			// 한 페이지에 전단 이미지 전체 표시 — 이미지 모두 다운로드
			saved = processPageImages(driver, FLYER_IMG_SELECTOR, store, period[0], period[1]);
			
		} catch (Exception e) {
			log.error("[EmartEverydayCrawl] 이마트에브리데이 크롤링 실패: {}", e.getMessage());
		} finally {
			driver.quit();
		}
		log.info("[EmartEverydayCrawl] 완료 — {}건 저장", saved);
		return saved;
	}
	
}
