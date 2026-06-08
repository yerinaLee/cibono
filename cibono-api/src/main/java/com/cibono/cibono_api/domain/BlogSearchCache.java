package com.cibono.cibono_api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

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

    public BlogSearchCache() {}

    public BlogSearchCache(String query, String resultJson, LocalDateTime cachedAt) {
        this.query = query;
        this.resultJson = resultJson;
        this.cachedAt = cachedAt;
    }

    public String getQuery() { return query; }
    public void setQuery(String query) { this.query = query; }

    public String getResultJson() { return resultJson; }
    public void setResultJson(String resultJson) { this.resultJson = resultJson; }

    public LocalDateTime getCachedAt() { return cachedAt; }
    public void setCachedAt(LocalDateTime cachedAt) { this.cachedAt = cachedAt; }
}
