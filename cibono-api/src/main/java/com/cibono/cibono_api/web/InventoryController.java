package com.cibono.cibono_api.web;

import com.cibono.cibono_api.common.UserContext;
import com.cibono.cibono_api.domain.Inventory;
import com.cibono.cibono_api.repository.InventoryRepository;
import com.cibono.cibono_api.service.InventoryService;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
public class InventoryController {
    private final InventoryRepository inventoryRepository;
    private final InventoryService inventoryService;


    public InventoryController(InventoryRepository inventoryRepository, InventoryService inventoryService) {
        this.inventoryRepository = inventoryRepository;
        this.inventoryService = inventoryService;
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
        return inventoryService.saveWithAutoExpiry(inv);
    }

    @PatchMapping("/inventory/{id}")
    public Inventory update(@PathVariable long id, @RequestBody Inventory req){
        Inventory inv = inventoryRepository.findById(id)
                .orElseThrow(()-> new IllegalArgumentException("inventory not found"));

        if(!inv.getUserId().equals(UserContext.userId())) throw  new IllegalArgumentException("forbidden");

        if (req.getQuantity() != null) inv.setQuantity(req.getQuantity());
        if (req.getUnit() != null) inv.setUnit(req.getUnit());
        if (req.getStorage() != null) inv.setStorage(req.getStorage());
        if (req.getPurchasedAt() != null) inv.setPurchasedAt(req.getPurchasedAt());
        inv.setExpiresAt(req.getExpiresAt()); // null 허용(사용자 삭제)

        return inventoryRepository.save(inv);
    }

    @DeleteMapping("/inventory/{id}")
    public void delete(@PathVariable long id) {
        Inventory inv = inventoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("inventory not found"));
        if (!inv.getUserId().equals(UserContext.userId())) throw new IllegalArgumentException("forbidden");
        inventoryRepository.delete(inv);
    }


}
