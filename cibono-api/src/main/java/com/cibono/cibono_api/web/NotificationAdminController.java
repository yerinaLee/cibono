package com.cibono.cibono_api.web;

import com.cibono.cibono_api.common.UserContext;
import com.cibono.cibono_api.domain.NotificationConfig;
import com.cibono.cibono_api.domain.PushToken;
import com.cibono.cibono_api.repository.NotificationConfigRepository;
import com.cibono.cibono_api.repository.PushTokenRepository;
import com.cibono.cibono_api.scheduler.DinnerNotificationScheduler;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin/notifications")
public class NotificationAdminController {
	
	private final NotificationConfigRepository configRepo;
	private final PushTokenRepository tokenRepo;
	private final DinnerNotificationScheduler scheduler;
	
	public NotificationAdminController(NotificationConfigRepository configRepo,
										PushTokenRepository tokenRepo,
										DinnerNotificationScheduler scheduler) {
		this.configRepo = configRepo;
		this.tokenRepo = tokenRepo;
		this.scheduler = scheduler;
	}
	
	// ─── 토큰 등록 (앱에서 호출) ───────────────────────────────────────────
	@PostMapping("/register-token")
	public ResponseEntity<Void> registerToken(@RequestBody Map<String, String> body) {
		String token = body.get("token");
		if (token == null || token.isBlank()) {
			return ResponseEntity.badRequest().build();
		}
		Long userId = UserContext.userId();
		PushToken pt = tokenRepo.findByToken(token).orElseGet(() -> {
			PushToken newToken = new PushToken(token);
			newToken.setUserId(userId);
			return tokenRepo.save(newToken);
		});
		if (pt.getUserId() == null) {
			pt.setUserId(userId);
			tokenRepo.save(pt);
		}
		return ResponseEntity.ok().build();
	}
	
	// ─── 토큰 목록 / 삭제 ────────────────────────────────────────────────
	@GetMapping("/tokens")
	public List<Map<String, Object>> listTokens() {
		return tokenRepo.findAll().stream()
				.map(t -> Map.<String, Object>of(
						"id", t.getId(),
						"token", t.getToken(),
						"registeredAt", t.getRegisteredAt().toString()))
				.toList();
	}
	
	@DeleteMapping("/tokens/{id}")
	public ResponseEntity<Void> deleteToken(@PathVariable Long id) {
		tokenRepo.deleteById(id);
		return ResponseEntity.noContent().build();
	}
	
	// ─── 알림 설정 CRUD ──────────────────────────────────────────────────
	@GetMapping("/configs")
	public List<NotificationConfig> listConfigs() {
		return configRepo.findAll();
	}
	
	@PostMapping("/configs")
	public NotificationConfig createConfig(@RequestBody NotificationConfig req) {
		req.setCreatedAt(LocalDateTime.now());
		NotificationConfig saved = configRepo.save(req);
		scheduler.scheduleConfig(saved);
		return saved;
	}
	
	@PutMapping("/configs/{id}")
	public ResponseEntity<NotificationConfig> updateConfig(@PathVariable Long id, @RequestBody NotificationConfig req) {
		return configRepo.findById(id).map(config -> {
			config.setTitle(req.getTitle());
			config.setBodyTemplate(req.getBodyTemplate());
			config.setCronExpression(req.getCronExpression());
			config.setTimezone(req.getTimezone());
			config.setEnabled(req.isEnabled());
			if (req.getMealType() != null) config.setMealType(req.getMealType());
			NotificationConfig saved = configRepo.save(config);
			scheduler.scheduleConfig(saved); // 활성이면 재등록, 비활성이면 취소
			return ResponseEntity.ok(saved);
		}).orElse(ResponseEntity.notFound().build());
	}
	
	@DeleteMapping("/configs/{id}")
	public ResponseEntity<Void> deleteConfig(@PathVariable Long id) {
		scheduler.cancelConfig(id);
		configRepo.deleteById(id);
		return ResponseEntity.noContent().build();
	}
	
	// ─── 즉시 발송 ──────────────────────────────────────────────────────
	@PostMapping("/configs/{id}/trigger")
	public ResponseEntity<Map<String, String>> triggerNow(@PathVariable Long id) {
		return configRepo.findById(id).map(config -> {
			scheduler.triggerNow(config);
			return ResponseEntity.ok(Map.of("result", "발송 요청 완료 (백엔드 로그 확인)"));
		}).orElse(ResponseEntity.notFound().build());
	}
	
}
