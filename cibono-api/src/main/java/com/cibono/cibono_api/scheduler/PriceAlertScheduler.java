package com.cibono.cibono_api.scheduler;

import com.cibono.cibono_api.common.UserContext;
import com.cibono.cibono_api.service.AlertService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class PriceAlertScheduler {
    private final AlertService alertService;

    public PriceAlertScheduler(AlertService alertService){
        this.alertService = alertService;
    }

    // MVP: 10분마다 한 번 스캔(개발용). 나중에 cron(매일 9시 등)으로 변경.
    @Scheduled(fixedDelay = 10*60*1000L)
    public void scan(){
        long userId = UserContext.userId();
        alertService.runDailyScan(userId);
    }

}
