# Vue Data Methods Auto Gen

## 概述

**Vue Data Methods Auto Gen** 是一个强大的 VS Code 扩展，通过分析模板自动生成 Vue 组件的 `data` 和 `methods` 属性。这个工具帮助你保持代码的一致性，并通过减少定义这些属性的手动工作来加速开发过程。

## 功能

- **自动生成数据属性**：解析 Vue 模板以识别并生成适当的 `data` 属性。
- **自动生成方法**： （计划中的功能）分析模板以识别并生成组件所需的 `methods`。
- **模板分析**：支持插值、指令（`v-bind`、`v-if`、`v-for` 等）和内联样式。
- **直观的命令**：通过 VS Code 命令面板轻松生成 `data` 和 `methods`。

## 使用方法

1. **打开一个 Vue 文件**：打开你想要生成 `data` 和 `methods` 的 Vue 文件。
2. **运行命令**：按 `Ctrl+Shift+P`（Windows/Linux）或 `Cmd+Shift+P`（Mac）打开命令面板，然后输入并选择 `Generate Missing Data`。
3. **查看结果**：扩展将解析模板，并自动将生成的 `data` 和 `methods` 添加到你的 Vue 组件的脚本部分。

## 安装

### 从 VS Code Marketplace 安装

1. 打开 VS Code。
2. 在扩展视图（Ctrl+Shift+X）中搜索 `Vue Data Methods Auto Gen` 并安装。

### 手动安装

1. 克隆这个仓库：
   ```sh
   git clone https://github.com/your-username/vue-data-methods-auto-gen.git
   ```
2. 进入项目目录并安装依赖：
   ```sh
   cd vue-data-methods-auto-gen
   npm install
   ```
3. 编译扩展：
   ```sh
   npm run compile
   ```
4. 在 VS Code 中打开此项目，并按 `F5` 启动一个新的 VS Code 窗口来测试扩展。

## 贡献

我们欢迎所有形式的贡献！如果你有任何改进或新功能的建议，请随时提交问题或拉取请求。

### 提交问题

如果你在使用过程中遇到问题，请在 [GitHub Issues](https://github.com/your-username/vue-data-methods-auto-gen/issues) 页面提交详细的描述。

### 提交拉取请求

1. Fork 这个仓库。
2. 创建一个新的分支：
   ```sh
   git checkout -b feature/your-feature
   ```
3. 提交你的更改：
   ```sh
   git commit -am 'Add some feature'
   ```
4. 推送到分支：
   ```sh
   git push origin feature/your-feature
   ```
5. 创建一个新的拉取请求。

---

感谢你使用 **Vue Data Methods Auto Gen**！我们期待你的反馈和贡献。
