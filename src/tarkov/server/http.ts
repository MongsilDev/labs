import "server-only";
import { captureException } from "@sentry/node";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export const fail = (message: string, status = 400) => json({ error: message }, status);

export async function sameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return h.get("sec-fetch-site") === "same-origin";
  // CloudFront를 거치면 Host가 원본 이름이 되므로 공개 주소와 비교
  return origin === BASE_URL;
}

export function handle(fn: () => Response | Promise<Response>): Promise<Response> {
  return Promise.resolve()
    .then(fn)
    .catch((e: unknown) => {
      console.error("[서버] 처리 실패", e);
      captureException(e);
      return fail("서버에서 처리하지 못했습니다. 잠시 뒤 다시 시도해주세요.", 500);
    });
}
