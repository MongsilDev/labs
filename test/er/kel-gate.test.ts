import { readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { KEL_SCREENS, type KelScreen } from "../../src/er/lib/kel";

const ROOT = join(__dirname, "../../src/app/er/kel");
const files = readdirSync(ROOT, { recursive: true, withFileTypes: true })
  .filter((e) => !e.isDirectory())
  .map((e) => join(e.parentPath, e.name));

// 없는 KEL 주소를 KEL 404 화면으로 보내는 파일
const MISSING = ["not-found.tsx", join("[...missing]", "page.tsx")];

// 공개 전 화면은 페이지마다 kelGate로 막으므로 새 파일이 검사를 빠뜨리지 않았는지 확인
describe("KEL 접근 제한", () => {
  const all = files.map((f) => ({ file: relative(ROOT, f), src: readFileSync(f, "utf8") }));
  const pages = all.filter((p) => !MISSING.includes(p.file));
  // teams/[key]처럼 동적 주소의 상세 화면은 바로 위 화면에 속함
  const screenOf = (file: string) => {
    const path = ["/er/kel", ...file.split(sep).slice(0, -1).filter((s) => !s.startsWith("["))].join("/");
    return (Object.keys(KEL_SCREENS) as KelScreen[]).find((k) => KEL_SCREENS[k].path === path);
  };

  it("page.tsx와 없는 주소 처리 파일 말고 다른 파일이 없고, 없는 주소의 page.tsx는 notFound만 부른다", () => {
    expect(pages.map((p) => p.file).filter((f) => basename(f) !== "page.tsx")).toEqual([]);
    expect(all.find((p) => p.file === MISSING[1])?.src.replace(/\s+/g, " ").trim()).toBe('import { notFound } from "next/navigation"; export default function Missing() { notFound(); }');
  });

  it("모든 페이지가 자기 화면 이름으로 kelGate, kelMetadata를 부르고 동적으로 렌더링된다", () => {
    for (const { file, src } of pages) {
      const screen = screenOf(file);
      expect(screen, file).toBeDefined();
      expect(src, file).toContain(`kelGate("${screen}")`);
      expect(src, file).toContain(`kelMetadata("${screen}")`);
      expect(src, file).toContain('export const dynamic = "force-dynamic"');
    }
    expect([...new Set(pages.map((p) => screenOf(p.file)))].sort()).toEqual(Object.keys(KEL_SCREENS).sort());
  });
});
