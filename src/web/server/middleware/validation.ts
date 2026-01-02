/**
 * Request validation middleware for the kustomark web server
 */

import type { NextFunction, Request, Response } from "express";

/**
 * Middleware to validate required fields in request body
 */
export function validateRequiredFields(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missingFields = fields.filter((field) => !(field in req.body));

    if (missingFields.length > 0) {
      res.status(400).json({
        error: `Missing required fields: ${missingFields.join(", ")}`,
        status: 400,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to validate a field is a string
 */
export function validateString(field: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (field in req.body && typeof req.body[field] !== "string") {
      res.status(400).json({
        error: `Field '${field}' must be a string`,
        status: 400,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to validate a field is a boolean
 */
export function validateBoolean(field: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (field in req.body && typeof req.body[field] !== "boolean") {
      res.status(400).json({
        error: `Field '${field}' must be a boolean`,
        status: 400,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to validate a field is a number
 */
export function validateNumber(field: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (field in req.body && typeof req.body[field] !== "number") {
      res.status(400).json({
        error: `Field '${field}' must be a number`,
        status: 400,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to validate a field is an array of strings
 */
export function validateStringArray(field: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (field in req.body) {
      const value = req.body[field];

      if (!Array.isArray(value)) {
        res.status(400).json({
          error: `Field '${field}' must be an array`,
          status: 400,
        });
        return;
      }

      if (!value.every((item) => typeof item === "string")) {
        res.status(400).json({
          error: `Field '${field}' must be an array of strings`,
          status: 400,
        });
        return;
      }
    }

    next();
  };
}

/**
 * Middleware to validate a field is an object
 */
export function validateObject(field: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (field in req.body) {
      const value = req.body[field];

      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        res.status(400).json({
          error: `Field '${field}' must be an object`,
          status: 400,
        });
        return;
      }
    }

    next();
  };
}
