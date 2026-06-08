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
import java.util.Set;

@Service
public class GeminiService {

    @Value("${gemini.api.key}")
    private String apiKey;

    private final RestTemplate rest = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();

    private static final String GEMINI_URL =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=";

    private static final String PROMPT = """
        이 이미지는 마트 영수증 또는 온라인 쇼핑 주문내역 캡처입니다.
        이미지에서 식료품에 해당하는 모든 항목을 빠짐없이 추출하세요. 누락이 없도록 이미지 전체를 꼼꼼히 확인하세요.

        [응답 규칙]
        1. 마크다운 없이 JSON 배열만 반환 (다른 텍스트 절대 금지)
        2. 상품명 → 일반 식재료명으로 정규화. 예: "농협 유기농 달걀 30구 1판" → itemName:"계란", quantity:30, unit:"개"
        3. 브랜드명·등급·원산지·포장 단위 설명은 제거하고 핵심 재료명만 남길 것
        4. 식료품이 아닌 항목(세제·휴지·음료·과자·조미료 단독 포장 등)은 제외
        5. 같은 재료가 여러 번 나오면 합산하지 말고 각각 별도 항목으로 출력
        6. 수량 불명확 시 1, 단위 불명확 시 "개"

        응답 형식(이 형식만, 다른 텍스트 금지): [{"itemName":"재료명","quantity":숫자,"unit":"단위"}]
        """;

    private static final Set<String> WEIGHT_VOLUME_UNITS =
        Set.of("g", "kg", "mg", "ml", "l", "oz", "lb", "cc", "gram", "liter");

    private ScannedItem normalizeUnit(ScannedItem item) {
        if (item.unit() == null) return item;
        String u = item.unit().toLowerCase().replaceAll("\\s+", "");
        boolean isWeight = WEIGHT_VOLUME_UNITS.stream().anyMatch(u::equals);
        if (isWeight) return new ScannedItem(item.itemName(), BigDecimal.ONE, "개");
        return item;
    }

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

            return mapper.readValue(text, new TypeReference<List<ScannedItem>>() {})
                    .stream().map(this::normalizeUnit).toList();

        } catch (Exception e) {
            throw new RuntimeException("Gemini API 호출 실패: " + e.getMessage(), e);
        }
    }

    public List<ScannedItem> parseReceiptText(String ocrText) {
        try {
            String prompt = """
                아래는 마트 영수증/온라인 주문내역에서 OCR로 추출한 텍스트입니다. 인식 오류로 일부 글자가 깨질 수 있습니다.
                식료품 재료명과 수량을 JSON 배열로만 응답하세요. 마크다운·부가 텍스트 없이 JSON 배열만 반환하세요.
                상품명은 일반 식재료명으로 정규화하세요. 예: "농협 유기농 달걀 30구 1판" → {"itemName":"계란","quantity":30,"unit":"개"}
                식료품이 아닌 항목(세제·휴지·음료·과자·생활용품·합계·금액 등)은 제외하세요.
                수량 불명확 시 1, 단위 불명확 시 "개"로 설정하세요.
                응답 형식(이 형식만): [{"itemName":"재료명","quantity":숫자,"unit":"단위"}]

                OCR 텍스트:
                """ + ocrText;

            Map<String, Object> body = Map.of(
                "contents", List.of(Map.of(
                    "parts", List.of(Map.of("text", prompt))
                ))
            );

            String raw = rest.postForObject(GEMINI_URL + apiKey, body, String.class);
            JsonNode root = mapper.readTree(raw);
            String text = root.at("/candidates/0/content/parts/0/text").asText("");
            text = text.replaceAll("(?s)```json\\s*", "").replaceAll("(?s)```\\s*", "").trim();

            return mapper.readValue(text, new TypeReference<List<ScannedItem>>() {})
                    .stream().map(this::normalizeUnit).toList();
        } catch (Exception e) {
            throw new RuntimeException("텍스트 파싱 실패: " + e.getMessage(), e);
        }
    }

    public record ScannedItem(String itemName, BigDecimal quantity, String unit) {}
}
