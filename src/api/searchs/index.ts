import * as cheerio from 'cheerio';
import { createErrorResponse, createSuccessResponse, BASE_URL, fetchHtml, log } from '..';

// 类型定义
interface SearchResult {
  id: string;
  type: 'class' | 'item' | 'modpack' | 'post' | 'author' | 'user' | 'community';
  url: string;
  name: string;
  description?: string;
  category?: string;
}

// 定义搜索结果元数据
interface SearchMeta {
  totalResults: number;
  totalPages: number;
  currentPage: number;
}

// 定义类型模式接口
interface TypePattern {
  pattern: RegExp;
  type: 'class' | 'item' | 'modpack' | 'post' | 'author' | 'user' | 'community';
}

// 解析搜索结果元数据
function parseMeta($: cheerio.CheerioAPI): SearchMeta {
  const infoText = $('.search-result p.info').text();
  const resultMatch = infoText.match(/找到约\s*(\d+)\s*条结果/);
  const pageMatch = infoText.match(/共约\s*(\d+)\s*页/);
  const total = resultMatch && resultMatch[1] ? parseInt(resultMatch[1], 10) : 0;
  const pages = pageMatch && pageMatch[1] ? parseInt(pageMatch[1], 10) : 0;
  const page = parseInt($('.search-result-pages .pagination .page-item.active .page-link').text().trim(), 10) || 1;
  log('SEARCH', `解析到总结果数: ${total}, 总页数: ${pages}, 当前页: ${page}`);
  return { totalResults: total, totalPages: pages, currentPage: page };
}

// 搜索内容函数
async function search(query: string, offset: number = 0, baseUrl: string, useMold: boolean = false, filter: number = 0): Promise<{results: SearchResult[], metadata: SearchMeta}> {
  const PAGE_SIZE = 30;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  log('SEARCH', `开始搜索内容: "${query}", 请求页码: ${page}, 偏移量: ${offset}, 复杂搜索: ${useMold}, 过滤器: ${filter}`);
  if (!query.trim()) throw new Error('搜索关键词不能为空');
  try {
    let url = `${baseUrl}/s?key=${encodeURIComponent(query)}&page=${page}`;
    // 添加复杂搜索参数
    if (useMold) url += '&mold=1';
    // 添加过滤参数
    if (filter > 0 && filter <= 7) url += `&filter=${filter}`;
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    // 解析元数据
    const meta = parseMeta($);
    meta.currentPage = page;
    // 定义类型模式
    const patterns: Record<string, TypePattern> = {
      class: { pattern: /\/class\/(\d+)\.html/, type: 'class' },
      modpack: { pattern: /\/modpack\/(\d+)\.html/, type: 'modpack' },
      post: { pattern: /\/post\/(\d+)\.html/, type: 'post' },
      item: { pattern: /\/item\/(\d+)\.html/, type: 'item' },
      author: { pattern: /\/author\/(\d+)\.html/, type: 'author' },
      user: { pattern: /\/center\.mcmod\.cn\/(\d+)/, type: 'user' },
      community: { pattern: /\/bbs\.mcmod\.cn\/thread-(\d+)-\d+-\d+\.html/, type: 'community' }
    };
    const results: SearchResult[] = [];
    $('.search-result-list .result-item').each((i, item) => {
      if (results.length >= PAGE_SIZE) return false;
      const $item = $(item);
      const name = $item.find('.head a').text().trim() || '未知名称';
      const desc = $item.find('.body').text().trim() || '暂无描述';
      const url = $item.find('.foot .info:first-child .value a').attr('href') || '';
      if (!url) return true;
      // 尝试确定结果类型和ID
      let type: SearchResult['type'] = 'item';
      let id = '';
      for (const [, pat] of Object.entries(patterns)) {
        const match = url.match(pat.pattern);
        if (match?.[1]) {
          type = pat.type;
          id = match[1];
          break;
        }
      }
      if (id) {
        const result: SearchResult = { id, name, description: desc, type, url };
        // 如果是mod类型，添加category字段
        if (type === 'class') {
          const catEl = $item.find('.head .class-category ul li a').first();
          if (catEl.length > 0) {
            // 从class属性中提取category ID
            const catClass = catEl.attr('class');
            if (catClass) {
              const catMatch = catClass.match(/c_(\d+)/);
              if (catMatch && catMatch[1]) result.category = catMatch[1];
            }
          }
        }
        results.push(result);
      }
    });
    log('SEARCH', `搜索完成，找到 ${results.length} 个结果，当前页: ${meta.currentPage}，总页数: ${meta.totalPages}`);
    return { results, metadata: meta };
  } catch (error: any) {
    log('SEARCH', `搜索内容失败: ${error.message}`);
    throw new Error(`搜索内容失败: ${error.message}`);
  }
}

// API处理函数
export async function serveSearch(params: URLSearchParams): Promise<Response> {
  const query = params.get('q');
  log('SEARCH_API', `全局搜索请求: ${query}`);
  if (!query) {
    return createErrorResponse({ error: '缺少参数', message: '请提供搜索关键词，例如: /api/search?q=minecraft', status: 400 });
  }
  // 处理分页参数
  const offsetParam = params.get('offset');
  const pageParam = params.get('page');
  let offset = offsetParam ? parseInt(offsetParam, 10) || 0 : 0;
  // 如果没有offset参数但有page参数，则转换为offset
  if (!offsetParam && pageParam) {
    const page = Math.max(1, parseInt(pageParam, 10) || 1);
    offset = (page - 1) * 30;
  }
  // 解析复杂搜索和过滤器参数
  const mold = params.get('mold') === '1';
  const filter = parseInt(params.get('filter') || '0', 10);
  try {
    const { results, metadata } = await search(query, offset, BASE_URL, mold, filter);
    return createSuccessResponse({
      results, page: metadata.currentPage,
      total: metadata.totalPages, totalResults: metadata.totalResults
    });
  } catch (error: any) {
    log('SEARCH_API', `搜索失败: ${error.message}`);
    return createErrorResponse({ error: '搜索失败', message: error.message, status: 500 });
  }
}