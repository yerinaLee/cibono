package com.cibono.cibono_api.scheduler;

import com.cibono.cibono_api.repository.DealRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Component
public class ExpiredDealCleanupScheduler {
	
	private static final Logger log = LoggerFactory.getLogger(ExpiredDealCleanupScheduler.class);
	
	private final DealRepository dealRepository;
	
	public ExpiredDealCleanupScheduler(DealRepository dealRepository) {
		this.dealRepository = dealRepository;
	}
	
	// 매주 월요일 새벽 03:00 에 만료된 딜 삭제
	@Scheduled(cron = "0 0 3 * * MON", zone = "Asia/Seoul")
	@Transactional
	public void deleteExpiredDeals() {
		LocalDate today = LocalDate.now();
		log.info("[DealCleanup] 만료 딜 삭제 시작 — 기준일: {}", today);
		dealRepository.deleteByEndsAtBefore(today);
		log.info("[DealCleanup] 만료 딜 삭제 완료");
	}
	
}
