package com.cibono.cibono_api.web;

import com.cibono.cibono_api.domain.Deal;
import com.cibono.cibono_api.repository.DealRepository;
import com.cibono.cibono_api.service.crawler.EmartCrawlerService;
import com.cibono.cibono_api.service.crawler.EmartEverydayCrawlerService;
import com.cibono.cibono_api.service.crawler.GsFreshCrawlerService;
import com.cibono.cibono_api.service.crawler.LotteCrawlerService;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
public class DealController {
	
	private final DealRepository dealRepository;
	private final LotteCrawlerService lotteCrawler;
	private final EmartCrawlerService emartCrawler;
	private final EmartEverydayCrawlerService emartEverydayCrawler;
	private final GsFreshCrawlerService gsFreshCrawler;
	
	public DealController(DealRepository dealRepository,
			LotteCrawlerService lotteCrawler,
			EmartCrawlerService emartCrawler,
			EmartEverydayCrawlerService emartEverydayCrawler,
			GsFreshCrawlerService gsFreshCrawler) {
		this.dealRepository = dealRepository;
		this.lotteCrawler = lotteCrawler;
		this.emartCrawler = emartCrawler;
		this.emartEverydayCrawler = emartEverydayCrawler;
		this.gsFreshCrawler = gsFreshCrawler;
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
			deals = dealRepository.findByItemNameContainingIgnoreCaseAndStartsAtLessThanEqualAndEndsAtGreaterThanEqual(keyword, to, from);
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
		int count = 0;
		count += lotteCrawler.crawl();
		count += emartCrawler.crawl();
		count += emartEverydayCrawler.crawl();
		count += gsFreshCrawler.crawl();
		return Map.of("saved", count);
	}
	
	@PostMapping("/admin/deals/crawl/lotte-mart")
	public Map<String, Integer> triggerLotteMart() {
		return Map.of("saved", lotteCrawler.crawlLotteMart());
	}
	
	@PostMapping("/admin/deals/crawl/lotte-super")
	public Map<String, Integer> triggerLotteSuper() {
		return Map.of("saved", lotteCrawler.crawlLotteSuper());
	}
	
	@PostMapping("/admin/deals/crawl/emart")
	public Map<String, Integer> triggerEmart() {
		return Map.of("saved", emartCrawler.crawl());
	}
	
	@PostMapping("/admin/deals/crawl/emart-everyday")
	public Map<String, Integer> triggerEmartEveryday() {
		return Map.of("saved", emartEverydayCrawler.crawl());
	}
	
	@PostMapping("/admin/deals/crawl/gs-fresh")
	public Map<String, Integer> triggerGsFresh() {
		return Map.of("saved", gsFreshCrawler.crawl());
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
		return new DealDto(
				d.getId(),
				new DealDto.ItemInfo(d.getItemName()),
				new DealDto.StoreInfo(d.getStoreId()),
				d.getDealPrice(),
				d.getOriginalPrice(),
				d.getStartsAt(),
				d.getEndsAt());
	}
	
	private DealDetailDto toDetailDto(Deal d) {
		LocalDate today = LocalDate.now();
		boolean isActive = !d.getStartsAt().isAfter(today) && !d.getEndsAt().isBefore(today);
		Integer saving = (d.getOriginalPrice() != null) ? d.getOriginalPrice() - d.getDealPrice() : null;
		
		return new DealDetailDto(
				d.getId(),
				new DealDetailDto.ItemInfo(d.getItemName()),
				new DealDetailDto.StoreInfo(d.getStoreId()),
				d.getDealPrice(),
				d.getOriginalPrice(),
				saving,
				d.getStartsAt(),
				d.getEndsAt(),
				isActive);
	}
	
	record DealDto(Long id, ItemInfo item, StoreInfo store, Integer dealPrice, Integer originalPrice,
			LocalDate startDate, LocalDate endDate) {
		record ItemInfo(String name) {}
		record StoreInfo(Long id) {}
	}
	
	record DealDetailDto(Long id, ItemInfo item, StoreInfo store, Integer dealPrice, Integer originalPrice,
			Integer saving, LocalDate startDate, LocalDate endDate, boolean isActive) {
		record ItemInfo(String name) {}
		record StoreInfo(Long id) {}
	}
	
}
