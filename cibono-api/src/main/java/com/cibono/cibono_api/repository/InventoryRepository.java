package com.cibono.cibono_api.repository;

import com.cibono.cibono_api.domain.Inventory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InventoryRepository extends JpaRepository<Inventory, Long> {
    List<Inventory> findByUserIdOrderByExpiresAtAsc(Long userId);
    Optional<Inventory> findFirstByUserIdAndItemNameIgnoreCase(Long userId, String itemName);
}
