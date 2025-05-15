import * as cheerio from 'cheerio';
import { createErrorResponse, createSuccessResponse, BASE_URL, validateId, fetchHtml, resolveUrl, getText, log } from '..';

// 类型定义
interface Pack {
  id: string;
  name: string;
  desc: string;
  img?: string;
  authors?: string[];
  mcVer?: string;
  dlUrl?: string;
  mods?: Array<{id: string, name: string, img?: string}>;
}

// 精简的解析函数
async function parsePack(id: string, url: string): Promise<Pack> {
  log('PACK', `开始解析模组包: ${id}`);
  try {
    const html = await fetchHtml(`${url}/modpack/${id}.html`);
    const $ = cheerio.load(html);
    
    log('PACK', `加载模组包页面成功，开始提取数据`);
    
    const pack: Pack = {
      id: id,
      name: $('.modpack-title').text().trim(),
      desc: $('.modpack-desc').text().trim() || '暂无描述',
      img: resolveUrl($('.modpack-logo img').attr('src'), url),
      mcVer: $('.modpack-mcversion').text().trim(),
      authors: getText($, '.modpack-author a'),
      dlUrl: resolveUrl($('.modpack-download-btn a').attr('href'), url),
      mods: []
    };
    
    log('PACK', `提取基本信息: ${pack.name}, 版本: ${pack.mcVer}`);
    
    // 提取包含模组
    log('PACK', `开始提取包含的模组列表`);
    $('.modpack-included-list .item-box').each((i, el) => {
      const $el = $(el);
      const link = $el.find('a').attr('href') || '';
      const match = link.match(/\/class\/(\d+)\.html/);
      
      if (match?.[1]) {
        const mod = {
          id: match[1],
          name: $el.find('.item-title').text().trim(),
          img: resolveUrl($el.find('img').attr('src'), url)
        };
        log('PACK', `找到模组: ${mod.name} (ID: ${mod.id})`);
        pack.mods?.push(mod);
      }
    });
    
    log('PACK', `模组包解析完成，包含 ${pack.mods?.length || 0} 个模组`);
    return pack;
  } catch (error: any) {
    log('PACK', `解析模组包失败: ${error.message}`, error);
    throw new Error(`解析模组包详情失败: ${error.message}`);
  }
}

// API导出函数
export async function serveModPack(params: URLSearchParams): Promise<Response> {
  const id = params.get('id');
  log('PACK_API', `请求模组包详情: ${id}`);
  
  const validId = validateId(id);
  if (typeof validId !== 'string') {
    log('PACK_API', `ID验证失败: ${JSON.stringify(validId)}`);
    return createErrorResponse(validId);
  }
  
  try {
    log('PACK_API', `开始获取模组包数据: ${validId}`);
    const data = await parsePack(validId, BASE_URL);
    log('PACK_API', `模组包数据获取成功: ${data.name}`);
    return createSuccessResponse(data);
  } catch (error: any) {
    log('PACK_API', `获取模组包失败: ${error.message}`, error);
    return createErrorResponse({
      error: '获取模组包失败',
      message: error.message,
      status: 404
    });
  }
}
