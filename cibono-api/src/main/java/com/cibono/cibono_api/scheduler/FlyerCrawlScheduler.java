package com.cibono.cibono_api.scheduler;

import com.cibono.cibono_api.service.FlyerCrawlerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class FlyerCrawlScheduler {
	
	private static final Logger log = LoggerFactory.getLogger(FlyerCrawlScheduler.class);
	
	private final FlyerCrawlerService flyerCrawlerService;
	
	public FlyerCrawlScheduler(FlyerCrawlerService flyerCrawlerService) {
		this.flyerCrawlerService = flyerCrawlerService;
	}
	
	// 매주 월요일 07:00 (마트 전단지는 보통 목요일~수요일 주기이나, 월요일 수집으로 주 초 반영)
//	@Scheduled(cron = "0 0 7 * * MON", zone = "Asia/Seoul")
	public void crawlWeekly() {
		log.info("[FlyerCrawl] 주간 전단지 크롤링 시작");
		int count = flyerCrawlerService.crawlAll();
		log.info("[FlyerCrawl] 주간 전단지 크롤링 완료 — {}건", count);
	}
	
}
