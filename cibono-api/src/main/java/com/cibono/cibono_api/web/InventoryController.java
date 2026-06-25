package com.cibono.cibono_api.web;

import com.cibono.cibono_api.common.UserContext;
import com.cibono.cibono_api.domain.FoodCategory;
import com.cibono.cibono_api.domain.Inventory;
import com.cibono.cibono_api.repository.FoodCategoryRepository;
import com.cibono.cibono_api.repository.InventoryRepository;
import com.cibono.cibono_api.service.GeminiService;
import com.cibono.cibono_api.service.GeminiService.ScannedItem;
import com.cibono.cibono_api.service.InventoryService;
import com.cibono.cibono_api.service.ClovaOcrService;
import com.cibono.cibono_api.service.DirectOcrService;
import com.cibono.cibono_api.service.KorieOcrService;
import com.cibono.cibono_api.service.TesseractOcrService;
import com.cibono.cibono_api.service.YoloOcrService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
public class InventoryController {
    private static final Logger log = LoggerFactory.getLogger(InventoryController.class);
    private final InventoryRepository inventoryRepository;
    private final FoodCategoryRepository foodCategoryRepository;
    private final InventoryService inventoryService;
    private final GeminiService geminiService;
    private final TesseractOcrService tesseractOcr;
    private final YoloOcrService yoloOcrService;
    private final ClovaOcrService clovaOcrService;
    private final DirectOcrService directOcrService;
    private final KorieOcrService korieOcrService;

    public InventoryController(InventoryRepository inventoryRepository,
                               FoodCategoryRepository foodCategoryRepository,
                               InventoryService inventoryService,
                               GeminiService geminiService,
                               TesseractOcrService tesseractOcr,
                               YoloOcrService yoloOcrService,
                               ClovaOcrService clovaOcrService,
                               DirectOcrService directOcrService,
                               KorieOcrService korieOcrService) {
        this.inventoryRepository = inventoryRepository;
        this.foodCategoryRepository = foodCategoryRepository;
        this.inventoryService = inventoryService;
        this.geminiService = geminiService;
        this.tesseractOcr = tesseractOcr;
        this.yoloOcrService = yoloOcrService;
        this.clovaOcrService = clovaOcrService;
        this.directOcrService = directOcrService;
        this.korieOcrService = korieOcrService;
    }

    public record ScanRequest(String imageBase64, String mimeType) {}
    public record ScanTextRequest(String ocrText) {}

    public record InventoryResponse(
        Long id, Long userId, String itemName,
        BigDecimal quantity, String unit, String storage,
        String purchasedAt, String expiresAt,
        Integer categoryId, String categoryName,
        boolean favorite
    ) {}

    // ── 카테고리 목록 ──────────────────────────────────────
    @GetMapping("/food-categories")
    public List<FoodCategory> categories() {
        return foodCategoryRepository.findAll();
    }

    // ── 인벤토리 목록 ──────────────────────────────────────
    @GetMapping("/inventory")
    public List<InventoryResponse> list() {
        List<Inventory> items = inventoryRepository.findByUserIdOrderByExpiresAtAsc(UserContext.userId());
        Map<Integer, String> catMap = foodCategoryRepository.findAll()
            .stream().collect(Collectors.toMap(FoodCategory::getId, FoodCategory::getName));

        return items.stream().map(inv -> new InventoryResponse(
            inv.getId(), inv.getUserId(), inv.getItemName(),
            inv.getQuantity(), inv.getUnit(), inv.getStorage(),
            inv.getPurchasedAt() != null ? inv.getPurchasedAt().toString() : null,
            inv.getExpiresAt() != null ? inv.getExpiresAt().toString() : null,
            inv.getCategoryId(),
            inv.getCategoryId() != null ? catMap.get(inv.getCategoryId()) : null,
            Boolean.TRUE.equals(inv.getFavorite())
        )).toList();
    }

    // ── 인벤토리 추가 ──────────────────────────────────────
    @PostMapping("/inventory")
    public Inventory add(@RequestBody Inventory req) {
        Inventory inv = new Inventory();
        inv.setUserId(UserContext.userId());
        inv.setItemName(req.getItemName());
        inv.setQuantity(req.getQuantity() == null ? BigDecimal.ONE : req.getQuantity());
        inv.setUnit(req.getUnit());
        inv.setStorage(req.getStorage());
        inv.setPurchasedAt(req.getPurchasedAt());
        inv.setExpiresAt(req.getExpiresAt());
        inv.setCategoryId(req.getCategoryId());
        inv.setFavorite(req.isFavorite());
        return inventoryService.saveWithAutoExpiry(inv);
    }

    // ── 인벤토리 수정 ──────────────────────────────────────
    @PatchMapping("/inventory/{id}")
    public Inventory update(@PathVariable long id, @RequestBody Inventory req) {
        Inventory inv = inventoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("inventory not found"));
        if (!inv.getUserId().equals(UserContext.userId())) throw new IllegalArgumentException("forbidden");

        if (req.getItemName() != null) inv.setItemName(req.getItemName());
        if (req.getQuantity() != null) inv.setQuantity(req.getQuantity());
        if (req.getUnit() != null) inv.setUnit(req.getUnit());
        if (req.getStorage() != null) inv.setStorage(req.getStorage());
        if (req.getPurchasedAt() != null) inv.setPurchasedAt(req.getPurchasedAt());
        inv.setExpiresAt(req.getExpiresAt());
        if (req.getCategoryId() != null) inv.setCategoryId(req.getCategoryId());
        if (req.getFavorite() != null) inv.setFavorite(req.getFavorite());

        return inventoryRepository.save(inv);
    }

    // ── 인벤토리 삭제 ──────────────────────────────────────
    @DeleteMapping("/inventory/{id}")
    public void delete(@PathVariable long id) {
        Inventory inv = inventoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("inventory not found"));
        if (!inv.getUserId().equals(UserContext.userId())) throw new IllegalArgumentException("forbidden");
        inventoryRepository.delete(inv);
    }

    // ── OCR 스캔 ──────────────────────────────────────────
    @PostMapping("/inventory/scan")
    public List<ScannedItem> scan(@RequestBody ScanRequest req) {
        List<ScannedItem> result = geminiService.scanReceipt(req.imageBase64(), req.mimeType());
        log.info("=== Gemini Vision 결과 ({}) ===\n{}", result.size(), result);
        return result;
    }

    @PostMapping("/inventory/scan-yolo")
    public List<ScannedItem> scanYolo(@RequestBody ScanRequest req) {
        List<ScannedItem> result = yoloOcrService.scan(req.imageBase64(), req.mimeType());
        log.info("=== YOLO+PaddleOCR 결과 ({}) ===\n{}", result.size(), result);
        return result;
    }

    @PostMapping("/inventory/scan-clova")
    public List<ScannedItem> scanClova(@RequestBody ScanRequest req) {
        List<ScannedItem> result = clovaOcrService.scan(req.imageBase64(), req.mimeType());
        log.info("=== CLOVA OCR 결과 ({}) ===\n{}", result.size(), result);
        return result;
    }

    @PostMapping("/inventory/scan-direct")
    public List<ScannedItem> scanDirect(@RequestBody ScanRequest req) {
        List<ScannedItem> result = directOcrService.scan(req.imageBase64(), req.mimeType());
        log.info("=== Direct OCR 결과 ({}) ===\n{}", result.size(), result);
        return result;
    }

    @PostMapping("/inventory/scan-korie")
    public List<ScannedItem> scanKorie(@RequestBody ScanRequest req) {
        List<ScannedItem> result = korieOcrService.scan(req.imageBase64(), req.mimeType());
        log.info("=== KORIE OCR 결과 ({}) ===\n{}", result.size(), result);
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
                    inv.setCategoryId(req.getCategoryId());
                    return inventoryService.saveWithAutoExpiry(inv);
                });
        }).toList();
    }
}
