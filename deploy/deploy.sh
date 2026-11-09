#!/usr/bin/env bash
# labs.mongsil.dev 배포: 커밋된 내용으로 이미지를 빌드하고 compose의 labs 서비스 컨테이너를 새 이미지로 다시 만든다
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/opt/node@24/bin:/Applications/OrbStack.app/Contents/MacOS/xbin:$PATH"

if [ -n "$(git status --porcelain)" ]; then
  echo "커밋하지 않은 변경이 있어 배포하지 않습니다. 커밋하거나 정리한 뒤 다시 실행해주세요." >&2
  git status --short >&2
  exit 1
fi

echo "==> 테스트"
pnpm test
if [ "${SKIP_UI_CHECK:-}" != 1 ]; then
  echo "==> 화면 점검"
  pnpm test:ui
fi

TAG="labs:$(date +%Y%m%d-%H%M)-$(git rev-parse --short HEAD)"
echo "==> 이미지 빌드 $TAG"
# git이 무시하는 로컬 파일도 이미지에 들어가지 않게 HEAD만 빌드 컨텍스트로 넘김
git archive HEAD | docker build -t "$TAG" -t labs:latest -

echo "==> 컨테이너 교체"
docker compose -f "$HOME/docker/compose.yaml" up -d labs

echo "==> 이전 이미지 정리"
docker images --format '{{.Repository}}:{{.Tag}}' | grep '^labs:[0-9]' | sort -r | tail -n +4 | xargs docker image rm >/dev/null || true

echo "==> 확인"
ready=0
for _ in $(seq 1 20); do
  if curl -fs -o /dev/null http://127.0.0.1:8745/api/health; then
    echo "  준비됨"
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" != 1 ]; then
  echo "  응답이 없습니다. docker logs labs로 확인해주세요." >&2
  exit 1
fi

# 엣지에 캐시된 HTML이 지난 빌드의 청크를 가리키지 않게 비움
echo "==> Cloudflare 캐시 비우기"
sh deploy/purge.sh || true
