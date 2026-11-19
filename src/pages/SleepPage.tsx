import { useMemo, useRef, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { CloudArrowDown, UploadSimple, Plus, Trash, PencilSimple, ArrowSquareOut, WarningCircle, Watch } from "@phosphor-icons/react";
import { api } from "../api";
import { useWorkspace } from "../WorkspaceContext";
import { formatDate } from "../utils";
import { Badge, Button, EmptyState, EntityForm, ErrorState, Modal, PageHeader, Section, Skeleton, type FieldDefinition } from "../components/ui";
import { ModuleArtwork } from "../components/ModuleArtwork";

const sourceLabels: Record<string, string> = { "huawei-api": "华为手表 · API", "huawei-export": "华为手表 · 导入", manual: "手工补录" };

function formatDuration(minutes: unknown): string {
  const value = Number(minutes || 0);
  if (!value) return "—";
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return hours ? `${hours} 小时 ${rest} 分` : `${rest} 分钟`;
}

export function SleepPage() {
  const { data, run, refresh } = useWorkspace();
  const config = useQuery({ queryKey: ["sleep-huawei-config"], queryFn: api.sleepHuaweiConfig });
  const [configOpen, setConfigOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, any> | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const records = useMemo(
    () => [...data.sleepRecords].sort((a, b) => String(b.sleep_date).localeCompare(String(a.sleep_date))),
    [data.sleepRecords],
  );
  const stats = useMemo(() => {
    const withDuration = records.filter((item) => Number(item.duration_min) > 0);
    const withScore = records.filter((item) => item.score !== null && item.score !== undefined);
    const average = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
    return {
      count: records.length,
      duration: average(withDuration.map((item) => Number(item.duration_min))),
      score: average(withScore.map((item) => Number(item.score))),
      deep: average(records.filter((item) => Number(item.deep_min) > 0).map((item) => Number(item.deep_min))),
    };
  }, [records]);

  const showMessage = (tone: "ok" | "error", text: string) => setMessage({ tone, text });

  const sync = async (days: number) => {
    setBusy("sync"); setMessage(null);
    try {
      const result = await run(() => api.syncSleepHuawei(days));
      showMessage("ok", `同步完成：读取 ${result.total} 条，新增 ${result.imported} 条，跳过重复 ${result.skipped} 条。`);
    } catch (error) {
      showMessage("error", error instanceof Error ? error.message : "同步失败");
    } finally { setBusy(""); }
  };

  const importText = async (content: string, format: "auto" | "json" | "csv") => {
    setBusy("import"); setMessage(null);
    try {
      const result = await run(() => api.importSleep(content, format));
      showMessage("ok", `导入完成：识别 ${result.total} 条，新增 ${result.imported} 条，跳过重复 ${result.skipped} 条。`);
      setImportOpen(false);
    } catch (error) {
      showMessage("error", error instanceof Error ? error.message : "导入失败");
    } finally { setBusy(""); }
  };

  const remove = async (id: string) => { await run(() => api.remove("sleepRecords", id)); };

  return (
    <div>
      <PageHeader
        icon={<ModuleArtwork module="sleep" />}
        eyebrow="生活 · 休息与恢复"
        title="日常睡眠"
        description="接入华为手表 / 运动健康的睡眠数据，也可以用导出文件或手工补录；数据只保存在这台电脑。"
        actions={<Button onClick={() => setManualOpen(true)}><Plus size={17} />手工补录</Button>}
      />

      <Section title="华为手表数据" description="三条入口任选其一：官方接口同步、导出文件导入、手工补录">
        <div className="sleep-sources">
          <article className="sleep-source-card">
            <div className="sleep-source-icon"><CloudArrowDown size={22} /></div>
            <div className="sleep-source-copy">
              <strong>官方接口同步</strong>
              <p>通过 Health Service Kit REST API 拉取睡眠记录，需要 Client ID 与用户授权令牌。</p>
              {config.isLoading ? <Skeleton lines={1} /> : <small>{config.data?.configured ? "凭证已配置，可直接同步" : "尚未配置凭证"}</small>}
            </div>
            <div className="sleep-source-actions">
              <Button variant="secondary" size="sm" onClick={() => setConfigOpen(true)}>配置凭证</Button>
              <Button size="sm" loading={busy === "sync"} disabled={!config.data?.configured} onClick={() => void sync(7)}>同步最近 7 天</Button>
              <Button variant="ghost" size="sm" loading={busy === "sync"} disabled={!config.data?.configured} onClick={() => void sync(30)}>同步 30 天</Button>
            </div>
          </article>
          <article className="sleep-source-card">
            <div className="sleep-source-icon"><UploadSimple size={22} /></div>
            <div className="sleep-source-copy">
              <strong>导入导出文件</strong>
              <p>从华为运动健康导出的 JSON / CSV 睡眠文件读取，不需要账号或开发者资质。</p>
              <small>支持中文或英文列名，自动去重</small>
            </div>
            <div className="sleep-source-actions">
              <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>选择文件 / 粘贴数据</Button>
            </div>
          </article>
          <article className="sleep-source-card">
            <div className="sleep-source-icon"><Watch size={22} /></div>
            <div className="sleep-source-copy">
              <strong>手工补录</strong>
              <p>没有导出文件时，直接按晚记录入睡、醒来、时长与睡眠分期。</p>
              <small>与自动数据共用同一份本地记录</small>
            </div>
            <div className="sleep-source-actions">
              <Button variant="secondary" size="sm" onClick={() => setManualOpen(true)}>新增一晚</Button>
            </div>
          </article>
        </div>
        <p className="sleep-data-note"><WarningCircle size={15} />华为 Health Service Kit 需要在开发者联盟申请睡眠读取权限（Scope <code>https://www.huawei.com/healthkit/sleep.read</code>），访问令牌有效期 1 小时、单次查询最多 31 天。<a href={config.data?.docsUrl ?? "https://developer.huawei.com/consumer/cn/doc/hmscore-guides/sleep-record-scene-0000001055511884"} target="_blank" rel="noreferrer">官方睡眠记录接口文档 <ArrowSquareOut size={13} /></a> · <a href={config.data?.guideUrl ?? "https://developers.anpheros.com/guides/huawei-health-api"} target="_blank" rel="noreferrer">REST / OAuth 说明 <ArrowSquareOut size={13} /></a></p>
        {message ? <div className={`sleep-message sleep-message-${message.tone}`} role="status">{message.text}</div> : null}
      </Section>

      <Section title="睡眠概览" description="基于全部本地记录计算">
        <div className="testing-stats">
          <div className="testing-stat" data-status="pending"><span>记录晚数</span><strong>{stats.count}</strong></div>
          <div className="testing-stat" data-status="passed"><span>平均睡眠</span><strong>{stats.duration ? formatDuration(stats.duration) : "—"}</strong></div>
          <div className="testing-stat" data-status="blocked"><span>平均深睡</span><strong>{stats.deep ? formatDuration(stats.deep) : "—"}</strong></div>
          <div className="testing-stat" data-status="pending"><span>平均评分</span><strong>{stats.score || "—"}</strong></div>
        </div>
      </Section>

      <Section title="每晚记录" description="按日期倒序，同一来源的重复记录会自动跳过">
        {records.length ? <div className="sleep-record-list">{records.map((item) => (
          <article key={item.id}>
            <div className="sleep-record-head">
              <div><strong>{formatDate(item.sleep_date)}</strong><Badge tone={item.source === "manual" ? "neutral" : "accent"}>{sourceLabels[item.source] ?? item.source}</Badge>{item.device ? <small>{item.device}</small> : null}</div>
              <div className="testing-actions">
                <Button variant="ghost" size="sm" onClick={() => setEditItem(item)}><PencilSimple size={15} />编辑</Button>
                <Button variant="ghost" size="sm" className="danger-text" onClick={() => void remove(item.id)}><Trash size={15} />删除</Button>
              </div>
            </div>
            <div className="sleep-record-metrics">
              <div><span>入睡 / 醒来</span><strong>{item.bedtime || "—"} → {item.wake_time || "—"}</strong></div>
              <div><span>睡眠时长</span><strong>{formatDuration(item.duration_min)}</strong></div>
              <div><span>深睡 / 浅睡 / REM</span><strong>{[item.deep_min, item.light_min, item.rem_min].map((value) => (value ? `${value}m` : "—")).join(" / ")}</strong></div>
              <div><span>清醒 / 评分</span><strong>{item.awake_min ? `${item.awake_min}m` : "—"} / {item.score ?? "—"}</strong></div>
            </div>
            {item.notes ? <p className="sleep-record-notes">{item.notes}</p> : null}
          </article>
        ))}</div> : <EmptyState title="还没有睡眠记录" description="同步华为手表、导入导出文件，或先手工补录一晚。" />}
      </Section>

      {configOpen ? <ConfigDialog config={config.data} onClose={() => { setConfigOpen(false); void config.refetch(); void refresh(); }} onSaved={() => { setConfigOpen(false); void config.refetch(); void refresh(); showMessage("ok", "凭证已保存到本机数据文件。"); }} /> : null}
      {importOpen ? <ImportDialog busy={busy === "import"} onClose={() => setImportOpen(false)} onImport={(content, format) => void importText(content, format)} fileInputRef={fileInput} /> : null}
      {manualOpen || editItem ? <RecordDialog item={editItem ?? undefined} onClose={() => { setManualOpen(false); setEditItem(null); }} onSave={async (values) => { if (editItem?.id) await run(() => api.update("sleepRecords", editItem.id, values)); else await run(() => api.create("sleepRecords", { ...values, source: "manual" })); setManualOpen(false); setEditItem(null); }} /> : null}
    </div>
  );
}

function ConfigDialog({ config, onClose, onSaved }: { config?: Record<string, any>; onClose: () => void; onSaved: () => void }) {
  const [clientId, setClientId] = useState(String(config?.clientId ?? ""));
  const [accessToken, setAccessToken] = useState("");
  const [apiBase, setApiBase] = useState(String(config?.apiBase ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true); setError("");
    try { await api.saveSleepHuaweiConfig({ clientId, accessToken, apiBase }); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    finally { setBusy(false); }
  };
  const clear = async () => {
    setBusy(true); setError("");
    try { await api.saveSleepHuaweiConfig({ clearToken: true }); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "清除失败"); }
    finally { setBusy(false); }
  };
  return (
    <Modal open title="华为 Health Service Kit 凭证" description="凭证只写入本机 SQLite，不会上传到任何服务器；令牌留空表示不修改。" onClose={onClose}>
      <div className="sleep-config-form">
        <label><span>Client ID</span><input value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder="华为开发者联盟应用的 Client ID" /></label>
        <label><span>访问令牌 Access Token</span><input type="password" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder={config?.hasToken ? "已保存，留空则不修改" : "用户 OAuth 授权获得的令牌"} /></label>
        <label><span>接口地址（可选）</span><input value={apiBase} onChange={(event) => setApiBase(event.target.value)} placeholder="留空使用官方端点，可填本机代理地址" /></label>
        <p className="sleep-data-note"><WarningCircle size={15} />令牌由华为账号 OAuth 授权获得，有效期约 1 小时；过期后请重新填写。当前状态：{config?.hasToken ? "已保存令牌" : "未保存令牌"}。</p>
        {error ? <ErrorState message={error} /> : null}
        <div className="modal-actions">
          {config?.hasToken ? <Button variant="ghost" className="danger-text" loading={busy} onClick={() => void clear()}>清除令牌</Button> : null}
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button loading={busy} onClick={() => void save()}>保存凭证</Button>
        </div>
      </div>
    </Modal>
  );
}

function ImportDialog({ busy, onClose, onImport, fileInputRef }: {
  busy: boolean;
  onClose: () => void;
  onImport: (content: string, format: "auto" | "json" | "csv") => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
}) {
  const [text, setText] = useState("");
  const [format, setFormat] = useState<"auto" | "json" | "csv">("auto");
  const [fileName, setFileName] = useState("");
  const readFile = (file?: File | null) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file, "utf-8");
  };
  return (
    <Modal open title="导入华为运动健康睡眠数据" description="支持 JSON 或 CSV 导出文件，也可以直接粘贴内容。" onClose={onClose} wide>
      <div className="sleep-import-form">
        <div className="sleep-import-controls">
          <input ref={fileInputRef} type="file" accept=".json,.csv,.txt,application/json,text/csv,text/plain" aria-label="选择睡眠数据文件" onChange={(event) => readFile(event.target.files?.[0])} />
          <select aria-label="文件格式" value={format} onChange={(event) => setFormat(event.target.value as typeof format)}>
            <option value="auto">自动识别</option><option value="json">JSON</option><option value="csv">CSV</option>
          </select>
          {fileName ? <Badge tone="accent">{fileName}</Badge> : null}
        </div>
        <textarea aria-label="睡眠数据内容" rows={9} value={text} onChange={(event) => setText(event.target.value)} placeholder={'粘贴导出数据，例如：\n日期,入睡时间,起床时间,睡眠时长,深睡,浅睡,REM,清醒,睡眠评分\n2026-11-18,23:20,07:05,445,95,250,80,20,86'} />
        <p className="sleep-data-note">识别字段：日期、入睡 / 起床时间、睡眠时长、深睡 / 浅睡 / REM / 清醒、评分、设备；列名支持中文、英文与 snake_case。同一天同一来源的重复记录会自动跳过。</p>
        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button loading={busy} disabled={!text.trim()} onClick={() => onImport(text, format)}>导入数据</Button>
        </div>
      </div>
    </Modal>
  );
}

function RecordDialog({ item, onClose, onSave }: { item?: Record<string, any>; onClose: () => void; onSave: (values: Record<string, any>) => Promise<void> }) {
  const fields: FieldDefinition[] = [
    { name: "sleep_date", label: "日期", type: "date", required: true },
    { name: "bedtime", label: "入睡时间", type: "time" },
    { name: "wake_time", label: "起床时间", type: "time" },
    { name: "duration_min", label: "睡眠时长（分钟）", type: "number" },
    { name: "deep_min", label: "深睡（分钟）", type: "number" },
    { name: "light_min", label: "浅睡（分钟）", type: "number" },
    { name: "rem_min", label: "REM（分钟）", type: "number" },
    { name: "awake_min", label: "清醒（分钟）", type: "number" },
    { name: "score", label: "睡眠评分（0-100）", type: "number" },
    { name: "device", label: "设备", placeholder: "例如：HUAWEI WATCH GT 5" },
    { name: "notes", label: "备注", type: "textarea" },
  ];
  return (
    <Modal open title={item?.id ? "编辑睡眠记录" : "手工补录一晚"} description="时长单位是分钟；不确定的分期可以留空。" onClose={onClose}>
      <EntityForm
        fields={fields}
        initial={{ sleep_date: new Date().toISOString().slice(0, 10), source: "manual", ...item }}
        submitLabel="保存记录"
        onCancel={onClose}
        onSubmit={onSave}
      />
    </Modal>
  );
}
