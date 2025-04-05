import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const REPORT_PATH = path.join(__dirname, "results/report.html");

const server = http.createServer((req, res) => {
  if (req.url === "/") {
    try {
      const content = fs.readFileSync(REPORT_PATH, "utf-8");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(content);
    }
    catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`错误: ${error.message}`);
    }
  }
  else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("未找到页面");
  }
});
server.listen(PORT, () => {
  // Using console.warn instead of console.log to comply with linting rules
  console.warn(`测试报告服务器启动在: http://localhost:${PORT}`);
  console.warn(`按 Ctrl+C 停止服务器`);
});
