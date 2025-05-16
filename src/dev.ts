import http from 'http';
import { URL } from 'url';

const PORT = 4000;
let worker: any = null;

// 导入 worker 模块
async function importWorker() {
  try {
    const module = await import('./index');
    worker = module.default;
    console.log('模块加载成功');
    return worker;
  } catch (error) {
    console.error('加载模块失败:', error);
    console.error('错误详情:', error instanceof Error ? error.stack : String(error));
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (!worker) worker = await importWorker();
    // 构建请求对象
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    // 创建兼容 Fetch API 的请求对象
    const request = new Request(url.toString(), {
      method: req.method,
      headers: new Headers(req.headers as Record<string, string>),
    });
    // 调用 worker 处理函数
    const response = await worker.fetch(request);
    // 将 Response 对象转换为 Node.js http 响应
    res.statusCode = response.status;
    // 设置响应头
    response.headers.forEach((value: string | number | readonly string[], key: string) => {
      res.setHeader(key, value);
    });
    // 返回响应体
    const buffer = Buffer.from(await response.arrayBuffer());
    res.end(buffer);
  } catch (error) {
    console.error('服务器错误:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.end(JSON.stringify({ error: '服务器内部错误', message: errorMessage }));
  }
});

function shutdownServer() {
  console.log('正在关闭服务器...');
  // 设置超时
  const forceExit = setTimeout(() => {
    console.log('强制退出服务器');
    process.exit(1);
  }, 5000);
  // 清除强制退出定时器
  forceExit.unref();
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
}

// 监听终止信号
process.on('SIGINT', shutdownServer);
process.on('SIGTERM', shutdownServer);

// 启动服务器
importWorker().then(() => {
  server.listen(PORT, () => {
    console.log(`开发服务器运行在 http://localhost:${PORT}`);
  });
});