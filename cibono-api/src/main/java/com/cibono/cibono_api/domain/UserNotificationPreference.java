package com.cibono.cibono_api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "user_notification_preference")
public class UserNotificationPreference {

	@Id
	@Column(name = "user_id")
	private Long userId;

	@Column(name = "lunch_enabled", nullable = false)
	private boolean lunchEnabled = true;

	@Column(name = "dinner_enabled", nullable = false)
	private boolean dinnerEnabled = true;

	public UserNotificationPreference(Long userId) {
		this.userId = userId;
	}
}
