#!/usr/bin/env python3
"""
静态校验：yishan-crm-cd-fc.yml 必须满足的证书 / 域名绑定 invariant。

跑 RED/GREEN：先跑确认失败，改完 workflow 后再跑确认通过。

Invariant 列表：
  1. workflow 有 schedule 触发（自动续签）
  2. workflow 包含 acme.sh / aic 签发步骤（证书流程）
  3. workflow 包含 aic aliyun-cert:upload（CAS 上传）
  4. workflow 包含 s deploy domain.yaml（域名绑定）
  5. s deploy step 必须 export CAS_CERT_NAME=cret-${CERT_ID}（用 cret- 前缀）
  6. workflow 不应再直接调 aliyun fc UpdateCustomDomain（首次部署会失败）
  7. workflow 应包含 post-deploy cert verify step
  8. domain.yaml 模板的 certConfig.certName 必须用 ${env(CAS_CERT_NAME)}
  9. domain.yaml 不应再用 ${file(../certs/...)} 引用文件（CRM 走 CAS）
"""
import re
import sys
from pathlib import Path
import yaml

REPO = Path(__file__).resolve().parent.parent
WF = REPO / ".github" / "workflows" / "yishan-crm-cd-fc.yml"
DOMAIN_YAML = REPO / "apps" / "yishan-api" / "deploy" / "fc3" / "templates" / "domain.yaml"


def load_domain_yaml(path: Path):
    """domain.yaml 不带 GitHub Actions 私有语法，普通 PyYAML 就能解析。"""
    if not path.exists():
        return None
    with path.open() as f:
        return yaml.safe_load(f)


def load_workflow_text(path: Path) -> str:
    if not path.exists():
        return None
    return path.read_text()


def extract_s_deploy_step_block(text: str) -> str | None:
    """从 workflow 文本里抠出含 `s deploy` 且含 `domain.yaml` 的 step 块。
    简单起见用启发式：以 `- name:` 切 step，找包含两个关键字的。"""
    lines = text.splitlines()
    blocks: list[list[str]] = []
    cur: list[str] = []
    # step 可能在 `steps:` 下缩进，例如 `      - name: ...`
    # 用 `\s*- name:` 兼容任意缩进（也包括顶层）
    step_starts = re.compile(r"^\s*- name:")
    for line in lines:
        if step_starts.match(line):
            if cur:
                blocks.append(cur)
            cur = [line]
        elif cur:
            cur.append(line)
    if cur:
        blocks.append(cur)
    for block in blocks:
        joined = "\n".join(block)
        if "s deploy" in joined and "domain.yaml" in joined:
            return joined
    return None


errors: list[str] = []

tpl = load_domain_yaml(DOMAIN_YAML)
wf_text = load_workflow_text(WF)

if wf_text is None:
    errors.append(f"[1] workflow 文件缺失: {WF.relative_to(REPO)}")
if tpl is None:
    errors.append(f"[2] domain.yaml 模板缺失: {DOMAIN_YAML.relative_to(REPO)}")

# Invariant 1: schedule
if wf_text is not None:
    # 匹配顶级 `schedule:` 配置块（允许前后空行/注释）
    has_schedule = bool(
        re.search(r"^\s*schedule:\s*(#.*)?$", wf_text, re.MULTILINE)
        and re.search(r"cron:\s*['\"]", wf_text)
    )
    if not has_schedule:
        errors.append("[3] workflow 缺少 schedule 触发（自动续签）")

    # Invariant 2: 证书签发
    if "aic cert:issue" not in wf_text and "acme.sh" not in wf_text:
        errors.append("[4] workflow 缺证书签发步骤（aic cert:issue 或 acme.sh）")

    # Invariant 3: CAS 上传
    if "aliyun-cert:upload" not in wf_text:
        errors.append("[5] workflow 缺 aic aliyun-cert:upload 步骤（CAS 上传）")

    # Invariant 4 + 5: s deploy domain.yaml + CAS_CERT_NAME env
    deploy_step = extract_s_deploy_step_block(wf_text)
    if deploy_step is None:
        errors.append("[6] workflow 缺 s deploy domain.yaml 步骤（域名绑定）")
    else:
        if "CAS_CERT_NAME" not in deploy_step:
            errors.append(
                "[7] s deploy domain.yaml 步骤未注入 CAS_CERT_NAME env "
                "(应当 export CAS_CERT_NAME=cret-${CERT_ID})"
            )
        if "cret-" not in deploy_step:
            errors.append(
                "[8] s deploy domain.yaml 步骤未拼接 cret- 前缀"
            )

    # Invariant 6: 不应再有 aliyun fc UpdateCustomDomain（首次部署会失败）
    if "aliyun fc UpdateCustomDomain" in wf_text:
        errors.append(
            "[9] workflow 仍含 aliyun fc UpdateCustomDomain（首次部署会失败，"
            "应删除改由 s deploy 负责）"
        )

    # Invariant 6b: environment 必须用 YISHAN_API（统一管理，
    # 避免空 YISHAN_CRM environment 重复建）
    has_yishan_api_env = bool(
        re.search(r"^\s*environment:\s*['\"]?YISHAN_API['\"]?\s*(#.*)?$",
                  wf_text, re.MULTILINE)
    )
    if not has_yishan_api_env:
        errors.append(
            "[9b] workflow 应在 YISHAN_API environment 下跑"
            "（统一管理，不另起 YISHAN_CRM environment）"
        )

    # Invariant 7: post-deploy cert verify
    if "openssl" not in wf_text or "s_client" not in wf_text:
        errors.append("[10] workflow 缺 post-deploy cert verify step（openssl s_client）")

# Invariant 8 + 9: domain.yaml 模板结构
if tpl is not None:
    cert_config = (
        tpl.get("resources", {}).get("yishan_domain", {}).get("props", {}).get("certConfig", {})
    )
    cert_name = cert_config.get("certName") if isinstance(cert_config, dict) else None
    if cert_name != "${env(CAS_CERT_NAME)}":
        errors.append(
            f"[11] domain.yaml certConfig.certName 应为 ${{env(CAS_CERT_NAME)}}，"
            f"实际: {cert_name!r}"
        )

    raw_tpl = DOMAIN_YAML.read_text()
    if re.search(r"\$\{file\([^)]*certs/", raw_tpl):
        errors.append("[12] domain.yaml 不应再用 ${file(.../certs/...)}（CRM 走 CAS 引用）")

if errors:
    print("❌ Invariants NOT satisfied:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
else:
    print("✅ All invariants satisfied")
    sys.exit(0)