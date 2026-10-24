import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// PowerShell 작은따옴표 문자열은 굽은 따옴표도 닫는 따옴표로 읽으므로 모두 두 번 씀
const quote = (s: string) => s.replace(/['‘’‚‛]/g, "$&$&");

// Windows PowerShell 5.1은 BOM이 없는 스크립트를 시스템 코드 페이지로 읽어 한국어가 깨짐
export function uploadScript(fill: { url: string; key: string; title: string }): string {
  const text = readFileSync(join(process.cwd(), "assets/er/labs-upload.ps1"), "utf8")
    .replace("__LABS_URL__", () => quote(fill.url))
    .replace("__LABS_KEY__", () => quote(fill.key))
    .replace("__LABS_TITLE__", () => quote(fill.title));
  return "﻿" + text.replace(/\r?\n/g, "\r\n");
}
