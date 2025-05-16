import * as cheerio from 'cheerio';
import { createErrorResponse, createSuccessResponse, BASE_URL, validateId, fetchHtml, log } from '..';

// 类型定义
interface Author {
  name: string;
  avatar?: string;
  id?: string;
}

interface TeamMember {
  name: string;
  avatar?: string;
  id?: string;
}

interface Statistics {
  viewCount?: number;
  editCount?: number;
  createTime?: string;
  lastUpdate?: string;
}

interface Metrics {
  statistics?: Statistics;
}

interface Teams {
  recentEditors?: TeamMember[];
  recentVisitors?: TeamMember[];
  relatedItems?: RelatedItem[];  // 添加到 Teams 中
}

interface ItemProperty {
  name: string;
  value: string;
}

interface Recipe {
  type: string;
  materials: {
    name: string;
    count: number;
    itemId?: string;
    icon?: string;
  }[];
  result: {
    name: string;
    count: number;
    itemId?: string;
    icon?: string;
  };
  notes?: string;
  version?: string;
}

interface RelatedItem {
  id: string;
  name: string;
  icon?: string;
  url?: string;
  isHighlight?: boolean;
}

interface Item {
  id: string;
  name: string;
  englishName?: string;
  icon?: string;
  intro: string;
  introMarkdown?: string;
  modId?: string;
  modName?: string;
  modUrl?: string;
  category?: string;
  categoryUrl?: string;
  properties?: ItemProperty[];
  recipes?: Recipe[];
  metrics?: Metrics;
  teams?: Teams;
}

// 提取用户ID
const extractUserId = (url: string): string => url.match(/\/(\d+)\/?$/)?.[1] || '';

// 清理图片URL
const cleanImageUrl = (url: string): string => {
  if (!url) return '';
  return (url.startsWith('//') ? 'https:' + url : url)
    .replace(/https?:\/\/www\.mcmod\.cn\/\//, '//')
    .replace(/@\d+x\d+\.jpg$/, '');
};

// 处理URL路径
const resolveUrl = (path: string, base: string): string => {
  if (!path) return '';
  path = cleanImageUrl(path);
  if (path.startsWith('//')) return 'https:' + path;
  if (path.startsWith('/') && !path.startsWith('//')) return base + path;
  return path;
};

// 提取JS弹出链接的真实URL
const extractPopoverUrl = (html: string): Record<string, string> => {
  const urlMap: Record<string, string> = {};
  const regex = /\$\("#(link_[a-zA-Z0-9_]+)"\)\.webuiPopover\({[^}]*content:"[^"]*<strong>([^<]+)<\/strong>/g;
  let match;
  while ((match = regex.exec(html)) !== null) urlMap[match[1]] = match[2];
  return urlMap;
};

// HTML转Markdown转换器
const markdownTransformers = {
  // 处理图片转换
  processImages: ($: cheerio.CheerioAPI): void => {
    $('img').each((_, el) => {
      const $el = $(el);
      const src = $el.attr('data-src') || $el.attr('src') || '';
      const imgUrl = cleanImageUrl(src);
      const alt = $el.attr('alt') || '图片';
      $el.replaceWith(`![${alt}](${imgUrl})`);
    });
  },
  // 处理标题转换
  processHeadings: ($: cheerio.CheerioAPI): void => {
    // 处理特殊标题类
    $('.common-text-title').each((_, el) => {
      const $el = $(el);
      const level = $el.hasClass('common-text-title-1') ? 2 : 
                    $el.hasClass('common-text-title-2') ? 3 : 4;
      $el.replaceWith(`\n\n${'#'.repeat(level)} ${$el.text().trim()}\n\n`);
    });
    // 处理标准HTML标题
    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const $el = $(el);
      if (!$el.hasClass('common-text-title')) {  
        const level = parseInt(el.tagName.toLowerCase().charAt(1));
        $el.replaceWith(`\n\n${'#'.repeat(level)} ${$el.text().trim()}\n\n`);
      }
    });
  },
  // 处理链接转换
  processLinks: ($: cheerio.CheerioAPI, popoverUrlMap: Record<string, string>): void => {
    $('a').each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      if (!text) return;
      const linkId = $el.attr('id') || '';
      let href = $el.attr('href') || '';
      // 处理弹出式链接
      if ((linkId && popoverUrlMap[linkId]) || (href.startsWith('javascript:void(0);') && linkId && popoverUrlMap[linkId])) href = popoverUrlMap[linkId] || '';
      // 处理有效链接
      if (href && !href.startsWith('javascript:')) {
        href = resolveUrl(href, BASE_URL);
        // 处理链接中含图片情况
        if ($el.find('img').length === 1 && $el.contents().length === 1) {
          const $img = $el.find('img');
          const imgSrc = resolveUrl($img.attr('src') || '', BASE_URL);
          const imgAlt = $img.attr('alt') || '图片';
          $el.replaceWith(`[![${imgAlt}](${imgSrc})](${href})`);
        } else {
          $el.replaceWith(`[${text}](${href})`);
        }
      } else {
        $el.replaceWith(text);
      }
    });
  },
  // 处理格式化和段落
  processText: ($: cheerio.CheerioAPI): void => {
    // 处理段落
    $('p').each((_, el) => {
      $(el).replaceWith(`\n\n${$(el).html() || ''}\n\n`);
    });
    // 处理格式化
    $('strong, b').each((_, el) => {
      $(el).replaceWith(`**${$(el).text().trim()}**`);
    });
    $('em, i').each((_, el) => {
      $(el).replaceWith(`*${$(el).text().trim()}*`);
    });
    $('hr').each((_, el) => {
      $(el).replaceWith('\n\n---\n\n');
    });
    $('br').each((_, el) => {
      $(el).replaceWith('\n');
    });
  },
  // 处理列表
  processLists: ($: cheerio.CheerioAPI): void => {
    $('ul').each((_, el) => {
      $(el).before('\n');
      $(el).find('li').each((__, li) => {
        $(li).prepend('\n- ');
      });
      $(el).after('\n\n');
    });
    $('ol').each((_, el) => {
      $(el).before('\n');
      $(el).find('li').each((i, li) => {
        $(li).prepend(`\n${i + 1}. `);
      });
      $(el).after('\n\n');
    });
  },
  // 清理DOM
  cleanupContent: ($: cheerio.CheerioAPI): void => {
    // 移除不需要的脚本和样式
    $('script, style').remove();
    // 处理代码块
    $('pre code').each((_, el) => {
      $(el).parent('pre').replaceWith(`\n\n\`\`\`\n${$(el).text().trim()}\n\`\`\`\n\n`);
    });
    // 处理行内代码
    $('code').each((_, el) => {
      if ($(el).parent('pre').length === 0) {
        $(el).replaceWith(`\`${$(el).text().trim()}\``);
      }
    });
    // 处理span元素
    $('span').each((_, el) => {
      $(el).replaceWith($(el).html() || '');
    });
    // 引用块处理
    $('blockquote').each((_, el) => {
      const content = $(el).html() || '';
      const quotedText = content.split('\n').map(line => `> ${line}`).join('\n');
      $(el).replaceWith(`\n\n${quotedText}\n\n`);
    });
    // 移除div容器，保留内容
    $('div').each((_, el) => {
      $(el).replaceWith($(el).html() || '');
    });
  }
};

// HTML转Markdown
const htmlToMarkdown = (html: string, popoverUrlMap: Record<string, string> = {}): string => {
  if (!html) return '';
  // 准备HTML
  html = html.replace(/\\"/g, '"').replace(/\\n/g, '\n');
  const $ = cheerio.load(html, { xml: { decodeEntities: false } });
  // 按顺序应用转换器
  markdownTransformers.cleanupContent($);
  markdownTransformers.processImages($);
  markdownTransformers.processHeadings($);
  markdownTransformers.processLinks($, popoverUrlMap);
  markdownTransformers.processText($);
  markdownTransformers.processLists($);
  // 获取并清理文本
  let markdownText = $.text()
    .replace(/<[^>]+>/g, '')    // 移除剩余HTML标签
    .replace(/\n{3,}/g, '\n\n') // 减少多余换行
    .replace(/&nbsp;/g, ' ')    // 替换HTML非断空格实体为普通空格
    .trim();
  // 规范化段落
  markdownText = markdownText.split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph.length > 0)
    .join('\n\n');
  // 处理特殊标签和格式
  return markdownText
    .replace(/!\[(.*?)\]\((\/\/[^)]+)\)/g, '![$1](https:$2)')
    .replace(/\[(.*?)\]\((\/\/[^)]+)\)/g, '[$1](https:$2)')
    .replace(/&nbsp;/g, ' ')
    .trim();
};

// 解析团队成员
const parseTeamMembers = ($: cheerio.CheerioAPI, selector: string, url: string): TeamMember[] => {
  const members: TeamMember[] = [];
  $(selector).find('li').each((_, el) => {
    const name = $(el).find('.text a').text().trim();
    if (!name) return;
    members.push({
      name,
      avatar: resolveUrl($(el).find('.img img').attr('src') || '', url),
      id: extractUserId(resolveUrl($(el).find('.text a').attr('href') || '', url))
    });
  });
  return members;
};

// 提取物品属性
const parseItemProperties = ($: cheerio.CheerioAPI): ItemProperty[] => {
  const properties: ItemProperty[] = [];
  $('.table.table-bordered.widetable.hidden.group-2 tr').each((_, el) => {
    const name = $(el).find('td').first().text().replace('：', '').trim();
    const value = $(el).find('td').last().text().trim();
    if (name && value) {
      properties.push({ name, value });
    }
  });
  return properties;
};

// 提取合成表
const parseRecipes = ($: cheerio.CheerioAPI): Recipe[] => {
  const recipes: Recipe[] = [];
  $('.item-table-block-out').each((_, recipeEl) => {
    const $recipe = $(recipeEl);
    
    // 解析配方类型
    const type = $recipe.find('.item-table-count p[style="color:#888"]').first().text().replace(/[\[\]]/g, '').trim();
    
    // 解析材料
    const materials: any[] = [];
    $recipe.find('.item-table-count p:not([style="color:#888"]):not(:contains("↓"))').each((_, matEl) => {
      const text = $(matEl).text().trim();
      const match = text.match(/(.*)\s*\*\s*(\d+)/);
      if (match) {
        const name = match[1].trim();
        const count = parseInt(match[2], 10);
        const itemEl = $(matEl).find('a');
        const itemId = itemEl.length ? extractItemId(itemEl.attr('href') || '') : undefined;
        
        materials.push({
          name,
          count,
          itemId,
        });
      }
    });
    
    // 解析成品
    const resultEl = $recipe.find('.item-table-count p:contains("↓") + p');
    const resultMatch = resultEl.text().trim().match(/(.*)\s*\*\s*(\d+)/);
    const result = {
      name: resultMatch ? resultMatch[1].trim() : '',
      count: resultMatch ? parseInt(resultMatch[2], 10) : 1,
      itemId: extractItemId(resultEl.find('a').attr('href') || '')
    };
    
    // 解析备注
    const notes = $recipe.find('.item-table-remarks .remark').text().trim();
    const version = $recipe.find('.alert-table-endver, .alert-table-startver').text().trim();
    
    recipes.push({
      type,
      materials,
      result,
      notes: notes || undefined,
      version: version || undefined
    });
  });
  return recipes;
};

// 提取相关物品
const parseRelatedItems = ($: cheerio.CheerioAPI, url: string): RelatedItem[] => {
  const items: RelatedItem[] = [];
  $('.common-imglist-block:contains("相关物品") .common-imglist li').each((_, el) => {
    const $el = $(el);
    const name = $el.find('.text a').text().trim();
    if (!name) return;
    
    const itemUrl = $el.find('.text a').attr('href') || '';
    const id = extractItemId(itemUrl);
    const isHighlight = $el.find('.text a').hasClass('common-text-red');
    
    items.push({
      id,
      name,
      icon: resolveUrl($el.find('.img img').attr('src') || '', url),
      url: resolveUrl(itemUrl, url),
      isHighlight
    });
  });
  return items;
};

// 提取物品ID
const extractItemId = (url: string): string => {
  if (!url) return '';
  const match = url.match(/\/item\/(\d+)\.html/);
  return match ? match[1] : '';
};

// 解析函数
async function parseItem(id: string, url: string, showOthers: boolean = false): Promise<Item> {
  log('ITEM', `开始解析物品: ${id}`);
  try {
    const html = await fetchHtml(`${url}/item/${id}.html`);
    const $ = cheerio.load(html);
    const popoverUrlMap = extractPopoverUrl(html);
    
    log('ITEM', `加载物品页面成功，开始提取数据`);
    
    // 基本信息
    const name = $('.itemname .name h5').text().trim();
    // 英文名称可能在名称括号内或在次要名称字段中
    let englishName = '';
    const nameMatch = name.match(/\((.*?)\)/);
    if (nameMatch) {
      englishName = nameMatch[1].trim();
    } else {
      englishName = $('.table.table-bordered.widetable.hidden.group-2 tr:contains("次要名称") td:last-child').text().trim();
    }
    
    // 提取图标 - 直接使用大尺寸图标
    const icon = resolveUrl($('.righttable img[width="128"]').attr('src') || '', url);
    
    // 提取介绍内容
    const introHtml = $('.item-content.common-text.font14').html() || '';
    const introMarkdown = htmlToMarkdown(introHtml, popoverUrlMap);
    
    // 提取所属模组信息
    const modLink = $('.common-nav .item[href*="/class/"]').attr('href') || '';
    const modMatch = modLink.match(/\/class\/(\d+)\.html/);
    
    // 创建基础物品对象
    const item: Item = {
      id,
      name,
      icon,
      intro: introMarkdown
    };
    
    // 只有当英文名称存在时才添加
    if (englishName) {
      item.englishName = englishName;
    }
    
    // 只有当模组信息存在时才添加
    if (modMatch) {
      item.modId = modMatch[1];
      item.modName = $('.common-nav .item[href*="/class/"]').text().trim();
      item.modUrl = resolveUrl(modLink, url);
    }
    
    // 提取分类信息
    const category = $('.table.table-bordered.widetable.hidden.group-2 tr:contains("资料分类") td:last-child a').text().trim();
    if (category) {
      item.category = category;
      item.categoryUrl = resolveUrl($('.table.table-bordered.widetable.hidden.group-2 tr:contains("资料分类") td:last-child a').attr('href') || '', url);
    }
    
    // 提取物品属性
    const properties = parseItemProperties($);
    if (properties.length > 0) {
      item.properties = properties;
    }
    
    // 提取合成表
    const recipes = parseRecipes($);
    if (recipes.length > 0) {
      item.recipes = recipes;
    }
    
    // 只有需要时才添加额外信息
    if (showOthers) {
      // 提取统计信息
      item.metrics = {
        statistics: {
          viewCount: parseInt($('.common-rowlist-2 li:contains("浏览量")').text().match(/浏览量：(\d+)/)?.[1] || '0', 10),
          editCount: parseInt($('.common-rowlist-2 li:contains("编辑次数")').text().match(/编辑次数：(\d+)/)?.[1] || '0', 10),
          createTime: $('.common-rowlist-2 li[data-original-title]:contains("创建")').attr('data-original-title')?.trim(),
          lastUpdate: $('.common-rowlist-2 li[data-original-title]:contains("最后编辑")').attr('data-original-title')?.trim()
        }
      };
      
      // 提取团队信息和相关物品
      const teams: Teams = {};
      
      // 提取团队成员
      const recentEditors = parseTeamMembers($, '.common-imglist-block:contains("最近参与编辑") .common-imglist', url);
      if (recentEditors.length > 0) teams.recentEditors = recentEditors;
      
      const recentVisitors = parseTeamMembers($, '.common-imglist-block:contains("最近浏览") .common-imglist', url);
      if (recentVisitors.length > 0) teams.recentVisitors = recentVisitors;
      
      // 提取相关物品，现在放到teams中
      const relatedItems = parseRelatedItems($, url);
      if (relatedItems.length > 0) teams.relatedItems = relatedItems;
      
      if (Object.keys(teams).length > 0) {
        item.teams = teams;
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
  const others = params.get('others') === 'true';
  log('ITEM_API', `请求物品详情: ${id}, 附加信息: ${others}`);
  
  const validId = validateId(id);
  if (typeof validId !== 'string') {
    log('ITEM_API', `ID验证失败: ${JSON.stringify(validId)}`);
    return createErrorResponse(validId);
  }
  
  try {
    log('ITEM_API', `开始获取物品数据: ${validId}`);
    const data = await parseItem(validId, BASE_URL, others);
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