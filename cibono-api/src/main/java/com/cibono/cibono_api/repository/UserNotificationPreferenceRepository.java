package com.cibono.cibono_api.repository;

import com.cibono.cibono_api.domain.UserNotificationPreference;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserNotificationPreferenceRepository extends JpaRepository<UserNotificationPreference, Long> {
}
