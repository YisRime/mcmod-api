import * as cheerio from 'cheerio';
import { createErrorResponse, createSuccessResponse, BASE_URL, validateId, fetchHtml, log } from '..';

// 类型定义
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
  relatedItems?: RelatedItem[];
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
  introduction?: string;
  command?: string;
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

// 工具函数
const extractUserId = (url: string): string => url.match(/\/(\d+)\/?$/)?.[1] || '';

const cleanImageUrl = (url: string): string => {
  if (!url) return '';
  return (url.startsWith('//') ? 'https:' + url : url)
    .replace(/https?:\/\/www\.mcmod\.cn\/\//, '//')
    .replace(/@\d+x\d+\.jpg$/, '');
};

const resolveUrl = (path: string, base: string): string => {
  if (!path) return '';
  path = cleanImageUrl(path);
  if (path.startsWith('//')) return 'https:' + path;
  if (path.startsWith('/') && !path.startsWith('//')) return base + path;
  return path;
};

const extractPopoverUrl = (html: string): Record<string, string> => {
  const urlMap: Record<string, string> = {};
  const regex = /\$\("#(link_[a-zA-Z0-9_]+)"\)\.webuiPopover\({[^}]*content:"[^"]*<strong>([^<]+)<\/strong>/g;
  let match;
  while ((match = regex.exec(html)) !== null) urlMap[match[1]] = match[2];
  return urlMap;
};

// HTML转Markdown
const htmlToMarkdown = (html: string, popoverUrlMap: Record<string, string> = {}): string => {
  if (!html) return '';
  // 预处理 HTML
  html = html.replace(/\\"/g, '"').replace(/\\n/g, '\n');
  html = html.replace(/<br\s*\/?>/gi, '{BR_PLACEHOLDER}');
  const $ = cheerio.load(html, { xml: { decodeEntities: false } });
  // 移除不需要的元素
  $('script, style').remove();
  // 处理图片
  $('img').each(function() {
    const src = $(this).attr('data-src') || $(this).attr('src') || '';
    const imgUrl = cleanImageUrl(src);
    const alt = $(this).attr('alt') || '图片';
    $(this).replaceWith(`![${alt}](${imgUrl})`);
  });
  // 处理标题
  $('.common-text-title').each(function() {
    const level = $(this).hasClass('common-text-title-1') ? 2 : 
                  $(this).hasClass('common-text-title-2') ? 3 : 4;
    $(this).replaceWith(`\n\n${'#'.repeat(level)} ${$(this).text().trim()}\n\n`);
  });
  $('h1, h2, h3, h4, h5, h6').each(function() {
    if (!$(this).hasClass('common-text-title')) {  
      const level = parseInt(this.tagName.toLowerCase().charAt(1));
      $(this).replaceWith(`\n\n${'#'.repeat(level)} ${$(this).text().trim()}\n\n`);
    }
  });
  // 处理链接
  $('a').each(function() {
    const text = $(this).text().trim();
    if (!text) return;
    const linkId = $(this).attr('id') || '';
    let href = $(this).attr('href') || '';
    if ((linkId && popoverUrlMap[linkId]) || (href.startsWith('javascript:void(0);') && linkId && popoverUrlMap[linkId])) 
      href = popoverUrlMap[linkId] || '';
    if (href && !href.startsWith('javascript:')) {
      href = resolveUrl(href, BASE_URL);
      if ($(this).find('img').length === 1 && $(this).contents().length === 1) {
        const $img = $(this).find('img');
        const imgSrc = resolveUrl($img.attr('src') || '', BASE_URL);
        const imgAlt = $img.attr('alt') || '图片';
        $(this).replaceWith(`[![${imgAlt}](${imgSrc})](${href})`);
      } else {
        $(this).replaceWith(`[${text}](${href})`);
      }
    } else {
      $(this).replaceWith(text);
    }
  });
  // 处理格式化和段落
  $('p').each(function() {
    $(this).replaceWith(`\n\n${$(this).html() || ''}\n\n`);
  });
  $('strong, b').each(function() {
    $(this).replaceWith(`**${$(this).text().trim()}**`);
  });
  $('em, i').each(function() {
    $(this).replaceWith(`*${$(this).text().trim()}*`);
  });
  $('hr').each(function() {
    $(this).replaceWith('\n\n---\n\n');
  });
  // 处理列表
  $('ul').each(function() {
    $(this).before('\n');
    $(this).find('li').each(function() {
      $(this).prepend('\n- ');
    });
    $(this).after('\n\n');
  });
  $('ol').each(function() {
    $(this).before('\n');
    $(this).find('li').each(function(i) {
      $(this).prepend(`\n${i + 1}. `);
    });
    $(this).after('\n\n');
  });
  // 清理DOM
  $('pre code').each(function() {
    $(this).parent('pre').replaceWith(`\n\n\`\`\`\n${$(this).text().trim()}\n\`\`\`\n\n`);
  });
  $('code').each(function() {
    if ($(this).parent('pre').length === 0) {
      $(this).replaceWith(`\`${$(this).text().trim()}\``);
    }
  });
  $('span').each(function() {
    $(this).replaceWith($(this).html() || '');
  });
  $('blockquote').each(function() {
    const content = $(this).html() || '';
    const quotedText = content.split('\n').map(line => `> ${line}`).join('\n');
    $(this).replaceWith(`\n\n${quotedText}\n\n`);
  });
  // 移除div容器，保留内容
  $('div').each(function() {
    $(this).replaceWith($(this).html() || '');
  });
  // 清理文本
  let markdownText = $.text()
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/&nbsp;/g, ' ')
    .trim();
  // 将预处理中的 <br> 占位符替换回换行符
  markdownText = markdownText.replace(/{BR_PLACEHOLDER}/g, '\n');
  // 合并多个连续空行，但保留单个换行符的语义
  markdownText = markdownText.split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph.length > 0)
    .join('\n\n');
  return markdownText
    .replace(/!\[(.*?)\]\((\/\/[^)]+)\)/g, '![$1](https:$2)')
    .replace(/\[(.*?)\]\((\/\/[^)]+)\)/g, '[$1](https:$2)')
    .replace(/&nbsp;/g, ' ')
    .trim();
};

// 提取物品ID
const extractItemId = (url: string): string => {
  if (!url) return '';
  const match = url.match(/\/item\/(\d+)\.html/);
  return match ? match[1] : '';
};

// 解析多物品页面
async function parseMultiItems(id: string, url: string, showOthers: boolean = false): Promise<Item[]> {
  try {
    const html = await fetchHtml(`${url}/item/${id}.html`);
    const $ = cheerio.load(html);
    const popoverUrlMap = extractPopoverUrl(html);
    // 提取共享信息 - 模组信息
    const modLink = $('.common-nav .item[href*="/class/"]').attr('href') || '';
    const modMatch = modLink.match(/\/class\/(\d+)\.html/);
    const modId = modMatch ? modMatch[1] : undefined;
    const modName = $('.common-nav .item[href*="/class/"]').text().trim();
    const modUrl = modLink ? resolveUrl(modLink, url) : undefined;
    // 提取共享信息 - 统计信息和团队信息
    let metrics: Metrics | undefined;
    let teams: Teams | undefined;
    if (showOthers) {
      // 解析统计信息
      metrics = {
        statistics: {
          viewCount: parseInt($('.common-rowlist-2 li:contains("浏览量")').text().match(/浏览量：(\d+)/)?.[1] || '0', 10),
          editCount: parseInt($('.common-rowlist-2 li:contains("编辑次数")').text().match(/编辑次数：(\d+)/)?.[1] || '0', 10),
          createTime: $('.common-rowlist-2 li[data-original-title]:contains("创建")').attr('data-original-title')?.trim(),
          lastUpdate: $('.common-rowlist-2 li[data-original-title]:contains("最后编辑")').attr('data-original-title')?.trim()
        }
      };
      teams = {};
      // 解析团队成员
      const recentEditors: TeamMember[] = [];
      $('.common-imglist-block:contains("最近参与编辑") .common-imglist li').each(function() {
        const name = $(this).find('.text a').text().trim();
        if (!name) return;
        recentEditors.push({
          name, avatar: resolveUrl($(this).find('.img img').attr('src') || '', url),
          id: extractUserId(resolveUrl($(this).find('.text a').attr('href') || '', url))
        });
      });
      if (recentEditors.length > 0) teams.recentEditors = recentEditors;
      const recentVisitors: TeamMember[] = [];
      $('.common-imglist-block:contains("最近浏览") .common-imglist li').each(function() {
        const name = $(this).find('.text a').text().trim();
        if (!name) return;
        recentVisitors.push({
          name, avatar: resolveUrl($(this).find('.img img').attr('src') || '', url),
          id: extractUserId(resolveUrl($(this).find('.text a').attr('href') || '', url))
        });
      });
      if (recentVisitors.length > 0) teams.recentVisitors = recentVisitors;
      // 解析相关物品
      const relatedItems: RelatedItem[] = [];
      $('.common-imglist-block:contains("相关物品") .common-imglist li').each(function() {
        const name = $(this).find('.text a').text().trim();
        if (!name) return;
        const itemUrl = $(this).find('.text a').attr('href') || '';
        const itemId = extractItemId(itemUrl);
        const isHighlight = $(this).find('.text a').hasClass('common-text-red');
        relatedItems.push({
          id: itemId, name, url: resolveUrl(itemUrl, url), isHighlight,
          icon: resolveUrl($(this).find('.img img').attr('src') || '', url),
        });
      });
      if (relatedItems.length > 0) teams.relatedItems = relatedItems;
    }
    // 遍历每个item-row解析物品数据
    const items: Item[] = [];
    $('.item-row').each(function(index) {
      // 获取物品ID和名称信息
      const $row = $(this);
      // 直接使用页面中的ID作为物品ID
      const itemId = id;
      const nameText = $row.find('.itemname .name h5').text().trim();
      let name = nameText;
      let englishName = '';
      // 尝试从名称中提取英文名称（通常在括号中）
      const nameMatch = nameText.match(/(.*?)\s*\((.*?)\)/);
      if (nameMatch) {
        name = nameMatch[1].trim();
        englishName = nameMatch[2].trim();
      } else {
        // 尝试从属性表中获取次要名称
        englishName = $row.find('.table.table-bordered.widetable.hidden.group-2 tr:contains("次要名称") td:last-child').text().trim();
      }
      // 提取物品命令
      const command = $row.find('.item-give').attr('data-command') || '';
      // 提取物品图标
      const icon = resolveUrl($row.find('.item-data .righttable img[width="128"]').first().attr('src') || '', url);
      // 提取介绍内容
      const introHtml = $row.find('.item-content.common-text.font14').html() || '';
      const introductionMarkdown = htmlToMarkdown(introHtml, popoverUrlMap);
      // 提取分类信息
      const category = $row.find('.table.table-bordered.widetable.hidden.group-2 tr:contains("资料分类") td:last-child a').text().trim();
      const categoryUrl = resolveUrl($row.find('.table.table-bordered.widetable.hidden.group-2 tr:contains("资料分类") td:last-child a').attr('href') || '', url);
      // 提取物品属性，排除主要名称、次要名称和资料分类
      const properties: ItemProperty[] = [];
      $row.find('.table.table-bordered.widetable.hidden.group-2 tr').each(function() {
        const name = $(this).find('td').first().text().replace('：', '').trim();
        const value = $(this).find('td').last().text().trim();
        // 排除主要名称、次要名称和资料分类，因为它们已经在其他字段中
        if (name && value && name !== '主要名称' && name !== '次要名称' && name !== '资料分类') {
          properties.push({ name, value });
        }
      });
      // 提取合成表
      const recipes: Recipe[] = [];
      $row.find('.item-table-area').each(function() {
        // 在每个item-table-area区域内处理所有合成表
        $(this).find('.item-table-block-out tr:not(:has(th))').each(function() {
          // 解析配方类型
          const typeText = $(this).find('.item-table-count p[style="color:#888"]').first().text().trim();
          // 删除方括号和"使用: "前缀
          const type = typeText.replace(/\[使用:\s*|\]/g, '').trim();
          if (!type) return; // 跳过没有类型的行
          // 解析材料
          const materials: any[] = [];
          $(this).find('.item-table-count p:not([style="color:#888"]):not(:contains("↓"))').each(function() {
            const text = $(this).text().trim();
            const match = text.match(/(.*)\s*\*\s*(\d+)/);
            if (match) {
              const name = match[1].trim();
              const count = parseInt(match[2], 10);
              const itemEl = $(this).find('a');
              const itemId = itemEl.length ? extractItemId(itemEl.attr('href') || '') : undefined;
              materials.push({ name, count, itemId, });
            }
          });
          // 解析成品
          const resultEl = $(this).find('.item-table-count p:contains("↓") + p');
          const resultMatch = resultEl.text().trim().match(/(.*)\s*\*\s*(\d+)/);
          const result = {
            name: resultMatch ? resultMatch[1].trim() : '',
            count: resultMatch ? parseInt(resultMatch[2], 10) : 1,
            itemId: extractItemId(resultEl.find('a').attr('href') || '')
          };
          // 完善备注提取逻辑
          let notes = '';
          // 提取常规备注
          const remarkText = $(this).find('.item-table-remarks .remark').text().trim();
          if (remarkText) notes = remarkText;
          // 提取版本信息
          const versionTexts: string[] = [];
          $(this).find('.item-table-remarks .alert-table-endver').each(function() {
            versionTexts.push($(this).text().trim());
          });
          $(this).find('.item-table-remarks .alert-table-startver').each(function() {
            versionTexts.push($(this).text().trim());
          });
          if (versionTexts.length > 0) {
            const versionText = versionTexts.join('，');
            notes = notes ? `${notes}（${versionText}）` : versionText;
          }
          // 提取其他模组提供的信息
          $(this).find('.item-table-remarks .alert-table-guifromother').each(function() {
            const guiFromOther = $(this).text().trim();
            if (guiFromOther) notes = notes ? `${notes}；${guiFromOther}` : guiFromOther;
          });
          // 清理备注中的多余内容
          notes = notes
            .replace(/^\s+|\s+$/g, '') // 删除首尾空白
            .replace(/\s*[;；]\s*/g, '；') // 规范化分号
            .replace(/\s*[,，]\s*/g, '，') // 规范化逗号
            .replace(/\s*[(（]\s*/g, '（') // 规范化左括号
            .replace(/\s*[)）]\s*/g, '）') // 规范化右括号
            .replace(/；+/g, '；') // 删除重复分号
            .replace(/，+/g, '，') // 删除重复逗号
            .trim();
          recipes.push({ type, materials, result, notes: notes || undefined });
        });
      });
      // 创建物品对象 - 只包含必填字段
      const item: Item = { id: itemId, name };
      // 只添加有值的字段
      if (introductionMarkdown) item.introduction = introductionMarkdown;
      if (icon) item.icon = icon;
      if (command) item.command = command;
      if (englishName) item.englishName = englishName;
      // 添加模组信息，仅当有modId时
      if (modId) {
        item.modId = modId;
        if (modName) item.modName = modName;
        if (modUrl) item.modUrl = modUrl;
      }
      // 添加分类信息，仅当有category时
      if (category) {
        item.category = category;
        if (categoryUrl) item.categoryUrl = categoryUrl;
      }
      // 添加属性和配方，仅当有内容时
      if (properties.length > 0) item.properties = properties;
      if (recipes.length > 0) item.recipes = recipes;
      // 添加统计和团队信息(如果需要)
      if (showOthers) {
        if (metrics && metrics.statistics) {
          // 只包含有实际值的统计信息
          const stats = Object.entries(metrics.statistics).reduce((acc: any, [key, value]) => {
            if (value !== undefined && value !== null && value !== '') acc[key] = value;
            return acc;
          }, {});
          if (Object.keys(stats).length > 0) item.metrics = { statistics: stats as Statistics };
        }
        if (teams && Object.keys(teams).length > 0) {
          const newTeams: Teams = {};
          if (teams.recentEditors && teams.recentEditors.length > 0) newTeams.recentEditors = teams.recentEditors;
          if (teams.recentVisitors && teams.recentVisitors.length > 0) newTeams.recentVisitors = teams.recentVisitors;
          if (teams.relatedItems && teams.relatedItems.length > 0) newTeams.relatedItems = teams.relatedItems;
          if (Object.keys(newTeams).length > 0) item.teams = newTeams;
        }
      }
      items.push(item);
    });
    return items;
  } catch (error: any) {
    log('MULTI_ITEM', `解析物品页面失败: ${error.message}`, error);
    throw new Error(`解析物品页面失败: ${error.message}`);
  }
}

// API导出函数
export async function serveItem(params: URLSearchParams): Promise<Response> {
  const id = params.get('id');
  const others = params.get('others') === 'true';
  log('MULTI_ITEM_API', `请求物品页面: ${id}, 附加信息: ${others}`);
  const validId = validateId(id);
  if (typeof validId !== 'string') return createErrorResponse(validId);
  try {
    const data = await parseMultiItems(validId, BASE_URL, others);
    return createSuccessResponse(data);
  } catch (error: any) {
    log('MULTI_ITEM_API', `获取物品失败: ${error.message}`, error);
    return createErrorResponse({ error: '获取物品失败', message: error.message, status: 404 });
  }
}