import { allow, blocked, clientIp } from "@/limits";
import { getCut } from "@/er/server/cut";
import { cutImage, OG_SIZE, siteImage } from "@/er/server/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "이터컷 예측";
export const dynamic = "force-dynamic";

export default async function Image() {
  const ip = await clientIp();
  const data = allow(`og:${ip}`, 120, 60_000) && !blocked(ip) ? await getCut() : null;
  return data ? cutImage(data) : siteImage({ sub: "이터컷 예측", url: "labs.mongsil.dev/er/cut" });
}
