/**
 * Global error handling middleware for the kustommark web server
 */

import type { NextFunction, Request, Response } from "express";
import type { ErrorResponse } from "../types.js";

/**
 * Custom error class for HTTP errors
 */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Global error handler middleware
 * This should be the last middleware added to the Express app
 */
export function errorHandler(
  err: Error | HttpError,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Determine status code
  let statusCode = 500;
  if (err instanceof HttpError) {
    statusCode = err.statusCode;
  }

  // Log error for debugging
  if (statusCode >= 500) {
    console.error("Server error:", err);
  }

  // Build error response
  const response: ErrorResponse = {
    error: err.message || "Internal server error",
    status: statusCode,
  };

  // Include details if available (only in development)
  if (err instanceof HttpError && err.details) {
    response.details = err.details;
  }

  // Send error response
  res.status(statusCode).json(response);
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: `Cannot ${req.method} ${req.path}`,
    status: 404,
  } as ErrorResponse);
}

/**
 * Async error handler wrapper
 * Wraps async route handlers to catch errors and pass them to the error handler
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
