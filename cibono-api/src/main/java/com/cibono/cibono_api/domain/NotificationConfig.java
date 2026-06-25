package com.cibono.cibono_api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "notification_config")
public class NotificationConfig {
	
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	
	/** 알림 제목 (예: "🍽️ 오늘 저녁 뭐 먹지?") */
	@Column(nullable = false)
	private String title;
	
	/** 알림 본문 템플릿. {recipe} 자리에 추천 레시피명 삽입 */
	@Column(name = "body_template", nullable = false)
	private String bodyTemplate;
	
	/** Spring cron 표현식 (초 분 시 일 월 요일) — 예: "0 0 18 * * *" */
	@Column(name = "cron_expression", nullable = false)
	private String cronExpression;
	
	@Column(nullable = false)
	private String timezone = "Asia/Seoul";
	
	@Column(nullable = false)
	private boolean enabled = true;

	/** LUNCH 또는 DINNER — 사용자 알림 수신 설정 필터링에 사용 */
	@Column(name = "meal_type", nullable = false, length = 10)
	private String mealType = "DINNER";

	@Column(name = "created_at")
	private LocalDateTime createdAt = LocalDateTime.now();
	
}
