package com.cibono.cibono_api.web;

import com.cibono.cibono_api.common.UserContext;
import com.cibono.cibono_api.domain.ShoppingListItem;
import com.cibono.cibono_api.repository.ShoppingListRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/shopping-list")
public class ShoppingListController {

    private final ShoppingListRepository repo;

    public ShoppingListController(ShoppingListRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public List<ShoppingListItem> list() {
        return repo.findByUserIdOrderByCreatedAtDesc(UserContext.userId());
    }

    @PostMapping
    public ShoppingListItem add(@RequestBody Map<String, Object> body) {
        ShoppingListItem item = new ShoppingListItem();
        item.setUserId(UserContext.userId());
        item.setItemName((String) body.get("itemName"));
        if (body.get("quantity") != null) {
            item.setQuantity(new BigDecimal(body.get("quantity").toString()));
        }
        if (body.get("unit") != null) {
            item.setUnit((String) body.get("unit"));
        }
        return repo.save(item);
    }

    @PostMapping("/bulk")
    public List<ShoppingListItem> addBulk(@RequestBody List<Map<String, Object>> items) {
        long userId = UserContext.userId();
        List<ShoppingListItem> toSave = items.stream().map(body -> {
            ShoppingListItem item = new ShoppingListItem();
            item.setUserId(userId);
            item.setItemName((String) body.get("itemName"));
            if (body.get("quantity") != null) {
                item.setQuantity(new BigDecimal(body.get("quantity").toString()));
            }
            if (body.get("unit") != null) {
                item.setUnit((String) body.get("unit"));
            }
            return item;
        }).toList();
        return repo.saveAll(toSave);
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ShoppingListItem> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return repo.findById(id)
            .filter(item -> item.getUserId().equals(UserContext.userId()))
            .map(item -> {
                if (body.containsKey("quantity")) {
                    Object q = body.get("quantity");
                    item.setQuantity(q == null ? null : new BigDecimal(q.toString()));
                }
                if (body.containsKey("unit")) {
                    item.setUnit((String) body.get("unit"));
                }
                return ResponseEntity.ok(repo.save(item));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        repo.findById(id).ifPresent(item -> {
            if (item.getUserId().equals(UserContext.userId())) {
                repo.delete(item);
            }
        });
        return ResponseEntity.noContent().build();
    }
}
