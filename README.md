# Power Profiler 应用

Power Profiler 应用是一个用于与 [Power Profiler Kit II (PPK2)](https://www.nordicsemi.com/Software-and-tools/Development-Tools/Power-Profiler-Kit-2) 通信的工具，这是一个经济实惠且灵活的工具，用于获取设计的实时电流测量数据。

PPK 可以测量连接的 Nordic 开发套件或任何外部板的电流消耗。它为用户应用程序提供了详细的电流分布图。

![screenshot](resources/screenshot.png)

## 多设备模式功能

PPK2多设备模式允许同时连接和监控多个PPK2设备，实现多设备功耗的并行测量和分析。这个功能特别适合需要同时监测多个设备功耗的场景，如多设备对比测试、系统级功耗分析等。

### 主要特性
- 支持同时连接最多3个PPK2设备
- 支持多种测量模式：数据记录器、示波器和多设备模式
- 设备间数据同步和对比分析
- 直观的多设备管理界面
- 实时数据可视化和分析

### 开发进度

| 状态 | 功能 | 说明 | 完成度 |
|------|------|------|--------|
| ✅ 已完成 | 多设备基础框架 | 实现多设备管理核心功能 | 100% |
| ✅ 已完成 | 设备选择器 | 支持多设备选择和切换 | 100% |
| ✅ 已完成 | 数据采集 | 支持多设备并行数据采集 | 100% |
| ✅ 已完成 | 设备状态管理 | 实时监控设备连接和运行状态 | 100% |
| ✅ 已完成 | 基本数据可视化 | 支持多设备数据实时显示 | 100% |
| 🔄 开发中 | 数据同步优化 | 优化多设备数据采集同步机制 | 80% |
| 🔄 开发中 | 采样参数配置 | 支持每个设备独立配置采样参数 | 60% |
| 🔄 开发中 | 固件版本检查 | 自动检查设备固件版本兼容性 | 40% |
| 🔄 开发中 | 错误处理机制 | 完善设备异常处理和恢复机制 | 30% |
| 📅 计划中 | 数据导出功能 | 支持多设备数据批量导出 | 0% |
| 📅 计划中 | 高级分析工具 | 提供更多数据分析功能 | 0% |
| 📅 计划中 | 配置模板 | 支持设备配置保存和加载 | 0% |
| 📅 计划中 | 批量管理 | 支持多设备批量操作 | 0% |
| 📅 计划中 | 远程监控 | 支持远程设备监控功能 | 0% |

### 系统要求
- Windows 10或更高版本
- 至少4GB RAM
- 500MB可用磁盘空间
- USB 3.0端口（推荐）

## 安装说明

Power Profiler 应用通过 nRF Connect for Desktop 安装。详细的安装步骤，请参阅 nRF Connect for Desktop 文档中的 [安装 nRF Connect for Desktop 应用](https://docs.nordicsemi.com/bundle/nrf-connect-desktop/page/installing_apps.html)。

## 文档

阅读 [Power Profiler 应用](https://docs.nordicsemi.com/bundle/nrf-connect-ppk/page/index.html) 官方文档，了解其用户界面和功能。

（该文档适用于 PPK2。如果您使用的是第一版硬件，请参阅 [PPK1 在线文档](https://docs.nordicsemi.com/bundle/ug_ppk/page/UG/ppk/PPK_user_guide_Intro.html)）。

## 使用提示

### 多设备操作
- 建议先连接所有设备，再开始测量
- 确保所有设备固件版本一致
- 注意检查设备连接状态
- 合理设置采样参数，避免系统资源占用过高

### 常见问题
- 设备连接：确保使用原装USB线缆，检查USB端口
- 数据采集：检查设备固件版本，确认采样参数设置
- 性能优化：关闭不必要的后台程序，调整采样频率

## 开发

### 应用下载
1. 从 [nRF Connect for Desktop](https://www.nordicsemi.com/Software-and-tools/Development-Tools/nRF-Connect-for-desktop/Download) 下载最新版本
2. 安装完成后，在应用商店中搜索并安装 Power Profiler 应用
3. 首次运行时，应用会自动检查并安装必要的依赖

### 本地开发环境搭建
1. 系统要求
   - Node.js 16.x 或更高版本
   - npm 8.x 或更高版本
   - Git

2. 获取源代码
   ! 必须进入 `.nrfconnect-apps\local` 目录，对于 Windows 用户一般在 C 盘用户根目录下；
   ```bash
   git clone https://github.com/Freedyool/pc-nrfconnect-ppk.git
   cd pc-nrfconnect-ppk
   checkout -b dev_multi_mode
   ```

3. 安装依赖
   ```bash
   npm ci
   ```

4. 开发模式运行
   ```bash
   npm run watch
   ```

5. 构建应用
   ```bash
   npm run build
   ```

### 开发指南
- 遵循 [nRF Connect for Desktop 应用开发指南](https://nordicsemiconductor.github.io/pc-nrfconnect-docs/)
- 使用 TypeScript 进行开发
- 遵循项目的代码风格指南
- 提交代码前运行测试套件

### 调试工具
- 使用 Chrome DevTools 进行调试
- 查看应用日志了解运行状态
- 使用 nRF Connect for Desktop 的开发者工具

### 发布你的应用（分享给其它用户）
```bash
npm pack
```
然后将生成的 pc-nrfconnect-ppk-xxx.tgz 文件发送给用户，用户将压缩包拖入 nrfConnect 即可；

### 反馈

如果您在使用过程中遇到问题或有改进建议，欢迎通过以下方式反馈：

1. **软件问题**
   - 在 GitHub 仓库提交 Issue
   - 提供问题描述和复现步骤
   - 标注软件版本号

2. **硬件问题**
   - 在 [DevZone](https://devzone.nordicsemi.com) 提交问题
   - 提供设备型号和固件版本
   - 描述问题现象

3. **技术支持**
   - 邮件：support@nordicsemi.com
   - 工作时间：周一至周五 9:00-17:00

## 贡献

有关贡献的详细信息，请参阅 [贡献指南](https://nordicsemiconductor.github.io/pc-nrfconnect-docs/contributing)。

## 许可证

详情请参阅 [LICENSE](LICENSE) 文件。
