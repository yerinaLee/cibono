package com.cibono.cibono_api.web;

import com.cibono.cibono_api.common.UserContext;
import com.cibono.cibono_api.domain.SavedRecipe;
import com.cibono.cibono_api.repository.SavedRecipeRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/saved-recipes")
public class SavedRecipeController {

    private final SavedRecipeRepository repo;

    public SavedRecipeController(SavedRecipeRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public List<SavedRecipe> list(@RequestParam(required = false) String q) {
        List<SavedRecipe> all = repo.findByUserIdOrderByCreatedAtDesc(UserContext.userId());
        if (q == null || q.isBlank()) return all;
        String kw = q.trim().toLowerCase();
        return all.stream()
            .filter(r -> r.getRecipeName().toLowerCase().contains(kw)
                || (r.getIngredients() != null && r.getIngredients().toLowerCase().contains(kw)))
            .toList();
    }

    @GetMapping("/exists")
    public Map<String, Boolean> exists(@RequestParam String name) {
        boolean saved = repo.existsByUserIdAndRecipeName(UserContext.userId(), name);
        return Map.of("saved", saved);
    }

    @PostMapping
    public SavedRecipe save(@RequestBody Map<String, Object> body) {
        String name = (String) body.get("recipeName");
        return repo.findByUserIdAndRecipeName(UserContext.userId(), name)
            .orElseGet(() -> {
                SavedRecipe r = new SavedRecipe();
                r.setUserId(UserContext.userId());
                r.setRecipeName(name);
                if (body.get("imageUrl") != null) r.setImageUrl((String) body.get("imageUrl"));
                if (body.get("sourceType") != null) r.setSourceType((String) body.get("sourceType"));
                if (body.get("sourceUrl") != null) r.setSourceUrl((String) body.get("sourceUrl"));
                if (body.get("ingredients") != null) r.setIngredients((String) body.get("ingredients"));
                return repo.save(r);
            });
    }

    @DeleteMapping("/by-name")
    public ResponseEntity<Void> deleteByName(@RequestParam String name) {
        repo.findByUserIdAndRecipeName(UserContext.userId(), name)
            .ifPresent(repo::delete);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteById(@PathVariable Long id) {
        repo.findById(id).ifPresent(r -> {
            if (r.getUserId().equals(UserContext.userId())) repo.delete(r);
        });
        return ResponseEntity.noContent().build();
    }
}