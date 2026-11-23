import { isMyGo } from "mygo-runtime";
import {
  AppService,
  events,
  type WorkspaceSnapshot,
  type SystemStatus,
  type ReminderNotification,
} from "../mygo";
import { todayKey } from "./dates";

export { AppService, events };

export function inDesktopRuntime(): boolean {
  try {
    return isMyGo();
  } catch {
    return false;
  }
}

export function createBrowserPreviewSnapshot(): WorkspaceSnapshot {
  const today = todayKey();
  const now = new Date().toISOString();
  return {
    version: 1,
    blocks: [
      { id: "blk_1", name: "工作推进", color: "sky", order: 0, createdAt: now },
      { id: "blk_2", name: "个人与生活", color: "sage", order: 1, createdAt: now },
      { id: "blk_3", name: "学习与复盘", color: "amber", order: 2, createdAt: now },
    ],
    tasks: [
      {
        id: "tsk_1",
        blockId: "blk_1",
        date: today,
        title: "梳理本周重点议题并确认优先级",
        done: false,
        tags: ["工作", "晨间"],
        order: 0,
        createdAt: now,
      },
      {
        id: "tsk_2",
        blockId: "blk_1",
        date: today,
        title: "整理进度同步与待办清单",
        done: false,
        tags: ["日报"],
        reminderTime: "17:30",
        order: 1,
        createdAt: now,
      },
      {
        id: "tsk_3",
        blockId: "blk_2",
        date: today,
        title: "傍晚散步或拉伸 20 分钟",
        done: true,
        tags: ["健康"],
        order: 0,
        createdAt: now,
      },
    ],
    notes: [
      {
        id: "nte_1",
        content: "欢迎使用随身记！随时写下灵感，支持 #标签 自动归类并一键转任务。#使用提示",
        tags: ["使用提示"],
        pinned: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    tagReminders: [
      {
        id: "rem_1",
        tag: "日报",
        time: "17:30",
        repeat: "weekdays",
        onlyWhenOpen: false,
        message: "工作日下班前花 3 分钟梳理一下今天的产出",
        enabled: true,
        createdAt: now,
      },
    ],
    settings: {
      quickShortcut: "Alt+Shift+Space",
      themeMode: "system",
    },
    knownTags: ["工作", "晨间", "日报", "健康", "使用提示"],
  };
}

export function createBrowserPreviewStatus(): SystemStatus {
  return {
    dataPath: "~/Library/Application Support/SchedNautix/data.json",
    notificationsSupported: false,
    quickShortcut: "Alt+Shift+Space",
    shortcutActive: false,
    shortcutError: "当前在浏览器预览模式，请通过桌面客户端运行以启用系统通知与全局快捷键",
  };
}

export function notifyLabel(n: ReminderNotification): string {
  if (n.osNotified) return "已发送系统通知";
  if (n.osNotifyErr) return n.osNotifyErr;
  return "应用内提醒";
}
