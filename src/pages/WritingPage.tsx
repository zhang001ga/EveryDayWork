import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, PenNib, PencilSimple, Trash } from "@phosphor-icons/react";
import { api } from "../api";
import { useWorkspace } from "../WorkspaceContext";
import { formatDate } from "../utils";
import { Badge, Button, EmptyState, EntityForm, Modal, PageHeader, Section } from "../components/ui";
import { ModuleArtwork } from "../components/ModuleArtwork";

const statusLabels: Record<string, string> = { idea: "选题", draft: "初稿", revising: "修改中", published: "已发布", shelved: "搁置" };
const kindLabels: Record<string, string> = { article: "文章", essay: "随笔", script: "脚本", notes: "笔记", book: "书稿", other: "其他" };

export function WritingPage() {
  const { data, run } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState("all");
  const [dialog, setDialog] = useState<{ item?: Record<string, any> } | null>(null);
  useEffect(() => { if (params.get("new")) setDialog({}); }, [params]);
  const close = () => { setDialog(null); setParams({}); };
  const items = data.writingItems.filter((item) => filter === "all" || item.status === filter);
  const totalWords = data.writingItems.reduce((sum, item) => sum + Number(item.word_count || 0), 0);
  const published = data.writingItems.filter((item) => item.status === "published").length;

  return (
    <div>
      <PageHeader icon={<ModuleArtwork module="writing" />} eyebrow="日常 · 内容产出" title="写作" description="从选题到发布管理每一篇文字，记录字数与交付节奏。" actions={<Button onClick={() => setDialog({})}><Plus size={17} />新建写作</Button>} />
      <div className="testing-stats">
        <div className="testing-stat" data-status="pending"><span>进行中</span><strong>{data.writingItems.filter((item) => ["draft", "revising", "idea"].includes(item.status)).length}</strong></div>
        <div className="testing-stat" data-status="passed"><span>已发布</span><strong>{published}</strong></div>
        <div className="testing-stat" data-status="blocked"><span>累计字数</span><strong>{totalWords.toLocaleString("zh-CN")}</strong></div>
      </div>
      <Section title="写作清单" description="按状态查看，点击编辑可推进到下一阶段">
        <div className="segmented testing-filter">{["all", ...Object.keys(statusLabels)].map((value) => <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{value === "all" ? "全部" : statusLabels[value]}</button>)}</div>
        {items.length ? <div className="testing-list">{items.map((item) => (
          <article key={item.id}>
            <div className="testing-head">
              <div><Badge tone={item.status === "published" ? "success" : item.status === "shelved" ? "neutral" : "accent"}>{statusLabels[item.status] ?? item.status}</Badge><strong>{item.title}</strong><small>{kindLabels[item.kind] ?? item.kind}{item.word_count ? ` · ${Number(item.word_count).toLocaleString("zh-CN")} 字` : ""}</small></div>
              <div className="testing-actions">
                <Button variant="ghost" size="sm" onClick={() => void run(() => api.update("writingItems", item.id, { status: "published", notes: item.notes ?? "" }))}><PenNib size={15} />标记发布</Button>
                <Button variant="ghost" size="sm" onClick={() => setDialog({ item })}><PencilSimple size={15} />编辑</Button>
                <Button variant="ghost" size="sm" className="danger-text" onClick={() => void run(() => api.remove("writingItems", item.id))}><Trash size={15} />删除</Button>
              </div>
            </div>
            {item.notes ? <p><span>备注</span>{item.notes}</p> : null}
            <small className="testing-date">{item.target_date ? `目标 ${formatDate(item.target_date)}` : "未设目标日期"}</small>
          </article>
        ))}</div> : <EmptyState title="这个分类还没有内容" description="新建一个写作条目，记录你的下一篇作品。" action={<Button variant="secondary" onClick={() => setDialog({})}>新建写作</Button>} />}
      </Section>
      {dialog ? <Modal open title={dialog.item?.id ? "编辑写作" : "新建写作"} description="字数可以留空，随时回来补。" onClose={close}>
        <EntityForm
          fields={[
            { name: "title", label: "标题", required: true, placeholder: "给这篇文字起个名字" },
            { name: "kind", label: "类型", type: "select", options: Object.entries(kindLabels).map(([value, label]) => ({ value, label })) },
            { name: "status", label: "状态", type: "select", options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })) },
            { name: "word_count", label: "字数", type: "number" },
            { name: "target_date", label: "目标日期", type: "date" },
            { name: "notes", label: "备注 / 大纲", type: "textarea" },
          ]}
          initial={{ kind: "article", status: "idea", ...dialog.item }}
          submitLabel="保存"
          onCancel={close}
          onSubmit={async (values) => { const editing = dialog.item; if (editing?.id) await run(() => api.update("writingItems", editing.id, values)); else await run(() => api.create("writingItems", values)); close(); }}
        />
      </Modal> : null}
    </div>
  );
}
