// 类型定义
interface ApiError {
  error: string;
  message: string;
  status?: number;
}

// 常量
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

export const BASE_URL = "https://www.mcmod.cn";

// 通用配置
const FETCH_OPTS = {
  headers: {'User-Agent': 'Mozilla/5.0'},
  cf: { cacheTtl: 3600, cacheEverything: true }
};

const TIMEOUT = 30000;
const DEBUG = false;

export function log(module: string, message: string, data?: any): void {
  if (!DEBUG) return;
  const ts = new Date().toISOString();
  const msg = `[${ts}] [${module}] ${message}`;
  if (data) {
    console.log(msg, typeof data === 'object' ? JSON.stringify(data) : data);
  } else {
    console.log(msg);
  }
}

// 通用工具
export async function fetchHtml(url: string): Promise<string> {
  log('FETCH', `开始获取: ${url}`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const resp = await fetch(url, { 
      ...FETCH_OPTS, 
      signal: controller.signal 
    });
    if (!resp.ok) {
      log('FETCH', `请求失败: ${resp.status} ${resp.statusText}`);
      throw new Error(`HTTP ${resp.status}`);
    }
    const html = await resp.text();
    log('FETCH', `成功获取: ${url} (${html.length} 字节)`);
    return html;
  } catch (error: any) {
    log('FETCH', `错误: ${error.message || '未知错误'}`);
    throw error.name === 'AbortError' 
      ? new Error('请求超时') 
      : error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// 响应处理
export function createErrorResponse(error: ApiError | Error | string): Response {
  const err = typeof error === 'string' 
    ? { error: '错误', message: error, status: 500 }
    : 'error' in error 
      ? error as ApiError 
      : { error: '错误', message: error.message, status: 500 };
  return new Response(
    JSON.stringify({ error: err.error, message: err.message }),
    { status: err.status || 500, headers: CORS_HEADERS }
  );
}

export function createSuccessResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), { headers: CORS_HEADERS });
}

// 参数验证
export function validateId(value: string | null): string | ApiError {
  if (!value) return { error: '参数缺失', message: '缺少ID参数', status: 400 };
  if (!/^\d+$/.test(value)) return { error: '无效参数', message: 'ID必须是数字', status: 400 };
  return value;
}