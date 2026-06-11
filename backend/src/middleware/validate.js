// ============================================================
// Zod Request Validation Middleware
// Validates req.body, req.query, req.params against schema
//
// NOTE: Express 5 makes req.query a getter-only property.
// We attach parsed values to req.parsedQuery / req.parsedParams
// instead of overwriting. For body, Express still allows writes.
// ============================================================

import { ZodError } from 'zod';

// Validate request body (body is writable in Express 5)
export const validateBody = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(422).json({
        error: 'Validation failed',
        details: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    next(error);
  }
};

// Validate query params — attaches parsed result to req.query via Object.assign
// (avoids the getter-only setter restriction in Express 5)
export const validateQuery = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse(req.query);
    // Copy all parsed (coerced) values back onto req.query
    // This ensures numeric defaults like page=1 are available as numbers
    Object.keys(parsed).forEach((key) => {
      try {
        req.query[key] = parsed[key];
      } catch {
        // Some keys may be read-only; ignore
      }
    });
    // Also attach as req.q for guaranteed typed access
    req.q = parsed;
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(422).json({
        error: 'Invalid query parameters',
        details: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    next(error);
  }
};

// Validate URL params
export const validateParams = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse(req.params);
    Object.assign(req.params, parsed);
    req.validatedParams = parsed;
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(422).json({
        error: 'Invalid parameters',
        details: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    next(error);
  }
};

// Alias: validateRequest(schema, 'query'|'body'|'params') for mobile routes
export const validateRequest = (schema, target = 'body') => {
  if (target === 'query')  return validateQuery(schema);
  if (target === 'params') return validateParams(schema);
  return validateBody(schema);
};
