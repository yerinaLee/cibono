package com.cibono.cibono_api.repository;

import com.cibono.cibono_api.domain.ItemShelfLife;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ItemShelfLifeRepository extends JpaRepository<ItemShelfLife, Long> {
    Optional<ItemShelfLife> findByItemName(String itemName);
}
