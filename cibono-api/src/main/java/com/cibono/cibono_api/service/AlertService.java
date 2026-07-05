package com.cibono.cibono_api.service;

import com.cibono.cibono_api.domain.AlertEvent;
import com.cibono.cibono_api.domain.Deal;
import com.cibono.cibono_api.domain.PriceAlert;
import com.cibono.cibono_api.domain.PushToken;
import com.cibono.cibono_api.domain.UserNotificationPreference;
import com.cibono.cibono_api.repository.AlertEventRepository;
import com.cibono.cibono_api.repository.DealRepository;
import com.cibono.cibono_api.repository.PriceAlertRepository;
import com.cibono.cibono_api.repository.PushTokenRepository;
import com.cibono.cibono_api.repository.UserNotificationPreferenceRepository;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AlertService {
	
	private static final Logger log = LoggerFactory.getLogger(AlertService.class);
	
	private final PriceAlertRepository priceAlertRepository;
	private final DealRepository dealRepository;
	private final AlertEventRepository alertEventRepository;
	private final PushTokenRepository pushTokenRepository;
	private final PushNotificationService pushNotificationService;
	private final UserNotificationPreferenceRepository notificationPreferenceRepository;
	
	public AlertService(PriceAlertRepository priceAlertRepository,
			DealRepository dealRepository,
			AlertEventRepository alertEventRepository,
			PushTokenRepository pushTokenRepository,
			PushNotificationService pushNotificationService,
			UserNotificationPreferenceRepository notificationPreferenceRepository) {
		this.priceAlertRepository = priceAlertRepository;
		this.dealRepository = dealRepository;
		this.alertEventRepository = alertEventRepository;
		this.pushTokenRepository = pushTokenRepository;
		this.pushNotificationService = pushNotificationService;
		this.notificationPreferenceRepository = notificationPreferenceRepository;
	}
	
	public List<AlertEventDto> listEvents(long userId, Boolean isRead) {
		List<AlertEvent> events = (isRead != null)
				? alertEventRepository.findByUserIdAndSeenOrderByTriggeredAtDesc(userId, isRead)
				: alertEventRepository.findByUserIdOrderByTriggeredAtDesc(userId);
		
		List<PriceAlert> rules = priceAlertRepository.findByUserId(userId);
		Map<Long, PriceAlert> ruleById = new HashMap<>();
		Map<String, PriceAlert> ruleByItemName = new HashMap<>();
		for (PriceAlert r : rules) {
			ruleById.put(r.getId(), r);
			ruleByItemName.putIfAbsent(r.getItemName().toLowerCase(), r);
		}
		
		List<AlertEventDto> result = new ArrayList<>();
		for (AlertEvent ev : events) {
			Deal deal = dealRepository.findById(ev.getDealId()).orElse(null);
			if (deal == null) {
				continue;
			}
			
			// rule_id가 있으면 그걸로 정확히 매칭(규칙이 수정/삭제돼도 이력 유지), 없으면(레거시 이벤트) itemName으로 추정
			PriceAlert rule = (ev.getRuleId() != null)
					? ruleById.get(ev.getRuleId())
					: ruleByItemName.get(deal.getItemName().toLowerCase());
			Integer saving = (deal.getOriginalPrice() != null) ? deal.getOriginalPrice() - deal.getDealPrice() : null;
			int effPrice = effectivePrice(deal);
			
			AlertEventDto.DealSummary dealSummary =
					new AlertEventDto.DealSummary(
							deal.getId(),
							deal.getItemName(),
							deal.getDealPrice(),
							deal.getOriginalPrice(),
							saving,
							effPrice,
							promotionLabel(deal),   // "1+1", "2+1" 등 표시용
							deal.getQuantity(),
							deal.getUnit(),
							deal.getEndsAt(),
							deal.getStoreId()
					);
			
			AlertEventDto.RuleSummary ruleSummary = (rule != null)
					? new AlertEventDto.RuleSummary(rule.getId(), rule.getAnchorPrice()) : null;
			
			result.add(new AlertEventDto(
					ev.getId(),
					ev.isSeen(),
					ev.getTriggeredAt(),
					ev.getReadAt(),
					dealSummary,
					ruleSummary));
		}
		
		return result;
	}
	
	@Transactional
	public ReadResult markSeen(long userId, long eventId) {
		AlertEvent ev = alertEventRepository.findById(eventId)
				.orElseThrow(() -> new IllegalArgumentException("event not found"));
		if (!ev.getUserId().equals(userId)) {
			throw new IllegalArgumentException("forbidden");
		}
		OffsetDateTime now = OffsetDateTime.now();
		ev.setSeen(true);
		ev.setReadAt(now);
		
		return new ReadResult(ev.getId(), true, now);
	}
	
	@Transactional
	public int markAllSeen(long userId) {
		List<AlertEvent> events = alertEventRepository.findByUserIdOrderByTriggeredAtDesc(userId);
		OffsetDateTime now = OffsetDateTime.now();
		int count = 0;
		for (AlertEvent ev : events) {
			if (!ev.isSeen()) {
				ev.setSeen(true);
				ev.setReadAt(now);
				count++;
			}
		}
		return count;
	}
	
	@Transactional
	public void deleteEvent(long userId, long eventId) {
		AlertEvent ev = alertEventRepository.findById(eventId)
				.orElseThrow(() -> new IllegalArgumentException("event not found"));
		if (!ev.getUserId().equals(userId)) {
			throw new IllegalArgumentException("forbidden");
		}
		alertEventRepository.delete(ev);
	}
	
	@Transactional
	public void deleteAllEvents(long userId) {
		alertEventRepository.deleteByUserId(userId);
	}
	
	/** 오늘 활성 deal을 기준으로, 전체 유저의 price_alert 조건 만족하면 alert_event 생성 */
	@Transactional
	public int runDailyScan() {
		LocalDate today = LocalDate.now();
		List<PriceAlert> rules = priceAlertRepository.findByIsEnabledTrue();
		int created = 0;
		
		for (PriceAlert rule : rules) {
			List<Deal> deals = dealRepository.findByItemNameIgnoreCaseAndStartsAtLessThanEqualAndEndsAtGreaterThanEqual(
					rule.getItemName(), today, today);
			
			for (Deal d : deals) {
				if (effectivePrice(d) > rule.getAnchorPrice()) {continue;}
				if (rule.getStoreId() != null && !rule.getStoreId().equals(d.getStoreId())) {continue;}
				// 규칙에 단위가 지정돼 있으면 딜의 단위와 일치할 때만 비교(예: "kg" 규칙이 "개" 단위 딜에 오발동하지 않도록)
				if (rule.getUnit() != null && !rule.getUnit().isBlank()
						&& !rule.getUnit().equalsIgnoreCase(d.getUnit())) {continue;}
				// 규칙에 수량이 지정돼 있으면 딜의 수량과 일치할 때만 비교(예: "2개" 규칙이 "1개" 단위 딜에 오발동하지 않도록)
				if (rule.getQuantity() != null
						&& (d.getQuantity() == null || rule.getQuantity().compareTo(d.getQuantity()) != 0)) {continue;}
				if (alertEventRepository.findByUserIdAndDealId(rule.getUserId(), d.getId()).isPresent()) {continue;}
				
				AlertEvent ev = new AlertEvent();
				ev.setUserId(rule.getUserId());
				ev.setDealId(d.getId());
				ev.setRuleId(rule.getId());
				// 푸시 알림이 발송되는 시점에 이미 사용자에게 노출되므로 확인된 것으로 간주
				ev.setSeen(true);
				ev.setReadAt(OffsetDateTime.now());
				alertEventRepository.save(ev);
				created++;

				sendPriceAlertPush(rule, d);
			}
		}
		return created;
	}
	
	private void sendPriceAlertPush(PriceAlert rule, Deal deal) {
		UserNotificationPreference pref = notificationPreferenceRepository.findById(rule.getUserId()).orElse(null);
		if (pref != null && !pref.isDealEnabled()) {
			return;
		}
		
		List<PushToken> tokens = pushTokenRepository.findAllByUserId(rule.getUserId());
		if (tokens.isEmpty()) {
			return;
		}
		
		String title = "📢특가 알림";
		String unitLabel = (deal.getQuantity() != null && deal.getUnit() != null)
				? " (" + stripTrailingZero(deal.getQuantity()) + deal.getUnit() + ")" : "";
		String body = deal.getItemName() + unitLabel + " " + effectivePrice(deal) + "원";
		for (PushToken pt : tokens) {
			try {
				pushNotificationService.send(pt.getToken(), title, body, Map.of("dealId", deal.getId()));
			} catch (Exception e) {
				log.warn("[Alert] 발송 실패 token={}: {}", pt.getToken(), e.getMessage());
			}
		}
	}
	
	// dealPrice는 이미 단가로 환산되어 저장됨 (PLUS_N도 묶음가 ÷ 총개수)
	private static int effectivePrice(Deal d) {
		return d.getDealPrice();
	}
	
	private static String stripTrailingZero(java.math.BigDecimal n) {
		return n.stripTrailingZeros().toPlainString();
	}
	
	/** 알림 메시지용 프로모션 라벨. 예: "1+1", "2+1", "30% 할인" */
	public static String promotionLabel(Deal d) {
		if (d.getPromotionType() == null) return null;
		return switch (d.getPromotionType()) {
			case "PLUS_N" -> {
				int buy = d.getBuyQty() != null ? d.getBuyQty() : 1;
				int free = d.getFreeQty() != null ? d.getFreeQty() : 1;
				yield buy + "+" + free;
			}
			case "PERCENT_OFF" -> null; // dealPrice에 이미 반영됨
			default -> null;
		};
	}
	
	public record AlertEventDto(Long id, boolean isRead, OffsetDateTime triggeredAt, OffsetDateTime readAt, DealSummary deal, RuleSummary rule) {
		// promotionLabel: "1+1", "2+1" 등 — null이면 일반 특가
		public record DealSummary(Long id, String itemName, Integer dealPrice, Integer originalPrice, Integer saving, Integer effectivePrice, String promotionLabel, java.math.BigDecimal quantity, String unit, LocalDate endDate, Long storeId) {}
		public record RuleSummary(Long id, Integer thresholdPrice) {}
	}
	
	public record ReadResult(Long id, boolean isRead, OffsetDateTime readAt) {}
	
}
