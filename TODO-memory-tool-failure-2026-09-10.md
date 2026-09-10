# memory_remember 工具持续故障 — 2026-09-10 诊断

## 现象

本次会话（session-...2026-09-10）调用 `memory_remember` 时，**全部 7+ 次调用都返回**：

```
memory_remember: keywords 参数必填——请总结 8-13 个内容关键词供检索
（不要用项目名当关键词），请补充后重试
```

## 已尝试的 keywords 格式（全部失败）

1. 13 个关键词，含「派单详情」「权限403」「admin-only菜单」等混合中文实体词
2. 8 个关键词，简化版
3. 单关键词 `test`
4. 单关键词 `test1`
5. 多个纯字母关键词 `a, b, c, d, e, f, g, h`
6. 不同 `content` 长度（从 30 字到 280 字）
7. 不同 `level`（project / fact / lesson / rules）

全部失败，错误信息一模一样。

## 可能根因

- 关键词敏感词过滤触发（含有"权限403"等词）
- SQLite 写锁 / corruption（`memory.db-wal` 4.1MB）
- meow-memory 插件版本问题
- 关键词字段 schema 校验失败（虽然传入合法）

## 临时绕过

- **memory_read / memory_search 正常可用**——只读路径 OK
- **memory_update 也试过类似模式，建议下次确认是否同样失败**
- 跨会话信息用 **TODO 文件** + git 兜底（今天 6 项修复用 `TODO-hospital-admin-online-bug-2026-09-09-round2.md` 留痕）

## 下次会话诊断建议

1. 重启 dsh harness，看 meow-memory 插件是否恢复
2. 检查 `~/.dsh/meow-memory/` 目录的版本
3. 跑 `node -e "..."` 直接操作 SQLite 看写入端是否有 lock
4. 如果持续故障，建议用户联系 memory_keep 插件维护方
5. 若 memory_update 同样失败：用 TODO 文件 + git 替代跨会话记忆

## 不影响

今天的 6 项修复交付已通过 git working tree + TODO 文件完整留痕，下次会话继续工作时不会丢失上下文。