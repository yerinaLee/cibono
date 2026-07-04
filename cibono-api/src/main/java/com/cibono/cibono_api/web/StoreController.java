package com.cibono.cibono_api.web;

import com.cibono.cibono_api.domain.Store;
import com.cibono.cibono_api.repository.StoreRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/stores")
public class StoreController {
	
	private final StoreRepository storeRepository;
	
	public StoreController(StoreRepository storeRepository) {
		this.storeRepository = storeRepository;
	}
	
	@GetMapping
	public Map<String, List<StoreDto>> listStores() {
		List<Store> stores = storeRepository.findByActiveTrue();
		return Map.of("data", stores.stream().map(s -> new StoreDto(s.getId(), s.getName(), s.getFlyerUrl())).toList());
	}
	
	record StoreDto(Long id, String name, String flyerUrl) {}
	
}
