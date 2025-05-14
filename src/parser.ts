import * as cheerio from 'cheerio';

// 统一接口定义
interface BaseEntity {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
}

interface Item {
  id: string;
  name: string;
  iconUrl?: string;
  introduction: string;
  tabUrl?: string;
  moduleId?: string;
  moduleName?: string;
}

interface Module extends BaseEntity {
  authors?: string[];
  version?: string;
  downloadUrl?: string;
  categories?: string[];
  mcVersions?: string[];
}

interface ModulePackage extends BaseEntity {
  authors?: string[];
  mcVersion?: string;
  downloadUrl?: string;
  modules?: Array<{id: string, name: string, imageUrl?: string}>;
}

interface Course {
  id: string;
  title: string;
  content: string;
  author?: string;
  date?: string;
  viewCount?: number;
}

interface Server extends BaseEntity {
  ip?: string;
  port?: string;
  version?: string;
  online?: number;
  players?: number;
  status?: string;
}

interface SearchResult {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  type: 'mod' | 'item' | 'modpack' | 'course' | 'server';
  url: string;
}

interface SearchResponse {
  results: SearchResult[];
  totalPages: number;
  currentPage: number;
}

// 通用配置
const FETCH_OPTIONS: RequestInit = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml'
  },
  cf: { cacheTtl: 3600, cacheEverything: true }
};

const TIMEOUT_MS = 10000;

// 通用工具函数
async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  
  try {
    const response = await fetch(url, { 
      ...FETCH_OPTIONS, 
      signal: controller.signal 
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error: any) {
    throw error.name === 'AbortError' 
      ? new Error('请求超时') 
      : error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function resolveUrl(path: string | undefined, baseUrl: string): string | undefined {
  if (!path) return undefined;
  return path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
}

function extractTexts($: cheerio.CheerioAPI, selector: string): string[] {
  const results: string[] = [];
  $(selector).each((_, el) => {
    const text = $(el).text().trim();
    if (text) results.push(text);
  });
  return results;
}

// HTML清理函数
function cleanHtml(html: string): string {
  const $ = cheerio.load(html);
  
  $('*').not('p, br, img').each((_, el) => {
    const $el = $(el);
    $el.replaceWith($el.html() || '');
  });
  
  return $.html()
    .replace(/<p>/g, '')
    .replace(/<\/p>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/<br\s*\/?>/g, '\n')
    .trim();
}

// 核心功能实现
export async function parseMod(modId: string, baseUrl: string): Promise<Module> {
  try {
    const html = await fetchHtml(`${baseUrl}/class/${modId}.html`);
    const $ = cheerio.load(html);
    
    if ($('.class-header-title').length === 0) {
      throw new Error(`未找到ID为${modId}的模组`);
    }
    
    // 基本信息提取
    const modInfo: Module = {
      id: modId,
      name: $('.class-header-title').text().trim() || '未知名称',
      description: $('.class-info-intro').text().trim() || '暂无描述',
      authors: extractTexts($, '.class-contributor a'),
      version: $('.class-mcversion').text().trim(),
      imageUrl: resolveUrl($('.class-image img').attr('src'), baseUrl),
      categories: extractTexts($, '.class-mctag a'),
      mcVersions: extractTexts($, '.class-mcversion span'),
    };

    // 提取下载链接
    $('.class-download-links a').each((_, el) => {
      const link = $(el).attr('href');
      if (link?.includes('download')) {
        modInfo.downloadUrl = resolveUrl(link, baseUrl);
      }
    });
    
    return modInfo;
  } catch (error: any) {
    throw new Error(`解析模组详情失败: ${error.message}`);
  }
}

export async function searchMods(query: string, page: number = 1, baseUrl: string): Promise<SearchResponse> {
  if (!query.trim()) throw new Error('搜索关键词不能为空');
  if (page < 1) page = 1;
  
  try {
    const html = await fetchHtml(`${baseUrl}/search?key=${encodeURIComponent(query)}&page=${page}`);
    const $ = cheerio.load(html);
    
    // 无搜索结果处理
    if ($('.search-result-item').length === 0 && $('.search-not-found').length > 0) {
      return { results: [], totalPages: 0, currentPage: page };
    }
    
    // 提取模组信息
    const results: SearchResult[] = [];
    $('.search-result-item').each((_, item) => {
      const $item = $(item);
      const link = $item.find('a').first().attr('href') || '';
      const idMatch = link.match(/\/class\/(\d+)\.html/);
      
      if (idMatch?.[1]) {
        results.push({
          id: idMatch[1],
          name: $item.find('.result-name').text().trim() || '未知名称',
          description: $item.find('.result-desc').text().trim() || '暂无描述',
          imageUrl: resolveUrl($item.find('img').attr('src'), baseUrl),
          type: 'mod',
          url: resolveUrl(link, baseUrl) || ''
        });
      }
    });
    
    // 提取分页信息
    let totalPages = 1;
    const paginationText = $('.paging-text').text();
    const pageMatch = paginationText.match(/(\d+)\/(\d+)/);
    
    if (pageMatch?.[2]) {
      totalPages = parseInt(pageMatch[2]);
    } else if ($('.paging-item-max').length) {
      const maxPageText = $('.paging-item-max').text().trim();
      if (/^\d+$/.test(maxPageText)) {
        totalPages = parseInt(maxPageText);
      }
    }
    
    return { results, totalPages, currentPage: page };
  } catch (error: any) {
    throw new Error(`搜索模组失败: ${error.message}`);
  }
}

export async function parseModList(category: string = '', page: number = 1, baseUrl: string): Promise<SearchResponse> {
  if (page < 1) page = 1;
  
  try {
    const urlPath = category 
      ? `/class-${encodeURIComponent(category)}-${page}.html` 
      : `/class-${page}.html`;
      
    const html = await fetchHtml(baseUrl + urlPath);
    const $ = cheerio.load(html);
    
    // 检查页面有效性
    if ($('.item-list').length === 0) {
      throw new Error('无法获取模组列表，可能页面结构已更改或参数无效');
    }
    
    // 提取模组信息
    const results: SearchResult[] = [];
    $('.item-third').each((_, item) => {
      const $item = $(item);
      const link = $item.find('a').first().attr('href') || '';
      const idMatch = link.match(/\/class\/(\d+)\.html/);
      
      if (idMatch?.[1]) {
        results.push({
          id: idMatch[1],
          name: $item.find('.item-title a').text().trim() || '未知名称',
          description: $item.find('.item-desc').text().trim() || '暂无描述',
          imageUrl: resolveUrl($item.find('img').attr('src'), baseUrl),
          type: 'mod',
          url: resolveUrl(link, baseUrl) || ''
        });
      }
    });
    
    // 提取分页信息
    let totalPages = 1;
    const lastPageLink = $('.paging-item-max').attr('href');
    
    if (lastPageLink) {
      const pageMatch = lastPageLink.match(/class-(?:.+?)-(\d+)\.html/) || lastPageLink.match(/class-(\d+)\.html/);
      if (pageMatch?.[1]) {
        totalPages = parseInt(pageMatch[1]);
      }
    } else if ($('.paging-item-max').length) {
      const maxPageText = $('.paging-item-max').text().trim();
      if (/^\d+$/.test(maxPageText)) {
        totalPages = parseInt(maxPageText);
      }
    }
    
    return { results, totalPages, currentPage: page };
  } catch (error: any) {
    throw new Error(`获取模组列表失败: ${error.message}`);
  }
}

export async function searchContent(query: string, baseUrl: string): Promise<SearchResult[]> {
  if (!query.trim()) throw new Error('搜索关键词不能为空');
  
  try {
    const html = await fetchHtml(`${baseUrl}/s?key=${encodeURIComponent(query)}`);
    const $ = cheerio.load(html);
    
    const results: SearchResult[] = [];
    
    $('.search-result-item').each((_, item) => {
      const $item = $(item);
      const link = $item.find('a').first().attr('href') || '';
      
      const typePatterns = {
        mod: { pattern: /\/class\/(\d+)\.html/, type: 'mod' as const },
        item: { pattern: /\/item\/(\d+)\.html/, type: 'item' as const },
        modpack: { pattern: /\/modpack\/(\d+)\.html/, type: 'modpack' as const },
        course: { pattern: /\/post\/(\d+)\.html/, type: 'course' as const },
        server: { pattern: /\/sv\/(\d+)\.html/, type: 'server' as const },
      };
      
      for (const [_, {pattern, type}] of Object.entries(typePatterns)) {
        const match = link.match(pattern);
        if (match?.[1]) {
          results.push({
            id: match[1],
            name: $item.find('.result-name').text().trim() || '未知名称',
            description: $item.find('.result-desc').text().trim() || '暂无描述',
            imageUrl: resolveUrl($item.find('img').attr('src'), baseUrl),
            type,
            url: resolveUrl(link, baseUrl) || ''
          });
          break;
        }
      }
    });
    
    return results;
  } catch (error: any) {
    throw new Error(`搜索内容失败: ${error.message}`);
  }
}

export async function parseItem(itemId: string, baseUrl: string): Promise<Item> {
  try {
    const html = await fetchHtml(`${baseUrl}/item/${itemId}.html`);
    const $ = cheerio.load(html);
    
    const item: Item = {
      id: itemId,
      name: $('.name').text().trim(),
      iconUrl: resolveUrl($('td > img').attr('src') || $('td > a > img').attr('src'), baseUrl),
      introduction: cleanHtml($('.item-content.common-text.font14').html() || '')
    };
    
    // 提取所属模组信息
    const moduleLink = $('.common-icon').attr('href');
    if (moduleLink) {
      const match = moduleLink.match(/\/class\/(\d+)\.html/);
      if (match?.[1]) {
        item.moduleId = match[1];
        item.moduleName = $('.common-icon').text().trim();
        item.tabUrl = resolveUrl(moduleLink, baseUrl);
      }
    }
    
    return item;
  } catch (error: any) {
    throw new Error(`解析物品详情失败: ${error.message}`);
  }
}

export async function parseModPack(packId: string, baseUrl: string): Promise<ModulePackage> {
  try {
    const html = await fetchHtml(`${baseUrl}/modpack/${packId}.html`);
    const $ = cheerio.load(html);
    
    const modpack: ModulePackage = {
      id: packId,
      name: $('.modpack-title').text().trim(),
      description: $('.modpack-desc').text().trim() || '暂无描述',
      imageUrl: resolveUrl($('.modpack-logo img').attr('src'), baseUrl),
      mcVersion: $('.modpack-mcversion').text().trim(),
      authors: extractTexts($, '.modpack-author a'),
      downloadUrl: resolveUrl($('.modpack-download-btn a').attr('href'), baseUrl),
      modules: []
    };
    
    // 提取包含模组
    $('.modpack-included-list .item-box').each((_, el) => {
      const $el = $(el);
      const link = $el.find('a').attr('href') || '';
      const match = link.match(/\/class\/(\d+)\.html/);
      
      if (match?.[1]) {
        modpack.modules?.push({
          id: match[1],
          name: $el.find('.item-title').text().trim(),
          imageUrl: resolveUrl($el.find('img').attr('src'), baseUrl)
        });
      }
    });
    
    return modpack;
  } catch (error: any) {
    throw new Error(`解析模组包详情失败: ${error.message}`);
  }
}

export async function parseCourse(courseId: string, baseUrl: string): Promise<Course> {
  try {
    const html = await fetchHtml(`${baseUrl}/post/${courseId}.html`);
    const $ = cheerio.load(html);
    
    const course: Course = {
      id: courseId,
      title: $('.post-title').text().trim(),
      content: cleanHtml($('.post-content').html() || ''),
      author: $('.post-author a').text().trim(),
      date: $('.post-date').text().trim()
    };
    
    // 提取浏览数
    const viewText = $('.post-view').text().trim();
    const viewMatch = viewText.match(/(\d+)/);
    if (viewMatch?.[1]) {
      course.viewCount = parseInt(viewMatch[1]);
    }
    
    return course;
  } catch (error: any) {
    throw new Error(`解析教程详情失败: ${error.message}`);
  }
}

export async function parseServer(serverId: string, baseUrl: string): Promise<Server> {
  try {
    const html = await fetchHtml(`${baseUrl}/sv/${serverId}.html`);
    const $ = cheerio.load(html);
    
    const server: Server = {
      id: serverId,
      name: $('.server-name').text().trim(),
      description: $('.server-desc').text().trim() || '暂无描述',
      imageUrl: resolveUrl($('.server-logo img').attr('src'), baseUrl),
      version: $('.server-version').text().trim(),
    };
    
    // 提取IP和端口
    const ipText = $('.server-ip').text().trim();
    const ipMatch = ipText.match(/(.+?)(?::(\d+))?$/);
    if (ipMatch) {
      server.ip = ipMatch[1];
      server.port = ipMatch[2] || '25565';
    }
    
    // 提取在线状态
    server.status = $('.server-status').hasClass('online') ? 'online' : 'offline';
    
    // 提取在线人数
    if (server.status === 'online') {
      const onlineText = $('.server-players').text().trim();
      const onlineMatch = onlineText.match(/(\d+)\s*\/\s*(\d+)/);
      if (onlineMatch) {
        server.online = parseInt(onlineMatch[1]);
        server.players = parseInt(onlineMatch[2]);
      }
    }
    
    return server;
  } catch (error: any) {
    throw new Error(`解析服务器详情失败: ${error.message}`);
  }
}

export async function searchServer(keyword: string, page: number = 1, baseUrl: string): Promise<SearchResult[]> {
  try {
    // 发送POST请求
    const formData = new URLSearchParams();
    formData.append('key', keyword);
    formData.append('page', page.toString());
    
    const response = await fetch(`${baseUrl}/api/index.php`, {
      method: 'POST',
      body: formData,
      headers: {
        ...FETCH_OPTIONS.headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    
    return Array.isArray(data) ? data.map(item => ({
      id: item.id,
      name: item.name || '未知服务器',
      description: item.description || '暂无描述',
      imageUrl: item.imageUrl,
      type: 'server' as const,
      url: `${baseUrl}/sv/${item.id}.html`
    })) : [];
    
  } catch (error: any) {
    throw new Error(`搜索服务器失败: ${error.message}`);
  }
}
