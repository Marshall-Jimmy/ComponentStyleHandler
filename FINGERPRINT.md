# 项目指纹 · StyleHandler

| 项目 | 值 |
| --- | --- |
| 项目名称 | ComponentStyleHandler (StyleHandler) |
| 仓库地址 | https://github.com/Marshall-Jimmy/ComponentStyleHandler |
| 默认分支 | main |
| 可见性 | PUBLIC |
| 提交标识 (Commit SHA) | `92e7dd59e81d3e394e398ecd31f8be24b080efc7` |
| 跟踪文件数 | 49 |
| 聚合指纹 (SHA-256) | `953585890447b9d9a7ab77670d0a65fa0d1c9f748a8dc46d29a12ac4ee631f3a` |
| 生成时间 | 2026-08-27 |

## 说明

- **提交标识 (Commit SHA)**：Git 提交的唯一标识，可精确定位本次交付的完整代码快照。
- **聚合指纹 (SHA-256)**：对全部 49 个 Git 跟踪文件内容按排序拼接后计算的 SHA-256 校验和，用于验证项目文件完整性，防止篡改。
- **验算方式**：在项目根目录执行 `git ls-files` 获取全部跟踪文件，按文件名排序后拼接内容并计算 SHA-256。

```powershell
# 重新验算聚合指纹
$h = [System.Security.Cryptography.SHA256]::Create()
foreach ($f in (git ls-files | Sort-Object)) {
  $bytes = [System.IO.File]::ReadAllBytes($f)
  $null = $h.TransformBlock($bytes, 0, $bytes.Length, $null, 0)
  $null = $h.TransformBlock([System.Text.Encoding]::UTF8.GetBytes("`n"), 0, 1, $null, 0)
}
$null = $h.TransformFinalBlock([byte[]]::new(0), 0, 0)
($h.Hash | ForEach-Object { $_.ToString('x2') }) -join ''
```
