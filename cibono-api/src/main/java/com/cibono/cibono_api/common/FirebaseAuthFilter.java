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
		String uri = request.getRequestURI();

		// CORS preflight(OPTIONS), 헬스체크, 이미지 프록시는 인증 없이 통과.
		// (이미지 프록시는 RN <Image>가 토큰 헤더 없이 호출하므로 공개 처리)
		if ("OPTIONS".equalsIgnoreCase(request.getMethod())
				|| uri.equals("/actuator/health") || uri.startsWith("/actuator/health/")
				|| uri.equals("/proxy-image")) {
			filterChain.doFilter(request, response);
			return;
		}

		String header = request.getHeader("Authorization");
		if (header == null || !header.startsWith("Bearer ")) {
			response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "인증 토큰이 필요합니다.");
			return;
		}

		try {
			FirebaseToken decoded = FirebaseAuth.getInstance().verifyIdToken(header.substring(7));
			AppUser user = findOrCreate(decoded.getUid());
			UserContext.set(user.getId(), user.getRole());
		} catch (Exception e) {
			log.warn("[Auth] 토큰 검증 실패: {}", e.getMessage());
			response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "유효하지 않은 토큰입니다.");
			return;
		}

		try {
			// /admin/** 경로는 ADMIN만 접근 가능
			if (uri.startsWith("/admin/") && !UserContext.isAdmin()) {
				response.sendError(HttpServletResponse.SC_FORBIDDEN, "관리자 권한이 필요합니다.");
				return;
			}
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
