#!/usr/bin/env bash
# 把证书正文一起写进 fc3-domain 模板并部署（幂等：首次创建，后续更新）。
#
# 为什么不用 templates/domain.yaml 直接部署：
#   2026-10-30 实测，fc3-domain 只接受 certName 时会报
#     certConfig must contain certName, certificate and privateKey simultaneously
#   也就是说"只给 CAS 引用（cret-<id>）"这条路走不通——CI 里每日续签成功、
#   却在绑定这一步失败，HTTPS 因此过期了 12 天。本脚本改成本地读 PEM，
#   把 certificate / privateKey 一并提交，不再依赖 CAS。
#
# 用法：
#   deploy-domain.sh <domain> <region> <functionName> <certFile> <keyFile> [certName] [accessAlias]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

DOMAIN="${1:?usage: deploy-domain.sh <domain> <region> <functionName> <certFile> <keyFile> [certName] [accessAlias]}"
REGION="${2:?missing region}"
FUNCTION_NAME="${3:?missing functionName}"
CERT_FILE="${4:?missing certFile}"
KEY_FILE="${5:?missing keyFile}"
CERT_NAME="${6:-${DOMAIN}-$(date -u +%Y%m%d)}"
ACCESS_ALIAS="${7:-enterprise}"

for f in "$CERT_FILE" "$KEY_FILE"; do
  [ -f "$f" ] || { echo "❌ 证书文件不存在: $f" >&2; exit 1; }
done
command -v s >/dev/null 2>&1 || { echo "❌ 未找到 s（npm i -g @serverless-devs/s）" >&2; exit 1; }

OUT_DIR="$FC_DIR/.build"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/domain.generated.yaml"

indent() { sed 's/^/          /'; }

{
  echo "edition: 3.0.0"
  echo "name: iximei-crm-domain"
  echo "access: ${ACCESS_ALIAS}"
  echo "resources:"
  echo "  iximei_crm_domain:"
  echo "    component: fc3-domain"
  echo "    props:"
  echo "      region: ${REGION}"
  echo "      domainName: ${DOMAIN}"
  echo "      protocol: HTTPS"
  echo "      certConfig:"
  echo "        certName: ${CERT_NAME}"
  echo "        certificate: |"
  indent < "$CERT_FILE"
  echo "        privateKey: |"
  indent < "$KEY_FILE"
  echo "      routeConfig:"
  echo "        routes:"
  echo "          - path: /"
  echo "            functionName: ${FUNCTION_NAME}"
  echo "            methods:"
  echo "              - GET"
  echo "              - HEAD"
  echo "          - path: /*"
  echo "            functionName: ${FUNCTION_NAME}"
} > "$OUT"

echo ">>> 生成域名模板: $OUT (cert=$CERT_FILE key=$KEY_FILE certName=$CERT_NAME)"
s deploy -y -t "$OUT" -a "$ACCESS_ALIAS"
