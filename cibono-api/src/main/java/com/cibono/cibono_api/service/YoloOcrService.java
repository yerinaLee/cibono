package com.cibono.cibono_api.service;

import com.cibono.cibono_api.service.GeminiService.ScannedItem;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

@Service
public class YoloOcrService {

    private static final Logger log = LoggerFactory.getLogger(YoloOcrService.class);

    @Value("${yolo.ocr.url:http://localhost:8000/ocr/paddle}")
    private String yoloUrl;

    private final RestTemplate rest = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();
    private final GeminiService geminiService;

    public YoloOcrService(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    public List<ScannedItem> scan(String base64Image, String mimeType) {
        try {
            byte[] imageBytes = Base64.getDecoder().decode(base64Image);
            String ext = mimeType != null && mimeType.contains("png") ? "png" : "jpg";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", new ByteArrayResource(imageBytes) {
                @Override
                public String getFilename() {
                    return "receipt." + ext;
                }
            });

            HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);
            String response = rest.postForObject(yoloUrl, request, String.class);

            JsonNode root = mapper.readTree(response);
            JsonNode detections = root.get("detections");

            List<String> rawItems = new ArrayList<>();
            for (JsonNode det : detections) {
                String cls = det.get("class").asText();
                String text = det.get("text").asText().trim();
                if (text.isEmpty()) continue;
                if ("Item".equals(cls)) rawItems.add(text);
            }

            log.info("[YoloOcr] 원본 OCR 품목: {}", rawItems);

            if (rawItems.isEmpty()) return List.of();

            // 바코드·숫자·영문 노이즈 제거: 한국어 음절만 추출
            List<String> cleanedItems = rawItems.stream()
                .map(t -> t.replaceAll("[^가-힣\\s]", "").replaceAll("\\s+", " ").trim())
                .filter(t -> t.length() >= 2)
                .toList();

            log.info("[YoloOcr] 한국어 정제 품목: {}", cleanedItems);

            if (cleanedItems.isEmpty()) return List.of();

            // EasyOCR 결과를 Gemini 텍스트 API로 정규화 (Vision API 아님 — 비용 거의 없음)
            String joinedText = String.join("\n", cleanedItems);
            List<ScannedItem> result = geminiService.parseReceiptText(joinedText);
            log.info("[YoloOcr] Gemini 정규화 결과: {}", result);
            return result;

        } catch (Exception e) {
            throw new RuntimeException("YOLO OCR 호출 실패: " + e.getMessage(), e);
        }
    }
}
