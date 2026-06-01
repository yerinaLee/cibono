package com.cibono.cibono_api.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Service
public class GeminiService {

    @Value("${gemini.api.key}")
    private String apiKey;

    private final RestTemplate rest = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    private static final String GEMINI_URL =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=";

    private static final String PROMPT = """
        이 이미지는 마트 영수증 또는 온라인 쇼핑 주문내역 캡처입니다.
        식료품 재료명과 수량을 JSON 배열로만 응답하세요. 마크다운이나 부가 텍스트 없이 JSON 배열만 반환하세요.
        상품명은 일반 식재료명으로 정규화하세요. 예: "국내산 달걀 30구 1판" → {"itemName":"계란","quantity":30,"unit":"개"}
        식료품이 아닌 항목(세제, 음료, 과자, 생활용품)은 제외하세요.
        수량 불명확 시 1, 단위 불명확 시 "개"로 설정하세요.
        응답 형식(반드시 이 형식만): [{"itemName":"재료명","quantity":숫자,"unit":"단위"}]
        """;

    public List<ScannedItem> scanReceipt(String base64Image, String mimeType) {
        try {
            Map<String, Object> body = Map.of(
                "contents", List.of(Map.of(
                    "parts", List.of(
                        Map.of("text", PROMPT),
                        Map.of("inline_data", Map.of(
                            "mime_type", mimeType,
                            "data", base64Image
                        ))
                    )
                ))
            );

            String raw = rest.postForObject(GEMINI_URL + apiKey, body, String.class);

            JsonNode root = mapper.readTree(raw);
            String text = root.at("/candidates/0/content/parts/0/text").asText("");

            // 마크다운 코드 블록 제거
            text = text.replaceAll("(?s)```json\\s*", "").replaceAll("(?s)```\\s*", "").trim();

            return mapper.readValue(text, new TypeReference<List<ScannedItem>>() {});

        } catch (Exception e) {
            throw new RuntimeException("Gemini API 호출 실패: " + e.getMessage(), e);
        }
    }

    public record ScannedItem(String itemName, BigDecimal quantity, String unit) {}
}
