# 上传说明

建议按下面顺序上传：

1. 先上传 `D:\WinRecovery_OpenSource_Prep` 这个目录作为源码仓库
2. 仓库首次公开时，优先只放源码，不附带第三方工具二进制
3. 如果后续要发安装包，建议放到 GitHub Release，而不是直接塞进源码仓库

## 首次公开建议

- 仓库内容：
  - `README.md`
  - `LICENSE`
  - `COPYRIGHT.md`
  - `THIRD_PARTY_NOTICES.md`
  - `OPEN_SOURCE_RELEASE_CHECKLIST.md`
  - `desktop/`
  - `runtime/`
  - `scripts/`
  - `build/icons/`
  - `docs/`

- 暂不建议直接公开：
  - `dist/`
  - `node_modules/`
  - 恢复结果
  - 运行日志
  - 外部压缩备份
  - 第三方恢复工具二进制

## 上传前最后检查

1. 检查 logo 是否可公开使用
2. 检查 README 是否符合你希望公开的表达
3. 检查 `COPYRIGHT.md` 是否使用最终署名
4. 检查是否存在本地私人路径、测试残留、隐私内容
5. 检查是否要在 Release 中附带安装包

## 推荐发布方式

- 源码仓库：公开源码
- Release：后续单独上传安装包

这样最稳，也最容易维护。
