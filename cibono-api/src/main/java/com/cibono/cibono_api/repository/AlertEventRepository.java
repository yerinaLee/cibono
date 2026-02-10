package com.cibono.cibono_api.repository;

import com.cibono.cibono_api.domain.AlertEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AlertEventRepository extends JpaRepository<AlertEvent, Long> {
    List<AlertEvent> findByUserIdOrderByTriggeredAtDesc(Long userId);

    Optional<AlertEvent> findByUserIdAndDealId(Long userId, Long dealId);
}
