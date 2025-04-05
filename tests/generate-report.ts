#!/usr/bin/env tsx

import path from "node:path";
import fs from "node:fs";
import { 
  createFileNameFilter, 
  createPathFilter,
  extractAllTestCases, 
} from "./utils/extractTestCases";
import { generateHTMLReport, runTest } from "./utils/testRunner";

async function main() {
  console.warn("开始生成测试报告...");
  
  // 确保结果目录存在
  const resultsDir = path.join(process.cwd(), "tests/results");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  // 设置测试目录和过滤器
  const testDirectories = [
    path.join(process.cwd(), "example/src/pages/en/demo"),
    // 可以添加更多测试目录
  ];
  
  // 创建过滤器，只包含MDX文件
  const fileFilter = createFileNameFilter("*.mdx");
  const pathFilter = createPathFilter(
    [], // 包含的路径
    ["**/node_modules/**"], // 排除的路径
  );
  
  // 提取测试用例
  const testCases = extractAllTestCases(testDirectories, {
    recursive: true,
    fileFilter,
    pathFilter,
  });
  
  console.warn(`找到 ${testCases.length} 个测试用例`);
  
  if (testCases.length === 0) {
    console.warn("没有找到测试用例。请检查测试目录和过滤器设置。");
    process.exit(1);
  }
  
  // 存储测试结果
  const testResults = [];
  let successCount = 0;
  let failureCount = 0;
  let errorCount = 0;
  
  // 运行所有测试
  for (const testCase of testCases) {
    console.warn(`运行测试: ${testCase.title}`);
    
    try {
      const result = await runTest(testCase);
      // @ts-expect-error 类型问题后续修复
      testResults.push(result);
      
      // 统计结果
      if (result.status === "success") {
        successCount++;
      } else if (result.status === "failure") {
        failureCount++;
      } else if (result.status === "error") {
        errorCount++;
      }
      
      // 打印结果
      if (result.status === "error") {
        console.warn(`❌ 错误: ${testCase.title} - ${result.error}`);
      } else if (result.status === "failure") {
        console.warn(`⚠️ 失败: ${testCase.title}`);
      } else {
        console.warn(`✅ 成功: ${testCase.title}`);
      }
    } catch (error) {
      console.warn(`❌ 测试执行异常: ${testCase.title} - ${error}`);
      // @ts-expect-error 类型问题后续修复
      testResults.push({
        title: testCase.title,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      errorCount++;
    }
  }
  
  // 生成报告
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  
  const reportPath = path.join(resultsDir, `report-${timestamp}.html`);
  generateHTMLReport(testResults, reportPath);
  
  // 输出摘要
  console.warn("\n测试摘要:");
  console.warn(`✅ 成功: ${successCount}`);
  console.warn(`⚠️ 失败: ${failureCount}`);
  console.warn(`❌ 错误: ${errorCount}`);
  console.warn(`总计: ${testCases.length}`);
  console.warn(`\nHTML测试报告已生成: ${reportPath}`);
  console.warn("使用 node tests/serve-report.js 查看报告");
  
  // 退出代码基于测试结果
  if (errorCount > 0) {
    process.exit(1);
  } else if (failureCount > 0) {
    process.exit(2);
  } else {
    process.exit(0);
  }
}

main().catch(error => {
  console.warn("报告生成失败:", error);
  process.exit(1);
}); 