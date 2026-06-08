package com.cibono.cibono_api.service;

import com.cibono.cibono_api.service.GeminiService.ScannedItem;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;
import java.util.regex.*;

@Service
public class ReceiptParserService {

    // 영수증에서 식재료가 아닌 줄 판별용 키워드
    private static final Set<String> SKIP_KEYWORDS = Set.of(
        "합계", "총계", "소계", "부가세", "vat", "카드", "현금", "영수증", "거스름",
        "교환", "환불", "포인트", "적립", "사용", "결제", "승인", "할인",
        "점원", "담당", "전화", "tel", "주소", "사업자", "대표", "등록번호",
        "마트", "슈퍼", "마켓", "편의점", "store", "mart"
    );

    private static final Pattern QTY_PATTERN =
        Pattern.compile("^(.+?)\\s+(\\d+(?:\\.\\d+)?)\\s*([가-힣a-zA-Z]{0,4})\\s*$");

    private static final Pattern PRICE_ONLY =
        Pattern.compile("^[\\d,\\s원\\-]+$");

    public List<ScannedItem> parse(String ocrText) {
        if (ocrText == null || ocrText.isBlank()) return List.of();

        List<ScannedItem> result = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();

        for (String raw : ocrText.split("[\\n\\r]+")) {
            String line = raw.trim();
            if (line.length() < 2) continue;
            if (!hasKorean(line)) continue;
            if (PRICE_ONLY.matcher(line).matches()) continue;
            if (containsSkipKeyword(line)) continue;
            if (line.length() > 40) continue;  // 매우 긴 줄은 설명문

            ScannedItem item = extractItem(line);
            if (item == null) continue;

            // 중복 재료명 제거
            String key = item.itemName().trim();
            if (seen.contains(key)) continue;
            seen.add(key);
            result.add(item);
        }
        return result;
    }

    private ScannedItem extractItem(String line) {
        // "대파 2단", "계란 30 개" 패턴 시도
        Matcher m = QTY_PATTERN.matcher(line);
        if (m.matches()) {
            String name = cleanName(m.group(1));
            if (name.isEmpty()) return null;
            BigDecimal qty;
            try { qty = new BigDecimal(m.group(2)); }
            catch (NumberFormatException e) { qty = BigDecimal.ONE; }
            String unit = m.group(3).isBlank() ? "개" : m.group(3);
            return new ScannedItem(name, qty, unit);
        }

        // 수량 없는 경우: 줄 전체가 재료명
        String name = cleanName(line.replaceAll("\\d.*$", "").trim());
        if (name.isEmpty()) return null;
        return new ScannedItem(name, BigDecimal.ONE, "개");
    }

    private String cleanName(String s) {
        // 브랜드/원산지 접두어 제거 (간단하게: 첫 2~8자 한글만 추출)
        return s.replaceAll("[\\[\\]()（）*]", "").trim();
    }

    private boolean hasKorean(String s) {
        return s.chars().anyMatch(c -> c >= 0xAC00 && c <= 0xD7A3);
    }

    private boolean containsSkipKeyword(String line) {
        String lower = line.toLowerCase();
        return SKIP_KEYWORDS.stream().anyMatch(lower::contains);
    }
}
