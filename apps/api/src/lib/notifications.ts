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
    // Use a structural cast to avoid 'any' lint error while maintaining compatibility
    // if the prisma client isn't fully regenerated yet in all environments.
    const prismaWithNotif = prisma as unknown as { 
      notification: { 
        create: (args: { data: Record<string, unknown> }) => Promise<unknown> 
      } 
    };
    return await prismaWithNotif.notification.create({
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
