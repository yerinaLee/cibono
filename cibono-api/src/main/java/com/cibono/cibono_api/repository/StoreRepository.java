package com.cibono.cibono_api.repository;

import com.cibono.cibono_api.domain.Store;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StoreRepository extends JpaRepository<Store, Long> {
	
	List<Store> findBySourceAndActiveTrue(String source);
	
	List<Store> findByActiveTrue();
	
}
