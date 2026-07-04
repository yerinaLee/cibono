import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../src/api/client";

const THEME = {
  bg: "#F3F8F1",
  surface: "#FFFFFF",
  text: "#1F2937",
  muted: "#6B7280",
  border: "rgba(31,41,55,0.10)",
  brand: "#7FB77E",
  danger: "#EB5757",
};

type NotificationConfig = {
  id: number;
  title: string;
  bodyTemplate: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  mealType: string;
  createdAt: string;
};

type PushToken = {
  id: number;
  token: string;
  registeredAt: string;
};

// cron "0 30 18 * * *" → "18:30" 표시용
function cronToLabel(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length === 6) {
    const h = parts[2].padStart(2, "0");
    const m = parts[1].padStart(2, "0");
    return `매일 ${h}:${m}`;
  }
  return cron;
}

const EMPTY_FORM = {
  title: "🍽️ 오늘 저녁 뭐 먹지?",
  bodyTemplate: "오늘 저녁 메뉴는 {recipe} 어떠신가요?",
  cronExpression: "0 0 18 * * *",
  timezone: "Asia/Seoul",
  enabled: true,
  mealType: "DINNER",
};

const LUNCH_PRESETS = [
  { label: "11:30", cron: "0 30 11 * * *" },
  { label: "12:00", cron: "0 0 12 * * *" },
  { label: "12:30", cron: "0 30 12 * * *" },
];

const DINNER_PRESETS = [
  { label: "17:00", cron: "0 0 17 * * *" },
  { label: "17:30", cron: "0 30 17 * * *" },
  { label: "18:00", cron: "0 0 18 * * *" },
  { label: "18:30", cron: "0 30 18 * * *" },
  { label: "19:00", cron: "0 0 19 * * *" },
];

export default function AdminNotificationsScreen() {
  const router = useRouter();
  const [configs, setConfigs] = useState<NotificationConfig[]>([]);
  const [tokens, setTokens] = useState<PushToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<NotificationConfig | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, tokRes] = await Promise.all([
        api.get<NotificationConfig[]>("/admin/notifications/configs"),
        api.get<PushToken[]>("/admin/notifications/tokens"),
      ]);
      setConfigs(cfgRes.data ?? []);
      setTokens(tokRes.data ?? []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (cfg: NotificationConfig) => {
    setEditTarget(cfg);
    setForm({
      title: cfg.title,
      bodyTemplate: cfg.bodyTemplate,
      cronExpression: cfg.cronExpression,
      timezone: cfg.timezone,
      enabled: cfg.enabled,
      mealType: cfg.mealType ?? "DINNER",
    });
    setShowForm(true);
  };

  const saveForm = async () => {
    try {
      if (editTarget) {
        await api.put(`/admin/notifications/configs/${editTarget.id}`, form);
      } else {
        await api.post("/admin/notifications/configs", form);
      }
      setShowForm(false);
      load();
    } catch {
      Alert.alert("저장 실패", "백엔드 오류가 발생했어요.");
    }
  };

  const deleteConfig = (id: number) => {
    Alert.alert("삭제 확인", "이 알림 스케줄을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제", style: "destructive",
        onPress: async () => {
          await api.delete(`/admin/notifications/configs/${id}`);
          load();
        },
      },
    ]);
  };

  const triggerNow = async (id: number) => {
    setTriggering(id);
    try {
      await api.post(`/admin/notifications/configs/${id}/trigger`);
      Alert.alert("발송 완료", "푸시 알림을 전송했어요. 백엔드 로그를 확인해보세요.");
    } catch {
      Alert.alert("발송 실패", "백엔드 오류가 발생했어요.");
    } finally { setTriggering(null); }
  };

  const deleteToken = (id: number) => {
    Alert.alert("토큰 삭제", "이 기기를 알림 대상에서 제거할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제", style: "destructive",
        onPress: async () => {
          await api.delete(`/admin/notifications/tokens/${id}`);
          load();
        },
      },
    ]);
  };

  if (showForm) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
        <View style={styles.header}>
          <Pressable onPress={() => setShowForm(false)} style={styles.iconBtn}>
            <MaterialIcons name="arrow-back" size={22} color={THEME.text} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {editTarget ? "알림 수정" : "알림 추가"}
          </Text>
          <Pressable onPress={saveForm} style={styles.iconBtn}>
            <MaterialIcons name="check" size={22} color={THEME.brand} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          {/* 식사 유형 */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>식사 유형</Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
              {(["LUNCH", "DINNER"] as const).map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setForm((p) => ({ ...p, mealType: type }))}
                  style={[styles.preset, { flex: 1, justifyContent: "center" }, form.mealType === type && styles.presetActive]}
                >
                  <Text style={[styles.presetText, form.mealType === type && styles.presetTextActive]}>
                    {type === "LUNCH" ? "🍱 점심" : "🍽️ 저녁"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 제목 */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>알림 제목</Text>
            <TextInput
              value={form.title}
              onChangeText={(v) => setForm((p) => ({ ...p, title: v }))}
              style={styles.fieldInput}
              placeholder="🍽️ 오늘 저녁 뭐 먹지?"
            />
          </View>

          {/* 본문 템플릿 */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>본문 ({"{recipe}"}에 레시피명 삽입)</Text>
            <TextInput
              value={form.bodyTemplate}
              onChangeText={(v) => setForm((p) => ({ ...p, bodyTemplate: v }))}
              style={[styles.fieldInput, { minHeight: 60 }]}
              multiline
              placeholder="오늘 저녁 메뉴는 {recipe} 어떠신가요?"
            />
          </View>

          {/* 시간 프리셋 */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>발송 시간</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              {(form.mealType === "LUNCH" ? LUNCH_PRESETS : DINNER_PRESETS).map((p) => (
                <Pressable
                  key={p.cron}
                  onPress={() => setForm((prev) => ({ ...prev, cronExpression: p.cron }))}
                  style={[styles.preset, form.cronExpression === p.cron && styles.presetActive]}
                >
                  <Text style={[styles.presetText, form.cronExpression === p.cron && styles.presetTextActive]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={form.cronExpression}
              onChangeText={(v) => setForm((p) => ({ ...p, cronExpression: v }))}
              style={[styles.fieldInput, { marginTop: 8 }]}
              placeholder="0 0 18 * * * (직접 입력)"
            />
            <Text style={styles.fieldHint}>Spring cron: 초 분 시 일 월 요일</Text>
          </View>

          {/* 활성화 토글 */}
          <View style={[styles.field, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
            <Text style={styles.fieldLabel}>활성화</Text>
            <Switch
              value={form.enabled}
              onValueChange={(v) => setForm((p) => ({ ...p, enabled: v }))}
              trackColor={{ true: THEME.brand }}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialIcons name="arrow-back" size={22} color={THEME.text} />
        </Pressable>
        <Text style={styles.headerTitle}>알림 관리</Text>
        <Pressable onPress={openAdd} style={styles.iconBtn}>
          <MaterialIcons name="add" size={24} color={THEME.brand} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={THEME.brand} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, gap: 16, paddingBottom: 60 }}>

          {/* 알림 스케줄 섹션 */}
          <Text style={styles.sectionTitle}>알림 스케줄</Text>
          {configs.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>등록된 알림이 없어요. + 버튼으로 추가해보세요.</Text>
            </View>
          )}
          {configs.map((cfg) => (
            <View key={cfg.id} style={styles.card}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{cfg.title}</Text>
                  <Text style={styles.cardMeta}>{cfg.bodyTemplate}</Text>
                  <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                    <View style={[styles.timeBadge, !cfg.enabled && { opacity: 0.4 }]}>
                      <MaterialIcons name="schedule" size={12} color={THEME.brand} />
                      <Text style={styles.timeBadgeText}>{cronToLabel(cfg.cronExpression)}</Text>
                    </View>
                    <View style={[styles.timeBadge, { backgroundColor: "rgba(127,183,126,0.08)" }]}>
                      <Text style={styles.timeBadgeText}>
                        {cfg.mealType === "LUNCH" ? "🍱 점심" : "🍽️ 저녁"}
                      </Text>
                    </View>
                  </View>
                </View>
                <Switch
                  value={cfg.enabled}
                  onValueChange={async (v) => {
                    await api.put(`/admin/notifications/configs/${cfg.id}`, { ...cfg, enabled: v });
                    load();
                  }}
                  trackColor={{ true: THEME.brand }}
                />
              </View>

              {/* 액션 버튼 */}
              <View style={styles.cardActions}>
                <Pressable
                  onPress={() => triggerNow(cfg.id)}
                  disabled={triggering === cfg.id}
                  style={[styles.actionBtn, styles.actionBtnPrimary]}
                >
                  {triggering === cfg.id
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <MaterialIcons name="send" size={14} color="#fff" />}
                  <Text style={styles.actionBtnPrimaryText}>지금 발송</Text>
                </Pressable>
                <Pressable onPress={() => openEdit(cfg)} style={styles.actionBtn}>
                  <MaterialIcons name="edit" size={14} color={THEME.text} />
                  <Text style={styles.actionBtnText}>수정</Text>
                </Pressable>
                <Pressable onPress={() => deleteConfig(cfg.id)} style={styles.actionBtn}>
                  <MaterialIcons name="delete" size={14} color={THEME.danger} />
                  <Text style={[styles.actionBtnText, { color: THEME.danger }]}>삭제</Text>
                </Pressable>
              </View>
            </View>
          ))}

          {/* 등록된 기기 섹션 */}
          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>등록된 기기</Text>
          {tokens.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>앱에서 알림 권한을 허용하면 자동 등록돼요.</Text>
            </View>
          )}
          {tokens.map((t) => (
            <View key={t.id} style={[styles.card, { flexDirection: "row", alignItems: "center" }]}>
              <MaterialIcons name="smartphone" size={20} color={THEME.brand} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.tokenText} numberOfLines={1}>{t.token}</Text>
                <Text style={styles.cardMeta}>
                  {new Date(t.registeredAt).toLocaleDateString("ko-KR")} 등록
                </Text>
              </View>
              <Pressable onPress={() => deleteToken(t.id)} hitSlop={8}>
                <MaterialIcons name="close" size={18} color={THEME.muted} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles: any = {
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: THEME.border,
    backgroundColor: THEME.bg,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)", borderWidth: 1, borderColor: THEME.border,
  },
  headerTitle: {
    flex: 1, textAlign: "center", fontSize: 17, fontWeight: "900", color: THEME.text,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: THEME.muted },
  card: {
    backgroundColor: THEME.surface, borderRadius: 16,
    borderWidth: 1, borderColor: THEME.border, padding: 14,
  },
  cardTitle: { fontSize: 15, fontWeight: "800", color: THEME.text, marginBottom: 4 },
  cardMeta: { fontSize: 12, color: THEME.muted, lineHeight: 16, marginBottom: 6 },
  timeBadge: {
    flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: "rgba(127,183,126,0.15)", borderWidth: 1, borderColor: "rgba(127,183,126,0.30)",
  },
  timeBadgeText: { fontSize: 12, fontWeight: "800", color: THEME.brand },
  cardActions: {
    flexDirection: "row", gap: 8, marginTop: 12,
    borderTopWidth: 1, borderTopColor: THEME.border, paddingTop: 12,
  },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10,
    borderWidth: 1, borderColor: THEME.border,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  actionBtnPrimary: { backgroundColor: THEME.brand, borderColor: THEME.brand },
  actionBtnText: { fontSize: 12, fontWeight: "800", color: THEME.text },
  actionBtnPrimaryText: { fontSize: 12, fontWeight: "800", color: "#fff" },
  emptyBox: {
    padding: 16, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: THEME.border,
    alignItems: "center",
  },
  emptyText: { fontSize: 13, color: THEME.muted },
  tokenText: { fontSize: 12, fontWeight: "700", color: THEME.text },

  // 폼
  field: {
    backgroundColor: THEME.surface, borderRadius: 14,
    borderWidth: 1, borderColor: THEME.border, padding: 14,
  },
  fieldLabel: { fontSize: 13, fontWeight: "900", color: THEME.muted, marginBottom: 6 },
  fieldInput: {
    fontSize: 14, color: THEME.text, borderWidth: 1, borderColor: THEME.border,
    borderRadius: 10, padding: 10, backgroundColor: THEME.bg,
  },
  fieldHint: { marginTop: 4, fontSize: 11, color: THEME.muted },
  preset: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: THEME.border, backgroundColor: "rgba(255,255,255,0.9)",
  },
  presetActive: { borderColor: THEME.brand, backgroundColor: "rgba(127,183,126,0.15)" },
  presetText: { fontSize: 13, fontWeight: "800", color: THEME.muted },
  presetTextActive: { color: THEME.brand },
};
