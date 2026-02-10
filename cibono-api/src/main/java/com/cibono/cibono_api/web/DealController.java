package com.cibono.cibono_api.web;

import com.cibono.cibono_api.domain.Deal;
import com.cibono.cibono_api.repository.DealRepository;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
public class DealController {
    private final DealRepository dealRepository;

    public DealController(DealRepository dealRepository) {
        this.dealRepository = dealRepository;
    }

    // 사용자용: 특가 조회(오늘 유효한 것만)
    @GetMapping("/deals")
    public List<Deal> listDeals(@RequestParam(required = false) String q) {
        if (q != null && !q.isBlank()) {
            return dealRepository.findByItemNameContainingIgnoreCase(q);
        }
        LocalDate today = LocalDate.now();
        return dealRepository.findByStartsAtLessThanEqualAndEndsAtGreaterThanEqual(today, today);
    }

    // 관리자용: 특가 수동 등록(MVP용)
    @PostMapping("/admin/deals")
    public Deal createDeal(@RequestBody Deal req) {
        if (req.getItemName() == null || req.getItemName().isBlank()) {
            throw new IllegalArgumentException("itemName required");
        }
        if (req.getDealPrice() == null || req.getDealPrice() <= 0) {
            throw new IllegalArgumentException("dealPrice required");
        }
        if (req.getStartsAt() == null || req.getEndsAt() == null) {
            throw new IllegalArgumentException("startsAt/endsAt required");
        }
        return dealRepository.save(req);
    }




}
