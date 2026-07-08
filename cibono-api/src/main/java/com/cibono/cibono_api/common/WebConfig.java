package com.cibono.cibono_api.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

	// 허용 Origin은 설정으로 제어 (운영에서는 실제 웹 도메인으로 좁힐 것). 기본값은 개발 편의를 위한 전체 허용.
	@Value("${app.cors.allowed-origins:*}")
	private String[] allowedOrigins;

	@Bean
	public TaskScheduler taskScheduler() {
		ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
		scheduler.setPoolSize(4);
		scheduler.setThreadNamePrefix("notif-");
		return scheduler;
	}

	@Override
	public void addCorsMappings(CorsRegistry registry) {
		// 인증은 Authorization(Bearer) 헤더로만 처리하므로 쿠키 자격증명은 불필요 → allowCredentials(false).
		// (와일드카드 Origin + allowCredentials(true) 조합은 브라우저가 거부하는 취약 설정)
		registry.addMapping("/**")
				.allowedOriginPatterns(allowedOrigins)
				.allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
				.allowedHeaders("*")
				.allowCredentials(false);
	}

}
