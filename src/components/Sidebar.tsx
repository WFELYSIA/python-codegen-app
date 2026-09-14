import { MessageSquare, Plus, Trash2, X } from "lucide-react";
import type { Conversation } from "../types";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export default function Sidebar({
  conversations,
  activeId,
  open,
  onClose,
  onSelect,
  onNew,
  onDelete,
}: SidebarProps) {
  const select = (id: string) => {
    onSelect(id);
    onClose();
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-950/35 transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200 md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 px-4">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-900">
              Python 代码生成
            </div>
            <div className="truncate text-xs text-slate-400">
              {conversations.length} 个对话
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="关闭侧栏"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={onNew}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
          >
            <Plus className="h-4 w-4" />
            新建对话
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {conversations.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-slate-400">
              暂无对话记录
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conversation) => {
                const active = conversation.id === activeId;
                return (
                  <div
                    key={conversation.id}
                    className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 ${
                      active
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                    onClick={() => select(conversation.id)}
                  >
                    <MessageSquare
                      className={`h-4 w-4 shrink-0 ${
                        active ? "text-blue-500" : "text-slate-400"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {conversation.title}
                      </div>
                      <div className="truncate text-xs text-slate-400">
                        {formatTime(conversation.updatedAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      title="删除对话"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (
                          window.confirm(
                            `确定删除“${conversation.title}”吗？此操作不可撤销。`,
                          )
                        ) {
                          onDelete(conversation.id);
                        }
                      }}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  });
}
