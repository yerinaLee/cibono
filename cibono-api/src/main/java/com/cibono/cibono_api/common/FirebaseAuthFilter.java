package com.cibono.cibono_api.common;

import com.cibono.cibono_api.domain.AppUser;
import com.cibono.cibono_api.repository.AppUserRepository;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class FirebaseAuthFilter extends OncePerRequestFilter {
	
	private static final Logger log = LoggerFactory.getLogger(FirebaseAuthFilter.class);
	
	private final AppUserRepository userRepository;
	
	public FirebaseAuthFilter(AppUserRepository userRepository) {
		this.userRepository = userRepository;
	}
	
	@Override
	protected void doFilterInternal(HttpServletRequest request,
									HttpServletResponse response,
									FilterChain filterChain) throws ServletException, IOException {
		String header = request.getHeader("Authorization");
		
		if (header != null && header.startsWith("Bearer ")) {
			String idToken = header.substring(7);
			try {
				FirebaseToken decoded = FirebaseAuth.getInstance().verifyIdToken(idToken);
				String firebaseUid = decoded.getUid();
				AppUser user = findOrCreate(firebaseUid);
				UserContext.set(user.getId(), user.getRole());
			} catch (Exception e) {
				log.warn("[Auth] 토큰 검증 실패: {}", e.getMessage());
				UserContext.set(1L, "USER");
			}
		} else {
			UserContext.set(1L, "ADMIN"); // 토큰 없을 때 개발용 fallback (로컬 테스트용)
		}
		
		// /admin/** 경로는 ADMIN만 접근 가능
		if (request.getRequestURI().startsWith("/admin/") && !UserContext.isAdmin()) {
			UserContext.clear();
			response.sendError(HttpServletResponse.SC_FORBIDDEN, "관리자 권한이 필요합니다.");
			return;
		}
		
		try {
			filterChain.doFilter(request, response);
		} finally {
			UserContext.clear();
		}
	}
	
	private AppUser findOrCreate(String firebaseUid) {
		return userRepository.findByFirebaseUid(firebaseUid).orElseGet(() -> {
			try {
				log.info("[Auth] 신규 유저 등록: uid={}", firebaseUid);
				return userRepository.save(new AppUser(firebaseUid));
			} catch (DataIntegrityViolationException e) {
				return userRepository.findByFirebaseUid(firebaseUid).orElseThrow();
			}
		});
	}
	
}
