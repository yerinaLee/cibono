package com.cibono.cibono_api.web;

import com.cibono.cibono_api.domain.Deal;
import com.cibono.cibono_api.repository.DealRepository;
import com.cibono.cibono_api.service.FlyerCrawlerService;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
public class DealController {
	
	private final DealRepository dealRepository;
	private final FlyerCrawlerService flyerCrawlerService;
	
	public DealController(DealRepository dealRepository, FlyerCrawlerService flyerCrawlerService) {
		this.dealRepository = dealRepository;
		this.flyerCrawlerService = flyerCrawlerService;
	}
	
	@GetMapping("/deals")
	public Map<String, List<DealDto>> listDeals(
			@RequestParam(required = false) String date,
			@RequestParam(required = false) String keyword,
			@RequestParam(required = false) Long storeId) {
		LocalDate today = LocalDate.now();
		LocalDate from, to;
		
		if ("week".equals(date)) {
			from = today;
			to = today.plusDays(6);
		} else if (date != null && !date.equals("today")) {
			LocalDate d = LocalDate.parse(date);
			from = d;
			to = d;
		} else {
			from = today;
			to = today;
		}
		
		List<Deal> deals;
		if (keyword != null && !keyword.isBlank()) {
			deals = dealRepository.findByItemNameContainingIgnoreCaseAndStartsAtLessThanEqualAndEndsAtGreaterThanEqual(
					keyword, to, from);
		} else {
			deals = dealRepository.findByStartsAtLessThanEqualAndEndsAtGreaterThanEqual(to, from);
		}
		
		if (storeId != null) {
			deals = deals.stream().filter(d -> storeId.equals(d.getStoreId())).toList();
		}
		
		return Map.of("data", deals.stream().map(this::toDto).toList());
	}
	
	@GetMapping("/deals/{id}")
	public DealDetailDto getDeal(@PathVariable Long id) {
		Deal deal = dealRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("deal not found"));
		
		return toDetailDto(deal);
	}
	
	@PostMapping("/admin/deals/crawl")
	public Map<String, Integer> triggerCrawl() {
		int count = flyerCrawlerService.crawlAll();
		
		return Map.of("saved", count);
	}
	
	@PostMapping("/admin/deals")
	public Deal createDeal(@RequestBody Deal req) {
		if (req.getItemName() == null || req.getItemName().isBlank()) {
			throw new IllegalArgumentException("itemName required");
		}
		if (req.getDealPrice() == null || req.getDealPrice() <= 0) {
			throw new IllegalArgumentException("dealPrice required");
		}
		if (req.getStartsAt() == null || req.getEndsAt() == null) {
			throw new IllegalArgumentException("startsAt/endsAt required");
		}
		
		return dealRepository.save(req);
	}
	
	@PutMapping("/admin/deals/{id}")
	public Deal updateDeal(@PathVariable Long id, @RequestBody Deal req) {
		Deal deal = dealRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("deal not found"));
		
		if (req.getItemName() != null) {deal.setItemName(req.getItemName());}
		if (req.getDealPrice() != null) {deal.setDealPrice(req.getDealPrice());}
		if (req.getOriginalPrice() != null) {deal.setOriginalPrice(req.getOriginalPrice());}
		if (req.getStartsAt() != null) {deal.setStartsAt(req.getStartsAt());}
		if (req.getEndsAt() != null) {deal.setEndsAt(req.getEndsAt());}
		if (req.getSource() != null) {deal.setSource(req.getSource());}
		if (req.getStoreId() != null) {deal.setStoreId(req.getStoreId());}
		
		return dealRepository.save(deal);
	}
	
	@DeleteMapping("/admin/deals/{id}")
	public Map<String, Boolean> deleteDeal(@PathVariable Long id) {
		dealRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("deal not found"));
		dealRepository.deleteById(id);
		
		return Map.of("success", true);
	}
	
	private DealDto toDto(Deal d) {
		Double discountRate = (d.getOriginalPrice() != null && d.getOriginalPrice() > 0)
				? Math.round((1.0 - (double) d.getDealPrice() / d.getOriginalPrice()) * 1000.0) / 10.0 : null;
		
		return new DealDto(
				d.getId(),
				new DealDto.ItemInfo(d.getItemName()),
				new DealDto.StoreInfo(d.getStoreId()),
				d.getDealPrice(),
				d.getOriginalPrice(),
				discountRate,
				d.getStartsAt(),
				d.getEndsAt());
	}
	
	private DealDetailDto toDetailDto(Deal d) {
		LocalDate today = LocalDate.now();
		boolean isActive = !d.getStartsAt().isAfter(today) && !d.getEndsAt().isBefore(today);
		Integer saving = (d.getOriginalPrice() != null) ? d.getOriginalPrice() - d.getDealPrice() : null;
		Double discountRate = (d.getOriginalPrice() != null && d.getOriginalPrice() > 0)
				? Math.round((1.0 - (double) d.getDealPrice() / d.getOriginalPrice()) * 1000.0) / 10.0 : null;
		
		return new DealDetailDto(
				d.getId(),
				new DealDetailDto.ItemInfo(d.getItemName()),
				new DealDetailDto.StoreInfo(d.getStoreId()),
				d.getDealPrice(),
				d.getOriginalPrice(),
				discountRate,
				saving,
				d.getStartsAt(),
				d.getEndsAt(),
				isActive);
	}
	
	record DealDto(Long id, ItemInfo item, StoreInfo store, Integer dealPrice, Integer originalPrice,
			Double discountRate, LocalDate startDate, LocalDate endDate) {
		record ItemInfo(String name) {}
		record StoreInfo(Long id) {}
	}
	
	record DealDetailDto(Long id, ItemInfo item, StoreInfo store, Integer dealPrice, Integer originalPrice,
			Double discountRate, Integer saving, LocalDate startDate, LocalDate endDate, boolean isActive) {
		record ItemInfo(String name) {}
		record StoreInfo(Long id) {}
	}
	
}
