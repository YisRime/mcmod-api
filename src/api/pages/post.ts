import * as cheerio from 'cheerio';
import { createErrorResponse, createSuccessResponse, BASE_URL, validateId, fetchHtml, cleanHtml, log } from '..';

// 类型定义
interface Post {
  id: string;
  title: string;
  content: string;
  author?: string;
  date?: string;
  views?: number;
}

// 精简的解析函数
async function parsePost(id: string, url: string): Promise<Post> {
  log('POST', `开始解析教程: ${id}`);
  try {
    const html = await fetchHtml(`${url}/post/${id}.html`);
    const $ = cheerio.load(html);
    
    log('POST', `加载教程页面成功，开始提取数据`);
    
    const post: Post = {
      id: id,
      title: $('.post-title').text().trim(),
      content: cleanHtml($('.post-content').html() || ''),
      author: $('.post-author a').text().trim(),
      date: $('.post-date').text().trim()
    };
    
    log('POST', `提取基本信息: ${post.title}, 作者: ${post.author}`);
    
    // 提取浏览数
    const viewText = $('.post-view').text().trim();
    const match = viewText.match(/(\d+)/);
    if (match?.[1]) {
      post.views = parseInt(match[1]);
      log('POST', `浏览数: ${post.views}`);
    }
    
    log('POST', `教程解析完成: ${post.title}`);
    return post;
  } catch (error: any) {
    log('POST', `解析教程失败: ${error.message}`, error);
    throw new Error(`解析教程详情失败: ${error.message}`);
  }
}

// API导出函数
export async function servePost(params: URLSearchParams): Promise<Response> {
  const id = params.get('id');
  log('POST_API', `请求教程详情: ${id}`);
  
  const validId = validateId(id);
  if (typeof validId !== 'string') {
    log('POST_API', `ID验证失败: ${JSON.stringify(validId)}`);
    return createErrorResponse(validId);
  }
  
  try {
    log('POST_API', `开始获取教程数据: ${validId}`);
    const data = await parsePost(validId, BASE_URL);
    log('POST_API', `教程数据获取成功: ${data.title}`);
    return createSuccessResponse(data);
  } catch (error: any) {
    log('POST_API', `获取教程失败: ${error.message}`, error);
    return createErrorResponse({
      error: '获取教程失败',
      message: error.message,
      status: 404
    });
  }
}
