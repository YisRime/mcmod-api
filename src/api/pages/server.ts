import * as cheerio from 'cheerio';
import { createErrorResponse, createSuccessResponse, BASE_URL, validateId, fetchHtml, resolveUrl, log } from '..';

// 类型定义
interface Server {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  ip?: string;
  port?: string;
  version?: string;
  online?: number;
  players?: number;
  status?: string;
}

// 精简的解析函数
async function parseSv(id: string, url: string): Promise<Server> {
  log('SERVER', `开始解析服务器: ${id}`);
  try {
    const html = await fetchHtml(`${url}/sv/${id}.html`);
    const $ = cheerio.load(html);
    
    log('SERVER', `加载服务器页面成功，开始提取数据`);
    
    const sv: Server = {
      id: id,
      name: $('.server-name').text().trim(),
      description: $('.server-desc').text().trim() || '暂无描述',
      imageUrl: resolveUrl($('.server-logo img').attr('src'), url),
      version: $('.server-version').text().trim(),
    };
    
    log('SERVER', `提取基本信息: ${sv.name}`);
    
    // 提取IP和端口
    const ipText = $('.server-ip').text().trim();
    const ipMatch = ipText.match(/(.+?)(?::(\d+))?$/);
    if (ipMatch) {
      sv.ip = ipMatch[1];
      sv.port = ipMatch[2] || '25565';
      log('SERVER', `提取IP信息: ${sv.ip}:${sv.port}`);
    }
    
    // 提取在线状态
    sv.status = $('.server-status').hasClass('online') ? 'online' : 'offline';
    
    // 提取在线人数
    if (sv.status === 'online') {
      const onlineText = $('.server-players').text().trim();
      const match = onlineText.match(/(\d+)\s*\/\s*(\d+)/);
      if (match) {
        sv.online = parseInt(match[1]);
        sv.players = parseInt(match[2]);
        log('SERVER', `服务器在线状态: ${sv.online}/${sv.players}`);
      }
    }
    
    log('SERVER', `服务器解析完成: ${id}`);
    return sv;
  } catch (error: any) {
    log('SERVER', `解析服务器失败: ${error.message}`, error);
    throw new Error(`解析服务器详情失败: ${error.message}`);
  }
}

// API导出函数
export async function serveServer(params: URLSearchParams): Promise<Response> {
  const id = params.get('id');
  log('SERVER_API', `请求服务器详情: ${id}`);
  
  const validId = validateId(id);
  if (typeof validId !== 'string') {
    log('SERVER_API', `ID验证失败: ${JSON.stringify(validId)}`);
    return createErrorResponse(validId);
  }
  
  try {
    log('SERVER_API', `开始获取服务器数据: ${validId}`);
    const data = await parseSv(validId, BASE_URL);
    log('SERVER_API', `服务器数据获取成功: ${data.name}`);
    return createSuccessResponse(data);
  } catch (error: any) {
    log('SERVER_API', `获取服务器失败: ${error.message}`, error);
    return createErrorResponse({
      error: '获取服务器失败',
      message: error.message,
      status: 404
    });
  }
}