package com.cibono.cibono_api.service;

import com.cibono.cibono_api.domain.AlertEvent;
import com.cibono.cibono_api.domain.Deal;
import com.cibono.cibono_api.domain.PriceAlert;
import com.cibono.cibono_api.repository.AlertEventRepository;
import com.cibono.cibono_api.repository.DealRepository;
import com.cibono.cibono_api.repository.PriceAlertRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class AlertService {

    private final PriceAlertRepository priceAlertRepository;
    private final DealRepository dealRepository;
    private final AlertEventRepository alertEventRepository;

    public AlertService(PriceAlertRepository priceAlertRepository,
                        DealRepository dealRepository,
                        AlertEventRepository alertEventRepository) {
        this.priceAlertRepository = priceAlertRepository;
        this.dealRepository = dealRepository;
        this.alertEventRepository = alertEventRepository;
    }

    public List<AlertEvent> listEvents(long userId) {
        return alertEventRepository.findByUserIdOrderByTriggeredAtDesc(userId);
    }

    @Transactional
    public void markSeen(long userId, long eventId) {
        AlertEvent ev = alertEventRepository.findById(eventId)
                .orElseThrow(() -> new IllegalArgumentException("event not found"));
        if (!ev.getUserId().equals(userId)) throw new IllegalArgumentException("forbidden");
        ev.setSeen(true);
    }

    /** 오늘 활성 deal을 기준으로, price_alert 조건 만족하면 alert_event 생성 */
    @Transactional
    public int runDailyScan(long userId) {
        LocalDate today = LocalDate.now();
        List<PriceAlert> rules = priceAlertRepository.findByUserId(userId);

        int created = 0;

        for (PriceAlert rule : rules) {
            // MVP: item_name 완전 일치 + 오늘 유효한 deal만
            List<Deal> deals = dealRepository
                    .findByItemNameIgnoreCaseAndStartsAtLessThanEqualAndEndsAtGreaterThanEqual(
                            rule.getItemName(), today, today
                    );

            for (Deal d : deals) {
                boolean hit = d.getDealPrice() <= rule.getAnchorPrice(); // MVP: LTE만
                if (!hit) continue;

                // 중복 알림 방지: (userId, dealId) 이미 있으면 skip
                if (alertEventRepository.findByUserIdAndDealId(userId, d.getId()).isPresent()) continue;

                AlertEvent ev = new AlertEvent();
                ev.setUserId(userId);
                ev.setDealId(d.getId());
                alertEventRepository.save(ev);
                created++;
            }
        }
        return created;
    }





}
