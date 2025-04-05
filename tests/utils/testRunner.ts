import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import rehypeParse from "rehype-parse";
import rehypeSmartLinks from "rehype-smart-links";
import { unified } from "unified";

export interface TestResult {
  id: string;
  title: string;
  status: "success" | "failure" | "error";
  config: string;
  expectedInternal: string;
  expectedExternal: string;
  expectedBroken: string;
  actualInternal?: string;
  actualExternal?: string;
  actualBroken?: string;
  error?: string;
}

/**
 * 运行测试用例
 * @param testCase 测试用例对象
 */
export async function runTest(testCase: {
  id: string;
  title: string;
  config: string;
  internalLinkHtml: string;
  externalLinkHtml: string;
  brokenLinkHtml: string;
}): Promise<TestResult> {
  // 基本测试结果
  const result: TestResult = {
    id: testCase.id,
    title: testCase.title,
    status: "error",
    config: testCase.config,
    expectedInternal: testCase.internalLinkHtml,
    expectedExternal: testCase.externalLinkHtml,
    expectedBroken: testCase.brokenLinkHtml,
  };

  try {
    // 解析配置
    const configCode = cleanConfigCode(testCase.config);
    const pluginConfig = extractPluginConfig(configCode);

    // 创建测试HTML
    const testHtml = `
      <html>
        <body>
          <div id="internal-container"><a href="/internal-link">Internal Link</a></div>
          <div id="external-container"><a href="https://example.com">External Link</a></div>
          <div id="broken-container"><a href="/broken-link">Broken Link</a></div>
        </body>
      </html>
    `;

    try {
      // 从处理后的HTML中提取链接
      // 处理 unified() 的类型问题，使用 await 等待处理完成
      const processor = unified()
        .use(rehypeParse as any)
        .use(rehypeSmartLinks, pluginConfig);

      const processedHtml = await processor.process(testHtml).then(file => String(file));
      const processedLinks = extractLinks(processedHtml);

      result.actualInternal = processedLinks.internal;
      result.actualExternal = processedLinks.external;
      result.actualBroken = processedLinks.broken;

      // 检查结果是否匹配预期
      if (
        compareHTML(result.actualInternal, result.expectedInternal)
        && compareHTML(result.actualExternal, result.expectedExternal)
        && compareHTML(result.actualBroken, result.expectedBroken)
      ) {
        result.status = "success";
      }
      else {
        result.status = "failure";
      }
    }
    catch (processingError) {
      result.status = "error";
      result.error = processingError instanceof Error
        ? processingError.message
        : String(processingError);
    }
  }
  catch (error) {
    result.status = "error";
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

/**
 * 清理配置代码
 * @param code 配置代码
 * @returns 清理后的代码
 */
function cleanConfigCode(code: string): string {
  // 从配置代码中提取实际配置对象
  return code
    .replace(/\/\/.*/g, "") // 移除注释
    .replace(/\/\*[\s\S]*?\*\//g, "") // 移除多行注释
    .trim();
}

/**
 * 从配置代码中提取插件配置
 * @param code 配置代码
 * @returns 插件配置对象
 */
function extractPluginConfig(code: string): Record<string, any> {
  try {
    // 查找 rehypeSmartLinks 配置对象
    const configMatch = code.match(/rehypeSmartLinks,\s*(\{[\s\S]*?\})/);

    if (configMatch && configMatch[1]) {
      // 尝试将配置字符串转换为对象
      // 注意：这是一个简化实现，实际上应该使用更安全的方法
      // 例如使用 babel 转换 AST
      const configStr = configMatch[1]
        .replace(/(\w+):/g, "\"$1\":") // 为属性名添加引号
        .replace(/'/g, "\""); // 将单引号替换为双引号

      try {
        return JSON.parse(configStr);
      }
      catch {
        // 如果无法解析，返回空对象
        return {};
      }
    }

    // 如果没找到配置，返回空对象
    return {};
  }
  catch {
    // 捕获错误但不输出
    return {};
  }
}

/**
 * 从HTML字符串中提取链接
 * @param html HTML字符串
 * @returns 提取的链接 {internal, external, broken}
 */
function extractLinks(html: string): { internal: string; external: string; broken: string } {
  const $ = cheerio.load(html);

  return {
    internal: $("#internal-container").html() || "",
    external: $("#external-container").html() || "",
    broken: $("#broken-container").html() || "",
  };
}

/**
 * 比较两个HTML字符串是否匹配
 * @param actual 实际HTML
 * @param expected 期望HTML
 * @returns 是否匹配
 */
function compareHTML(actual: string, expected: string): boolean {
  // 简化实现：移除所有空白字符再比较
  const normalizeHTML = (html: string) => html.replace(/\s+/g, "").trim();
  return normalizeHTML(actual) === normalizeHTML(expected);
}

/**
 * 生成HTML报告
 * @param results 测试结果数组
 * @param outputPath 输出路径
 */
export function generateHTMLReport(results: TestResult[], outputPath: string): void {
  const statusEmoji = {
    success: "✅",
    failure: "⚠️",
    error: "❎",
  };

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>rehype-smart-links Test Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2, h3 {
      margin-top: 20px;
      margin-bottom: 10px;
    }
    .test-card {
      border: 1px solid #ddd;
      border-radius: 5px;
      margin-bottom: 20px;
      overflow: hidden;
    }
    .test-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px;
      background-color: #f5f5f5;
      border-bottom: 1px solid #ddd;
    }
    .test-title {
      font-weight: bold;
      font-size: 1.2em;
      margin: 0;
    }
    .status-success { color: #2e7d32; }
    .status-failure { color: #ff9800; }
    .status-error { color: #d32f2f; }
    .test-body {
      padding: 15px;
    }
    .comparison {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 15px;
    }
    .comparison-header {
      font-weight: bold;
      margin-bottom: 5px;
    }
    .code-block {
      background-color: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 3px;
      padding: 10px;
      overflow-x: auto;
      font-family: monospace;
      white-space: pre-wrap;
    }
    .error-message {
      background-color: #ffebee;
      border: 1px solid #ffcdd2;
      color: #d32f2f;
      padding: 10px;
      border-radius: 3px;
      margin-top: 15px;
    }
    .link-preview {
      margin-top: 10px;
      padding: 15px;
      border: 1px dashed #ddd;
      border-radius: 5px;
    }
    .link-preview-header {
      font-weight: bold;
      margin-bottom: 10px;
    }
    .summary {
      margin-bottom: 20px;
      padding: 15px;
      background-color: #f5f5f5;
      border-radius: 5px;
    }
  </style>
</head>
<body>
  <h1>rehype-smart-links Test Report</h1>
  
  <div class="summary">
    <h2>Summary</h2>
    <p>
      Total Tests: ${results.length} | 
      Passed: ${results.filter(r => r.status === "success").length} ✅ | 
      Failed: ${results.filter(r => r.status === "failure").length} ⚠️ | 
      Errors: ${results.filter(r => r.status === "error").length} ❎
    </p>
  </div>

  <h2>Test Results</h2>
  
  ${results.map(result => `
    <div class="test-card">
      <div class="test-header">
        <div class="test-title">${result.title}</div>
        <div class="status-${result.status}">
          ${statusEmoji[result.status]} ${result.status.toUpperCase()}
        </div>
      </div>
      <div class="test-body">
        <h3>Plugin Configuration</h3>
        <pre class="code-block">${escapeHTML(result.config)}</pre>
        
        ${result.error
          ? `
          <div class="error-message">
            <strong>Error:</strong> ${escapeHTML(result.error)}
          </div>
        `
          : `
          <h3>Internal Link Comparison</h3>
          <div class="comparison">
            <div>
              <div class="comparison-header">Expected:</div>
              <pre class="code-block">${escapeHTML(result.expectedInternal)}</pre>
              <div class="link-preview">
                <div class="link-preview-header">Rendered Preview:</div>
                ${result.expectedInternal}
              </div>
            </div>
            <div>
              <div class="comparison-header">Actual:</div>
              <pre class="code-block">${escapeHTML(result.actualInternal || "")}</pre>
              <div class="link-preview">
                <div class="link-preview-header">Rendered Preview:</div>
                ${result.actualInternal || ""}
              </div>
            </div>
          </div>
          
          <h3>External Link Comparison</h3>
          <div class="comparison">
            <div>
              <div class="comparison-header">Expected:</div>
              <pre class="code-block">${escapeHTML(result.expectedExternal)}</pre>
              <div class="link-preview">
                <div class="link-preview-header">Rendered Preview:</div>
                ${result.expectedExternal}
              </div>
            </div>
            <div>
              <div class="comparison-header">Actual:</div>
              <pre class="code-block">${escapeHTML(result.actualExternal || "")}</pre>
              <div class="link-preview">
                <div class="link-preview-header">Rendered Preview:</div>
                ${result.actualExternal || ""}
              </div>
            </div>
          </div>
          
          <h3>Broken Link Comparison</h3>
          <div class="comparison">
            <div>
              <div class="comparison-header">Expected:</div>
              <pre class="code-block">${escapeHTML(result.expectedBroken)}</pre>
              <div class="link-preview">
                <div class="link-preview-header">Rendered Preview:</div>
                ${result.expectedBroken}
              </div>
            </div>
            <div>
              <div class="comparison-header">Actual:</div>
              <pre class="code-block">${escapeHTML(result.actualBroken || "")}</pre>
              <div class="link-preview">
                <div class="link-preview-header">Rendered Preview:</div>
                ${result.actualBroken || ""}
              </div>
            </div>
          </div>
        `}
      </div>
    </div>
  `).join("")}
</body>
</html>
`;

  // 确保目录存在
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, html);
}

/**
 * 转义HTML字符串
 * @param str 输入字符串
 * @returns 转义后的字符串
 */
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
