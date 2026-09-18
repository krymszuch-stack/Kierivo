import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  expose?: boolean;
}

/**
 * Global error handler.
 *
 * The client never receives `err.message` or a stack trace. Upstream errors leak
 * internal detail — a Gemini SDK failure or an `ECONNREFUSED 127.0.0.1:6379`
 * describes our infrastructure to whoever triggered it. The client gets a stable
 * message plus a `requestId`; the detail goes to the server log under that id.
 */
export function errorHandler(
  err: HttpError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const reqWithId = req as unknown as { requestId?: string };
  const headerId = req.headers['x-request-id'];
  const requestId =
    reqWithId.requestId ||
    (typeof headerId === 'string' && headerId.trim().length > 0 ? headerId.trim() : randomUUID());
  const status = err.status || err.statusCode || 500;

  console.error(
    `[API Error] requestId=${requestId} ${req.method} ${req.path} status=${status}`,
    err
  );

  if (res.headersSent) {
    return;
  }

  // 4xx raised deliberately by our own handlers carry safe, user-facing text.
  // Anything 5xx is unexpected and gets a generic message.
  const isSafeClientError = status >= 400 && status < 500 && err.expose === true;

  res.status(status).json({
    success: false,
    requestId,
    error: isSafeClientError
      ? err.message
      : 'Wystąpił nieoczekiwany błąd serwera. Spróbuj ponownie za chwilę.',
  });
}
