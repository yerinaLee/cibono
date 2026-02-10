package com.cibono.cibono_api.web;

import com.cibono.cibono_api.common.UserContext;
import com.cibono.cibono_api.domain.AlertEvent;
import com.cibono.cibono_api.domain.PriceAlert;
import com.cibono.cibono_api.repository.PriceAlertRepository;
import com.cibono.cibono_api.service.AlertService;
import org.springframework.web.bind.annotation.*;
import java.util.List;


@RestController
public class AlertController {
    private final PriceAlertRepository priceAlertRepository;
    private final AlertService alertService;

    public AlertController(PriceAlertRepository priceAlertRepository, AlertService alertService) {
        this.priceAlertRepository = priceAlertRepository;
        this.alertService = alertService;
    }

    // 알림 규칙 등록(기준가)
    @PostMapping("/alerts/rules")
    public PriceAlert createRule(@RequestBody PriceAlert req) {
        long userId = UserContext.userId();
        PriceAlert rule = new PriceAlert();
        rule.setUserId(userId);
        rule.setItemName(req.getItemName());
        rule.setAnchorPrice(req.getAnchorPrice());
        rule.setThresholdType("LTE");
        return priceAlertRepository.save(rule);
    }

    @GetMapping("/alerts")
    public List<AlertEvent> listEvents() {
        long userId = UserContext.userId();
        return alertService.listEvents(userId);
    }

    @PostMapping("/alerts/seen/{id}")
    public void markSeen(@PathVariable long id) {
        long userId = UserContext.userId();
        alertService.markSeen(userId, id);
    }

    // 개발 편의: 스케줄러 기다리기 싫으면 수동 스캔 실행
    @PostMapping("/admin/alerts/run-scan")
    public int runScanNow() {
        long userId = UserContext.userId();
        return alertService.runDailyScan(userId);
    }
}
