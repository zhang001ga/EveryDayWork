import type { AppStore, Entity } from "./store.js";

function plusDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

export function buildDashboard(store: AppStore, date: string): Record<string, any> {
  const planItems: Entity[] = store.list("planItems").map((item) => ({
    ...item,
    display_title: store.sourceTitle(item.source_entity_type, item.source_entity_id) || item.title,
  }));
  const todayItems = planItems.filter((item) => item.plan_date === date && item.status !== "cancelled");
  const timeline = todayItems.filter((item) => item.start_time).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const unscheduled = todayItems.filter((item) => !item.start_time);
  const completed = todayItems.filter((item) => item.status === "done").length;
  const totalMinutes = todayItems.reduce((sum, item) => sum + Number(item.estimated_minutes || 0), 0);
  const horizon = plusDays(date, 3);

  const attention: Entity[] = [];
  attention.push(
    ...planItems
      .filter((item) => item.plan_date < date && !["done", "cancelled"].includes(item.status))
      .map((item) => ({ ...item, attention_type: "overdue", module: "today" })),
  );
  attention.push(
    ...store
      .list("consultingDeliverables")
      .filter((item) => item.due_date && item.due_date <= horizon && item.status !== "done")
      .map((item) => ({ ...item, attention_type: "deliverable", module: "consulting" })),
  );
  attention.push(
    ...store
      .list("consultingFollowups")
      .filter((item) => item.followup_at?.slice(0, 10) <= date && item.status !== "done")
      .map((item) => ({ ...item, attention_type: "followup", module: "consulting", title: item.content })),
  );
  attention.push(
    ...store
      .list("workouts")
      .filter((item) => item.workout_date === date && item.status !== "completed")
      .map((item) => ({ ...item, attention_type: "workout", module: "fitness", title: item.name })),
  );

  const devItems = store.list("devWorkItems");
  const testCases = store.list("testCases");
  const writingItems = store.list("writingItems");
  const workouts = store.list("workouts");
  const readingItems = store.list("readingItems");
  const sleepRecords = store.list("sleepRecords");

  return {
    date,
    overview: {
      completed,
      total: todayItems.length,
      progress: todayItems.length ? Math.round((completed / todayItems.length) * 100) : 0,
      scheduledMinutes: totalMinutes,
    },
    timeline,
    unscheduled,
    attention: attention.slice(0, 12),
    summaries: {
      development: devItems.filter((item) => item.priority === "high" && item.status !== "done").slice(0, 3),
      testing: testCases.filter((item) => ["pending", "failed", "blocked"].includes(item.status)).slice(0, 3),
      writing: writingItems.filter((item) => ["draft", "revising"].includes(item.status)).slice(0, 3),
      fitness: workouts.filter((item) => item.workout_date >= date).slice(0, 3),
      diet: store.list("meals").filter((item) => item.meal_date === date).slice(0, 4),
      reading: readingItems.filter((item) => item.status === "reading").slice(0, 3),
      sleep: sleepRecords.filter((item) => item.sleep_date >= plusDays(date, -6)).slice(0, 3),
      // 兼容旧数据：保留历史模块摘要，避免旧设置或旧数据丢失。
      media: store.list("mediaContents").filter((item) => ["producing", "ready"].includes(item.stage)).slice(0, 3),
      consulting: store.list("consultingFollowups").filter((item) => item.status !== "done").slice(0, 3),
      entertainment: store.list("entertainmentItems").filter((item) => item.status === "playing").slice(0, 3),
    },
  };
}
