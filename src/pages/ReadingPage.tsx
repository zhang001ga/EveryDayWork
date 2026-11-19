import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, BookOpen, PencilSimple, Trash, Star } from "@phosphor-icons/react";
import { api } from "../api";
import { useWorkspace } from "../WorkspaceContext";
import { formatDate } from "../utils";
import { Badge, Button, EmptyState, EntityForm, Modal, PageHeader, Section } from "../components/ui";
import { ModuleArtwork } from "../components/ModuleArtwork";

const statusLabels: Record<string, string> = { wishlist: "想读", reading: "在读", paused: "暂停", finished: "读完" };

export function ReadingPage() {
  const { data, run } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState("all");
  const [dialog, setDialog] = useState<{ item?: Record<string, any> } | null>(null);
  useEffect(() => { if (params.get("new")) setDialog({}); }, [params]);
  const close = () => { setDialog(null); setParams({}); };
  const items = data.readingItems.filter((item) => filter === "all" || item.status === filter);
  const finished = data.readingItems.filter((item) => item.status === "finished");

  return (
    <div>
      <PageHeader icon={<ModuleArtwork module="reading" />} eyebrow="生活 · 输入与积累" title="阅读" description="管理书单、阅读进度与读后评分，把输入变成可回顾的记录。" actions={<Button onClick={() => setDialog({})}><Plus size={17} />添加书目</Button>} />
      <div className="testing-stats">
        <div className="testing-stat" data-status="pending"><span>在读</span><strong>{data.readingItems.filter((item) => item.status === "reading").length}</strong></div>
        <div className="testing-stat" data-status="passed"><span>已读完</span><strong>{finished.length}</strong></div>
        <div className="testing-stat" data-status="blocked"><span>想读</span><strong>{data.readingItems.filter((item) => item.status === "wishlist").length}</strong></div>
      </div>
      <Section title="我的书架" description="进度按百分比记录，读完可以打分">
        <div className="segmented testing-filter">{["all", ...Object.keys(statusLabels)].map((value) => <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{value === "all" ? "全部" : statusLabels[value]}</button>)}</div>
        {items.length ? <div className="testing-list">{items.map((item) => (
          <article key={item.id}>
            <div className="testing-head">
              <div><Badge tone={item.status === "finished" ? "success" : item.status === "reading" ? "accent" : "neutral"}>{statusLabels[item.status] ?? item.status}</Badge><strong>{item.title}</strong><small>{item.author || "未填写作者"}</small></div>
              <div className="testing-actions">
                <Button variant="ghost" size="sm" onClick={() => void run(() => api.update("readingItems", item.id, { status: "finished", finished_date: new Date().toISOString().slice(0, 10) }))}><BookOpen size={15} />标记读完</Button>
                <Button variant="ghost" size="sm" onClick={() => setDialog({ item })}><PencilSimple size={15} />编辑</Button>
                <Button variant="ghost" size="sm" className="danger-text" onClick={() => void run(() => api.remove("readingItems", item.id))}><Trash size={15} />删除</Button>
              </div>
            </div>
            <div className="reading-progress"><span style={{ width: `${Math.max(0, Math.min(100, Number(item.progress || 0)))}%` }} /></div>
            <small className="testing-date">进度 {Number(item.progress || 0)}%{item.rating ? ` · 评分 ${item.rating}/5` : ""}{item.finished_date ? ` · 读完 ${formatDate(item.finished_date)}` : ""}</small>
            {item.notes ? <p><span>笔记</span>{item.notes}</p> : null}
          </article>
        ))}</div> : <EmptyState title="这个分类还没有书" description="把想读的书加进来，慢慢读。" action={<Button variant="secondary" onClick={() => setDialog({})}>添加书目</Button>} />}
      </Section>
      {dialog ? <Modal open title={dialog.item?.id ? "编辑书目" : "添加书目"} description="进度和评分都可以之后补。" onClose={close}>
        <EntityForm
          fields={[
            { name: "title", label: "书名", required: true },
            { name: "author", label: "作者" },
            { name: "status", label: "状态", type: "select", options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })) },
            { name: "progress", label: "阅读进度 %", type: "number" },
            { name: "rating", label: "评分（1-5）", type: "number" },
            { name: "finished_date", label: "读完日期", type: "date" },
            { name: "notes", label: "读书笔记", type: "textarea" },
          ]}
          initial={{ status: "wishlist", ...dialog.item }}
          submitLabel="保存"
          onCancel={close}
          onSubmit={async (values) => { const editing = dialog.item; if (editing?.id) await run(() => api.update("readingItems", editing.id, values)); else await run(() => api.create("readingItems", values)); close(); }}
        />
      </Modal> : null}
    </div>
  );
}

export function ReadingStar({ value }: { value: number }) {
  return <Star size={14} weight={value ? "fill" : "regular"} />;
}
