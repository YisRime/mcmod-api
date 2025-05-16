import * as cheerio from 'cheerio';
import { createErrorResponse, createSuccessResponse, BASE_URL, validatePage, fetchHtml, resolveUrl, log } from '..';

// 类型定义
interface SearchResult {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  type: 'mod';
  url: string;
}

interface SearchResponse {
  results: SearchResult[];
  totalPages: number;
  currentPage: number;
}

// 内联的parseModList函数
async function listMods(category: string = '', page: number = 1, baseUrl: string): Promise<SearchResponse> {
  log('LIST', `开始解析模组列表: 分类="${category}", 页码=${page}`);
  
  if (page < 1) page = 1;
  
  try {
    const path = category 
      ? `/class-${encodeURIComponent(category)}-${page}.html` 
      : `/class-${page}.html`;
    
    const url = baseUrl + path;
    log('LIST', `获取列表页面: ${url}`);
      
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    
    log('LIST', `列表页面加载成功，开始解析结果`);
    
    // 检查页面有效性
    if ($('.item-list').length === 0) {
      log('LIST', `获取模组列表失败，页面结构异常`);
      throw new Error('无法获取模组列表，可能页面结构已更改或参数无效');
    }
    
    // 提取模组信息
    const mods: SearchResult[] = [];
    $('.item-third').each((i, item) => {
      const $item = $(item);
      const link = $item.find('a').first().attr('href') || '';
      const idMatch = link.match(/\/class\/(\d+)\.html/);
      
      if (idMatch?.[1]) {
        const mod = {
          id: idMatch[1],
          name: $item.find('.item-title a').text().trim() || '未知名称',
          description: $item.find('.item-desc').text().trim() || '暂无描述',
          imageUrl: resolveUrl($item.find('img').attr('src'), baseUrl),
          type: 'mod' as const,
          url: resolveUrl(link, baseUrl) || ''
        };
        
        log('LIST', `找到模组: ${mod.id} - ${mod.name}`);
        mods.push(mod);
      }
    });
    
    // 提取分页信息
    let total = 1;
    const lastLink = $('.paging-item-max').attr('href');
    
    if (lastLink) {
      const pageMatch = lastLink.match(/class-(?:.+?)-(\d+)\.html/) || lastLink.match(/class-(\d+)\.html/);
      if (pageMatch?.[1]) {
        total = parseInt(pageMatch[1]);
        log('LIST', `从链接中提取到总页数: ${total}`);
      }
    } else if ($('.paging-item-max').length) {
      const maxPage = $('.paging-item-max').text().trim();
      if (/^\d+$/.test(maxPage)) {
        total = parseInt(maxPage);
        log('LIST', `从文本中提取到总页数: ${total}`);
      }
    }
    
    log('LIST', `列表解析完成，找到 ${mods.length} 个模组，共 ${total} 页`);
    return { results: mods, totalPages: total, currentPage: page };
  } catch (error: any) {
    log('LIST', `获取模组列表失败: ${error.message}`, error);
    throw new Error(`获取模组列表失败: ${error.message}`);
  }
}

// API处理函数
export async function serveModList(params: URLSearchParams): Promise<Response> {
  const cat = params.get('category') || '';
  const page = validatePage(params.get('page'));
  
  log('LIST_API', `请求模组列表: 分类="${cat}", 页码=${page}`);
  
  try {
    log('LIST_API', `开始获取模组列表数据`);
    const data = await listMods(cat, page, BASE_URL);
    log('LIST_API', `列表数据获取成功，找到 ${data.results.length} 个结果，总页数: ${data.totalPages}`);
    return createSuccessResponse(data);
  } catch (error: any) {
    log('LIST_API', `获取列表失败: ${error.message}`, error);
    return createErrorResponse({
      error: '获取列表失败',
      message: error.message,
      status: 500
    });
  }
}
