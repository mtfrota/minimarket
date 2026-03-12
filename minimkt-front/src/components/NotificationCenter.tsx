"use client";

import {
  createRandomNotification,
  randomDelayMs,
  readStoredNotifications,
  saveNotifications,
  SystemNotification,
} from "@/lib/notifications";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

function BellIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <path
        d="M15 17H5.5a1 1 0 0 1-.83-1.56L6 13.5V10a6 6 0 1 1 12 0v3.5l1.33 1.94A1 1 0 0 1 18.5 17H17"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 19a3 3 0 0 0 6 0" strokeLinecap="round" />
    </svg>
  );
}

function formatNotificationDate(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>(() => readStoredNotifications());
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  useEffect(() => {
    saveNotifications(notifications);
  }, [notifications]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const schedule = () => {
      timer = setTimeout(() => {
        if (cancelled) return;

        const notification = createRandomNotification();
        setNotifications((prev) => [notification, ...prev].slice(0, 50));
        toast(notification.message, { duration: 3500 });

        schedule();
      }, randomDelayMs());
    };

    schedule();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function openPanel() {
    setOpen((prev) => !prev);

    if (!open) {
      setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
    }
  }

  function clearAll() {
    setNotifications([]);
  }

  return (
    <div className="relative hidden lg:block" ref={wrapperRef}>
      <button
        type="button"
        onClick={openPanel}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-neutral-300 transition hover:bg-white/10 hover:text-white"
        aria-label="Notificacoes"
        title="Notificacoes"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-black">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      <div
        className={`absolute left-1/2 mt-2 w-96 -translate-x-1/2 origin-top rounded-2xl border border-white/10 bg-neutral-900/95 p-3 shadow-2xl backdrop-blur-xl transition-all duration-200 ${
          open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-2 scale-95 opacity-0"
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Notificacoes</p>
          {notifications.length > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-md border border-white/10 px-2 py-1 text-xs text-neutral-300 transition hover:bg-white/10"
            >
              Limpar
            </button>
          ) : null}
        </div>

        {notifications.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-neutral-400">
            Nenhuma notificacao no momento.
          </p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-auto pr-1">
            {notifications.map((notification) => (
              <article key={notification.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <p className="text-sm text-neutral-100">{notification.message}</p>
                <p className="mt-1 text-xs text-neutral-500">{formatNotificationDate(notification.createdAt)}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
