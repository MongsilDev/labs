import "server-only";

// 몽실봇 웹 서버를 부르는 쪽. 주소가 없으면 운영 환경에서만 기본 주소를 쓰고, 그 밖에서는 부르지 않음
export function botApiUrl(): string | null {
  const url = process.env.BOT_API_URL?.trim();
  if (url) return url.replace(/\/+$/, "");
  return process.env.NODE_ENV === "production" ? "https://bot.mongsil.dev" : null;
}

const headers = () => ({ "x-bot-token": process.env.LABS_BOT_TOKEN ?? "", "content-type": "application/json" });

let warnedAt = 0;
function warn(message: string, e: unknown) {
  if (Date.now() - warnedAt < 60_000) return;
  warnedAt = Date.now();
  console.warn(`[봇] ${message}`, e instanceof Error ? e.message : e);
}

// 응답을 기다리지 않고, 실패는 1분에 한 번만 남김
export function notifyChanged(code: string) {
  const url = botApiUrl();
  if (!url) return;
  try {
    fetch(`${url}/api/t/changed`, { method: "POST", headers: headers(), body: JSON.stringify({ code }), signal: AbortSignal.timeout(3000) })
      .then((r) => {
        if (!r.ok && r.status !== 202) warn(`변경 알림 응답 ${r.status}`, null);
        return r.body?.cancel();
      })
      .catch((e: unknown) => warn("변경 알림 실패", e));
  } catch (e) {
    warn("변경 알림 실패", e);
  }
}

export type BotGuild = { id: string; name: string; channels: { id: string; name: string }[] };

const ID = /^\d{1,20}$/;
const text = (v: unknown) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 100) : "");

// 사용자가 고를 수 있는 채널 목록. 봇을 부르지 못했거나 응답 모양이 다르면 null
export async function botChannels(userId: string): Promise<BotGuild[] | null> {
  const url = botApiUrl();
  if (!url || !ID.test(userId)) return null;
  try {
    const r = await fetch(`${url}/api/t/channels?user=${userId}`, { headers: headers(), signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!r.ok) {
      await r.body?.cancel();
      warn(`채널 목록 응답 ${r.status}`, null);
      return null;
    }
    const data = (await r.json()) as { guilds?: unknown };
    if (!Array.isArray(data?.guilds)) return null;
    return (data.guilds as { id?: unknown; name?: unknown; channels?: unknown }[]).slice(0, 100).flatMap((g) => {
      if (typeof g?.id !== "string" || !ID.test(g.id) || !Array.isArray(g.channels)) return [];
      const channels = (g.channels as { id?: unknown; name?: unknown }[])
        .slice(0, 500)
        .flatMap((c) => (typeof c?.id === "string" && ID.test(c.id) ? [{ id: c.id, name: text(c.name) || c.id }] : []));
      return channels.length ? [{ id: g.id, name: text(g.name) || g.id, channels }] : [];
    });
  } catch (e) {
    warn("채널 목록 실패", e);
    return null;
  }
}
