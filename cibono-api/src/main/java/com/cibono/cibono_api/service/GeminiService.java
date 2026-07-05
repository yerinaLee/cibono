package com.cibono.cibono_api.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
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
	
	@Value("${gemini.api.key.flyer}")
	private String flyerApiKey;
	
	private final RestTemplate rest = new RestTemplate();
	private final ObjectMapper mapper = new ObjectMapper();
	
	private static final String GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=";
	
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
	
	private static final Map<String, Object> FLYER_DEAL_ITEM_SCHEMA = Map.of(
			"type", "OBJECT",
			"properties", Map.ofEntries(
					Map.entry("itemName", Map.of("type", "STRING")),
					Map.entry("dealPrice", Map.of("type", "INTEGER")),
					Map.entry("originalPrice", Map.of("type", "INTEGER", "nullable", true)),
					Map.entry("promotionType", Map.of(
							"type", "STRING",
							"enum", List.of("PLUS_N", "PERCENT_OFF", "SPECIAL_PRICE"),
							"nullable", true)),
					Map.entry("buyQty", Map.of("type", "INTEGER", "nullable", true)),
					Map.entry("freeQty", Map.of("type", "INTEGER", "nullable", true)),
					Map.entry("quantity", Map.of("type", "NUMBER", "nullable", true)),
					Map.entry("unit", Map.of(
							"type", "STRING",
							"enum", List.of("개", "kg", "g", "ml", "L"),
							"nullable", true))
			),
			"required", List.of("itemName", "dealPrice")
	);
	
	private static final Map<String, Object> FLYER_DEAL_LIST_SCHEMA = Map.of(
			"type", "ARRAY",
			"items", FLYER_DEAL_ITEM_SCHEMA
	);
	
	private static final Map<String, Object> FLYER_PARSE_RESULT_SCHEMA = Map.of(
			"type", "OBJECT",
			"properties", Map.of(
					"startDate", Map.of("type", "STRING", "nullable", true),
					"endDate", Map.of("type", "STRING", "nullable", true),
					"items", FLYER_DEAL_LIST_SCHEMA
			),
			"required", List.of("items")
	);
	
	private static Map<String, Object> generationConfig(Map<String, Object> responseSchema) {
		return Map.of(
				"temperature", 0.0,
				"responseMimeType", "application/json",
				"responseSchema", responseSchema
		);
	}
	
	private ScannedItem normalizeUnit(ScannedItem item) {
		if (item.unit() == null) {
			return item;
		}
		String u = item.unit().toLowerCase().replaceAll("\\s+", "");
		boolean isWeight = WEIGHT_VOLUME_UNITS.stream().anyMatch(u::equals);
		if (isWeight) {
			return new ScannedItem(item.itemName(), BigDecimal.ONE, "개");
		}
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
		return callGeminiWithRetry(body, "Vision OCR", apiKey);
	}
	
	private String callGeminiRaw(Map<String, Object> body, String label, String key) {
		int attempt = 0;
		while (true) {
			try {
				attempt++;
				String raw = rest.postForObject(GEMINI_URL + key, body, String.class);
				JsonNode root = mapper.readTree(raw);
				String text = root.at("/candidates/0/content/parts/0/text").asText("");
				return text.replaceAll("(?s)```json\\s*", "").replaceAll("(?s)```\\s*", "").trim();
			} catch (HttpClientErrorException e) {
				if (e.getStatusCode().value() == 429 && attempt < MAX_RETRY) {
					// Retry-After 헤더 또는 응답 메시지에서 대기 시간 파싱
					long waitMs = parseRetryAfterMs(e.getMessage());
					log.warn("[Gemini] {} 429 Rate Limit — {}ms 후 재시도 ({}/{})", label, waitMs, attempt, MAX_RETRY);
					try {
						Thread.sleep(waitMs);
					} catch (InterruptedException ie) {
						Thread.currentThread().interrupt();
					}
				} else {
					throw new RuntimeException("Gemini " + label + " 실패 [" + e.getStatusCode() + "]: " + e.getMessage(), e);
				}
			} catch (HttpServerErrorException e) {
				if (e.getStatusCode().value() == 503 && attempt < MAX_RETRY) {
					long wait = (long) Math.pow(2, attempt) * 1000;
					log.warn("[Gemini] {} 503 에러 — {}ms 후 재시도 ({}/{})", label, wait, attempt, MAX_RETRY);
					try {
						Thread.sleep(wait);
					} catch (InterruptedException ie) {
						Thread.currentThread().interrupt();
					}
				} else {
					throw new RuntimeException("Gemini " + label + " 실패 [" + e.getStatusCode() + "]: " + e.getMessage(),
							e);
				}
			} catch (Exception e) {
				throw new RuntimeException("Gemini " + label + " 호출 실패: " + e.getMessage(), e);
			}
		}
	}
	
	private List<ScannedItem> callGeminiWithRetry(Map<String, Object> body, String label, String key) {
		String text = callGeminiRaw(body, label, key);
		try {
			return mapper.readValue(text, new TypeReference<List<ScannedItem>>() {
			}).stream().map(this::normalizeUnit).toList();
		} catch (Exception e) {
			throw new RuntimeException("Gemini 응답 파싱 실패: " + e.getMessage(), e);
		}
	}
	
	public List<FlyerDealItem> parseFlyerImage(String base64Image, String mimeType) {
		String prompt = """
				이 이미지는 마트 행사 전단지입니다.
				전단지에 있는 모든 행사 상품을 빠짐없이 추출하세요.
				
				[응답 규칙]
				1. 마크다운 없이 JSON 배열만 반환 (다른 텍스트 절대 금지)
				2. 상품명은 핵심 이름만 남기세요. 예: "농협 유기농 대란 30구 1판" → "계란"
				3. 가격은 숫자만 (원 기호·쉼표 제거)
				4. originalPrice(정상가)가 없거나 불명확하면 null
				5. 가격이 전혀 명시되지 않은 상품은 제외
				6. 식품·식재료가 아닌 상품(생활용품·가전·의류 등)은 제외
				7. promotionType 판별 기준:
				   - "1+1", "2+1" 등 증정 행사 → "PLUS_N", buyQty/freeQty 숫자 추출 (예: 1+1이면 buyQty=1, freeQty=1)
				   - "X% 할인" 등 퍼센트 할인 → "PERCENT_OFF", buyQty/freeQty는 null
				   - 가격만 표시된 특가 (할인 방식 불명확) → "SPECIAL_PRICE"
				   - promotionType 불명확하면 null, 해당 없는 필드는 null
				8. dealPrice가 적용되는 판매 단위를 quantity(숫자)+unit으로 추출
				   - 예: "삼겹살 100g 1,980원" → quantity=100, unit="g" / "계란 30구 6,980원" → quantity=30, unit="개"
				   - unit은 반드시 "개","kg","g","ml","L" 중 하나로 정규화 (판·봉·팩·구 등 낱개 단위는 "개")
				   - 단위 표기를 찾을 수 없으면 quantity, unit 모두 null
				
				응답 형식(이 형식만):
				[{"itemName":"상품명","dealPrice":행사가숫자,"originalPrice":정상가숫자또는null,"promotionType":"PLUS_N|PERCENT_OFF|SPECIAL_PRICE|null","buyQty":숫자또는null,"freeQty":숫자또는null,"quantity":숫자또는null,"unit":"개|kg|g|ml|L 또는 null"}]
				""";
		
		Map<String, Object> body = Map.of(
			"contents", List.of(Map.of(
				"parts", List.of(
					Map.of("text", prompt),
					Map.of("inline_data", Map.of(
						"mime_type", mimeType,
						"data", base64Image)
					)
				)
			)),
			"generationConfig", generationConfig(FLYER_DEAL_LIST_SCHEMA)
		);
		
		String text = callGeminiRaw(body, "전단지 파싱", flyerApiKey);
		try {
			return mapper.readValue(text, new TypeReference<List<FlyerDealItem>>() {
			});
		} catch (Exception e) {
			throw new RuntimeException("전단지 응답 파싱 실패: " + e.getMessage(), e);
		}
	}
	
	public record FlyerDealItem(
			String itemName,
			Integer dealPrice,
			Integer originalPrice,
			String promotionType,   // PLUS_N | PERCENT_OFF | SPECIAL_PRICE | null
			Integer buyQty,         // PLUS_N: N+M에서 N
			Integer freeQty,        // PLUS_N: N+M에서 M
			BigDecimal quantity,    // dealPrice가 적용되는 판매 단위 수량 (예: 100, 30)
			String unit             // 개 | kg | g | ml | L
	) {}
	
	/**
	 * 코스트코처럼 행사마다 기간이 달라 전단지 자체에서 기간을 읽어야 하는 경우 사용.
	 * 상품 목록과 함께 전단지에 표기된 행사 시작일/종료일(ISO 형식)을 함께 추출한다.
	 */
	public FlyerParseResult parseFlyerImageWithPeriod(String base64Image, String mimeType) {
		String prompt = """
				이 이미지는 마트 행사 전단지입니다.
				전단지에 있는 모든 행사 상품과, 전단지에 표기된 행사 기간(시작일~종료일)을 함께 추출하세요.
				
				[상품 추출 규칙]
				1. 상품명은 핵심 이름만 남기세요. 예: "농협 유기농 대란 30구 1판" → "계란"
				2. 가격은 숫자만 (원 기호·쉼표 제거)
				3. originalPrice(정상가)가 없거나 불명확하면 null
				4. 가격이 전혀 명시되지 않은 상품은 제외
				5. 식품·식재료가 아닌 상품(생활용품·가전·의류·화장품 등)은 제외
				6. promotionType 판별 기준:
				   - "1+1", "2+1" 등 증정 행사 → "PLUS_N", buyQty/freeQty 숫자 추출 (예: 1+1이면 buyQty=1, freeQty=1)
				   - "X% 할인" 등 퍼센트 할인 → "PERCENT_OFF", buyQty/freeQty는 null
				   - 가격만 표시된 특가 (할인 방식 불명확) → "SPECIAL_PRICE"
				   - promotionType 불명확하면 null, 해당 없는 필드는 null
				7. dealPrice가 적용되는 판매 단위를 quantity(숫자)+unit으로 추출
				   - 예: "삼겹살 100g 1,980원" → quantity=100, unit="g" / "계란 30구 6,980원" → quantity=30, unit="개"
				   - unit은 반드시 "개","kg","g","ml","L" 중 하나로 정규화 (판·봉·팩·구 등 낱개 단위는 "개")
				   - 단위 표기를 찾을 수 없으면 quantity, unit 모두 null
				
				[기간 추출 규칙]
				1. 전단지에 표기된 행사 시작일과 종료일을 "YYYY-MM-DD" 형식으로 변환
				2. 연도가 표기되어 있지 않으면 현재 연도로 가정
				3. 기간을 전혀 찾을 수 없으면 startDate, endDate 모두 null
				
				[응답 규칙]
				마크다운 없이 아래 JSON 객체 하나만 반환 (다른 텍스트 절대 금지):
				{"startDate":"YYYY-MM-DD 또는 null","endDate":"YYYY-MM-DD 또는 null","items":[{"itemName":"상품명","dealPrice":행사가숫자,"originalPrice":정상가숫자또는null,"promotionType":"PLUS_N|PERCENT_OFF|SPECIAL_PRICE|null","buyQty":숫자또는null,"freeQty":숫자또는null,"quantity":숫자또는null,"unit":"개|kg|g|ml|L 또는 null"}]}
				""";
		
		Map<String, Object> body = Map.of(
			"contents", List.of(Map.of(
				"parts", List.of(
					Map.of("text", prompt),
					Map.of("inline_data", Map.of(
						"mime_type", mimeType,
						"data", base64Image)
					)
				)
			)),
			"generationConfig", generationConfig(FLYER_PARSE_RESULT_SCHEMA)
		);
		
		String text = callGeminiRaw(body, "전단지+기간 파싱", flyerApiKey);
		try {
			return mapper.readValue(text, FlyerParseResult.class);
		} catch (Exception e) {
			throw new RuntimeException("전단지+기간 응답 파싱 실패: " + e.getMessage(), e);
		}
	}
	
	public record FlyerParseResult(
			String startDate,
			String endDate,
			List<FlyerDealItem> items
	) {}
	
	public List<ScannedItem> parseReceiptText(String ocrText) {
		String prompt = """
				아래는 마트 영수증 OCR에서 한국어만 추출한 텍스트입니다. OCR 인식 오류로 글자가 일부 틀릴 수 있습니다.

				[규칙]
				1. 식재료(채소·과일·육류·수산·유제품·곡류·양념 등)에 해당하는 항목을 최대한 추출하세요.
				2. OCR 오류로 글자가 약간 틀려도 식재료명으로 추정 가능하면 올바른 이름으로 교정하여 포함하세요.
				   예: "싸은찮이" → "쌈장아찌", "히선점" → "하선정"
				3. 브랜드명은 제거하고 핵심 식재료명만 남기세요.
				4. 식재료가 아닌 항목(세제·휴지·생활용품·합계·금액)은 제외하세요.
				5. 수량 불명확 시 1, 단위 불명확 시 "개"로 설정하세요.
				6. 식재료를 전혀 찾을 수 없을 때만 빈 배열 []을 반환하세요.
				7. 마크다운 없이 JSON 배열만 반환하세요.

				응답 형식(이 형식만): [{"itemName":"재료명","quantity":숫자,"unit":"단위"}]

				OCR 텍스트:
				""" + ocrText;
		
		Map<String, Object> body = Map.of(
			"contents", List.of(Map.of(
				"parts", List.of(Map.of("text", prompt))
			))
		);
		return callGeminiWithRetry(body, "텍스트 파싱", apiKey);
	}
	
	public record ScannedItem(String itemName, BigDecimal quantity, String unit) {
	}
	
	/** "retry in 21s" 형태의 메시지에서 대기 ms 파싱. 파싱 실패 시 30초 기본값 */
	private static long parseRetryAfterMs(String message) {
		if (message != null) {
			java.util.regex.Matcher m = java.util.regex.Pattern.compile("retry[^\\d]*(\\d+)s")
					.matcher(message.toLowerCase());
			if (m.find()) return Long.parseLong(m.group(1)) * 1000L;
		}
		return 30_000L;
	}
	
}
