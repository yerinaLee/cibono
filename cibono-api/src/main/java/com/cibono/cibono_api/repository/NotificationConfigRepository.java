package com.cibono.cibono_api.repository;

import com.cibono.cibono_api.domain.NotificationConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationConfigRepository extends JpaRepository<NotificationConfig, Long> {
    List<NotificationConfig> findAllByEnabledTrue();
}
