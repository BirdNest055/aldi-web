/**
 * Standardized API error handling for discount-database.
 *
 * Same pattern as discount-map — see that project for full docs.
 *
 * ERROR CODES
 * -----------
 * STORAGE_ERROR   — Supabase query failed
 * NOT_FOUND       — resource not found
 * CONFIG_ERROR    — missing env vars
 * INTERNAL_ERROR  — unexpected
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export type ErrorCode =
  | "STORAGE_ERROR"
  | "NOT_FOUND"
  | "CONFIG_ERROR"
  | "INTERNAL_ERROR";

export type ErrorStage =
  | "init"
  | "validation"
  | "query"
  | "parse";

export interface ApiErrorBody {
  error: string;
  code: ErrorCode;
  stage: ErrorStage;
  retryable: boolean;
  timestamp: string;
  cause?: string;
}

export class ApiError extends Error {
  code: ErrorCode;
  stage: ErrorStage;
  retryable: boolean;
  statusCode: number;
  cause?: string;

  constructor(
    message: string,
    opts: {
      code: ErrorCode;
      stage?: ErrorStage;
      retryable?: boolean;
      statusCode?: number;
      cause?: string;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.code = opts.code;
    this.stage = opts.stage ?? "init";
    this.retryable = opts.retryable ?? false;
    this.statusCode = opts.statusCode ?? 500;
    this.cause = opts.cause;
  }

  toBody(): ApiErrorBody {
    return {
      error: this.message,
      code: this.code,
      stage: this.stage,
      retryable: this.retryable,
      timestamp: new Date().toISOString(),
      cause: this.cause,
    };
  }
}

export const Errors = {
  storage: (msg: string, opts: { stage?: ErrorStage; cause?: string } = {}) =>
    new ApiError(msg, {
      code: "STORAGE_ERROR",
      stage: opts.stage ?? "query",
      retryable: false,
      statusCode: 500,
      cause: opts.cause,
    }),

  notFound: (msg: string) =>
    new ApiError(msg, {
      code: "NOT_FOUND",
      stage: "validation",
      retryable: false,
      statusCode: 404,
    }),

  config: (msg: string, opts: { cause?: string } = {}) =>
    new ApiError(msg, {
      code: "CONFIG_ERROR",
      stage: "init",
      retryable: false,
      statusCode: 500,
      cause: opts.cause,
    }),

  internal: (msg: string, opts: { cause?: string } = {}) =>
    new ApiError(msg, {
      code: "INTERNAL_ERROR",
      stage: "init",
      retryable: false,
      statusCode: 500,
      cause: opts.cause,
    }),
};

export type ApiHandler = (req: NextRequest, ctx?: any) => Promise<NextResponse> | NextResponse;

export function withErrorHandling(handler: ApiHandler): ApiHandler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (e: any) {
      if (e instanceof ApiError) {
        return NextResponse.json(e.toBody(), { status: e.statusCode });
      }
      const wrapped = Errors.internal(
        `Unexpected error: ${e?.message ?? String(e)}`,
        { cause: e?.name },
      );
      console.error("[api] Unhandled error:", e);
      return NextResponse.json(wrapped.toBody(), { status: 500 });
    }
  };
}
