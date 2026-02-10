package com.cibono.cibono_api.repository;

import com.cibono.cibono_api.domain.Inventory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InventoryRepository extends JpaRepository<Inventory, Long> {
    List<Inventory> findByUserIdOrderByExpiresAtAsc(Long userId);
}
