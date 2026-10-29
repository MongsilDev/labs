import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Replays } from "../../src/er/components/t/Rounds";
import type { RoundSummary } from "../../src/er/lib/engine";

const summary = (roundNo: number, gameId: number | null, source: RoundSummary["source"] = "csv"): RoundSummary => ({ roundNo, gameId, source, teamCount: 8, winner: null, main: "비", sub: null });

function findButton(node: ReactNode): ReactElement<{ onClick: () => void }> | null {
  if (!isValidElement<{ children?: ReactNode }>(node)) return null;
  if (node.type === "button") return node as ReactElement<{ onClick: () => void }>;
  for (const c of [node.props.children].flat()) {
    const b = findButton(c);
    if (b) return b;
  }
  return null;
}

describe("리플레이 코드 패널", () => {
  const rounds = [summary(1, 12345678), summary(2, null, "manual"), summary(3, 87654321)];

  it("CSV 라운드의 게임 ID를 라운드 순서대로 보여 준다", () => {
    const html = renderToStaticMarkup(createElement(Replays, { rounds, copy: () => {} }));
    expect(html).toContain("리플레이 코드");
    expect(html.replace(/<[^>]+>/g, "")).toContain("1R 123456783R 87654321");
    expect(html).not.toContain("2R");
  });

  it("복사 버튼은 한 줄에 하나씩 1R 12345678 형식으로 넘긴다", () => {
    const copied: string[] = [];
    findButton(Replays({ rounds, copy: (text) => copied.push(text) }))?.props.onClick();
    expect(copied).toEqual(["1R 12345678\n3R 87654321"]);
  });

  it("게임 ID가 없으면 패널을 그리지 않는다", () => {
    expect(renderToStaticMarkup(createElement(Replays, { rounds: [summary(1, null, "manual")], copy: () => {} }))).toBe("");
  });
});
