import { CORS_HEADERS, createErrorResponse } from './api';
import { serveClass } from './api/pages/class';
import { serveItem } from './api/pages/item';
import { serveModPack } from './api/pages/modpack';
import { servePost } from './api/pages/post';
import { serveSearch } from './api/searchs';
import { genDoc } from './api/utils/doc';

// Worker实现
export default {
  async fetch(request: Request): Promise<Response> {
    // OPTIONS请求处理
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const params = url.searchParams;
      // API路由映射
      const apis: Record<string, (params: URLSearchParams) => Promise<Response>> = {
        '/api/class': serveClass,
        '/api/item': serveItem,
        '/api/modpack': serveModPack,
        '/api/post': servePost,
        '/api/search': serveSearch
      };
      // 处理API文档请求
      if (path === '/') return await genDoc();
      // 路由处理
      const proc = apis[path];
      if (proc) return await proc(params);
      // 404处理
      return createErrorResponse({
        error: '路径不存在',
        message: '请使用有效的 API 端点',
        status: 404
      });
    } catch (error: any) {
      return createErrorResponse(error);
    }
  },
};