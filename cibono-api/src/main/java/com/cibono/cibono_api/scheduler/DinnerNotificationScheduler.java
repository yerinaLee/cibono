package com.cibono.cibono_api.scheduler;

import com.cibono.cibono_api.common.UserContext;
import com.cibono.cibono_api.domain.NotificationConfig;
import com.cibono.cibono_api.domain.PushToken;
import com.cibono.cibono_api.repository.NotificationConfigRepository;
import com.cibono.cibono_api.repository.PushTokenRepository;
import com.cibono.cibono_api.service.RecipeService;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

@Component
public class DinnerNotificationScheduler {

    private static final Logger log = LoggerFactory.getLogger(DinnerNotificationScheduler.class);
    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

    private final TaskScheduler taskScheduler;
    private final NotificationConfigRepository configRepo;
    private final PushTokenRepository pushTokenRepository;
    private final RecipeService recipeService;
    private final RestTemplate rest = new RestTemplate();

    // configId → 실행 중인 스케줄 Future
    private final Map<Long, ScheduledFuture<?>> activeTasks = new ConcurrentHashMap<>();

    public DinnerNotificationScheduler(TaskScheduler taskScheduler,
                                       NotificationConfigRepository configRepo,
                                       PushTokenRepository pushTokenRepository,
                                       RecipeService recipeService) {
        this.taskScheduler = taskScheduler;
        this.configRepo = configRepo;
        this.pushTokenRepository = pushTokenRepository;
        this.recipeService = recipeService;
    }

    /** 서버 시작 시 DB의 활성 알림 설정을 모두 스케줄 등록 */
    @PostConstruct
    public void initOnStartup() {
        List<NotificationConfig> configs = configRepo.findAllByEnabledTrue();
        log.info("[Notif] 시작 시 {}개 알림 스케줄 등록", configs.size());
        configs.forEach(this::scheduleConfig);
    }

    /** 새 알림 설정 스케줄 등록 (또는 기존 재등록) */
    public void scheduleConfig(NotificationConfig config) {
        cancelConfig(config.getId());
        if (!config.isEnabled()) return;

        CronTrigger trigger = new CronTrigger(
                config.getCronExpression(),
                TimeZone.getTimeZone(config.getTimezone())
        );
        ScheduledFuture<?> future = taskScheduler.schedule(
                () -> executeNotification(config),
                trigger
        );
        activeTasks.put(config.getId(), future);
        log.info("[Notif] 스케줄 등록: id={}, cron={}", config.getId(), config.getCronExpression());
    }

    /** 알림 설정 스케줄 취소 */
    public void cancelConfig(Long configId) {
        ScheduledFuture<?> existing = activeTasks.remove(configId);
        if (existing != null) {
            existing.cancel(false);
            log.info("[Notif] 스케줄 취소: id={}", configId);
        }
    }

    /** 즉시 발송 (관리자 화면 "지금 발송" 버튼) */
    public void triggerNow(NotificationConfig config) {
        executeNotification(config);
    }

    private void executeNotification(NotificationConfig config) {
        List<PushToken> tokens = pushTokenRepository.findAll();
        if (tokens.isEmpty()) {
            log.info("[Notif] 토큰 없음 — 발송 생략 (configId={})", config.getId());
            return;
        }

        // 인벤토리 기반 최고점 레시피 선택
        String recipeName = pickRecipeName();
        if (recipeName == null) {
            log.info("[Notif] 추천 레시피 없음 (configId={})", config.getId());
            return;
        }

        String body = config.getBodyTemplate().replace("{recipe}", recipeName);
        log.info("[Notif] 발송: '{}' → {} 개 기기 (configId={})", recipeName, tokens.size(), config.getId());

        for (PushToken pt : tokens) {
            try {
                sendExpoPush(pt.getToken(), config.getTitle(), body, recipeName);
            } catch (Exception e) {
                log.warn("[Notif] 발송 실패 token={}: {}", pt.getToken(), e.getMessage());
            }
        }
    }

    private String pickRecipeName() {
        List<RecipeService.RecipeSuggestion> suggestions = recipeService.recommendToday(UserContext.userId());
        return suggestions.stream()
                .filter(s -> s.score() > 0)
                .findFirst()
                .map(RecipeService.RecipeSuggestion::name)
                .orElse(suggestions.isEmpty() ? null : suggestions.get(0).name());
    }

    private void sendExpoPush(String token, String title, String body, String recipeName) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Accept", "application/json");

        Map<String, Object> message = new HashMap<>();
        message.put("to", token);
        message.put("title", title);
        message.put("body", body);
        message.put("data", Map.of("recipeName", recipeName));
        message.put("sound", "default");
        message.put("priority", "high");

        var response = rest.postForEntity(EXPO_PUSH_URL, new HttpEntity<>(List.of(message), headers), String.class);
        log.info("[Notif] Expo 응답: {}", response.getBody());
    }
}
