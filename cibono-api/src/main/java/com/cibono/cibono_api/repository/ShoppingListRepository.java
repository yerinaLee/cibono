package com.cibono.cibono_api.repository;

import com.cibono.cibono_api.domain.ShoppingListItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ShoppingListRepository extends JpaRepository<ShoppingListItem, Long> {
	
	List<ShoppingListItem> findByUserIdOrderByCreatedAtDesc(Long userId);
	
}
