# 测试外部CSS功能

这个文件用来测试新增的外部CSS加载功能。

## 如何测试

1. 打开VS Code设置（`Cmd+,` 或 `Ctrl+,`）
2. 搜索 `markdown-editor`
3. 配置以下设置：

```json
{
  "markdown-editor.externalCssFiles": [
    "./example-styles.css"
  ],
  "markdown-editor.cssLoadOrder": "external-first"
}
```

4. 保存设置
5. 用markdown编辑器打开这个文件，应该看到梦幻的渐变背景和金色标题

## 功能演示

### 标题样式

# 一级标题

## 二级标题

### 三级标题

### 代码块样式

```javascript
function testExternalCSS() {
    console.log('外部CSS已生效！');
    return true;
}
```

### 内联代码

这是一个 `内联代码` 示例。

### 链接样式

[这是一个测试链接](https://github.com)

### 表格样式

| 功能 | 状态 | 说明 |
|------|------|------|
| HTTP/HTTPS URL | ✅ | 支持网络CSS资源 |
| 本地文件路径 | ✅ | 支持绝对和相对路径 |
| 配置热重载 | ✅ | 修改配置自动生效 |

### 引用块样式
>
> 这是一个引用块，用来测试外部CSS的引用块样式。
> 应该有金色的左边框和半透明背景。

### 列表样式

- 第一项
- 第二项
- 第三项

1. 有序列表项1
2. 有序列表项2
3. 有序列表项3

## 多种CSS配置示例

### 使用网络CSS资源

```json
{
  "markdown-editor.externalCssFiles": [
    "https://cdn.jsdelivr.net/npm/github-markdown-css@4.0.0/github-markdown.css"
  ]
}
```

### 使用多个CSS文件

```json
{
  "markdown-editor.externalCssFiles": [
    "./styles/base.css",
    "./styles/theme.css", 
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap"
  ]
}
```

### 自定义CSS优先级

```json
{
  "markdown-editor.cssLoadOrder": "custom-first",
  "markdown-editor.customCss": "h1 { color: red !important; }",
  "markdown-editor.externalCssFiles": ["./theme.css"]
}
```

保存这个文件后，试试修改VS Code设置中的CSS配置，编辑器应该会自动应用新的样式！
