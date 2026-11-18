import { describe, expect, it } from "vitest";
import { wordDiff } from "@/next/l10n-words";

const show = (a: string, b: string) => wordDiff(a, b).map((p) => (p.op < 0 ? `[-${p.text}]` : p.op > 0 ? `[+${p.text}]` : p.text)).join("");

describe("wordDiff", () => {
  it("끝에 붙은 글자만 더한 것으로 표시", () => {
    expect(show("로딩 중", "로딩 중 (수정)")).toBe("로딩 중[+ (수정)]");
  });
  it("긴 문장 안의 숫자 하나만 바뀐 것으로 표시", () => {
    expect(show("5초 동안 피해를 30% 줄입니다.", "5초 동안 피해를 35% 줄입니다.")).toBe("5초 동안 피해를 [-30][+35]% 줄입니다.");
  });
  it("연달아 바뀐 단어는 지운 글과 더한 글로 한 번씩 묶음", () => {
    expect(show("빨간 큰 사과", "파란 작은 사과")).toBe("[-빨간 큰][+파란 작은] 사과");
  });
  it("같은 문자열은 바뀐 곳 없음", () => {
    expect(wordDiff("같음", "같음")).toEqual([{ text: "같음", op: 0 }]);
  });
  it("줄바꿈이 있어도 원문을 그대로 이어 붙일 수 있음", () => {
    const a = "첫 줄\n둘째 줄";
    const b = "첫 줄\n셋째 줄";
    const parts = wordDiff(a, b);
    expect(parts.filter((p) => p.op <= 0).map((p) => p.text).join("")).toBe(a);
    expect(parts.filter((p) => p.op >= 0).map((p) => p.text).join("")).toBe(b);
  });
});
