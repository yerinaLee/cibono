package com.cibono.cibono_api.web;

import com.cibono.cibono_api.common.UserContext;
import com.cibono.cibono_api.domain.UserNotificationPreference;
import com.cibono.cibono_api.repository.UserNotificationPreferenceRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/notifications")
public class NotificationPreferenceController {

	private final UserNotificationPreferenceRepository prefRepo;

	public NotificationPreferenceController(UserNotificationPreferenceRepository prefRepo) {
		this.prefRepo = prefRepo;
	}

	@GetMapping("/preferences")
	public UserNotificationPreference getPreferences() {
		Long userId = UserContext.userId();
		return prefRepo.findById(userId).orElse(new UserNotificationPreference(userId));
	}

	@PutMapping("/preferences")
	public ResponseEntity<UserNotificationPreference> updatePreferences(@RequestBody UpdateRequest req) {
		Long userId = UserContext.userId();
		UserNotificationPreference pref = prefRepo.findById(userId)
				.orElse(new UserNotificationPreference(userId));
		pref.setLunchEnabled(req.lunchEnabled());
		pref.setDinnerEnabled(req.dinnerEnabled());
		return ResponseEntity.ok(prefRepo.save(pref));
	}

	public record UpdateRequest(boolean lunchEnabled, boolean dinnerEnabled) {}
}
