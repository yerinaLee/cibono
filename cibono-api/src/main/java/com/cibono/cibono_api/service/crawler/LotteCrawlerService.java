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
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 롯데마트/롯데슈퍼 전단지 크롤러.
 * 하단 "N / M" 페이지 표시. < > 버튼으로 이동.
 * 각 페이지의 전단 img src를 다운로드해 Gemini에 전달.
 */
@Service
public class LotteCrawlerService extends BaseFlyerCrawlerService {
	
	private static final String BASE_URL = "https://www.mlotte.net/leaflet?rst1=";
	// 전단 이미지 selector
	private static final String FLYER_IMG_SELECTOR = "img[src*='leaflet'], img[src*='flyer'], .swiper-slide img, .leaflet img";
	private static final Pattern PAGE_PATTERN = Pattern.compile("(\\d+)\\s*/\\s*(\\d+)");
	
	public LotteCrawlerService(GeminiService geminiService, DealRepository dealRepository,
			StoreRepository storeRepository) {
		super(geminiService, dealRepository, storeRepository);
	}
	
	/** 스케줄러에서 개별 호출 가능하도록 분리 */
	public int crawlLotteMart() { return crawlMart("LOTTE_MART", "HYPER"); }
	public int crawlLotteSuper() { return crawlMart("LOTTE_SUPER", "SUPER"); }
	
	@Override
	public int crawl() {
		return crawlLotteMart() + crawlLotteSuper();
	}
	
	private int crawlMart(String source, String rst1) {
		Optional<Store> storeOpt = findStore(source);
		if (storeOpt.isEmpty()) return 0;
		Store store = storeOpt.get();
		
		log.info("[LotteCrawl] {} 크롤링 시작: {}", source, BASE_URL + rst1);
		WebDriver driver = createDriver();
		int saved = 0;
		try {
			driver.get(BASE_URL + rst1);
			new WebDriverWait(driver, Duration.ofSeconds(15))
					.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("body")));
			Thread.sleep(3000);
			
			var period = thisWeekThursdayPeriod();
			
			for (int page = 1; page <= MAX_PAGES; page++) {
				saved += processPageImages(driver, FLYER_IMG_SELECTOR, store, period[0], period[1]);
				
				int[] info = parsePageNofM(driver, PAGE_PATTERN);
				if (info != null && info[0] >= info[1]) {
					log.info("[LotteCrawl] {} 마지막 페이지 ({}/{})", source, info[0], info[1]);
					break;
				}
				
				List<WebElement> nextBtns = driver.findElements(By.cssSelector(
						"button.swiper-button-next, .btn-next, [aria-label='다음'], [aria-label='next'], " +
						"[class*='next'][class*='btn'], [class*='arrow'][class*='right']"));
				if (nextBtns.isEmpty()) {
					log.info("[LotteCrawl] {} 다음 페이지 버튼 없음 — 종료", source);
					break;
				}
				nextBtns.get(0).click();
				Thread.sleep(PAGE_DELAY_MS);
			}
		} catch (Exception e) {
			log.error("[LotteCrawl] {} 크롤링 실패: {}", source, e.getMessage());
		} finally {
			driver.quit();
		}
		log.info("[LotteCrawl] {} 완료 — {}건 저장", source, saved);
		return saved;
	}
	
	static int[] parsePageNofM(WebDriver driver, Pattern pattern) {
		try {
			Matcher m = pattern.matcher(driver.findElement(By.cssSelector("body")).getText());
			if (m.find()) return new int[]{ Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)) };
		} catch (Exception ignored) {}
		return null;
	}
	
}
