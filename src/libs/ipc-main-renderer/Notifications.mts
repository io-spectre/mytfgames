import { createAction } from "@reduxjs/toolkit";

export enum AppNotificationType {
  SUCCESS = "success",
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
}

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  title: string;
  message: string;
  timestamp: number;
}

export const addNotification = createAction(
  "ipc/notifications/add",
  (notification: AppNotification) => ({
    payload: notification,
  }),
);
