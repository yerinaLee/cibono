package com.cibono.cibono_api.service;

import com.cibono.cibono_api.domain.Inventory;
import com.cibono.cibono_api.repository.InventoryRepository;
import com.cibono.cibono_api.repository.ItemShelfLifeRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Service
public class InventoryService {

    private final InventoryRepository inventoryRepository;
    private final ItemShelfLifeRepository itemShelfLifeRepository;

    public InventoryService(InventoryRepository inventoryRepository,
                            ItemShelfLifeRepository itemShelfLifeRepository) {
        this.inventoryRepository = inventoryRepository;
        this.itemShelfLifeRepository = itemShelfLifeRepository;
    }

    public Inventory saveWithAutoExpiry(Inventory inv) {
        if (inv.getPurchasedAt() == null) {
            inv.setPurchasedAt(LocalDate.now());
        }

        if (inv.getExpiresAt() == null) {
            itemShelfLifeRepository.findByItemName(inv.getItemName())
                    .ifPresent(rule ->
                            inv.setExpiresAt(inv.getPurchasedAt().plusDays(rule.getShelfLifeDays()))
                    );
        }

        return inventoryRepository.save(inv);
    }
}
