package com.cibono.cibono_api.repository;

import com.cibono.cibono_api.domain.FoodCategory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FoodCategoryRepository extends JpaRepository<FoodCategory, Integer> {
}
