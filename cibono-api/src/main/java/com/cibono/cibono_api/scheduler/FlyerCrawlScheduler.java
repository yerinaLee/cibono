package com.cibono.cibono_api.scheduler;

import com.cibono.cibono_api.service.crawler.EmartCrawlerService;
import com.cibono.cibono_api.service.crawler.EmartEverydayCrawlerService;
import com.cibono.cibono_api.service.crawler.GsFreshCrawlerService;
import com.cibono.cibono_api.service.crawler.LotteCrawlerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 전단지 크롤링 스케줄러.
 *
 * Gemini 무료 티어 제한(20 req/day)으로 인해 마트별로 2시간 간격 분산.
 *   수요일 08:00 — GS더프레시    (~13장)
 *   목요일 08:00 — 롯데마트      (~8장)
 *   목요일 10:00 — 롯데슈퍼      (~8장)
 *   목요일 12:00 — 이마트        (~8장)
 *   목요일 14:00 — 이마트에브리데이 (~3장)
 */
@Component
public class FlyerCrawlScheduler {
	
	private static final Logger log = LoggerFactory.getLogger(FlyerCrawlScheduler.class);
	
	private final LotteCrawlerService lotteCrawler;
	private final EmartCrawlerService emartCrawler;
	private final EmartEverydayCrawlerService emartEverydayCrawler;
	private final GsFreshCrawlerService gsFreshCrawler;
	
	public FlyerCrawlScheduler(LotteCrawlerService lotteCrawler,
			EmartCrawlerService emartCrawler,
			EmartEverydayCrawlerService emartEverydayCrawler,
			GsFreshCrawlerService gsFreshCrawler) {
		this.lotteCrawler = lotteCrawler;
		this.emartCrawler = emartCrawler;
		this.emartEverydayCrawler = emartEverydayCrawler;
		this.gsFreshCrawler = gsFreshCrawler;
	}
	
	/** 수요일 08:00 KST — GS더프레시 */
	@Scheduled(cron = "0 0 8 * * WED", zone = "Asia/Seoul")
	public void crawlGsFresh() {
		log.info("[FlyerCrawl] GS더프레시 크롤링 시작");
		int count = gsFreshCrawler.crawl();
		log.info("[FlyerCrawl] GS더프레시 완료 — {}건", count);
	}
	
	/** 목요일 08:00 KST — 롯데마트 */
	@Scheduled(cron = "0 0 8 * * THU", zone = "Asia/Seoul")
	public void crawlLotteMart() {
		log.info("[FlyerCrawl] 롯데마트 크롤링 시작");
		int count = lotteCrawler.crawlLotteMart();
		log.info("[FlyerCrawl] 롯데마트 완료 — {}건", count);
	}
	
	/** 목요일 10:00 KST — 롯데슈퍼 */
	@Scheduled(cron = "0 0 10 * * THU", zone = "Asia/Seoul")
	public void crawlLotteSuper() {
		log.info("[FlyerCrawl] 롯데슈퍼 크롤링 시작");
		int count = lotteCrawler.crawlLotteSuper();
		log.info("[FlyerCrawl] 롯데슈퍼 완료 — {}건", count);
	}
	
	/** 목요일 12:00 KST — 이마트 */
	@Scheduled(cron = "0 0 12 * * THU", zone = "Asia/Seoul")
	public void crawlEmart() {
		log.info("[FlyerCrawl] 이마트 크롤링 시작");
		int count = emartCrawler.crawl();
		log.info("[FlyerCrawl] 이마트 완료 — {}건", count);
	}
	
	/** 목요일 14:00 KST — 이마트에브리데이 */
	@Scheduled(cron = "0 0 14 * * THU", zone = "Asia/Seoul")
	public void crawlEmartEveryday() {
		log.info("[FlyerCrawl] 이마트에브리데이 크롤링 시작");
		int count = emartEverydayCrawler.crawl();
		log.info("[FlyerCrawl] 이마트에브리데이 완료 — {}건", count);
	}
	
}
