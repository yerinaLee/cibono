package com.cibono.cibono_api.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;

@RestController
public class ImageProxyController {
	
	private static final Logger log = LoggerFactory.getLogger(ImageProxyController.class);
	
	@GetMapping("/proxy-image")
	public ResponseEntity<byte[]> proxyImage(@RequestParam String url) {
		try {
			HttpURLConnection conn = openWithRedirects(url, 3);

			int status = conn.getResponseCode();
			log.info("[ImageProxy] {} → HTTP {}", url, status);

			if (status != 200) {
				return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
			}

			String contentType = conn.getContentType();
			if (contentType == null || !contentType.startsWith("image/")) {
				contentType = "image/jpeg";
			}

			try (InputStream is = conn.getInputStream()) {
				byte[] bytes = is.readAllBytes();
				HttpHeaders headers = new HttpHeaders();
				headers.set(HttpHeaders.CONTENT_TYPE, contentType);
				headers.set(HttpHeaders.CACHE_CONTROL, "public, max-age=86400");
				return new ResponseEntity<>(bytes, headers, HttpStatus.OK);
			}
		} catch (Exception e) {
			log.warn("[ImageProxy] 실패 {}: {}", url, e.getMessage());
			return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
		}
	}

	private HttpURLConnection openImageConnection(String url) throws java.io.IOException {
		HttpURLConnection conn = (HttpURLConnection) URI.create(url).toURL().openConnection();
		conn.setConnectTimeout(5000);
		conn.setReadTimeout(5000);
		conn.setInstanceFollowRedirects(false);
		conn.setRequestProperty("Referer", "https://blog.naver.com");
		conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
		conn.setRequestProperty("Accept", "image/webp,image/apng,image/*,*/*;q=0.8");
		conn.connect();
		return conn;
	}

	// http↔https 등 프로토콜이 바뀌는 리다이렉트는 HttpURLConnection이 자동으로 따라가지 않아 수동 추적
	private HttpURLConnection openWithRedirects(String url, int maxHops) throws java.io.IOException {
		String current = url;
		HttpURLConnection conn = openImageConnection(current);
		for (int hop = 0; hop < maxHops; hop++) {
			int status = conn.getResponseCode();
			boolean isRedirect = status == HttpURLConnection.HTTP_MOVED_PERM
					|| status == HttpURLConnection.HTTP_MOVED_TEMP
					|| status == HttpURLConnection.HTTP_SEE_OTHER
					|| status == 307 || status == 308;
			String location = isRedirect ? conn.getHeaderField("Location") : null;
			if (location == null || location.isBlank()) {
				return conn;
			}
			conn.disconnect();
			current = URI.create(current).resolve(location).toString();
			conn = openImageConnection(current);
		}
		return conn;
	}

}
