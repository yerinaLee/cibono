package com.cibono.cibono_api.web;

import com.cibono.cibono_api.common.UserContext;
import com.cibono.cibono_api.domain.PriceAlert;
import com.cibono.cibono_api.repository.PriceAlertRepository;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/alert-rules")
public class AlertRuleController {
	
	private final PriceAlertRepository priceAlertRepository;
	
	public AlertRuleController(PriceAlertRepository priceAlertRepository) {
		this.priceAlertRepository = priceAlertRepository;
	}
	
	@GetMapping
	public Map<String, List<RuleDto>> listRules(
			@RequestParam(name = "is_enabled", required = false) Boolean isEnabled) {
		long userId = UserContext.userId();
		List<PriceAlert> rules = (isEnabled != null) ? priceAlertRepository.findByUserIdAndIsEnabled(userId, isEnabled)
				: priceAlertRepository.findByUserId(userId);
		return Map.of("data", rules.stream().map(this::toDto).toList());
	}
	
	@PostMapping
	public Map<String, Object> createRule(@RequestBody RuleRequest req) {
		if (req.itemName() == null || req.itemName().isBlank()) {
			throw new IllegalArgumentException("itemName required");
		}
		if (req.thresholdPrice() == null || req.thresholdPrice() <= 0) {
			throw new IllegalArgumentException("thresholdPrice required");
		}
		if (priceAlertRepository.existsByUserIdAndItemNameIgnoreCase(UserContext.userId(), req.itemName())) {
			throw new IllegalArgumentException("already exists: rule for this item name already registered");
		}
		
		PriceAlert rule = new PriceAlert();
		rule.setUserId(UserContext.userId());
		rule.setItemName(req.itemName());
		rule.setAnchorPrice(req.thresholdPrice());
		rule.setThresholdType("LTE");
		rule.setStoreId(req.storeId());
		rule.setUnit(req.unit());
		rule.setQuantity(req.quantity());
		PriceAlert saved = priceAlertRepository.save(rule);
		
		return Map.of("id", saved.getId(), "created_at", saved.getCreatedAt());
	}
	
	@PutMapping("/{id}")
	public RuleDto updateRule(@PathVariable Long id, @RequestBody RuleRequest req) {
		PriceAlert rule = priceAlertRepository.findByIdAndUserId(id, UserContext.userId())
				.orElseThrow(() -> new IllegalArgumentException("rule not found"));
		if (req.itemName() != null) {
			if (req.itemName().isBlank()) {
				throw new IllegalArgumentException("itemName required");
			}
			if (priceAlertRepository.existsByUserIdAndItemNameIgnoreCaseAndIdNot(UserContext.userId(), req.itemName(), id)) {
				throw new IllegalArgumentException("already exists: rule for this item name already registered");
			}
			rule.setItemName(req.itemName());
		}
		if (req.thresholdPrice() != null) {
			if (req.thresholdPrice() <= 0) {
				throw new IllegalArgumentException("thresholdPrice required");
			}
			rule.setAnchorPrice(req.thresholdPrice());
		}
		if (req.isEnabled() != null) {
			rule.setEnabled(req.isEnabled());
		}
		rule.setStoreId(req.storeId());
		rule.setUnit(req.unit());
		rule.setQuantity(req.quantity());
		
		return toDto(priceAlertRepository.save(rule));
	}
	
	@PatchMapping("/{id}/toggle")
	public Map<String, Object> toggleRule(@PathVariable Long id) {
		PriceAlert rule = priceAlertRepository.findByIdAndUserId(id, UserContext.userId())
				.orElseThrow(() -> new IllegalArgumentException("rule not found"));
		rule.setEnabled(!rule.isEnabled());
		priceAlertRepository.save(rule);
		
		return Map.of("id", rule.getId(), "is_enabled", rule.isEnabled());
	}
	
	@DeleteMapping("/{id}")
	public Map<String, Boolean> deleteRule(@PathVariable Long id) {
		PriceAlert rule = priceAlertRepository.findByIdAndUserId(id, UserContext.userId())
				.orElseThrow(() -> new IllegalArgumentException("rule not found"));
		priceAlertRepository.delete(rule);
		
		return Map.of("success", true);
	}
	
	private RuleDto toDto(PriceAlert r) {
		return new RuleDto(
				r.getId(),
				new RuleDto.ItemInfo(r.getItemName()),
				r.getAnchorPrice(),
				"below",
				r.isEnabled(),
				r.getStoreId(),
				r.getUnit(),
				r.getQuantity(),
				r.getCreatedAt());
	}
	
	record RuleRequest(String itemName, Integer thresholdPrice, String condition, Boolean isEnabled, Long storeId, String unit, java.math.BigDecimal quantity) {}
	
	record RuleDto(
			Long id,
			ItemInfo item,
			Integer thresholdPrice,
			String condition,
			boolean isEnabled,
			Long storeId,
			String unit,
			java.math.BigDecimal quantity,
			OffsetDateTime createdAt) {
		record ItemInfo(String name) {}
	}
	
}
