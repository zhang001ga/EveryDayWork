import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, PencilSimple, Trash, CheckCircle } from "@phosphor-icons/react";
import { api } from "../api";
import { useWorkspace } from "../WorkspaceContext";
import { formatDate } from "../utils";
import { Badge, Button, EmptyState, EntityForm, Modal, PageHeader, Section, type FieldDefinition } from "../components/ui";
import { ModuleArtwork } from "../components/ModuleArtwork";

const statusLabels: Record<string, string> = { pending: "待执行", passed: "通过", failed: "失败", blocked: "阻塞" };
const typeLabels: Record<string, string> = { functional: "功能", regression: "回归", integration: "集成", performance: "性能", other: "其他" };

export function TestingPage() {
  const { data, run } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState("all");
  const [dialog, setDialog] = useState<{ item?: Record<string, any> } | null>(null);
  useEffect(() => { if (params.get("new")) setDialog({}); }, [params]);
  const close = () => { setDialog(null); setParams({}); };
  const items = data.testCases.filter((item) => filter === "all" || item.status === filter);
  const counts = Object.fromEntries(["pending", "passed", "failed", "blocked"].map((status) => [status, data.testCases.filter((item) => item.status === status).length]));

  return (
    <div>
      <PageHeader icon={<ModuleArtwork module="testing" />} eyebrow="日常 · 质量保障" title="测试" description="记录测试用例、执行结果与阻塞原因，让每次交付都有据可查。" actions={<Button onClick={() => setDialog({})}><Plus size={17} />新增用例</Button>} />
      <div className="testing-stats">
        {(["pending", "passed", "failed", "blocked"] as const).map((status) => (
          <div className="testing-stat" key={status} data-status={status}><span>{statusLabels[status]}</span><strong>{counts[status]}</strong></div>
        ))}
      </div>
      <Section title="测试用例" description="按状态筛选，点击「执行结果」可直接更新状态">
        <div className="segmented testing-filter">{["all", "pending", "passed", "failed", "blocked"].map((value) => <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{value === "all" ? "全部" : statusLabels[value]}</button>)}</div>
        {items.length ? <div className="testing-list">{items.map((item) => (
          <article key={item.id}>
            <div className="testing-head">
              <div><Badge tone={item.status === "passed" ? "success" : item.status === "failed" ? "danger" : item.status === "blocked" ? "warning" : "neutral"}>{statusLabels[item.status] ?? item.status}</Badge><strong>{item.title}</strong><small>{typeLabels[item.case_type] ?? item.case_type}{item.related_module ? ` · ${item.related_module}` : ""}</small></div>
              <div className="testing-actions">
                <Button variant="ghost" size="sm" onClick={() => void run(() => api.update("testCases", item.id, { status: "passed", tested_at: new Date().toISOString() }))}><CheckCircle size={15} />标记通过</Button>
                <Button variant="ghost" size="sm" onClick={() => setDialog({ item })}><PencilSimple size={15} />编辑</Button>
                <Button variant="ghost" size="sm" className="danger-text" onClick={() => void run(() => api.remove("testCases", item.id))}><Trash size={15} />删除</Button>
              </div>
            </div>
            {item.expected ? <p><span>预期</span>{item.expected}</p> : null}
            {item.actual ? <p><span>实际</span>{item.actual}</p> : null}
            {item.notes ? <p><span>备注</span>{item.notes}</p> : null}
            <small className="testing-date">{item.tested_at ? `执行于 ${formatDate(item.tested_at)}` : "尚未执行"}{item.priority === "high" ? " · 高优先" : ""}</small>
          </article>
        ))}</div> : <EmptyState title="这个分类还没有用例" description="新增一条测试用例，开始积累你的回归清单。" action={<Button variant="secondary" onClick={() => setDialog({})}>新增用例</Button>} />}
      </Section>
      {dialog ? <TestDialog item={dialog.item} onClose={close} onSave={async (values) => { const editing = dialog.item; if (editing?.id) await run(() => api.update("testCases", editing.id, values)); else await run(() => api.create("testCases", values)); close(); }} /> : null}
    </div>
  );
}

function TestDialog({ item, onClose, onSave }: { item?: Record<string, any>; onClose: () => void; onSave: (values: Record<string, any>) => Promise<void> }) {
  const fields: FieldDefinition[] = [
    { name: "title", label: "用例名称", required: true, placeholder: "例如：登录后在首页看到今日计划", span: 2 },
    { name: "related_module", label: "关联模块", placeholder: "开发、写作、饮食……" },
    { name: "case_type", label: "类型", type: "select", options: Object.entries(typeLabels).map(([value, label]) => ({ value, label })) },
    { name: "status", label: "状态", type: "select", options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })) },
    { name: "priority", label: "优先级", type: "select", options: [{ value: "low", label: "低" }, { value: "medium", label: "中" }, { value: "high", label: "高" }] },
    { name: "expected", label: "预期结果", type: "textarea", rows: 3 },
    { name: "actual", label: "实际结果", type: "textarea", rows: 3 },
    { name: "notes", label: "备注", type: "textarea", rows: 3 },
  ];
  return (
    <Modal open title={item?.id ? "编辑测试用例" : "新增测试用例"} description="失败或阻塞时把实际结果写清楚，方便复盘。" onClose={onClose} className="modal-test">
      <EntityForm fields={fields} initial={{ case_type: "functional", status: "pending", priority: "medium", ...item }} submitLabel="保存用例" onCancel={onClose} onSubmit={onSave} />
    </Modal>
  );
}
