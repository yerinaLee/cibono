package com.cibono.cibono_api.repository;

import com.cibono.cibono_api.domain.Deal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.time.LocalDate;

public interface DealRepository extends JpaRepository<Deal, Long> {
    List<Deal> findByItemNameContainingIgnoreCase(String q);

    List<Deal> findByStartsAtLessThanEqualAndEndsAtGreaterThanEqual(LocalDate from, LocalDate to);

    List<Deal> findByItemNameIgnoreCaseAndStartsAtLessThanEqualAndEndsAtGreaterThanEqual(
            String itemName, LocalDate from, LocalDate to
    );
}
