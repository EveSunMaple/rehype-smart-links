import fs from "node:fs";
import path from "node:path";

interface TestCase {
  id: string;
  title: string;
  config: string;
  internalLinkHtml: string;
  externalLinkHtml: string;
  brokenLinkHtml: string;
  sourceFile: string;
}

interface ExtractOptions {
  /**
   * 是否递归搜索子目录
   * @default false
   */
  recursive?: boolean;

  /**
   * 文件名过滤器，返回true表示包含该文件
   * @default (filename) => filename.endsWith(".mdx")
   */
  fileFilter?: (filename: string) => boolean;

  /**
   * 文件路径过滤器，返回true表示包含该文件
   * @default () => true
   */
  pathFilter?: (filepath: string) => boolean;
}

const DEFAULT_OPTIONS: ExtractOptions = {
  recursive: false,
  fileFilter: filename => filename.endsWith(".mdx"),
  pathFilter: () => true,
};

/**
 * 从MDX文件中提取测试用例
 * @param mdxFilePath MDX文件路径
 * @returns 测试用例数组
 */
export function extractTestCasesFromMdx(mdxFilePath: string): TestCase[] {
  const content = fs.readFileSync(mdxFilePath, "utf-8");
  const filename = path.basename(mdxFilePath, ".mdx");

  // 匹配CodeExample组件
  const codeExampleRegex = /<CodeExample([^>]*)>([\s\S]*?)<\/CodeExample>/g;

  const testCases: TestCase[] = [];
  let index = 0;

  const matches = content.matchAll(codeExampleRegex);
  for (const match of matches) {
    const props = match[1];
    const codeBlock = match[2];

    // 提取title
    const titleMatch = props.match(/title="([^"]*)"/);
    const title = titleMatch ? titleMatch[1] : `Unnamed Test Case ${index + 1}`;

    // 提取HTML结构
    const internalLinkHtmlMatch = props.match(/internalLinkHtml='([^']*)'/);
    const externalLinkHtmlMatch = props.match(/externalLinkHtml='([^']*)'/);
    const brokenLinkHtmlMatch = props.match(/brokenLinkHtml='([^']*)'/);

    // 提取配置代码
    const configMatch = codeBlock.match(/```js([^`]*)```/);

    if (configMatch) {
      testCases.push({
        id: `${filename}-${index}`,
        title,
        config: configMatch[1].trim(),
        internalLinkHtml: internalLinkHtmlMatch ? internalLinkHtmlMatch[1] : "",
        externalLinkHtml: externalLinkHtmlMatch ? externalLinkHtmlMatch[1] : "",
        brokenLinkHtml: brokenLinkHtmlMatch ? brokenLinkHtmlMatch[1] : "",
        sourceFile: mdxFilePath,
      });
    }

    index++;
  }

  return testCases;
}

/**
 * 从指定目录中提取所有MDX文件的测试用例
 * @param dirPath 目录路径或目录路径数组
 * @param options 提取选项
 * @returns 测试用例数组
 */
export function extractAllTestCases(
  dirPath: string | string[],
  options: ExtractOptions = {},
): TestCase[] {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const { recursive, fileFilter, pathFilter } = mergedOptions;

  // 处理多个目录的情况
  if (Array.isArray(dirPath)) {
    return dirPath.flatMap(dir => extractAllTestCases(dir, options));
  }

  // 获取目录中的文件和子目录
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  const testCases: TestCase[] = [];

  // 处理文件
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory() && recursive) {
      // 递归处理子目录
      const subDirCases = extractAllTestCases(fullPath, options);
      testCases.push(...subDirCases);
    }
    else if (
      entry.isFile()
      && fileFilter && fileFilter(entry.name)
      && pathFilter && pathFilter(fullPath)
    ) {
      // 处理符合条件的文件
      const fileCases = extractTestCasesFromMdx(fullPath);
      testCases.push(...fileCases);
    }
  }

  return testCases;
}

/**
 * 按文件名模式过滤文件
 * @param pattern 文件名模式，支持 * 通配符
 * @returns 文件过滤函数
 */
export function createFileNameFilter(pattern: string): (filename: string) => boolean {
  if (pattern === "*")
    return () => true;

  // 将通配符模式转换为正则表达式
  const regexPattern = pattern
    .replace(/\./g, "\\.")
    .replace(/\*/g, ".*");

  const regex = new RegExp(`^${regexPattern}$`);
  return (filename: string) => regex.test(filename);
}

/**
 * 创建文件路径过滤器
 * @param includes 包含的路径模式数组
 * @param excludes 排除的路径模式数组
 * @returns 文件路径过滤函数
 */
export function createPathFilter(
  includes: string[] = [],
  excludes: string[] = [],
): (filepath: string) => boolean {
  if (includes.length === 0 && excludes.length === 0)
    return () => true;

  // 转换通配符为正则表达式
  const includeRegexes = includes.map(pattern =>
    new RegExp(pattern.replace(/\./g, "\\.").replace(/\*/g, ".*")));

  const excludeRegexes = excludes.map(pattern =>
    new RegExp(pattern.replace(/\./g, "\\.").replace(/\*/g, ".*")));

  return (filepath: string) => {
    // 如果路径匹配任一排除模式，则排除该文件
    if (excludeRegexes.some(regex => regex.test(filepath)))
      return false;

    // 如果没有包含模式，或者路径匹配任一包含模式，则包含该文件
    return includes.length === 0 || includeRegexes.some(regex => regex.test(filepath));
  };
}
