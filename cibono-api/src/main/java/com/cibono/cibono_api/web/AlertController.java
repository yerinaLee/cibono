package com.cibono.cibono_api.web;

import com.cibono.cibono_api.common.UserContext;
import com.cibono.cibono_api.service.AlertService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class AlertController {
	
	private final AlertService alertService;
	
	public AlertController(AlertService alertService) {
		this.alertService = alertService;
	}
	
	@GetMapping("/alerts")
	public Map<String, List<AlertService.AlertEventDto>> listEvents(
			@RequestParam(name = "is_read", required = false) Boolean isRead) {
		return Map.of("data", alertService.listEvents(UserContext.userId(), isRead));
	}
	
	@PatchMapping("/alerts/{id}/read")
	public AlertService.ReadResult markRead(@PathVariable long id) {
		return alertService.markSeen(UserContext.userId(), id);
	}
	
	@PatchMapping("/alerts/read-all")
	public Map<String, Integer> markAllRead() {
		int count = alertService.markAllSeen(UserContext.userId());
		return Map.of("updated_count", count);
	}
	
	@PostMapping("/admin/alerts/run-scan")
	public int runScanNow() {
		return alertService.runDailyScan(UserContext.userId());
	}
	
}
