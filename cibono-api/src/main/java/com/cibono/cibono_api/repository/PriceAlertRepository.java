package com.cibono.cibono_api.repository;

import com.cibono.cibono_api.domain.PriceAlert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PriceAlertRepository extends JpaRepository<PriceAlert, Long> {
	
	List<PriceAlert> findByUserId(Long userId);
	
	List<PriceAlert> findByIsEnabledTrue();
	
	List<PriceAlert> findByUserIdAndIsEnabled(Long userId, boolean isEnabled);
	
	Optional<PriceAlert> findByIdAndUserId(Long id, Long userId);
	
}
