package com.cibono.cibono_api.common;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;

@Configuration
public class FirebaseConfig {
	
	@PostConstruct
	public void init() throws IOException {
		if (!FirebaseApp.getApps().isEmpty()) {
			return;
		}
		
		GoogleCredentials credentials = GoogleCredentials
				.fromStream(new ClassPathResource("firebase-service-account.json").getInputStream());
		
		FirebaseOptions options = FirebaseOptions.builder().setCredentials(credentials).build();
		
		FirebaseApp.initializeApp(options);
	}
	
}
