package com.cibono.cibono_api.repository;

import com.cibono.cibono_api.domain.Recipe;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecipeRepository extends JpaRepository<Recipe, Long> {
}
