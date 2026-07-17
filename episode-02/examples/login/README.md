# Login Token 示例

`auth.ts` 故意保留了一个用于 Episode 02 演示的时间单位 Bug：

- `issuedAtSeconds` 和 `TOKEN_TTL_SECONDS` 使用秒；
- `Date.now()` 使用毫秒；
- 毫秒与秒直接比较，导致 Token 被错误判断为过期。

Episode 02 的 ReadTool 只读取并分析这个文件，不会修改它。Episode 03 将使用 EditTool 和 Diff 修复问题。
