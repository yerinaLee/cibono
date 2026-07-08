package com.cibono.cibono_api.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.NoSuchElementException;

/**
 * 컨트롤러 전역 예외 처리.
 * 검증/요청 오류가 스택트레이스와 함께 500으로 노출되지 않도록 일관된 에러 본문과 상태코드로 매핑한다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	/** 잘못된 요청 값 (예: "itemName required") → 400 */
	@ExceptionHandler(IllegalArgumentException.class)
	public ResponseEntity<Map<String, Object>> handleBadRequest(IllegalArgumentException e) {
		return body(HttpStatus.BAD_REQUEST, e.getMessage());
	}

	/** 존재하지 않는 리소스 (orElseThrow 등) → 404 */
	@ExceptionHandler(NoSuchElementException.class)
	public ResponseEntity<Map<String, Object>> handleNotFound(NoSuchElementException e) {
		return body(HttpStatus.NOT_FOUND, e.getMessage());
	}

	/** @Valid 바인딩 검증 실패 → 400 */
	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
		String message = e.getBindingResult().getFieldErrors().stream()
				.findFirst()
				.map(fe -> fe.getField() + " " + fe.getDefaultMessage())
				.orElse("요청 값 검증에 실패했습니다.");
		return body(HttpStatus.BAD_REQUEST, message);
	}

	private ResponseEntity<Map<String, Object>> body(HttpStatus status, String message) {
		return ResponseEntity.status(status).body(Map.of(
				"status", status.value(),
				"error", status.getReasonPhrase(),
				"message", message != null ? message : ""
		));
	}
}
