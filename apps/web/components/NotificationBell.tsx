"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, Check, Trash2, Mail } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/supabase-auth";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: "INFO" | "MESSAGE" | "ENROLLMENT" | "COURSE_UPDATE";
  read: boolean;
  link: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function fetchNotifications(accessToken: string) {
    try {
      const res = await apiRequest<{ notifications: Notification[] }>("/notifications", { token: accessToken });
      setNotifications(res.notifications);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  }

  useEffect(() => {
    async function init() {
      const { data } = await getCurrentSession();
      if (data.session?.access_token) {
        setToken(data.session.access_token);
        fetchNotifications(data.session.access_token);
      }
    }
    init();

    // Close on outside click
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function markAsRead(id: string) {
    if (!token) return;
    try {
      await apiRequest(`/notifications/${id}/read`, { method: "PATCH", token });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (err) {
      console.error(err);
    }
  }

  async function markAllAsRead() {
    if (!token) return;
    try {
      await apiRequest("/notifications/read-all", { method: "PATCH", token });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteNotification(id: string) {
    if (!token) return;
    try {
      await apiRequest(`/notifications/${id}`, { method: "DELETE", token });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && token) fetchNotifications(token);
        }}
        className="relative p-2 rounded-xl border border-[var(--edge)] hover:bg-gray-50 transition-all group"
      >
        <Bell className="w-5 h-5 text-[var(--ink-soft)] group-hover:text-[var(--ink)]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-4 w-80 md:w-96 bg-white rounded-3xl border border-[var(--edge)] shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="p-5 border-b border-[var(--edge)] flex items-center justify-between bg-gray-50/50">
            <h3 className="font-heading font-semibold text-lg">Inbox</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[10px] font-mono font-bold text-blue-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-12 text-center text-[var(--ink-soft)]">
                <Mail className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-mono tracking-tight">Your inbox is clear.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--edge)]">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-5 hover:bg-gray-50 transition-colors flex gap-4 ${!n.read ? "bg-blue-50/20" : ""}`}
                  >
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${!n.read ? "bg-blue-500" : "bg-transparent"}`} />
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-sm leading-tight pr-4">{n.title}</h4>
                        <button onClick={() => deleteNotification(n.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-[var(--ink-soft)] leading-relaxed mb-3">{n.message}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono text-gray-400">
                          {new Date(n.createdAt).toLocaleDateString()}
                        </span>
                        {!n.read && (
                          <button
                            onClick={() => markAsRead(n.id)}
                            className="flex items-center gap-1 text-[9px] font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-full transition-all"
                          >
                            <Check className="w-2.5 h-2.5" /> MARK AS READ
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
