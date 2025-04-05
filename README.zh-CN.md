[English](README.md) | [中文](README.zh-CN.md)

# rehype-smart-links

一个Astro的rehype插件，为内部和外部链接添加不同的样式：

- 内部链接（指向存在的页面）：默认样式，使用可自定义的class
- 内部链接（指向不存在的页面）：红色样式，使用可自定义的class（类似Wikipedia的断开链接）
- 外部链接：添加"↗"图标（或自定义内容）并设置target="\_blank"，使用可自定义的class

## 安装

```bash
# npm
npm install rehype-smart-links

# yarn
yarn add rehype-smart-links

# pnpm
pnpm add rehype-smart-links
```

## 使用方法

### 基本配置

将插件添加到Astro配置中：

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import rehypeSmartLinks from "rehype-smart-links";

export default defineConfig({
  markdown: {
    rehypePlugins: [
      // 基本用法（默认设置）
      rehypeSmartLinks,

      // 或使用自定义选项
      [
        rehypeSmartLinks,
        {
          content: { type: "text", value: "↗" },
          internalLinkClass: "internal-link",
          externalLinkClass: "external-link",
          brokenLinkClass: "broken-link",
          contentClass: "external-icon",
          target: "_blank",
          rel: "noopener noreferrer",
          publicDir: "./dist",
          routesFile: "./.smart-links-routes.json",
          includeFileExtensions: ["html", "pdf", "zip"], // 只包含特定文件类型
          includeAllFiles: false // 设置为true可包含所有文件类型
        }
      ]
    ]
  }
});
```

### 两阶段构建过程（推荐）

为了准确检测哪些链接是有效的内部链接，推荐使用两阶段构建过程：

#### 方法1：使用内置CLI命令（推荐）

rehype-smart-links提供了一个内置CLI命令，可以简化路由文件生成过程：

1. 在你的`package.json`中添加构建脚本：

```json
{
  "scripts": {
    "build:with-routes": "astro build && rehype-smart-links build && astro build"
  }
}
```

2. 运行脚本来执行两阶段构建：

```bash
npm run build:with-routes
```

这个命令会：

1. 首先构建你的站点
2. 使用`rehype-smart-links build`命令扫描构建输出并生成路由文件
3. 再次构建站点，这次使用生成的路由信息

CLI命令支持以下选项：

```
选项：
  -d, --dir <path>        构建目录路径 (默认: "./dist")
  -o, --output <path>     路由文件的输出路径 (默认: "./.smart-links-routes.json")
  -a, --all               包含所有文件类型 (默认: false)
  -e, --extensions <ext>  要包含的文件扩展名 (默认: ["html"])
  -h, --help              显示帮助信息
```

#### 方法2：使用API函数

你也可以编写自定义构建脚本：

1. 首先生成站点并创建路由映射文件：

```js
// 在你的构建脚本中
import { generateRoutesFile } from "rehype-smart-links";

// 先执行一个初步构建
await build();

// 然后从构建输出目录生成路由文件
generateRoutesFile("./dist", "./.smart-links-routes.json", {
  includeAllFiles: true, // 包含所有文件类型
  // 或者只包含特定文件类型
  includeFileExtensions: ["html", "pdf", "zip"]
});

// 最后再执行最终构建
await build();
```

2. 在你的`package.json`中添加构建脚本：

```json
{
  "scripts": {
    "build": "node ./scripts/build-with-routes.js"
  }
}
```

3. 创建构建脚本（例如`scripts/build-with-routes.js`）：

```js
import { execSync } from "node:child_process";
import { generateRoutesFile } from "rehype-smart-links";

// 第一阶段：初步构建
console.log("[PHASE 1] Initial build...");
execSync("astro build", { stdio: "inherit" });

// 生成路由映射文件
console.log("[PHASE 2] Generating routes map...");
generateRoutesFile("./dist", "./.smart-links-routes.json", {
  includeAllFiles: true // 包含所有文件类型
});

// 第二阶段：带着路由信息再次构建
console.log("[PHASE 3] Final build with routes...");
execSync("astro build", { stdio: "inherit" });

console.log("[SUCCESS] Build complete!");
```

## 自定义链接结构

除了添加类名外，你还可以完全自定义链接的HTML结构：

```js
import rehypeSmartLinks from "rehype-smart-links";

export default defineConfig({
  markdown: {
    rehypePlugins: [
      [
        rehypeSmartLinks,
        {
          wrapperTemplate: (node, type, className) => {
            // 创建工具提示包装器
            if (type === "external") {
              // 外部链接结构示例
              const tooltip = {
                type: "element",
                tagName: "div",
                properties: {
                  className: ["tooltip"],
                  dataTooltip: "这是一个外部链接"
                },
                children: [node]
              };

              // 也可以修改原始节点
              if (className) {
                node.properties.className
                  = [...(node.properties.className || []), className];
              }

              return tooltip;
            }
            else if (type === "broken") {
              // 断开链接结构示例
              const wrapper = {
                type: "element",
                tagName: "span",
                properties: {
                  className: ["broken-link-wrapper"],
                  dataError: "页面不存在"
                },
                children: [node]
              };

              // 添加警告图标
              node.children.push({
                type: "element",
                tagName: "span",
                properties: { className: ["warning-icon"] },
                children: [{ type: "text", value: "⚠" }]
              });

              return wrapper;
            }

            // 仅为内部链接添加类名
            if (className) {
              node.properties.className
                = [...(node.properties.className || []), className];
            }

            return node;
          }
        }
      ]
    ]
  }
});
```

这种方法允许你为不同类型的链接创建完全不同的HTML结构，而不仅仅是添加类名，非常适合与组件库（如DaisyUI、TailwindCSS）一起使用。

## 样式

为不同的链接类型添加CSS样式：

```css
/* 内部链接的默认样式 */
.internal-link {
  /* 自定义样式 */
}

/* 带有图标的外部链接 */
.external-link {
  /* 自定义样式 */
}
.external-link .external-icon {
  margin-left: 0.25em;
  font-size: 0.75em;
}

/* 断开链接的样式（类似Wikipedia） */
.broken-link {
  color: red;
}
```

## 选项

| 选项                          | 类型                                 | 默认值                          | 描述                            |
| ----------------------------- | ------------------------------------ | ------------------------------- | ------------------------------- |
| `content`                     | `{ type: string, value: string }`    | `{ type: 'text', value: '↗' }` | 添加到外部链接后的内容          |
| `internalLinkClass`           | `string`                             | `'internal-link'`               | 指向存在页面的内部链接的class   |
| `externalLinkClass`           | `string`                             | `'external-link'`               | 外部链接的class                 |
| `brokenLinkClass`             | `string`                             | `'broken-link'`                 | 指向不存在页面的断开链接的class |
| `contentClass`                | `string`                             | `'external-icon'`               | 添加到外部链接的内容元素的class |
| `target`                      | `string`                             | `'_blank'`                      | 外部链接的target属性            |
| `rel`                         | `string`                             | `'noopener noreferrer'`         | 外部链接的rel属性               |
| `publicDir`                   | `string`                             | `'./dist'`                      | 构建输出目录的路径              |
| `routesFile`                  | `string`                             | `'./.smart-links-routes.json'`  | 路由映射文件的路径              |
| `includeFileExtensions`       | `string[]`                           | `['html']`                      | 要包含的文件扩展名列表          |
| `includeAllFiles`             | `boolean`                            | `false`                         | 设置为true时包含所有文件类型    |
| `wrapperTemplate`             | `(node, type, className) => Element` | `undefined`                     | 自定义链接结构的模板函数        |
| `customInternalLinkTransform` | `(node) => void`                     | `undefined`                     | 自定义转换内部链接的函数        |
| `customExternalLinkTransform` | `(node) => void`                     | `undefined`                     | 自定义转换外部链接的函数        |
| `customBrokenLinkTransform`   | `(node) => void`                     | `undefined`                     | 自定义转换断开链接的函数        |

## 高级自定义

### 使用自定义转换函数

除了 `wrapperTemplate`，你还可以使用单独的转换函数进行更精细的控制：

```js
import rehypeSmartLinks from "rehype-smart-links";

// 外部链接的自定义转换函数示例
function customExternalLinkTransform(node) {
  // 添加自定义图标或结构
  node.properties.class = [...(node.properties.class || []), "my-external-link"];
  node.properties.target = "_blank";
  node.properties.rel = "noopener";

  // 添加自定义SVG图标
  const svgIcon = {
    type: "element",
    tagName: "span",
    properties: { class: "custom-icon" },
    children: [{ type: "text", value: "🔗" }]
  };

  node.children.push(svgIcon);
}

export default {
  markdown: {
    rehypePlugins: [
      [
        rehypeSmartLinks,
        {
          customExternalLinkTransform
        }
      ]
    ]
  }
};
```

### 与TailwindCSS结合使用

```js
// 使用TailwindCSS类名的示例
const tailwindWrapper = (node, type, className) => {
  // 保存原始链接内容
  const linkChildren = [...node.children];

  // 清空原始链接内容
  node.children = [];

  if (type === "external") {
    // 为外部链接添加Tailwind类名
    node.properties.className = ["text-blue-500", "hover:text-blue-700", "inline-flex", "items-center", "gap-1"];

    // 添加原始内容
    node.children = [
      ...linkChildren,
      {
        type: "element",
        tagName: "svg",
        properties: {
          className: ["w-4", "h-4"],
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor"
        },
        children: [{
          type: "element",
          tagName: "path",
          properties: {
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeWidth: "2",
            d: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          },
          children: []
        }]
      }
    ];

    return node;
  }
  else if (type === "broken") {
    // 创建断开链接包装器
    const wrapper = {
      type: "element",
      tagName: "span",
      properties: {
        className: ["group", "relative", "inline-block"]
      },
      children: [
        {
          ...node,
          properties: {
            ...node.properties,
            className: ["text-red-500", "underline", "underline-offset-2", "decoration-wavy", "decoration-red-500"]
          },
          children: linkChildren
        },
        {
          type: "element",
          tagName: "span",
          properties: {
            className: ["invisible", "group-hover:visible", "absolute", "bottom-full", "left-1/2", "-translate-x-1/2", "bg-red-100", "text-red-800", "text-xs", "px-2", "py-1", "rounded", "whitespace-nowrap"]
          },
          children: [{ type: "text", value: "页面不存在" }]
        }
      ]
    };

    return wrapper;
  }
  else {
    // 为内部链接添加Tailwind类名
    node.properties.className = ["text-green-600", "hover:text-green-800", "transition-colors"];
    node.children = linkChildren;
    return node;
  }
};
```

## 测试

该插件包含一个全面的测试套件，以确保功能按预期工作。

### 运行测试

```bash
# 首先安装依赖
npm install

# 运行测试
npm test
```

### 添加测试用例

如果你遇到问题或想添加新的测试用例：

1. 按照现有模式向 `tests/cases/testCases.ts` 添加新的测试用例。

2. 运行测试以验证你的测试用例：

```bash
npm test
```

3. 测试报告将生成在 `tests/results/report.html`，其中包含预期输出和实际输出的可视化比较。

### 报告问题

如果你发现bug或有功能请求，请[提交issue](https://github.com/yourusername/rehype-smart-links/issues)，并包含：

1. 问题的清晰描述
2. 复现步骤（最好是一个失败的测试用例）
3. 预期行为与实际行为的比较
4. rehype-smart-links和你的环境的版本信息

欢迎提交Pull Request！
