package com.cibono.cibono_api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.concurrent.TimeUnit;

@Service
public class TesseractOcrService {
	
	private static final Logger log = LoggerFactory.getLogger(TesseractOcrService.class);
	
	@Value("${tesseract.path:C:\\\\Program Files\\\\Tesseract-OCR\\\\tesseract.exe}")
	private String tesseractPath;
	
	public String extractText(String base64Image, String mimeType) {
		byte[] imageBytes = Base64.getDecoder().decode(base64Image);
		String ext = (mimeType != null && mimeType.contains("png")) ? "png" : "jpg";
		Path tempFile = null;
		try {
			tempFile = Files.createTempFile("receipt_", "." + ext);
			Files.write(tempFile, imageBytes);
			
			ProcessBuilder pb = new ProcessBuilder(
					tesseractPath,
					tempFile.toAbsolutePath().toString(),
					"stdout",
					"-l",
					"kor+eng",
					"--psm", "6", // 단일 텍스트 블록 가정 (영수증에 적합)
					"--oem", "1"  // LSTM 엔진만 사용 (최고 정확도)
			);
			pb.redirectErrorStream(false);
			Process process = pb.start();
			
			String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
			boolean finished = process.waitFor(30, TimeUnit.SECONDS);
			if (!finished) {
				process.destroyForcibly();
				throw new RuntimeException("Tesseract 타임아웃 (30초)");
			}
			
			log.info("=== Tesseract OCR 결과 ===\n{}", output);
			return output;
			
		} catch (IOException | InterruptedException e) {
			throw new RuntimeException("Tesseract OCR 실패: " + e.getMessage(), e);
		} finally {
			if (tempFile != null) {
				try {
					Files.deleteIfExists(tempFile);
				} catch (IOException ignored) {
				}
			}
		}
	}
	
}
