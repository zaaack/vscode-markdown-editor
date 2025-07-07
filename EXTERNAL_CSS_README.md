# 外部CSS支持功能

这个功能允许你在markdown编辑器中加载外部CSS文件，支持多种路径类型。

## 配置选项

### `markdown-editor.externalCssFiles`

- **类型**: `string[]`
- **默认值**: `[]`
- **描述**: 要加载到markdown编辑器中的外部CSS文件路径或URL数组

支持的路径类型：

1. **HTTP/HTTPS URLs**: `https://example.com/style.css`
2. **绝对路径**: `/Users/username/styles/custom.css`
3. **相对路径**:
   - 相对于markdown文件: `./styles/custom.css`
   - 相对于工作区根目录: `assets/styles/theme.css`

### `markdown-editor.cssLoadOrder`

- **类型**: `string`
- **可选值**: `"external-first"` | `"custom-first"`
- **默认值**: `"external-first"`
- **描述**: CSS加载顺序
  - `external-first`: 先加载外部CSS文件，后加载自定义CSS
  - `custom-first`: 先加载自定义CSS，后加载外部CSS文件

### `markdown-editor.customCss`

- **类型**: `string`
- **默认值**: `""`
- **描述**: 内联CSS样式（保持兼容原有功能）

## 使用示例

### 1. 在VS Code设置中配置

```json
{
  "markdown-editor.externalCssFiles": [
    "https://cdn.jsdelivr.net/npm/github-markdown-css@4.0.0/github-markdown.css",
    "./styles/custom.css",
    "/Users/username/Documents/markdown-themes/dark-theme.css"
  ],
  "markdown-editor.cssLoadOrder": "external-first",
  "markdown-editor.customCss": "body { font-family: 'Monaco', monospace; }"
}
```

### 2. 使用工作区设置

在项目根目录创建 `.vscode/settings.json`:

```json
{
  "markdown-editor.externalCssFiles": [
    "./assets/markdown-theme.css",
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"
  ]
}
```

### 3. 示例CSS文件

项目中包含了一个示例CSS文件 `example-styles.css`，你可以这样使用：

```json
{
  "markdown-editor.externalCssFiles": [
    "./example-styles.css"
  ]
}
```

## 功能特点

- ✅ 支持HTTP/HTTPS网络CSS资源
- ✅ 支持本地文件路径（绝对和相对）
- ✅ 智能路径解析（相对于markdown文件或工作区）
- ✅ 配置热重载（修改配置后自动应用）
- ✅ 错误处理和日志
- ✅ 与现有customCss功能兼容
- ✅ 可配置CSS加载顺序

## 注意事项

1. **安全性**: 当使用外部URL时，确保来源可信
2. **性能**: 过多的外部CSS文件可能影响编辑器加载速度
3. **缓存**: 外部CSS文件会被浏览器缓存，可能需要刷新编辑器查看更新
4. **路径解析**: 相对路径优先相对于markdown文件，如果文件不存在则相对于工作区根目录

## 故障排除

1. **CSS不生效**: 检查文件路径是否正确，查看开发者控制台的错误信息
2. **网络CSS加载失败**: 检查网络连接和URL是否有效
3. **样式被覆盖**: 尝试使用 `!important` 或调整CSS加载顺序
