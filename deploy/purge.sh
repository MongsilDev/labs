#!/usr/bin/env bash
# labs.mongsil.dev의 Cloudflare 캐시를 호스트 단위로 비운다. 배포 뒤와 KEL 자료를 바꾼 뒤에 실행
# 토큰은 bori.wiki 퍼지용 계정 토큰. 서버 비밀 파일에서 읽고 출력 안 함
set -uo pipefail

ZONE="d439e5edb4aa419a297d331c734eb29a"
TOKEN_FILE="${CF_PURGE_TOKEN_FILE:-$HOME/docker/mediawiki/LocalSettings.secrets.php}"
token="$(grep -oE 'cfat_[A-Za-z0-9]+' "$TOKEN_FILE" 2>/dev/null | head -1 || true)"
if [ -z "$token" ]; then
  echo "  토큰이 없어 건너뜀. 대시보드에서 labs.mongsil.dev 캐시를 비워 주세요" >&2
  exit 1
fi
if curl -s -X POST -H "Authorization: Bearer $token" -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/zones/$ZONE/purge_cache" -d '{"hosts":["labs.mongsil.dev"]}' | grep -q '"success":true'; then
  echo "  labs.mongsil.dev 캐시를 비움"
else
  echo "  캐시 비우기 실패. 대시보드에서 비워 주세요" >&2
  exit 1
fi
