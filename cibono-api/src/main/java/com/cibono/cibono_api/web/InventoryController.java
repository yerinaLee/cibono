package com.cibono.cibono_api.web;

import com.cibono.cibono_api.common.UserContext;
import com.cibono.cibono_api.domain.Inventory;
import com.cibono.cibono_api.repository.InventoryRepository;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
public class InventoryController {
    private final InventoryRepository inventoryRepository;

    public InventoryController(InventoryRepository inventoryRepository) {
        this.inventoryRepository = inventoryRepository;
    }

    @GetMapping("/inventory")
    public List<Inventory> list() {
        return inventoryRepository.findByUserIdOrderByExpiresAtAsc(UserContext.userId());
    }

    @PostMapping("/inventory")
    public Inventory add(@RequestBody Inventory req) {
        Inventory inv = new Inventory();
        inv.setUserId(UserContext.userId());
        inv.setItemName(req.getItemName());
        inv.setQuantity(req.getQuantity() == null ? BigDecimal.ONE : req.getQuantity());
        inv.setUnit(req.getUnit());
        inv.setStorage(req.getStorage()); // FRIDGE/FREEZER/PANTRY
        inv.setPurchasedAt(req.getPurchasedAt());
        inv.setExpiresAt(req.getExpiresAt());
        return inventoryRepository.save(inv);
    }
}
