import path from "node:path";
import process from "node:process";
import { afterAll, describe, expect, it } from "vitest";
import {
  createFileNameFilter,
  createPathFilter,
  extractAllTestCases,
} from "./utils/extractTestCases";
import { generateHTMLReport, runTest } from "./utils/testRunner";

describe("rehype-smart-links", () => {
  // 设置测试目录和过滤器
  const demoDirs = [
    path.join(process.cwd(), "example/src/pages/en/demo"),
    // 可以添加更多测试目录
  ];

  // 创建过滤器，只包含特定的演示文件
  const fileFilter = createFileNameFilter("*.mdx");
  const pathFilter = createPathFilter(
    // 可以添加包含的路径模式
    [],
    // 可以添加排除的路径模式
    ["**/node_modules/**"],
  );

  // 从示例目录中提取测试用例，使用过滤器和递归选项
  const testCases = extractAllTestCases(demoDirs, {
    recursive: true,
    fileFilter,
    pathFilter,
  });

  // 使用warn输出测试用例数量，符合linter要求
  console.warn(`提取到 ${testCases.length} 个测试用例`);

  // 存储测试结果
  const testResults = [];

  // 测试每个用例
  it.each(testCases)("$title", async (testCase) => {
    // 运行测试
    const result = await runTest(testCase);
    // @ts-expect-error 类型问题将在后续修复
    testResults.push(result);

    // 根据测试结果进行断言
    if (result.status === "error") {
      expect(result.error).toBeUndefined();
      // console.warn(`Test "${result.title}" 遇到错误: ${result.error}`);
    }
    else if (result.status === "failure") {
      expect(result.status).toBe("success");
      // console.warn(`Test "${result.title}" 失败: 实际输出与期望不符`);
    }
    else {
      // console.warn(`Test "${result.title}" 成功!`);
    }
  });

  // 在所有测试完成后生成HTML报告
  afterAll(() => {
    // 使用当前日期时间作为报告文件名的一部分
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

    const reportPath = path.join(process.cwd(), `tests/results/report-${timestamp}.html`);
    generateHTMLReport(testResults, reportPath);
    console.warn(`HTML测试报告已生成: ${reportPath}`);
  });
});
