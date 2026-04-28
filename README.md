# 鱼老师文件恢复助手

一个面向 Windows 的文件恢复工具原型，当前包含：

- 快速扫描
- 深度扫描
- 恢复目录选择
- 结果筛选与恢复
- 桌面安装包构建链路

## 项目结构

- `desktop/`
  Electron 桌面壳
- `runtime/minimal-web/`
  本地 Web UI 与后端服务
- `scripts/`
  打包与图标生成脚本
- `build/icons/`
  安装包和程序图标资源
- `docs/`
  使用说明与发布准备文档
- `tools/`
  第三方恢复工具说明

## 当前开源策略

当前仓库建议先公开源码，不默认附带第三方恢复工具二进制。

默认不包含：

- `node_modules/`
- `dist/`
- 运行日志
- 恢复结果
- 外部压缩备份
- 第三方恢复工具二进制

这样做的目的：

- 保持仓库干净
- 减少仓库体积
- 降低第三方二进制再分发的不确定性

## 第三方工具说明

本项目会调用这些外部工具：

- TestDisk / PhotoRec
- The Sleuth Kit (TSK)
- Windows File Recovery（可选）

本开源准备目录默认不附带这些二进制文件。请查看：

- `THIRD_PARTY_NOTICES.md`
- `tools/README.md`

## 许可证计划

当前计划采用：

- `GNU General Public License v2.0 or later`

正式公开前，建议再做一轮人工许可复核。

## 上传前还需要确认的事

1. 确认鱼 logo 可以公开发布
2. 确认是否只发布源码，还是源码加安装包
3. 如果要发布安装包，确认发布说明里写清楚第三方工具依赖
4. 如果后续要附带第三方工具二进制，再做一轮许可审查

## 构建方式

当前桌面打包基于：

- Electron
- electron-builder

主要脚本：

- `scripts/Generate-IconAssets.ps1`
- `scripts/Build-Setup.ps1`

## 使用说明

详见：

- `docs/鱼老师文件恢复助手-使用说明.md`
