package com.cibono.cibono_api.repository;

import com.cibono.cibono_api.domain.Deal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.time.LocalDate;

public interface DealRepository extends JpaRepository<Deal, Long> {

    List<Deal> findByStartsAtLessThanEqualAndEndsAtGreaterThanEqual(LocalDate startsAtBound, LocalDate endsAtBound);

    List<Deal> findByItemNameContainingIgnoreCaseAndStartsAtLessThanEqualAndEndsAtGreaterThanEqual(
            String keyword, LocalDate startsAtBound, LocalDate endsAtBound);

    List<Deal> findByItemNameIgnoreCaseAndStartsAtLessThanEqualAndEndsAtGreaterThanEqual(
            String itemName, LocalDate startsAtBound, LocalDate endsAtBound);

}
