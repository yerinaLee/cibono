package com.cibono.cibono_api.scheduler;

import com.cibono.cibono_api.domain.Inventory;
import com.cibono.cibono_api.domain.NotificationConfig;
import com.cibono.cibono_api.domain.PushToken;
import com.cibono.cibono_api.dto.RecipeDto;
import com.cibono.cibono_api.domain.UserNotificationPreference;
import com.cibono.cibono_api.repository.InventoryRepository;
import com.cibono.cibono_api.repository.NotificationConfigRepository;
import com.cibono.cibono_api.repository.PushTokenRepository;
import com.cibono.cibono_api.repository.UserNotificationPreferenceRepository;
import com.cibono.cibono_api.service.FoodSafetyApiService;
import com.cibono.cibono_api.service.PushNotificationService;
import com.cibono.cibono_api.service.RecipeService;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;
import java.util.stream.Collectors;

@Component
public class DinnerNotificationScheduler {
	
	private static final Logger log = LoggerFactory.getLogger(DinnerNotificationScheduler.class);
	
	private final TaskScheduler taskScheduler;
	private final NotificationConfigRepository configRepo;
	private final PushTokenRepository pushTokenRepository;
	private final RecipeService recipeService;
	private final InventoryRepository inventoryRepository;
	private final FoodSafetyApiService foodSafetyApiService;
	private final UserNotificationPreferenceRepository prefRepository;
	private final PushNotificationService pushNotificationService;
	
	// configId → 실행 중인 스케줄 Future
	private final Map<Long, ScheduledFuture<?>> activeTasks = new ConcurrentHashMap<>();
	
	// 최근 보낸 레시피 이름 (최대 5개) — 중복 방지용
	private final Deque<String> recentlySent = new ArrayDeque<>();
	private static final int RECENT_LIMIT = 5;
	
	public DinnerNotificationScheduler(TaskScheduler taskScheduler,
										NotificationConfigRepository configRepo,
										PushTokenRepository pushTokenRepository,
										RecipeService recipeService,
										InventoryRepository inventoryRepository,
										FoodSafetyApiService foodSafetyApiService,
										UserNotificationPreferenceRepository prefRepository,
										PushNotificationService pushNotificationService) {
		this.taskScheduler = taskScheduler;
		this.configRepo = configRepo;
		this.pushTokenRepository = pushTokenRepository;
		this.recipeService = recipeService;
		this.inventoryRepository = inventoryRepository;
		this.foodSafetyApiService = foodSafetyApiService;
		this.prefRepository = prefRepository;
		this.pushNotificationService = pushNotificationService;
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
		if (!config.isEnabled()) {
			return;
		}
		
		CronTrigger trigger = new CronTrigger(
				config.getCronExpression(),
				TimeZone.getTimeZone(config.getTimezone())
		);
		
		ScheduledFuture<?> future = taskScheduler.schedule(() -> executeNotification(config), trigger);
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
		String mealType = config.getMealType();

		// 수신 대상 토큰을 "사용자별"로 그룹핑 (사용자별 알림 수신 설정 반영)
		// userId가 없는(로그인 전) 토큰은 개인화할 수 없으므로 제외한다.
		Map<Long, List<PushToken>> tokensByUser = pushTokenRepository.findAll().stream()
				.filter(pt -> pt.getUserId() != null)
				.filter(pt -> {
					UserNotificationPreference pref = prefRepository.findById(pt.getUserId()).orElse(null);
					if (pref == null) return true;
					return "LUNCH".equals(mealType) ? pref.isLunchEnabled() : pref.isDinnerEnabled();
				})
				.collect(Collectors.groupingBy(PushToken::getUserId));

		if (tokensByUser.isEmpty()) {
			log.info("[Notif] 발송 대상 없음 (configId={}, mealType={})", config.getId(), mealType);
			return;
		}

		// 사용자마다 본인 재고 기반으로 레시피를 선택해 발송
		tokensByUser.forEach((userId, userTokens) -> {
			String recipeName = pickRecipeName(userId);
			if (recipeName == null) {
				log.info("[Notif] 추천 레시피 없음 (userId={}, configId={})", userId, config.getId());
				return;
			}

			String body = config.getBodyTemplate().replace("{recipe}", recipeName);
			log.info("[Notif] 발송: '{}' → {}개 기기 (userId={}, configId={}, mealType={})",
					recipeName, userTokens.size(), userId, config.getId(), mealType);

			for (PushToken pt : userTokens) {
				try {
					pushNotificationService.send(pt.getToken(), config.getTitle(), body, Map.of("recipeName", recipeName));
				} catch (Exception e) {
					log.warn("[Notif] 발송 실패 token={}: {}", pt.getToken(), e.getMessage());
				}
			}
		});
	}

	private String pickRecipeName(long userId) {
		// 1. 재고에서 유통기한 임박 순으로 재료 최대 4개 추출
		List<Inventory> inventory = inventoryRepository.findByUserIdOrderByExpiresAtAsc(userId);
		List<String> ingredients = inventory.stream()
				.map(Inventory::getItemName)
				.distinct()
				.limit(4)
				.toList();
		
		// 2. 외부 API로 재고 기반 레시피 새로 검색
		if (!ingredients.isEmpty()) {
			try {
				List<RecipeDto.RecipeCard> cards = foodSafetyApiService.searchBulk(ingredients);
				String name = pickExcludingRecent(cards.stream().map(RecipeDto.RecipeCard::name).toList());
				if (name != null) {
					log.info("[Notif] 외부API 레시피 선택: '{}' (재료: {}, 후보: {}개)", name, ingredients, cards.size());
					recordSent(name);
					return name;
				}
			} catch (Exception e) {
				log.warn("[Notif] 외부API 레시피 검색 실패, 로컬 DB 폴백: {}", e.getMessage());
			}
		}
		
		// 3. 로컬 DB 폴백: 상위 10개 후보 중 최근 보낸 것 제외
		List<RecipeService.RecipeSuggestion> suggestions = recipeService.recommendToday(userId);
		List<String> candidateNames = suggestions.stream()
				.filter(s -> s.score() > 0)
				.limit(10)
				.map(RecipeService.RecipeSuggestion::name)
				.toList();
		
		if (candidateNames.isEmpty()) {
			candidateNames = suggestions.stream().map(RecipeService.RecipeSuggestion::name).toList();
		}
		
		String name = pickExcludingRecent(candidateNames);
		if (name == null) return null;
		
		log.info("[Notif] 로컬DB 레시피 선택: '{}' (후보: {}개)", name, candidateNames.size());
		recordSent(name);
		return name;
	}
	
	private String pickExcludingRecent(List<String> names) {
		if (names.isEmpty()) return null;
		List<String> filtered = names.stream()
				.filter(n -> !recentlySent.contains(n))
				.toList();
		// 후보가 모두 최근 목록에 있으면 전체에서 선택 (재고 변화 없는 극단적 케이스)
		List<String> pool = filtered.isEmpty() ? names : filtered;
		int idx = LocalDate.now().getDayOfYear() % pool.size();
		return pool.get(idx);
	}
	
	private synchronized void recordSent(String name) {
		recentlySent.remove(name);
		recentlySent.addLast(name);
		if (recentlySent.size() > RECENT_LIMIT) {
			recentlySent.removeFirst();
		}
	}
	
}
