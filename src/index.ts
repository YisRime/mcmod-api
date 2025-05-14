import { parseMod, parseModList, searchContent, parseItem, parseModPack, parseCourse, parseServer, searchServer } from './parser';

// 类型定义
export interface Env {}

interface ApiError {
  error: string;
  message: string;
  status?: number;
}

// 常量
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=3600'
};

const BASE_URL = "https://www.mcmod.cn";

// 统一的响应处理
function createErrorResponse(error: ApiError | Error | string): Response {
  const errorObj = typeof error === 'string' 
    ? { error: '错误', message: error, status: 500 }
    : 'error' in error 
      ? error as ApiError 
      : { error: '错误', message: error.message, status: 500 };
      
  return new Response(
    JSON.stringify({ error: errorObj.error, message: errorObj.message }),
    { status: errorObj.status || 500, headers: CORS_HEADERS }
  );
}

function createSuccessResponse(data: unknown): Response {
  return new Response(
    JSON.stringify(data),
    { headers: CORS_HEADERS }
  );
}

// 参数验证
function validateId(value: string | null): string | ApiError {
  if (!value) return { error: '参数缺失', message: '缺少ID参数', status: 400 };
  if (!/^\d+$/.test(value)) return { error: '无效参数', message: 'ID必须是数字', status: 400 };
  return value;
}

function validatePage(value: string | null): number {
  return value && /^\d+$/.test(value) ? parseInt(value, 10) : 1;
}

// API处理函数
async function handleModRequest(params: URLSearchParams): Promise<Response> {
  const idValidation = validateId(params.get('id'));
  if (typeof idValidation !== 'string') {
    return createErrorResponse(idValidation);
  }
  
  try {
    const modData = await parseMod(idValidation, BASE_URL);
    return createSuccessResponse(modData);
  } catch (error: any) {
    return createErrorResponse({
      error: '获取模组失败',
      message: error.message,
      status: 404
    });
  }
}

async function handleItemRequest(params: URLSearchParams): Promise<Response> {
  const idValidation = validateId(params.get('id'));
  if (typeof idValidation !== 'string') {
    return createErrorResponse(idValidation);
  }
  
  try {
    const itemData = await parseItem(idValidation, BASE_URL);
    return createSuccessResponse(itemData);
  } catch (error: any) {
    return createErrorResponse({
      error: '获取物品失败',
      message: error.message,
      status: 404
    });
  }
}

async function handleModPackRequest(params: URLSearchParams): Promise<Response> {
  const idValidation = validateId(params.get('id'));
  if (typeof idValidation !== 'string') {
    return createErrorResponse(idValidation);
  }
  
  try {
    const packData = await parseModPack(idValidation, BASE_URL);
    return createSuccessResponse(packData);
  } catch (error: any) {
    return createErrorResponse({
      error: '获取模组包失败',
      message: error.message,
      status: 404
    });
  }
}

async function handleCourseRequest(params: URLSearchParams): Promise<Response> {
  const idValidation = validateId(params.get('id'));
  if (typeof idValidation !== 'string') {
    return createErrorResponse(idValidation);
  }
  
  try {
    const courseData = await parseCourse(idValidation, BASE_URL);
    return createSuccessResponse(courseData);
  } catch (error: any) {
    return createErrorResponse({
      error: '获取教程失败',
      message: error.message,
      status: 404
    });
  }
}

async function handleServerRequest(params: URLSearchParams): Promise<Response> {
  const idValidation = validateId(params.get('id'));
  if (typeof idValidation !== 'string') {
    return createErrorResponse(idValidation);
  }
  
  try {
    const serverData = await parseServer(idValidation, BASE_URL);
    return createSuccessResponse(serverData);
  } catch (error: any) {
    return createErrorResponse({
      error: '获取服务器失败',
      message: error.message,
      status: 404
    });
  }
}

async function handleSearchRequest(params: URLSearchParams): Promise<Response> {
  const query = params.get('q');
  if (!query) {
    return createErrorResponse({
      error: '缺少参数',
      message: '请提供搜索关键词，例如: /api/search?q=minecraft',
      status: 400
    });
  }
  
  try {
    const results = await searchContent(query, BASE_URL);
    return createSuccessResponse({
      results,
      totalPages: 1,
      currentPage: 1
    });
  } catch (error: any) {
    return createErrorResponse({
      error: '搜索失败',
      message: error.message,
      status: 500
    });
  }
}

async function handleServerSearchRequest(params: URLSearchParams): Promise<Response> {
  const query = params.get('q');
  if (!query) {
    return createErrorResponse({
      error: '缺少参数',
      message: '请提供服务器搜索关键词',
      status: 400
    });
  }
  
  const page = validatePage(params.get('page'));
  
  try {
    const results = await searchServer(query, page, BASE_URL);
    return createSuccessResponse({
      results,
      totalPages: 1,
      currentPage: page
    });
  } catch (error: any) {
    return createErrorResponse({
      error: '搜索服务器失败',
      message: error.message,
      status: 500
    });
  }
}

async function handleListRequest(params: URLSearchParams): Promise<Response> {
  const category = params.get('category') || '';
  const page = validatePage(params.get('page'));
  
  try {
    const results = await parseModList(category, page, BASE_URL);
    return createSuccessResponse(results);
  } catch (error: any) {
    return createErrorResponse({
      error: '获取列表失败',
      message: error.message,
      status: 500
    });
  }
}

// Worker实现
export default {
  async fetch(request: Request): Promise<Response> {
    // OPTIONS请求处理
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const params = url.searchParams;
      
      // API路由映射
      const routes: Record<string, (params: URLSearchParams) => Promise<Response>> = {
        '/api/mod': handleModRequest,
        '/api/item': handleItemRequest,
        '/api/modpack': handleModPackRequest,
        '/api/course': handleCourseRequest,
        '/api/server': handleServerRequest,
        '/api/search': handleSearchRequest,
        '/api/search/server': handleServerSearchRequest,
        '/api/list': handleListRequest
      };
      
      // 处理API文档请求
      if (path === '/api' || path === '/') {
        return createSuccessResponse({
          title: 'MCModCN API',
          description: 'MC模组中文网数据API',
          version: '1.0.0',
          documentation: '请参阅README.md获取详细文档',
          endpoints: [
            { path: '/api/mod?id=[modId]', description: '获取指定ID的模组详情' },
            { path: '/api/item?id=[itemId]', description: '获取指定ID的物品详情' },
            { path: '/api/modpack?id=[packId]', description: '获取指定ID的模组包详情' },
            { path: '/api/course?id=[courseId]', description: '获取指定ID的教程详情' },
            { path: '/api/server?id=[serverId]', description: '获取指定ID的服务器详情' },
            { path: '/api/search?q=[关键词]', description: '搜索内容' },
            { path: '/api/search/server?q=[关键词]&page=[页码]', description: '搜索服务器' },
            { path: '/api/list?category=[分类]&page=[页码]', description: '获取模组列表' }
          ]
        });
      }
      
      // 路由处理
      const handler = routes[path];
      if (handler) {
        return await handler(params);
      }
      
      // 404处理
      return createErrorResponse({
        error: '路径不存在',
        message: '请使用有效的API端点',
        status: 404
      });
    } catch (error: any) {
      // 全局错误处理
      console.error('API错误:', error);
      return createErrorResponse(error);
    }
  },
};