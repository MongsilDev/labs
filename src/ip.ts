// IPv6는 /64 하나가 한 사용자에게 주어지므로 요청 제한 키를 /64로 묶음. IPv4와 IPv4 매핑 주소는 그대로
export function limitKey(ip: string): string {
  if (!ip.includes(":") || ip.includes(".")) return ip;
  const [head, tail = ""] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const full = ip.includes("::") ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t] : h;
  return `${full
    .slice(0, 4)
    .map((x) => (parseInt(x, 16) || 0).toString(16))
    .join(":")}::/64`;
}

// CloudFront를 거친 요청은 XFF가 「방문자, CloudFront 엣지」 순으로 끝나므로 끝에서 두 번째가 방문자. 비밀값이 맞을 때만 믿음
export function viewerIp(h: Headers, secret: string | undefined): string | null {
  if (!secret || h.get("x-origin-auth") !== secret) return null;
  const xs = (h.get("x-forwarded-for") || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return xs.length >= 2 ? xs[xs.length - 2] : null;
}
