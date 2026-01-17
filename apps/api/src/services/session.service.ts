import type { Prisma, PrismaClient } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import type { ExtendedPrismaClient } from "../prisma.js";
import { SUBSCRIPTION_STATUS } from "../constants/subscription.js";

export type SessionWithTopics = Prisma.WeeklySessionGetPayload<{
  select: {
    id: true;
    title: true;
    description: true;
    youtubeUrl: true;
    sessionDate: true;
    topics: {
      select: {
        id: true;
        timestamp: true;
        topic: true;
        order: true;
      };
    };
  };
}>;

class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * retry helper with exponential backoff for transient db failures
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    multiplier?: number;
    operationName?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 100,
    multiplier = 2,
    operationName = "database operation",
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const isTransient =
        error instanceof PrismaClientKnownRequestError &&
        (error.code === "P1001" || // connection error
          error.code === "P1002" || // connection timeout
          error.code === "P1008" || // operations timed out
          error.code === "P1017"); // server closed connection

      const isNetworkError =
        error instanceof Error &&
        (error.message.includes("ECONNREFUSED") ||
          error.message.includes("ETIMEDOUT") ||
          error.message.includes("ENOTFOUND"));

      if (!isTransient && !isNetworkError) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(multiplier, attempt);
        console.warn(
          `[${new Date().toISOString()}] ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`,
          error
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

export const sessionService = {
  /**
   * Get all sessions for authenticated paid users
   * Sessions are ordered by sessionDate descending (newest first)
   */
  async getSessions(
    prisma: ExtendedPrismaClient | PrismaClient,
    userId: string
  ): Promise<SessionWithTopics[]> {
    const subscription = await withRetry(
      () =>
        prisma.subscription.findFirst({
          where: {
            userId,
            status: SUBSCRIPTION_STATUS.ACTIVE,
            endDate: {
              gte: new Date(),
            },
          },
        }),
      { operationName: "subscription check" }
    );

    if (!subscription) {
      throw new AuthorizationError(
        "Active subscription required to access sessions"
      );
    }

    try {
      const sessions = await withRetry(
        () =>
          prisma.weeklySession.findMany({
            select: {
              id: true,
              title: true,
              description: true,
              youtubeUrl: true,
              sessionDate: true,
              topics: {
                select: {
                  id: true,
                  timestamp: true,
                  topic: true,
                  order: true,
                },
                orderBy: {
                  order: "asc",
                },
              },
            },
            orderBy: {
              sessionDate: "desc",
            },
          }),
        { operationName: "session fetch" }
      );

      return sessions;
    } catch (error) {
      const timestamp = new Date().toISOString();
      const functionName = "getSessions";

      console.error(
        `[${timestamp}] Error in sessionService.${functionName} - userId: ${userId}`,
        error
      );

      throw error;
    }
  },
};
