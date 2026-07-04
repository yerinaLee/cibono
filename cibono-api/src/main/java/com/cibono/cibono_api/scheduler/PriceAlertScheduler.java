package com.cibono.cibono_api.scheduler;

import com.cibono.cibono_api.service.AlertService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class PriceAlertScheduler {
	
	private final AlertService alertService;
	
	public PriceAlertScheduler(AlertService alertService) {
		this.alertService = alertService;
	}
	
	// 매주 수/목요일 정오에 스캔
	@Scheduled(cron = "0 0 12 * * WED,THU", zone = "${app.notification.timezone}")
	public void scan() {
		alertService.runDailyScan();
	}
	
}
