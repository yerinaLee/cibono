package com.cibono.cibono_api.service.crawler;

import com.cibono.cibono_api.domain.Store;
import com.cibono.cibono_api.repository.DealRepository;
import com.cibono.cibono_api.repository.StoreRepository;
import com.cibono.cibono_api.service.GeminiService;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.Keys;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

/**
 * 이마트 에브리데이 전단지 크롤러.
 * 한 페이지에 전단 이미지가 모두 표시됨 — 페이지네이션 없음.
 * 첫 진입 시 프로모션 팝업이 뜨므로 먼저 닫고, '이번주전단' 아이콘 메뉴 클릭 후 전단 img들을 다운로드해 Gemini에 전달.
 */
@Service
public class EmartEverydayCrawlerService extends BaseFlyerCrawlerService {
	
	private static final String MAIN_URL = "https://emile.emarteveryday.co.kr/";
	// 전단 이미지는 class="visual-figure"이고 경로가 /images/exhibition/...
	// 하단 상품 썸네일(class="lazy", /images/product/...)과 명확히 구분됨.
	private static final String FLYER_IMG_SELECTOR = "img.visual-figure, img[src*='/images/exhibition/']";
	
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
			Thread.sleep(1500); // 프로모션 팝업이 뜰 시간 확보
			
			// 첫 진입 시 뜨는 프로모션 팝업이 아래 메뉴를 가리거나 클릭을 가로챌 수 있어 먼저 닫는다.
			closePopupIfPresent(driver);
			
			// '이번주전단' 아이콘 메뉴 클릭
			// 실제 라벨은 공백 없는 "이번주전단"이며 <span> 등으로 감싸여 있어 contains(text(),...)로는
			// 매칭이 안 됨 → contains(.,...)로 하위 텍스트까지 포함해 leaf 요소 기준으로 매칭.
			WebElement btn = wait.until(ExpectedConditions.presenceOfElementLocated(
					By.xpath("//a[contains(normalize-space(.),'이번주전단') or contains(normalize-space(.),'이번주 전단') or contains(normalize-space(.),'이번 주 전단')]" +
							" | //button[contains(normalize-space(.),'이번주전단') or contains(normalize-space(.),'이번주 전단') or contains(normalize-space(.),'이번 주 전단')]" +
							" | //*[not(*) and (contains(normalize-space(.),'이번주전단') or contains(normalize-space(.),'이번주 전단') or contains(normalize-space(.),'이번 주 전단'))]")));
			// 튜토리얼/프로모션 오버레이가 버튼 위를 덮어 native 클릭이 가로채이는 경우가 있어
			// JS로 직접 클릭 이벤트를 발생시켜 우회한다.
			((JavascriptExecutor) driver).executeScript(
					"arguments[0].scrollIntoView({block:'center'}); arguments[0].click();", btn);
			log.info("[EmartEverydayCrawl] '이번주전단' 클릭 완료");
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
	
	/** 첫 진입 시 뜨는 프로모션 팝업/튜토리얼 오버레이를 닫는다. 없어도 무시하고 계속 진행. */
	private void closePopupIfPresent(WebDriver driver) {
		try {
			driver.findElement(By.tagName("body")).sendKeys(Keys.ESCAPE);
		} catch (Exception ignored) {
		}
		try {
			List<WebElement> closeBtns = driver.findElements(By.cssSelector(
					"[class*='close'], [class*='Close'], [aria-label='닫기'], [aria-label='close'], " +
							"[aria-label='Close'], .modal button, .popup button, [class*='modal'] [class*='btn']"));
			for (WebElement btn : closeBtns) {
				if (btn.isDisplayed()) {
					btn.click();
					log.info("[EmartEverydayCrawl] 팝업 닫기 완료");
					break;
				}
			}
		} catch (Exception e) {
			log.debug("[EmartEverydayCrawl] 팝업 닫기 시도 실패(무시): {}", e.getMessage());
		}
		// '이번주전단' 클릭 시 modal-tutorial__section 등 튜토리얼 오버레이가 클릭을 가로채는 경우가 있어
		// 닫기 버튼을 못 찾더라도 DOM에서 직접 제거해 확실히 치운다.
		try {
			((JavascriptExecutor) driver).executeScript(
					"document.querySelectorAll(\"[class*='modal-tutorial'], [class*='tutorial-']\")" +
							".forEach(function(el){ el.remove(); });");
		} catch (Exception e) {
			log.debug("[EmartEverydayCrawl] 튜토리얼 오버레이 제거 실패(무시): {}", e.getMessage());
		}
	}
	
}
