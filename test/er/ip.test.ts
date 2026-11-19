import { describe, expect, it } from "vitest";
import { limitKey, viewerIp } from "../../src/ip";

describe("요청 제한 키", () => {
  it("같은 /64의 IPv6 주소는 한 키로 묶는다", () => {
    expect(limitKey("2001:db8:1:2::1")).toBe("2001:db8:1:2::/64");
    expect(limitKey("2001:db8:1:2::2")).toBe("2001:db8:1:2::/64");
    expect(limitKey("2001:0DB8:0001:0002:0000:0000:0000:0001")).toBe("2001:db8:1:2::/64");
    expect(limitKey("2001:db8:1:3::1")).toBe("2001:db8:1:3::/64");
    expect(limitKey("::1")).toBe("0:0:0:0::/64");
  });

  it("IPv4와 IPv4 매핑 주소는 그대로 쓴다", () => {
    expect(limitKey("203.0.113.9")).toBe("203.0.113.9");
    expect(limitKey("::ffff:203.0.113.9")).toBe("::ffff:203.0.113.9");
    expect(limitKey("local")).toBe("local");
  });
});

describe("CloudFront 방문자 IP", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it("비밀값이 맞으면 XFF 끝에서 두 번째를 쓴다", () => {
    expect(viewerIp(h({ "x-origin-auth": "s", "x-forwarded-for": "198.51.100.7, 203.0.113.9, 130.176.1.1" }), "s")).toBe("203.0.113.9");
    expect(viewerIp(h({ "x-origin-auth": "s", "x-forwarded-for": "2001:db8::1, 130.176.1.1" }), "s")).toBe("2001:db8::1");
  });
  it("비밀값이 없거나 틀리면 쓰지 않는다", () => {
    const xff = { "x-forwarded-for": "203.0.113.9, 130.176.1.1" };
    expect(viewerIp(h(xff), "s")).toBeNull();
    expect(viewerIp(h({ ...xff, "x-origin-auth": "x" }), "s")).toBeNull();
    expect(viewerIp(h({ ...xff, "x-origin-auth": "s" }), undefined)).toBeNull();
    expect(viewerIp(h({ ...xff, "x-origin-auth": "" }), "")).toBeNull();
  });
  it("XFF 항목이 하나뿐이면 쓰지 않는다", () => {
    expect(viewerIp(h({ "x-origin-auth": "s", "x-forwarded-for": "203.0.113.9" }), "s")).toBeNull();
  });
});
