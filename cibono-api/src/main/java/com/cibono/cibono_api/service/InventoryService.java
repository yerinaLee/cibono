package com.cibono.cibono_api.service;

import com.cibono.cibono_api.domain.Inventory;
import com.cibono.cibono_api.repository.InventoryRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Map;

@Service
public class InventoryService {
    private final InventoryRepository inventoryRepository;

    private static final Map<String, Integer> DEFAULT_SHELF_LIFE_DAYS = Map.of(
            "대파", 14,
            "양파", 14,
            "감자", 30,
            "당근", 21,
            "계란", 30,
            "마늘", 14,
            "양배추", 21,
            "알배추", 14,
            "우유", 14
    );

    public InventoryService(InventoryRepository inventoryRepository){
        this.inventoryRepository = inventoryRepository;
    }

    public Inventory saveWithAutoExpiry(Inventory inv){
        if (inv.getPurchasedAt() == null) {
            inv.setPurchasedAt(LocalDate.now());
        }

        // expiresAt이 비어있고, 기본 보관일 룰이 있으면 자동 세팅
        if (inv.getExpiresAt() == null) {
            Integer days = DEFAULT_SHELF_LIFE_DAYS.get(inv.getItemName());
            if (days != null) {
                inv.setExpiresAt(inv.getPurchasedAt().plusDays(days));
            }
        }

        return inventoryRepository.save(inv);
    }
}
