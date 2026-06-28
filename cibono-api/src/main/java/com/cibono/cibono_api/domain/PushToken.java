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
@Table(name = "push_token")
public class PushToken {
	
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	
	@Column(unique = true, nullable = false, length = 500)
	private String token;

	@Column(name = "user_id")
	private Long userId;

	@Column(name = "registered_at")
	private LocalDateTime registeredAt = LocalDateTime.now();

	public PushToken(String token) {
		this.token = token;
	}
	
}
