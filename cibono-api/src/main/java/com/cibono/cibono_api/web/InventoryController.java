package com.cibono.cibono_api.web;

import com.cibono.cibono_api.common.UserContext;
import com.cibono.cibono_api.domain.Inventory;
import com.cibono.cibono_api.repository.InventoryRepository;
import com.cibono.cibono_api.service.GeminiService;
import com.cibono.cibono_api.service.GeminiService.ScannedItem;
import com.cibono.cibono_api.service.InventoryService;
import com.cibono.cibono_api.service.ReceiptParserService;
import com.cibono.cibono_api.service.TesseractOcrService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
public class InventoryController {
    private static final Logger log = LoggerFactory.getLogger(InventoryController.class);
    private final InventoryRepository inventoryRepository;
    private final InventoryService inventoryService;
    private final GeminiService geminiService;
    private final TesseractOcrService tesseractOcr;

    public InventoryController(InventoryRepository inventoryRepository,
                               InventoryService inventoryService,
                               GeminiService geminiService,
                               TesseractOcrService tesseractOcr) {
        this.inventoryRepository = inventoryRepository;
        this.inventoryService = inventoryService;
        this.geminiService = geminiService;
        this.tesseractOcr = tesseractOcr;
    }

    public record ScanRequest(String imageBase64, String mimeType) {}
    public record ScanTextRequest(String ocrText) {}

    @PostMapping("/inventory/scan")
    public List<ScannedItem> scan(@RequestBody ScanRequest req) {
        // 1단계: Tesseract 로컬 OCR (이미지 → 텍스트)
        String ocrText = tesseractOcr.extractText(req.imageBase64(), req.mimeType());
        // 2단계: Gemini 텍스트 API 파싱 (텍스트 → 재료 JSON)
        List<ScannedItem> result = geminiService.parseReceiptText(ocrText);
        log.info("=== Gemini 파싱 결과 ({}) ===\n{}", result.size(), result);
        return result;
    }

    @PostMapping("/inventory/scan-text")
    public List<ScannedItem> scanText(@RequestBody ScanTextRequest req) {
        log.info("=== OCR 수신 텍스트 ===\n{}", req.ocrText());
        List<ScannedItem> result = geminiService.parseReceiptText(req.ocrText());
        log.info("=== Gemini 파싱 결과 ({}) ===\n{}", result.size(), result);
        return result;
    }

    @PostMapping("/inventory/bulk")
    public List<Inventory> bulkAdd(@RequestBody List<Inventory> reqs) {
        Long userId = UserContext.userId();
        return reqs.stream().map(req -> {
            BigDecimal addQty = req.getQuantity() == null ? BigDecimal.ONE : req.getQuantity();
            String normalizedName = req.getItemName() == null ? "" : req.getItemName().trim();
            // 동일 재료명(대소문자 무시)이 이미 있으면 수량만 합산
            return inventoryRepository.findFirstByUserIdAndItemNameIgnoreCase(userId, normalizedName)
                .map(existing -> {
                    existing.setQuantity(existing.getQuantity().add(addQty));
                    return inventoryRepository.save(existing);
                })
                .orElseGet(() -> {
                    Inventory inv = new Inventory();
                    inv.setUserId(userId);
                    inv.setItemName(normalizedName);
                    inv.setQuantity(addQty);
                    inv.setUnit(req.getUnit());
                    inv.setStorage(req.getStorage() != null ? req.getStorage() : "FRIDGE");
                    inv.setPurchasedAt(req.getPurchasedAt());
                    inv.setExpiresAt(req.getExpiresAt());
                    return inventoryService.saveWithAutoExpiry(inv);
                });
        }).toList();
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

        if (req.getItemName() != null) inv.setItemName(req.getItemName());
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
