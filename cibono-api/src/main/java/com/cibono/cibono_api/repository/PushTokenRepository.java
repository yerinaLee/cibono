package com.cibono.cibono_api.repository;

import com.cibono.cibono_api.domain.PushToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PushTokenRepository extends JpaRepository<PushToken, Long> {
	
	Optional<PushToken> findByToken(String token);
	
}
