import http from 'http';
import { URL } from 'url';
import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';

const PORT = 4000;
let worker: any = null;
let isReloading = false;

// 获取模块的绝对路径
function resolveModulePath(relativePath: string): string {
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const possiblePaths = [
    relativePath,
    `${process.cwd()}/${normalizedPath}`,
    path.resolve(normalizedPath)
  ];
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) return p;
      if (fs.existsSync(`${p}.js`)) return `${p}.js`;
      if (fs.existsSync(`${p}.ts`)) return `${p}.ts`;
    } catch (e) {}
  }
  return relativePath;
}

// 智能清除特定模块及其依赖的缓存
function clearModuleCache(modulePath: string) {
  try {
    // 尝试解析模块的完整路径
    const resolvedPath = resolveModulePath(modulePath);
    // 如果模块不在缓存中，直接返回
    if (!require.cache[resolvedPath]) {
      const relativeKey = Object.keys(require.cache).find(key => 
        key.endsWith(modulePath) || key.includes(modulePath));
      if (relativeKey) delete require.cache[relativeKey];
      return;
    }
    // 获取模块信息
    const cachedModule = require.cache[resolvedPath];
    if (cachedModule) {
      const dependents = new Set<string>();
      // 查找依赖于当前模块的其他模块
      Object.keys(require.cache).forEach(key => {
        const mod = require.cache[key];
        if (mod && mod.children) if (mod.children.some(child => child.id === resolvedPath)) dependents.add(key);
      });
      // 先删除自身的缓存
      delete require.cache[resolvedPath];
      // 递归清除依赖于此模块的模块
      dependents.forEach(dep => {clearModuleCache(dep)});
    }
  } catch (error) {
    console.error(`清除模块缓存出错:`, error);
  }
}

// 导入 worker 模块
async function importWorker(force = false) {
  if (isReloading && !force) return;
  isReloading = true;
  try {
    clearModuleCache('./src/index');
    const module = await import('./src/index');
    worker = module.default;
    console.log('模块重新加载成功');
  } catch (error) {
    console.error('加载模块失败:', error);
    console.error('错误详情:', error instanceof Error ? error.stack : String(error));
  } finally {
    isReloading = false;
  }
}

// 处理请求时确保使用最新模块
async function ensureFreshWorker() {
  if (!worker) await importWorker(true);
  return worker;
}

// 监控文件变化
function setupHMR() {
  // 增加延迟以处理文件系统事件
  let debounceTimeout: NodeJS.Timeout | null = null;
  const watcher = chokidar.watch('./src/**/*.ts', {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100
    }
  });
  watcher
    .on('ready', () => {
      console.log('初始化完成，开始监控文件变化...');
    })
    .on('change', async (filePath) => {
      console.log(`文件变化: ${filePath}`);
      // 防抖处理
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(async () => {
        try {
          // 只清除变更的文件和其依赖的缓存
          clearModuleCache(filePath);
          await importWorker(true);
        } catch (err) {
          console.error('重载过程中出错:', err);
        }
      }, 500);
    });
}

const server = http.createServer(async (req, res) => {
  try {
    // 每次请求都确保使用最新的 worker
    const currentWorker = await ensureFreshWorker();
    if (!currentWorker) throw new Error('Worker 模块未能正确加载');
    // 构建请求对象
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    // 创建兼容 Fetch API 的请求对象
    const request = new Request(url.toString(), {
      method: req.method,
      headers: new Headers(req.headers as Record<string, string>),
    });
    // 调用 worker 处理函数
    const response = await currentWorker.fetch(request);
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

// 先导入模块，然后启动服务器和文件监控
importWorker(true).then(() => {
  server.listen(PORT, () => {
    console.log(`开发服务器运行在 http://localhost:${PORT}`);
    setupHMR();
  });
});