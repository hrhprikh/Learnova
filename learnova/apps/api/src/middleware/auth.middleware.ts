import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { supabaseAdmin } from "../lib/supabase.js";

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

async function validateSupabaseToken(token: string): Promise<string | null> {
  const authApi = supabaseAdmin.auth as unknown as {
    getUser: (jwt: string) => Promise<{ data: { user: { email?: string } | null }; error: unknown }>;
  };

  const { data, error } = await authApi.getUser(token);
  if (error || !data.user?.email) {
    return null;
  }

  return data.user.email;
}

export async function requireSupabaseToken(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ message: "Missing or invalid authorization header" });
    }

    const email = await validateSupabaseToken(token);
    if (!email) {
      return res.status(401).json({ message: "Invalid access token" });
    }

    req.authEmail = email;
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ message: "Missing or invalid authorization header" });
    }

    const email = await validateSupabaseToken(token);
    if (!email) {
      return res.status(401).json({ message: "Invalid access token" });
    }

    const dbUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true }
    });

    if (!dbUser) {
      return res.status(403).json({ message: "User is not provisioned in application" });
    }

    req.user = dbUser;
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function tryAttachUser(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) {
      return next();
    }

    const email = await validateSupabaseToken(token);
    if (!email) {
      return res.status(401).json({ message: "Invalid access token" });
    }

    const dbUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true }
    });

    if (!dbUser) {
      return res.status(403).json({ message: "User is not provisioned in application" });
    }

    req.user = dbUser;
    return next();
  } catch (error) {
    return next(error);
  }
}
