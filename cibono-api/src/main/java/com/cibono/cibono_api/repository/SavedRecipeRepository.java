package com.cibono.cibono_api.repository;

import com.cibono.cibono_api.domain.SavedRecipe;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface SavedRecipeRepository extends JpaRepository<SavedRecipe, Long> {
    List<SavedRecipe> findByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<SavedRecipe> findByUserIdAndRecipeName(Long userId, String recipeName);
    boolean existsByUserIdAndRecipeName(Long userId, String recipeName);
}