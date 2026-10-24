import "server-only";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { captureException } from "@sentry/node";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { currentUser, sameOrigin, type User } from "./auth";
import { allow, blocked, clientIp, miss } from "@/limits";
import { loadView, OpError } from "./tournament";

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });

export const fail = (message: string, status = 400) => json({ error: message }, status);

// 코드로 대회를 여는 화면은 모두 이 검사를 거침. 막힌 IP에는 있는 코드도 열어 주지 않고, 없는 코드를 열면 막힘 횟수에 셈
export async function openView(code: string, user: User | null, bucket?: string, max = 300) {
  const ip = await clientIp();
  if (blocked(ip) || (bucket && !allow(`${bucket}:${ip}`, max, 60_000))) return { limited: true, view: null };
  const view = loadView(code, user);
  if (!view) miss(ip);
  return { limited: false, view };
}

export const MAX_BODY = 6 * 1024 * 1024;
const TOO_LARGE = "한 번에 올릴 수 있는 크기를 넘었습니다. 파일을 나눠서 올려주세요.";
class TooLarge extends Error {}

export async function guardWrite(): Promise<{ user: User } | { error: Response }> {
  if (!(await sameOrigin())) return { error: fail("다른 사이트에서 보낸 요청은 받지 않습니다.", 403) };
  const length = Number((await headers()).get("content-length") ?? 0);
  if (length > MAX_BODY) return { error: fail(TOO_LARGE, 413) };
  const user = await currentUser();
  if (!user) return { error: fail("디스코드로 로그인해주세요.", 401) };
  if (!allow(`w:${user.id}`, 120, 60_000)) return { error: fail("요청이 너무 많습니다. 잠시 뒤 다시 시도해주세요.", 429) };
  return { user };
}

export function handle(fn: () => Response | Promise<Response>): Promise<Response> {
  return Promise.resolve()
    .then(fn)
    .catch((e: unknown) => {
      if (e instanceof OpError) return fail(e.message, 400);
      if (e instanceof TooLarge) return fail(TOO_LARGE, 413);
      if (e instanceof SyntaxError) return fail("요청 형식이 잘못됐습니다.", 400);
      console.error("[서버] 처리 실패", e);
      captureException(e);
      return fail("서버에서 처리하지 못했습니다. 잠시 뒤 다시 시도해주세요.", 500);
    });
}

// Content-Length가 없는 chunked 요청도 있으므로 본문을 읽으며 바이트를 세다가 MAX_BODY를 넘으면 멈춤
export async function readJson<T>(req: Request): Promise<T> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (req.body)
    for await (const chunk of req.body as NodeReadableStream<Uint8Array>) {
      size += chunk.length;
      if (size > MAX_BODY) throw new TooLarge();
      chunks.push(chunk);
    }
  const body: unknown = JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new SyntaxError("not an object");
  return body as T;
}
