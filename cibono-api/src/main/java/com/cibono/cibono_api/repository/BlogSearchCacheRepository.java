package com.cibono.cibono_api.repository;

import com.cibono.cibono_api.domain.BlogSearchCache;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BlogSearchCacheRepository extends JpaRepository<BlogSearchCache, String> {
}
