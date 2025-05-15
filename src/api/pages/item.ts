import * as cheerio from 'cheerio';
import { createErrorResponse, createSuccessResponse, BASE_URL, validateId, fetchHtml, resolveUrl, cleanHtml, log } from '..';

// 类型定义
interface Item {
  id: string;
  name: string;
  icon?: string;
  intro: string;
  modUrl?: string;
  modId?: string;
  modName?: string;
}

// 精简的解析函数
async function parseItem(id: string, url: string): Promise<Item> {
  log('ITEM', `开始解析物品: ${id}`);
  try {
    const html = await fetchHtml(`${url}/item/${id}.html`);
    const $ = cheerio.load(html);
    
    log('ITEM', `加载物品页面成功，开始提取数据`);
    
    const item: Item = {
      id: id,
      name: $('.name').text().trim(),
      icon: resolveUrl($('td > img').attr('src') || $('td > a > img').attr('src'), url),
      intro: cleanHtml($('.item-content.common-text.font14').html() || '')
    };
    
    log('ITEM', `提取基本信息: ${item.name}`);
    
    // 提取所属模组信息
    const modLink = $('.common-icon').attr('href');
    if (modLink) {
      const match = modLink.match(/\/class\/(\d+)\.html/);
      if (match?.[1]) {
        item.modId = match[1];
        item.modName = $('.common-icon').text().trim();
        item.modUrl = resolveUrl(modLink, url);
        log('ITEM', `提取所属模组: ${item.modName} (ID: ${item.modId})`);
      }
    }
    
    log('ITEM', `物品解析完成: ${item.name}`);
    return item;
  } catch (error: any) {
    log('ITEM', `解析物品失败: ${error.message}`, error);
    throw new Error(`解析物品详情失败: ${error.message}`);
  }
}

// API导出函数
export async function serveItem(params: URLSearchParams): Promise<Response> {
  const id = params.get('id');
  log('ITEM_API', `请求物品详情: ${id}`);
  
  const validId = validateId(id);
  if (typeof validId !== 'string') {
    log('ITEM_API', `ID验证失败: ${JSON.stringify(validId)}`);
    return createErrorResponse(validId);
  }
  
  try {
    log('ITEM_API', `开始获取物品数据: ${validId}`);
    const data = await parseItem(validId, BASE_URL);
    log('ITEM_API', `物品数据获取成功: ${data.name}`);
    return createSuccessResponse(data);
  } catch (error: any) {
    log('ITEM_API', `获取物品失败: ${error.message}`, error);
    return createErrorResponse({
      error: '获取物品失败',
      message: error.message,
      status: 404
    });
  }
}
