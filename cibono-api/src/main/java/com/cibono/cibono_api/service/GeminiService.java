package com.cibono.cibono_api.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class GeminiService {

    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);
    private static final int MAX_RETRY = 3;

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
        return callGeminiWithRetry(body, "Vision OCR");
    }

    private List<ScannedItem> callGeminiWithRetry(Map<String, Object> body, String label) {
        int attempt = 0;
        while (true) {
            try {
                attempt++;
                String raw = rest.postForObject(GEMINI_URL + apiKey, body, String.class);
                JsonNode root = mapper.readTree(raw);
                String text = root.at("/candidates/0/content/parts/0/text").asText("");
                text = text.replaceAll("(?s)```json\\s*", "").replaceAll("(?s)```\\s*", "").trim();
                return mapper.readValue(text, new TypeReference<List<ScannedItem>>() {})
                        .stream().map(this::normalizeUnit).toList();
            } catch (HttpServerErrorException e) {
                if (e.getStatusCode().value() == 503 && attempt < MAX_RETRY) {
                    long wait = (long) Math.pow(2, attempt) * 1000;
                    log.warn("[Gemini] {} 503 에러 — {}ms 후 재시도 ({}/{})", label, wait, attempt, MAX_RETRY);
                    try { Thread.sleep(wait); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                } else {
                    throw new RuntimeException("Gemini " + label + " 실패 [" + e.getStatusCode() + "]: " + e.getMessage(), e);
                }
            } catch (Exception e) {
                throw new RuntimeException("Gemini " + label + " 호출 실패: " + e.getMessage(), e);
            }
        }
    }

    public List<ScannedItem> parseReceiptText(String ocrText) {
        String prompt = """
            아래는 마트 영수증/온라인 주문내역에서 OCR로 추출한 텍스트입니다. 인식 오류로 일부 글자가 깨져 있을 수 있습니다.

            [중요 규칙]
            1. OCR 텍스트에 명확하게 식별 가능한 한국어 식재료명이 있는 경우에만 추출하세요.
            2. 텍스트가 깨지거나 알파벳/숫자 조합으로만 이루어져 식재료명을 확신할 수 없으면 절대 추측하거나 지어내지 마세요.
            3. 확실하지 않은 항목은 포함하지 말고 완전히 제외하세요.
            4. 식별 가능한 식재료가 하나도 없으면 빈 배열 []을 반환하세요.
            5. 상품명은 일반 식재료명으로 정규화하세요. 예: "농협 유기농 달걀 30구 1판" → itemName:"계란", quantity:30, unit:"개"
            6. 식료품이 아닌 항목(세제·휴지·음료·과자·생활용품·합계·금액·바코드 등)은 제외하세요.
            7. 수량 불명확 시 1, 단위 불명확 시 "개"로 설정하세요.
            8. 마크다운 없이 JSON 배열만 반환하세요.

            응답 형식(이 형식만): [{"itemName":"재료명","quantity":숫자,"unit":"단위"}]

            OCR 텍스트:
            """ + ocrText;

        Map<String, Object> body = Map.of(
            "contents", List.of(Map.of(
                "parts", List.of(Map.of("text", prompt))
            ))
        );
        return callGeminiWithRetry(body, "텍스트 파싱");
    }

    public record ScannedItem(String itemName, BigDecimal quantity, String unit) {}
}
