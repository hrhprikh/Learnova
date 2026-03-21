import { prisma } from "./prisma.js";

export type NotificationType = "INFO" | "MESSAGE" | "ENROLLMENT" | "COURSE_UPDATE";

/**
 * Helper to create a notification in the database
 */
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType = "INFO",
  link: string | null = null
) {
  try {
    return await (prisma as any).notification.create({
      data: {
        userId,
        title,
        message,
        type,
        link
      }
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
    return null;
  }
}
