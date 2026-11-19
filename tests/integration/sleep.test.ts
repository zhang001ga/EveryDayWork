// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../server/app.js";
import {
  HUAWEI_DEFAULT_API_BASE,
  HUAWEI_SLEEP_DATA_TYPE,
  HUAWEI_SLEEP_SCOPE,
  fetchHuaweiSleepRecords,
  parseHuaweiApiResponse,
  parseHuaweiExport,
  toClock,
  toDate,
  toMinutes,
} from "../../server/huaweiSleep.js";
import { makeTestDirectory, removeTestDirectory } from "../helpers.js";

let directory = "";
afterEach(() => { if (directory) removeTestDirectory(directory); directory = ""; });

const csvExport = [
  "日期,入睡时间,起床时间,睡眠时长,深睡,浅睡,REM,清醒,睡眠评分,设备",
  "2026-11-18,23:20,07:05,445,95,250,80,20,86,HUAWEI WATCH GT 5",
  "2026-11-19,23:40,07:10,430,88,242,75,25,82,HUAWEI WATCH GT 5",
].join("\n");

describe("Huawei sleep data parsing", () => {
  it("normalizes minute / second / millisecond durations and mixed clock formats", () => {
    expect(toMinutes(445)).toBe(445);
    expect(toMinutes(26_700)).toBe(445);
    expect(toMinutes(26_700_000)).toBe(445);
    expect(toClock("2026-11-18T23:20:00")).toBe("23:20");
    expect(toClock("07:05")).toBe("07:05");
    expect(toDate("2026/11/18")).toBe("2026-11-18");
  });

  it("parses a Huawei Health CSV export with Chinese headers", () => {
    const records = parseHuaweiExport(csvExport, "csv");
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      sleep_date: "2026-11-18",
      bedtime: "23:20",
      wake_time: "07:05",
      duration_min: 445,
      deep_min: 95,
      light_min: 250,
      rem_min: 80,
      awake_min: 20,
      score: 86,
      source: "huawei-export",
      device: "HUAWEI WATCH GT 5",
    });
  });

  it("parses nested Health Service Kit payloads and accumulates sleep-state fragments", () => {
    const records = parseHuaweiApiResponse({ healthRecords: [{
      recordId: "rec-1",
      sleepDate: "2026-11-18",
      bedTime: "23:20",
      wakeTime: "07:05",
      duration: 445,
      sleepState: [
        { sleep_state: 2, duration: 95 },
        { sleep_state: 1, duration: 250 },
        { sleep_state: 3, duration: 80 },
        { sleep_state: 4, duration: 20 },
      ],
      sleepScore: 86,
      device: "HUAWEI WATCH GT 5",
    }] });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      sleep_date: "2026-11-18",
      bedtime: "23:20",
      wake_time: "07:05",
      duration_min: 445,
      deep_min: 95,
      light_min: 250,
      rem_min: 80,
      awake_min: 20,
      score: 86,
      source: "huawei-api",
      external_id: "rec-1",
      device: "HUAWEI WATCH GT 5",
    });
  });

  it("rejects empty exports and files without a recognizable sleep date", () => {
    expect(() => parseHuaweiExport("  ", "auto")).toThrow(/文件内容为空/);
    expect(() => parseHuaweiExport("备注\n没有日期", "csv")).toThrow(/没有从文件中识别出睡眠记录/);
    expect(() => parseHuaweiExport("{not json", "json")).toThrow(/JSON 解析失败/);
  });

  it("requires credentials and calls the documented REST endpoint with the right headers", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    const fakeFetch = async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = init.headers as Record<string, string>;
      return new Response(JSON.stringify({ healthRecords: [{ sleepDate: "2026-11-18", bedTime: "23:20", wakeTime: "07:05", duration: 445, sleepScore: 86 }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    await expect(fetchHuaweiSleepRecords({ clientId: "", accessToken: "" }, { startTime: 1, endTime: 2 }, fakeFetch)).rejects.toThrow(/尚未配置/);

    const now = Date.now();
    const records = await fetchHuaweiSleepRecords(
      { clientId: "client-1", accessToken: "token-1" },
      { startTime: now - 86_400_000, endTime: now },
      fakeFetch,
    );
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ sleep_date: "2026-11-18", source: "huawei-api", device: "华为手表" });
    expect(capturedUrl).toContain(HUAWEI_DEFAULT_API_BASE);
    expect(capturedUrl).toContain(`dataType=${encodeURIComponent(HUAWEI_SLEEP_DATA_TYPE)}`);
    expect(capturedHeaders.Authorization).toBe("Bearer token-1");
    expect(capturedHeaders["x-client-id"]).toBe("client-1");
  });
});

describe("sleep API routes", () => {
  it("stores Huawei credentials locally and never returns the token", async () => {
    directory = makeTestDirectory("sleep-config");
    const app = await buildApp({ dataDir: directory, autoBackup: false });
    try {
      const initial = await app.inject({ method: "GET", url: "/api/sleep/huawei/config" });
      expect(initial.json().data).toMatchObject({ configured: false, hasToken: false, scope: HUAWEI_SLEEP_SCOPE });

      const saved = await app.inject({ method: "PUT", url: "/api/sleep/huawei/config", payload: { clientId: "client-1", accessToken: "secret-token" } });
      expect(saved.json().data).toEqual({ configured: true, hasToken: true });
      const after = await app.inject({ method: "GET", url: "/api/sleep/huawei/config" });
      expect(after.json().data).toMatchObject({ configured: true, hasToken: true, clientId: "client-1" });
      expect(JSON.stringify(after.json())).not.toContain("secret-token");

      const cleared = await app.inject({ method: "PUT", url: "/api/sleep/huawei/config", payload: { clearToken: true } });
      expect(cleared.json().data).toEqual({ configured: false, hasToken: false });
    } finally {
      await app.close();
    }
  });

  it("imports Huawei CSV exports, de-duplicates them and exposes them in state", async () => {
    directory = makeTestDirectory("sleep-import");
    const app = await buildApp({ dataDir: directory, autoBackup: false });
    try {
      const first = await app.inject({ method: "POST", url: "/api/sleep/import", payload: { content: csvExport, format: "csv" } });
      expect(first.statusCode).toBe(200);
      expect(first.json().data).toMatchObject({ total: 2, imported: 2, skipped: 0, source: "huawei-export" });

      const second = await app.inject({ method: "POST", url: "/api/sleep/import", payload: { content: csvExport, format: "csv" } });
      expect(second.json().data).toMatchObject({ total: 2, imported: 0, skipped: 2 });

      const state = await app.inject({ method: "GET", url: "/api/state" });
      expect(state.json().data.sleepRecords).toHaveLength(2);
      expect(state.json().data.sleepRecords).toEqual(expect.arrayContaining([
        expect.objectContaining({ sleep_date: "2026-11-18", duration_min: 445, source: "huawei-export" }),
        expect.objectContaining({ sleep_date: "2026-11-19", duration_min: 430, source: "huawei-export" }),
      ]));
      expect(Object.keys(state.json().data)).toEqual(expect.arrayContaining(["testCases", "writingItems", "readingItems", "sleepRecords"]));
    } finally {
      await app.close();
    }
  });

  it("syncs through the official API, supports manual records and keeps both sources", async () => {
    directory = makeTestDirectory("sleep-sync");
    const calls: string[] = [];
    const app = await buildApp({
      dataDir: directory,
      autoBackup: false,
      huaweiFetch: async (url) => {
        calls.push(url);
        return new Response(JSON.stringify({ healthRecords: [{ recordId: "api-1", sleepDate: "2026-11-17", bedTime: "23:00", wakeTime: "07:00", duration: 480, sleepScore: 90 }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    try {
      const missing = await app.inject({ method: "POST", url: "/api/sleep/huawei/sync", payload: { days: 7 } });
      expect(missing.statusCode).not.toBe(200);

      await app.inject({ method: "PUT", url: "/api/sleep/huawei/config", payload: { clientId: "client-1", accessToken: "token-1" } });
      const synced = await app.inject({ method: "POST", url: "/api/sleep/huawei/sync", payload: { days: 7 } });
      expect(synced.statusCode).toBe(200);
      expect(synced.json().data).toMatchObject({ total: 1, imported: 1, skipped: 0, source: "huawei-api" });
      expect(calls).toHaveLength(1);
      expect(calls[0]).toContain("healthRecords");

      const manual = await app.inject({ method: "POST", url: "/api/collections/sleepRecords", payload: { sleep_date: "2026-11-16", bedtime: "23:30", wake_time: "07:15", duration_min: 465, source: "manual", notes: "手工补录" } });
      expect(manual.statusCode).toBe(201);

      const state = await app.inject({ method: "GET", url: "/api/state" });
      expect(state.json().data.sleepRecords).toHaveLength(2);
      expect(state.json().data.sleepRecords.map((row: any) => row.source).sort()).toEqual(["huawei-api", "manual"]);
    } finally {
      await app.close();
    }
  });

  it("serves CRUD for the four new lifestyle collections", async () => {
    directory = makeTestDirectory("sleep-collections");
    const app = await buildApp({ dataDir: directory, autoBackup: false });
    try {
      for (const [collection, title] of [["testCases", "登录用例"], ["writingItems", "随笔草稿"], ["readingItems", "设计心理学"]] as const) {
        const created = await app.inject({ method: "POST", url: `/api/collections/${collection}`, payload: { title } });
        expect(created.statusCode).toBe(201);
        expect(created.json().data).toMatchObject({ title });
      }
      const state = await app.inject({ method: "GET", url: "/api/state" });
      expect(state.json().data.testCases).toHaveLength(1);
      expect(state.json().data.writingItems).toHaveLength(1);
      expect(state.json().data.readingItems).toHaveLength(1);
    } finally {
      await app.close();
    }
  });
});
