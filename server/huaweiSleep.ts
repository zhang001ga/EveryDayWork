/**
 * 华为手表 / 华为运动健康 睡眠数据接入层。
 *
 * 数据来源与限制（本地单机应用）：
 * - 官方服务端 REST API「睡眠健康记录」文档：
 *   https://developer.huawei.com/consumer/cn/doc/hmscore-guides/sleep-record-scene-0000001055511884
 * - REST 端点与 OAuth / Scope 说明（第三方整理）：
 *   https://developers.anpheros.com/guides/huawei-health-api
 * - 端点：GET https://health-api.cloud.huawei.com/healthkit/v2/healthRecords
 *   ?startTime=<ms>&endTime=<ms>&dataType=com.huawei.health.record.sleep
 * - 读取睡眠需要 Scope https://www.huawei.com/healthkit/sleep.read，
 *   且需在华为开发者联盟申请 Health Service Kit 权限（个人开发者仅基础开放度）。
 *   单次查询最多 31 天，Access Token 有效期 1 小时。
 *
 * 因此提供三条入口：
 * 1) 配置凭证后调用官方 REST API 同步；
 * 2) 导入华为运动健康导出的 JSON / CSV 数据文件（无需账号、无需资质）；
 * 3) 手工补录。
 *
 * 本文件只做纯数据解析与协议封装，不做数据库写入，便于单元测试。
 */

export const HUAWEI_SLEEP_DOCS_URL =
  "https://developer.huawei.com/consumer/cn/doc/hmscore-guides/sleep-record-scene-0000001055511884";
export const HUAWEI_HEALTH_KIT_API_GUIDE_URL =
  "https://developers.anpheros.com/guides/huawei-health-api";
export const HUAWEI_SLEEP_SCOPE = "https://www.huawei.com/healthkit/sleep.read";
export const HUAWEI_DEFAULT_API_BASE = "https://health-api.cloud.huawei.com/healthkit/v2";
export const HUAWEI_SLEEP_DATA_TYPE = "com.huawei.health.record.sleep";
export const HUAWEI_MAX_RANGE_DAYS = 31;

export type HuaweiSleepConfig = {
  clientId: string;
  accessToken: string;
  /** 可留空使用官方端点；允许本机代理地址用于调试。 */
  apiBase?: string;
  /** 站点区域（华为按账号所属地区返回不同域名），默认官方全球端点。 */
  xVersion?: string;
};

export type SleepRecordInput = {
  sleep_date: string;
  bedtime: string;
  wake_time: string;
  duration_min: number | null;
  deep_min: number | null;
  light_min: number | null;
  rem_min: number | null;
  awake_min: number | null;
  score: number | null;
  source: "huawei-api" | "huawei-export" | "manual";
  external_id: string;
  device: string;
  notes: string;
};

export class HuaweiSleepError extends Error {
  statusCode = 400;
}

type UnknownRecord = Record<string, unknown>;

function asString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstPresent(record: UnknownRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key) && record[key] !== null && record[key] !== undefined && record[key] !== "") {
      return record[key];
    }
  }
  return undefined;
}

/** 把可能以 分钟 / 秒 / 毫秒 表示的时长统一换算为分钟（四舍五入）。 */
export function toMinutes(value: unknown): number | null {
  const raw = asNumber(value);
  if (raw === null) return null;
  const absolute = Math.abs(raw);
  if (absolute >= 60_000) return Math.round(raw / 60_000); // 毫秒
  if (absolute >= 600) return Math.round(raw / 60); // 秒（>10 小时的分钟数少见）
  return Math.round(raw); // 已是分钟
}

/** 时间戳 / ISO / HH:mm 统一成 HH:mm。 */
export function toClock(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number" || /^\d{10,13}$/.test(String(value).trim())) {
    const millis = Number(value);
    const date = new Date(millis < 100_000_000_000 ? millis * 1000 : millis);
    if (!Number.isNaN(date.getTime())) return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
  const text = String(value).trim();
  const iso = text.match(/[T\s](\d{2}:\d{2})/);
  if (iso) return iso[1];
  const clock = text.match(/^(\d{1,2}):(\d{2})/);
  if (clock) return `${clock[1].padStart(2, "0")}:${clock[2]}`;
  return "";
}

/** 从时间戳 / ISO / YYYY-MM-DD 中提取本地日期 YYYY-MM-DD。 */
export function toDate(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number" || /^\d{10,13}$/.test(String(value).trim())) {
    const millis = Number(value);
    const date = new Date(millis < 100_000_000_000 ? millis * 1000 : millis);
    if (!Number.isNaN(date.getTime())) return localDateOf(date);
  }
  const text = String(value).trim();
  const match = text.match(/(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return "";
}

function localDateOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function minutesBetween(start: unknown, end: unknown): number | null {
  const parse = (value: unknown): number | null => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number" || /^\d{10,13}$/.test(String(value).trim())) {
      const millis = Number(value);
      return millis < 100_000_000_000 ? millis * 1000 : millis;
    }
    const time = Date.parse(String(value));
    return Number.isNaN(time) ? null : time;
  };
  const from = parse(start);
  const to = parse(end);
  if (from === null || to === null || to <= from) return null;
  return Math.round((to - from) / 60_000);
}

/**
 * 把华为 Health Service Kit 或运动健康导出的一条原始记录归一化。
 * 字段名兼容 snake_case / camelCase / 中文表头，缺失字段留空。
 */
export function normalizeHuaweiRecord(raw: unknown, source: SleepRecordInput["source"] = "huawei-export"): SleepRecordInput | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as UnknownRecord;

  // 嵌套结构：华为 API 会把业务字段放在 fieldValues / subData / data 里
  const nested = [record.fieldValues, record.subData, record.data, record.value, record.sleepRecord]
    .find((item): item is UnknownRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item));
  const flat: UnknownRecord = { ...record, ...(nested ?? {}) };

  const start = firstPresent(flat, ["startTime", "start_time", "bedTime", "bedtime", "sleepStartTime", "fallAsleepTime", "入睡时间", "开始时间"]);
  const end = firstPresent(flat, ["endTime", "end_time", "wakeTime", "wake_time", "wakeUpTime", "sleepEndTime", "起床时间", "结束时间"]);
  const explicitDate = firstPresent(flat, ["sleepDate", "sleep_date", "date", "day", "recordDate", "日期", "睡眠日期"]);
  const sleepDate = toDate(explicitDate) || toDate(end) || toDate(start);
  if (!sleepDate) return null;

  const bedtime = toClock(start);
  const wakeTime = toClock(end);
  const explicitDuration = toMinutes(firstPresent(flat, [
    "duration", "durationMin", "duration_min", "sleepDuration", "totalSleepTime", "sleepTime",
    "total_sleep_minutes", "睡眠时长", "睡眠总时长", "睡眠时间",
  ]));
  const duration = explicitDuration ?? minutesBetween(start, end);

  // 睡眠分期：优先读取聚合字段，缺失时再从明细片段累加
  let deep = toMinutes(firstPresent(flat, ["deep_min", "deepMin", "deepSleep", "deepSleepTime", "deepSleepDuration", "deep_sleep_minutes", "深睡", "深睡时长", "深睡时间"]));
  let light = toMinutes(firstPresent(flat, ["light_min", "lightMin", "lightSleep", "lightSleepTime", "lightSleepDuration", "light_sleep_minutes", "浅睡", "浅睡时长", "浅睡时间"]));
  let rem = toMinutes(firstPresent(flat, ["rem_min", "remMin", "remSleep", "remSleepTime", "remSleepDuration", "rem_sleep_minutes", "REM", "快速眼动", "眼动时长", "快速眼动时长"]));
  let awake = toMinutes(firstPresent(flat, ["awake_min", "awakeMin", "awakeTime", "awakeDuration", "wakeDuration", "awake_sleep_minutes", "清醒", "清醒时长", "清醒时间"]));

  const fragments = [flat.sleepState, flat.sleep_state, flat.fragments, flat.sleepFragments, flat.details]
    .find((item) => Array.isArray(item)) as UnknownRecord[] | undefined;
  if (fragments && (deep === null || light === null || rem === null || awake === null)) {
    const totals = { deep: 0, light: 0, rem: 0, awake: 0 };
    for (const fragment of fragments) {
      const state = Number(firstPresent(fragment, ["sleep_state", "sleepState", "state", "type"]) ?? 0);
      const length = toMinutes(firstPresent(fragment, ["duration", "duration_min", "length", "minutes", "value"])) ?? 0;
      // 华为 sleep_state 常见取值：1 浅睡 / 2 深睡 / 3 REM / 4 清醒
      if (state === 2) totals.deep += length;
      else if (state === 3) totals.rem += length;
      else if (state === 4) totals.awake += length;
      else totals.light += length;
    }
    if (deep === null && totals.deep) deep = totals.deep;
    if (light === null && totals.light) light = totals.light;
    if (rem === null && totals.rem) rem = totals.rem;
    if (awake === null && totals.awake) awake = totals.awake;
  }

  const score = asNumber(firstPresent(flat, ["score", "sleepScore", "sleep_score", "睡眠评分", "得分"]));
  const externalId = asString(firstPresent(flat, ["id", "recordId", "externalId", "external_id", "dataId", "record_id"]))
    || `${source}:${sleepDate}:${bedtime}`;
  const device = asString(firstPresent(flat, ["device", "deviceModel", "device_model", "deviceInfo", "设备", "设备名称"]));

  return {
    sleep_date: sleepDate,
    bedtime,
    wake_time: wakeTime,
    duration_min: duration,
    deep_min: deep,
    light_min: light,
    rem_min: rem,
    awake_min: awake,
    score: score === null ? null : Math.max(0, Math.min(100, Math.round(score))),
    source,
    external_id: externalId,
    device: device || (source === "huawei-api" ? "华为手表" : ""),
    notes: asString(firstPresent(flat, ["notes", "note", "remark", "备注", "说明"])),
  };
}

function extractRecords(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const object = payload as UnknownRecord;
  for (const key of ["healthRecords", "records", "data", "sleepRecords", "sleepData", "items", "list", "sampleSets"]) {
    const value = object[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const nested = extractRecords(value);
      if (nested.length) return nested;
    }
  }
  return [];
}

/** 解析 CSV（支持带引号字段）为对象数组。 */
export function parseCsv(text: string): UnknownRecord[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field.trim()); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = []; field = "";
    } else field += char;
  }
  row.push(field.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, position) => [header, cells[position] ?? ""])));
}

/**
 * 解析华为运动健康导出的 JSON / CSV 文本；自动识别格式。
 * 导出文件不需要开发者资质，是本地离线场景下最稳妥的入口。
 */
export function parseHuaweiExport(text: string, format: "auto" | "json" | "csv" = "auto"): SleepRecordInput[] {
  const trimmed = text.trim();
  if (!trimmed) throw new HuaweiSleepError("文件内容为空，请选择华为运动健康导出的睡眠数据文件。");
  let detected = format;
  if (detected === "auto") detected = /^[{[]/.test(trimmed) ? "json" : "csv";

  let rawRecords: unknown[];
  if (detected === "json") {
    let parsed: unknown;
    try { parsed = JSON.parse(trimmed); }
    catch { throw new HuaweiSleepError("JSON 解析失败，请确认文件是华为运动健康导出的原始数据。"); }
    rawRecords = extractRecords(parsed);
  } else {
    rawRecords = parseCsv(trimmed);
  }

  const records = rawRecords
    .map((item) => normalizeHuaweiRecord(item, "huawei-export"))
    .filter((item): item is SleepRecordInput => item !== null);
  if (!records.length) throw new HuaweiSleepError("没有从文件中识别出睡眠记录，请确认导出文件包含日期与睡眠时长列。");
  return records;
}

/** 解析 Health Service Kit REST API 的响应体。 */
export function parseHuaweiApiResponse(payload: unknown): SleepRecordInput[] {
  return extractRecords(payload)
    .map((item) => normalizeHuaweiRecord(item, "huawei-api"))
    .filter((item): item is SleepRecordInput => item !== null);
}

export type HuaweiFetch = (url: string, init: RequestInit) => Promise<Response>;

/**
 * 调用华为 Health Service Kit 服务端 REST API 拉取睡眠记录。
 * 参考：GET /healthkit/v2/healthRecords?startTime=&endTime=&dataType=com.huawei.health.record.sleep
 * 需要 Authorization: Bearer <access_token>、x-client-id、x-version、x-caller-trace-id。
 */
export async function fetchHuaweiSleepRecords(
  config: HuaweiSleepConfig,
  range: { startTime: number; endTime: number },
  fetchImpl: HuaweiFetch = (url, init) => fetch(url, init),
): Promise<SleepRecordInput[]> {
  if (!config.clientId || !config.accessToken) {
    throw new HuaweiSleepError("尚未配置 Client ID 或访问令牌，请在下方填写华为 Health Service Kit 凭证，或改用文件导入 / 手工补录。");
  }
  if (!Number.isFinite(range.startTime) || !Number.isFinite(range.endTime) || range.endTime <= range.startTime) {
    throw new HuaweiSleepError("同步时间范围无效。");
  }
  if (range.endTime - range.startTime > HUAWEI_MAX_RANGE_DAYS * 86_400_000) {
    throw new HuaweiSleepError(`华为接口单次最多查询 ${HUAWEI_MAX_RANGE_DAYS} 天，请缩短同步范围。`);
  }

  const base = (config.apiBase || HUAWEI_DEFAULT_API_BASE).replace(/\/$/, "");
  const url = `${base}/healthRecords?startTime=${range.startTime}&endTime=${range.endTime}&dataType=${encodeURIComponent(HUAWEI_SLEEP_DATA_TYPE)}`;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.accessToken}`,
        "x-client-id": config.clientId,
        "x-version": config.xVersion || "1",
        "x-caller-trace-id": `muzi-${Date.now()}`,
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new HuaweiSleepError(`无法连接华为健康服务：${error instanceof Error ? error.message : String(error)}。请检查网络或改用文件导入。`);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new HuaweiSleepError(`华为健康服务返回 ${response.status}：${detail.slice(0, 200) || "权限不足或令牌已过期"}。需要 Scope ${HUAWEI_SLEEP_SCOPE}。`);
  }
  const payload = await response.json().catch(() => null);
  const records = parseHuaweiApiResponse(payload);
  if (!records.length) throw new HuaweiSleepError("华为健康服务没有返回该时间范围内的睡眠记录。");
  return records;
}

/** 用于写入数据库前的去重键：同一来源 + 外部 ID（或同一天同一入睡时间）视为同一晚。 */
export function sleepRecordKey(record: Pick<SleepRecordInput, "source" | "external_id" | "sleep_date" | "bedtime">): string {
  return `${record.source}|${record.external_id || `${record.sleep_date}:${record.bedtime}`}`;
}
