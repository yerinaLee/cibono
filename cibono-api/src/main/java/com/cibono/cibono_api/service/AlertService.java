package com.cibono.cibono_api.service;

import com.cibono.cibono_api.domain.AlertEvent;
import com.cibono.cibono_api.domain.Deal;
import com.cibono.cibono_api.domain.PriceAlert;
import com.cibono.cibono_api.repository.AlertEventRepository;
import com.cibono.cibono_api.repository.DealRepository;
import com.cibono.cibono_api.repository.PriceAlertRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AlertService {
	
	private final PriceAlertRepository priceAlertRepository;
	private final DealRepository dealRepository;
	private final AlertEventRepository alertEventRepository;
	
	public AlertService(PriceAlertRepository priceAlertRepository,
			DealRepository dealRepository,
			AlertEventRepository alertEventRepository) {
		this.priceAlertRepository = priceAlertRepository;
		this.dealRepository = dealRepository;
		this.alertEventRepository = alertEventRepository;
	}
	
	public List<AlertEventDto> listEvents(long userId, Boolean isRead) {
		List<AlertEvent> events = (isRead != null)
				? alertEventRepository.findByUserIdAndSeenOrderByTriggeredAtDesc(userId, isRead)
				: alertEventRepository.findByUserIdOrderByTriggeredAtDesc(userId);
		
		List<PriceAlert> rules = priceAlertRepository.findByUserId(userId);
		Map<String, PriceAlert> ruleByItemName = new HashMap<>();
		for (PriceAlert r : rules) {
			ruleByItemName.putIfAbsent(r.getItemName().toLowerCase(), r);
		}
		
		List<AlertEventDto> result = new ArrayList<>();
		for (AlertEvent ev : events) {
			Deal deal = dealRepository.findById(ev.getDealId()).orElse(null);
			if (deal == null) {
				continue;
			}
			
			PriceAlert rule = ruleByItemName.get(deal.getItemName().toLowerCase());
			Integer saving = (deal.getOriginalPrice() != null) ? deal.getOriginalPrice() - deal.getDealPrice() : null;
			
			AlertEventDto.DealSummary dealSummary =
					new AlertEventDto.DealSummary(
							deal.getId(),
							deal.getItemName(),
							deal.getDealPrice(),
							deal.getOriginalPrice(),
							saving, deal.getEndsAt(),
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
				if (d.getDealPrice() > rule.getAnchorPrice()) {continue;}
				if (rule.getStoreId() != null && !rule.getStoreId().equals(d.getStoreId())) {continue;}
				if (alertEventRepository.findByUserIdAndDealId(rule.getUserId(), d.getId()).isPresent()) {continue;}

				AlertEvent ev = new AlertEvent();
				ev.setUserId(rule.getUserId());
				ev.setDealId(d.getId());
				alertEventRepository.save(ev);
				created++;
			}
		}
		return created;
	}
	
	public record AlertEventDto(Long id, boolean isRead, OffsetDateTime triggeredAt, OffsetDateTime readAt, DealSummary deal, RuleSummary rule) {
		public record DealSummary(Long id, String itemName, Integer dealPrice, Integer originalPrice, Integer saving, LocalDate endDate, Long storeId) {}
		public record RuleSummary(Long id, Integer thresholdPrice) {}
	}
	
	public record ReadResult(Long id, boolean isRead, OffsetDateTime readAt) {}
	
}
