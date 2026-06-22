package com.cibono.cibono_api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "blog_search_cache")
public class BlogSearchCache {
	
	@Id
	@Column(name = "query", length = 200)
	private String query;
	
	@Column(name = "result_json", columnDefinition = "TEXT", nullable = false)
	private String resultJson;
	
	@Column(name = "cached_at", nullable = false)
	private LocalDateTime cachedAt;
	
}
