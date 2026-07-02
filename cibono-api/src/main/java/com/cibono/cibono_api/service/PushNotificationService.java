package com.cibono.cibono_api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Expo Push API 발송 공용 서비스 (메뉴 추천/가격 알림 등에서 공유) */
@Service
public class PushNotificationService {
	
	private static final Logger log = LoggerFactory.getLogger(PushNotificationService.class);
	private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
	
	private final RestTemplate rest = new RestTemplate();
	
	public void send(String token, String title, String body, Map<String, Object> data) {
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_JSON);
		headers.set("Accept", "application/json");
		
		Map<String, Object> message = new HashMap<>();
		message.put("to", token);
		message.put("title", title);
		message.put("body", body);
		message.put("data", data);
		message.put("sound", "default");
		message.put("priority", "high");
		
		var response = rest.postForEntity(EXPO_PUSH_URL, new HttpEntity<>(List.of(message), headers), String.class);
		log.info("[Push] Expo 응답: {}", response.getBody());
	}
	
}
