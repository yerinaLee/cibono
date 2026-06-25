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

import java.util.Base64;
import java.util.List;

@Service
public class ClovaOcrService {

    private static final Logger log = LoggerFactory.getLogger(ClovaOcrService.class);

    @Value("${yolo.ocr.url:http://localhost:8000}/ocr/clova")
    private String clovaUrl;

    private final RestTemplate rest = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();
    private final GeminiService geminiService;

    public ClovaOcrService(GeminiService geminiService) {
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
                @Override public String getFilename() { return "receipt." + ext; }
            });

            String response = rest.postForObject(clovaUrl, new HttpEntity<>(body, headers), String.class);
            JsonNode root = mapper.readTree(response);

            // CLOVA는 FullText 클래스 하나로 전체 텍스트를 반환
            String fullText = root.at("/detections/0/text").asText("").trim();
            log.info("[ClovaOcr] 원본 텍스트:\n{}", fullText);

            if (fullText.isEmpty()) return List.of();

            List<ScannedItem> result = geminiService.parseReceiptText(fullText);
            log.info("[ClovaOcr] Gemini 정규화 결과: {}", result);
            return result;

        } catch (Exception e) {
            throw new RuntimeException("CLOVA OCR 호출 실패: " + e.getMessage(), e);
        }
    }
}
