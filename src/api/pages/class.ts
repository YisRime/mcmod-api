import * as cheerio from 'cheerio';
import { createErrorResponse, createSuccessResponse, BASE_URL, validateId, fetchHtml, log } from '..';

// 接口定义
interface Author {
  name: string;
  position?: string;
  avatar?: string;
  id?: string;
}

interface Status {
  status: 'active' | 'semi-abandoned' | 'inactive'; // 活跃、半弃坑、停更
  isOpenSource: boolean;
}

// 基本信息接口
interface BasicInfo {
  id: string;
  name: string;
  englishName?: string;
  shortName?: string;
  img?: string;
  status?: Status;
  categories?: string[];
  tags?: string[];
}

// 兼容性信息接口
interface Compatibility {
  platforms?: string[];
  apis?: string[];
  environment?: string;
  mcVersions?: McVersions;
}

interface Statistics {
  viewCount?: string;
  downloadCount?: string; 
  popularity?: string;
  fillRate?: string;
  yesterdayIndex?: string;
  yesterdayAvgIndex?: string;
  editCount?: string;
  modpackCount?: string;
  resourceCount?: string;
  resourceDataCount?: string;
  serverCount?: string;
  serverInstallRate?: string;
  createTime?: string;
  lastUpdate?: string;
  lastRecommend?: string;
}

interface DetailedRating {
  positive: string;
  neutral: string;
  negative: string;
}

interface Ratings {
  redVotes?: string;
  blackVotes?: string;
  detailedRatings?: Record<string, DetailedRating>;
}

interface McVersions {
  forge?: string[];
  fabric?: string[];
  behaviorPack?: string[];
}

interface Link {
  title?: string;
  url: string;
}

interface UpdateLog {
  version: string;
  date: string;
}

interface TeamMember {
  name: string;
  avatar: string;
  id: string;
}

interface Teams {
  managementTeam?: TeamMember[];
  editingTeam?: TeamMember[];
  developmentTeam?: TeamMember[];
  recentEditors?: TeamMember[];
  recentVisitors?: TeamMember[];
}

interface ModResource {
  typeId: string;
  count: number;
}

interface RelatedMod {
  id?: string;
  name: string;
}

interface ModRelation {
  version: string;
  dependencyMods?: RelatedMod[];
  relationMods?: RelatedMod[];
}

interface ModTutorial {
  id: string;
  title: string;
}

interface ModDiscussion {
  id: string;
  title: string;
}

interface Metrics {
  statistics?: Statistics;
  ratings?: Ratings;
  updateLogs?: UpdateLog[];
}

interface Community {
  tutorials?: ModTutorial[];
  discussions?: ModDiscussion[];
}

interface Mod {
  basicInfo: BasicInfo;
  compatibility: Compatibility;
  authors?: Author[];
  links?: Link[];
  metrics?: Metrics;
  teams?: Teams;
  resources?: ModResource[];
  relations?: ModRelation[];
  community?: Community;
  introduction?: string;
}

// 工具函数
const extractCategoryId = (url: string): string | undefined => url.match(/category=(\d+)/)?.[1];

const cleanImageUrl = (url: string): string => {
  if (!url) return '';
  return (url.startsWith('//') ? 'https:' + url : url)
    .replace(/https?:\/\/www\.mcmod\.cn\/\//, '//')
    .replace(/@\d+x\d+\.jpg$/, '');
};

const decodeExternalLink = (url: string): string => {
  if (!url) return url;
  const targetMatch = url.match(/link\.mcmod\.cn\/target\/([A-Za-z0-9+/=]+)/);
  if (!targetMatch) return url;
  try {
    // 使用 Web API
    const base64 = targetMatch[1].replace(/-/g, '+').replace(/_/g, '/');
    // 解码 Base64 为二进制字符串
    const binaryString = atob(base64);
    // 转换二进制字符串为 UTF-8
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    // 使用 TextDecoder 解码为 UTF-8 字符串
    return new TextDecoder('utf-8').decode(bytes);
  } catch (error) {
    log('URL_DECODE', `解码链接失败: ${url}, 错误: ${error}`, error);
    return url;
  }
};

const resolveUrl = (path: string, base: string): string => {
  if (!path) return '';
  path = cleanImageUrl(path);
  if (path.includes('link.mcmod.cn/target/')) return decodeExternalLink(path);
  if (path.startsWith('//')) return 'https:' + path;
  if (path.startsWith('/') && !path.startsWith('//')) return base + path;
  return path;
};

// HTML到Markdown的转换
const htmlToMarkdown = (html: string, popoverUrlMap: Record<string, string> = {}): string => {
  if (!html) return '';
  const $ = cheerio.load(html);
  $('script').remove();
  // 处理图片
  $('img').each((_, el) => {
    const src = $(el).attr('data-src') || $(el).attr('src') || '';
    const imgUrl = src.startsWith('//') ? 'https:' + src : src;
    const alt = $(el).attr('alt') || '图片';
    $(el).replaceWith(`![${alt}](${imgUrl})`);
  });
  // 处理链接
  $('a').each((_, el) => {
    const $el = $(el);
    // 检查链接是否有文本内容，如果没有则跳过
    const text = $el.text().trim();
    if (!text) return;
    $el.attr('data-markdown-processed', 'true');
    // 处理JavaScript弹出式链接
    const linkId = $el.attr('id') || '';
    if (linkId && popoverUrlMap[linkId]) {
      const href = popoverUrlMap[linkId];
      $el.replaceWith(`[${text}](${href})`);
      return;
    }
    let href = $el.attr('href') || '';
    if (href.startsWith('//')) href = 'https:' + href;
    // 根据内容类型转换
    if (/\[.*?\]\(.*?\)/.test(text)) {
      $el.replaceWith(text);
    } else if ($el.children('img').length === 1 && $el.contents().length === 1) {
      const $img = $el.children('img');
      const imgSrc = $img.attr('src') || '';
      const imgAlt = $img.attr('alt') || '图片';
      $el.replaceWith(`[![${imgAlt}](${imgSrc})](${href})`);
    } else {
      $el.replaceWith(`[${text}](${href})`);
    }
  });
  // 处理标题和基本格式
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const level = parseInt(el.tagName.toLowerCase().charAt(1));
    $(el).replaceWith(`\n\n${'#'.repeat(level)} ${$(el).text().trim()}\n\n`);
  });
  $('p').each((_, el) => { $(el).replaceWith(`\n\n${$(el).text().trim()}\n\n`); });
  $('strong, b').each((_, el) => { $(el).replaceWith(`**${$(el).text().trim()}**`); });
  $('em, i').each((_, el) => { $(el).replaceWith(`*${$(el).text().trim()}*`); });
  // 处理列表
  $('ul').each((_, el) => {
    $(el).find('li').each((__, li) => { $(li).replaceWith(`\n- ${$(li).text().trim()}`); });
    $(el).replaceWith($(el).html() + '\n\n');
  });
  $('ol').each((_, el) => {
    $(el).find('li').each((i, li) => { $(li).replaceWith(`\n${i + 1}. ${$(li).text().trim()}`); });
    $(el).replaceWith($(el).html() + '\n\n');
  });
  // 清理并返回
  return $.text()
    .replace(/([^\s])\n([^\s])/g, '$1 $2')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{3,}/g, ' ')
    .replace(/\[([^\]]+)\]\(\/\/([^)]+)\)/g, (_, text, url) => `[${text}](https://${url})`)
    .trim();
};

// 提取用户ID
const extractUserId = (url: string): string => url.match(/\/(\d+)\/?$/)?.[1] || '';

// 解析团队成员
const parseTeamMembers = ($: cheerio.CheerioAPI, selector: string, url: string): TeamMember[] => {
  const members: TeamMember[] = [];
  if ($(selector).find('.null').length) return members;
  $(selector).find('li').each((_, el) => {
    const name = $(el).find('.text a').text().trim();
    if (!name) return;
    members.push({
      name, avatar: resolveUrl($(el).find('.img img').attr('src') || '', url),
      id: extractUserId(resolveUrl($(el).find('.text a').attr('href') || '', url))
    });
  });
  return members;
};

// 其他解析
const parseAuthors = ($: cheerio.CheerioAPI, url: string): Author[] => {
  const authors: Author[] = [];
  $('.author .member').each((_, el) => {
    const authorUrl = $(el).find('.name a').attr('href') || '';
    const authorId = authorUrl.match(/\/author\/(\d+)\.html/)?.[1] || '';
    authors.push({
      name: $(el).find('.name a').text().trim(),
      position: $(el).find('.position').text().trim(),
      avatar: resolveUrl($(el).parent().find('.avatar a img').attr('src') || '', url),
      id: authorId
    });
  });
  return authors;
};

// 分类解析
const parseCategories = ($: cheerio.CheerioAPI): string[] => {
  const categories: string[] = [];
  // 主分类
  $('.common-class-category .main a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const categoryId = extractCategoryId(href);
    const xlinkHref = $(el).find('svg use').attr('xlink:href') || '';
    const mainCategoryId = xlinkHref.match(/#common-icon-category-(\d+)/)?.[1] || categoryId;
    if (mainCategoryId && !categories.includes(mainCategoryId)) categories.push(mainCategoryId);
  });
  // 普通分类
  $('.common-class-category .normal').each((_, el) => {
    const categoryId = extractCategoryId($(el).attr('href') || '');
    if (categoryId && !categories.includes(categoryId)) categories.push(categoryId);
  });
  return categories;
};

// 提取JS弹出链接的真实URL
const extractPopoverUrl = (html: string): Record<string, string> => {
  const urlMap: Record<string, string> = {};
  // 匹配 $("#link_XXXX").webuiPopover 的模式
  const scriptRegex = /\$\("#(link_[a-zA-Z0-9_]+)"\)\.webuiPopover\({[^}]*content:"[^"]*<strong>([^<]+)<\/strong>/g;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const id = match[1]; // 完整的link_ID
    const url = match[2]; // URL在<strong>标签中
    if (id && url) urlMap[id] = url;
  }
  return urlMap;
};

// 链接解析
const parseLinks = ($: cheerio.CheerioAPI, url: string): Link[] => {
  const links: Link[] = [];
  const processedUrls = new Set<string>();
  // 处理常规链接
  $('.common-link-icon-frame li').each((_, el) => {
    const a = $(el).find('a');
    const href = a.attr('href') || '';
    const title = a.attr('data-original-title')?.trim() || $(el).find('.name').text().trim();
    // 确定最终URL
    let finalUrl = '';
    if (href && !href.includes('javascript:')) finalUrl = href;
    // 添加有效链接
    finalUrl = resolveUrl(finalUrl, url);
    if (finalUrl && !finalUrl.includes('javascript:') && !processedUrls.has(finalUrl)) {
      processedUrls.add(finalUrl);
      links.push({ title, url: finalUrl });
    }
  });
  return links;
};

const parseDetailedRatings = ($: cheerio.CheerioAPI): Record<string, DetailedRating> => {
  const detailedRatings: Record<string, DetailedRating> = {};
  $('.progress-list').each((_, el) => {
    const tooltipEl = $(el).find('div[data-original-title]');
    if (!tooltipEl.length) return;
    const tooltipTitle = tooltipEl.attr('data-original-title') || '';
    const categoryMatch = tooltipTitle.match(/\[([\u4e00-\u9fa5]+)\]/);
    if (!categoryMatch?.[1]) return;
    const category = categoryMatch[1];
    const ratingFields: Record<string, { positive: string, neutral: string, negative: string }> = {
      '趣味': { positive: '好玩', neutral: '一般', negative: '没意思' },
      '难度': { positive: '有挑战', neutral: '一般', negative: '太简单' },
      '稳定': { positive: '很稳定', neutral: '一般', negative: '不稳定' },
      '实用': { positive: '很实用', neutral: '一般', negative: '没啥用' },
      '美观': { positive: '很漂亮', neutral: '一般', negative: '太丑了' },
      '平衡': { positive: '合理', neutral: '一般', negative: '变态' },
      '兼容': { positive: '兼容好', neutral: '一般', negative: '兼容差' },
      '持久': { positive: '很耐玩', neutral: '一般', negative: '容易腻' }
    };
    const fields = ratingFields[category];
    if (!fields) return;
    const positive = tooltipTitle.match(new RegExp(`${fields.positive}:(\\d+)`))?.[1] || '0';
    const neutral = tooltipTitle.match(new RegExp(`${fields.neutral}:(\\d+)`))?.[1] || '0';
    const negative = tooltipTitle.match(new RegExp(`${fields.negative}:(\\d+)`))?.[1] || '0';
    detailedRatings[category] = { positive, neutral, negative };
  });
  return detailedRatings;
};

// 主解析函数
async function parseMod(id: string, url: string, showOthers: boolean = false, showCommunity: boolean = false, showRelations: boolean = false): Promise<Mod> {
  log('MOD', `开始解析模组: ${id}`);
  try {
    const html = await fetchHtml(`${url}/class/${id}.html`);
    const $ = cheerio.load(html);
    // 提取JavaScript弹出链接
    const popoverUrlMap = extractPopoverUrl(html);
    if ($('.class-title').length === 0) throw new Error(`未找到ID为${id}的模组`);
    // 创建基本信息对象
    const basicInfo: BasicInfo = {
      id, name: $('.class-title h3').text().trim(),
      englishName: $('.class-title h4').text().trim(),
      shortName: $('.class-title .short-name').text().trim(),
      img: resolveUrl($('.class-cover-image img').attr('src') || '', url),
      status: {
        status: (() => {
          const statusText = $('.class-status').text().trim();
          if (statusText === '停更') return 'inactive';
          if (statusText === '半弃坑') return 'semi-abandoned';
          return 'active';
        })(),
        isOpenSource: $('.class-source').text().trim() !== '闭源'
      },
      categories: parseCategories($),
      tags: $('.class-info-left .tag a').map((_, el) => $(el).text().trim()).get()
    };
    // 创建兼容性信息对象
    const compatibility: Compatibility = {
      platforms: $('.class-info-left li').filter((_, el) => $(el).text().includes('支持平台')).find('a').map((_, el) => $(el).text().trim()).get(),
      apis: $('.class-info-left li').filter((_, el) => $(el).text().includes('运作方式')).find('a').map((_, el) => $(el).text().trim()).get(),
      environment: $('.class-info-left li').filter((_, el) => $(el).text().includes('运行环境')).text().replace('运行环境:', '').trim(),
    };
    // 提取MC版本支持
    const mcVersions: McVersions = {};
    $('.mcver ul').each((_, el) => {
      const loaderLabel = $(el).find('li').first().text().trim();
      const versions = $(el).find('a').map((_, link) => $(link).text().trim()).get();
      if (loaderLabel.includes('行为包')) mcVersions.behaviorPack = versions;
      else if (loaderLabel.includes('Forge')) mcVersions.forge = versions;
      else if (loaderLabel.includes('Fabric')) mcVersions.fabric = versions;
    });
    if (Object.keys(mcVersions).length > 0) compatibility.mcVersions = mcVersions;
    // 创建基础模组对象
    const mod: Mod = { basicInfo, compatibility, authors: parseAuthors($, url), links: parseLinks($, url) };
    // 额外信息
    if (showOthers) {
      // 统计信息
      const statistics: Statistics = {
        viewCount: $('.infos .span').first().find('.n').text().trim(),
        fillRate: $('.infos .span').last().find('.n').text().trim(),
        popularity: $('.block-left .up').text().trim(),
        downloadCount: $('.download-btn').attr('title')?.replace('共', '').replace('次下载', '').trim()
      };
      // 添加其他统计指标
      const statsMap: [string, RegExp | string, (v: string) => string][] = [
        ['yesterdayIndex', '.block-right .text:first', v => v.replace('昨日指数:', '').trim()],
        ['yesterdayAvgIndex', '.block-right .text:eq(1)', v => v.replace('昨日平均指数:', '').trim()],
        ['editCount', /编辑次数:(\d+)次/, v => v.replace('编辑次数:', '').replace('次', '').trim()],
        ['modpackCount', /有\s+(\d+)\s+个已收录的整合包/, v => v.match(/有\s+(\d+)\s+个已收录的整合包/)?.[1] || ''],
        ['serverCount', /有\s+(\d+)\s+台已收录的服务器/, v => v.match(/有\s+(\d+)\s+台已收录的服务器/)?.[1] || ''],
        ['serverInstallRate', /安装率为\s+([0-9.]+)%/, v => v.match(/安装率为\s+([0-9.]+)%/)?.[1] || '']
      ];
      for (const [key, selector, transform] of statsMap) {
        if (typeof selector === 'string') {
          const value = $(selector).text();
          if (value) statistics[key as keyof Statistics] = transform(value);
        } else {
          $('.class-info-left li, .infolist').each((_, el) => {
            const text = $(el).text();
            const match = text.match(selector);
            if (match) statistics[key as keyof Statistics] = transform(text);
          });
        }
      }
      // 时间信息
      const timeSelectors = [['createTime', '收录时间'], ['lastUpdate', '最后编辑'], ['lastRecommend', '最后推荐']];
      for (const [key, label] of timeSelectors) {
        statistics[key as keyof Statistics] = $('.class-info-left li')
          .filter((_, el) => $(el).text().includes(label))
          .attr('data-original-title')?.trim();
      }
      // 评分信息
      const ratings: Ratings = {
        redVotes: $('.class-card .text-block span').first().text().match(/红票(\d+)/)?.[1],
        blackVotes: $('.class-card .text-block span').last().text().match(/黑票(\d+)/)?.[1],
        detailedRatings: parseDetailedRatings($)
      };
      // 更新日志
      const updateLogs = $('.common-rowlist.log li').map((_, el) => ({
        version: $(el).find('a').text().trim(),
        date: $(el).find('.time').text().trim()
      })).get();
      mod.metrics = { statistics, ratings, updateLogs };
      // 团队信息
      const teams: Teams = {};
      const teamSelectors: Record<string, string> = {
        managementTeam: '.common-imglist-block:contains("管理组") .common-imglist',
        editingTeam: '.common-imglist-block:contains("编辑组") .common-imglist',
        developmentTeam: '.common-imglist-block:contains("开发组") .common-imglist',
        recentEditors: '.common-imglist-block:contains("最近参与编辑") .common-imglist',
        recentVisitors: '.common-imglist-block:contains("最近浏览") .common-imglist'
      };
      for (const [key, selector] of Object.entries(teamSelectors)) {
        const members = parseTeamMembers($, selector, url);
        if (members.length > 0) teams[key as keyof Teams] = members;
      }
      if (Object.keys(teams).length > 0) mod.teams = teams;
    }
    // 资源信息
    mod.resources = $('.class-item-type .mold').filter((_, el) => !$(el).hasClass('mold-0')).map((_, el) => {
      const link = $(el).find('a');
      return {
        typeId: link.attr('href')?.match(/\/\d+-(\d+)\.html$/)?.[1] || '',
        count: parseInt(link.find('.count').text().match(/\((\d+)条\)/)?.[1] || '0')
      };
    }).get();
    // 社区信息
    if (showCommunity) {
      const tutorials: ModTutorial[] = [];
      const processedIds = new Set<string>();
      // 教程提取
      const tutorialSelectors = [
        '.class-post-frame .post-block .title a',
        '.class-post-list li a'
      ];
      for (const selector of tutorialSelectors) {
        $(selector).each((_, el) => {
          const title = $(el).text().trim();
          const url = $(el).attr('href') || '';
          const id = url.match(/\/post\/(\d+)\.html/)?.[1] || '';
          if (id && !processedIds.has(id)) {
            processedIds.add(id);
            tutorials.push({ id, title });
          }
        });
      }
      // 讨论提取
      const discussions = $('.class-thread-list li a').map((_, el) => {
        const title = $(el).text().trim();
        const url = $(el).attr('href') || '';
        const id = url.match(/thread-(\d+)-/)?.[1] || '';
        return id ? { id, title } : null;
      }).get().filter(Boolean) as ModDiscussion[];
      if (tutorials.length > 0 || discussions.length > 0) {
        mod.community = {};
        if (tutorials.length > 0) mod.community.tutorials = tutorials;
        if (discussions.length > 0) mod.community.discussions = discussions;
      }
    }
    // 关系信息
    if (showRelations) {
      mod.relations = $('.class-relation-list fieldset').map((_, fieldset) => {
        const version = $(fieldset).find('legend').text().trim();
        const relation: ModRelation = { version };
        $(fieldset).find('li.relation').each((_, relEl) => {
          const relType = $(relEl).find('span').text().includes('依赖') ? 'dependencyMods' : 'relationMods';
          const mods = $(relEl).find('ul a').map((_, modEl) => ({
            id: $(modEl).attr('href')?.match(/\/class\/(\d+)\.html$/)?.[1],
            name: $(modEl).text().trim()
          })).get();
          if (mods.length > 0) relation[relType as keyof Pick<ModRelation, 'dependencyMods' | 'relationMods'>] = mods;
        });
        return relation;
      }).get();
    }
    // 介绍信息
    const introContainer = $('.class-menu-main .text-area.common-text.font14').first();
    if (introContainer.length) mod.introduction = htmlToMarkdown(introContainer.html() || '', popoverUrlMap);
    log('MOD', `模组解析完成: ${mod.basicInfo.name}`);
    return mod;
  } catch (error: any) {
    log('MOD', `解析模组失败: ${error.message}`, error);
    throw new Error(`解析模组详情失败: ${error.message}`);
  }
}

export async function serveClass(params: URLSearchParams): Promise<Response> {
  const id = params.get('id');
  const others = params.get('others') === 'true';
  const community = params.get('community') === 'true';
  const relations = params.get('relations') === 'true';
  log('MOD_API', `请求模组详情: ${id}, 包含附加信息: ${others}, 包含社区信息: ${community}, 包含关系: ${relations}`);
  const validId = validateId(id);
  if (typeof validId !== 'string') return createErrorResponse(validId);
  try {
    const data = await parseMod(validId, BASE_URL, others, community, relations);
    return createSuccessResponse(data);
  } catch (error: any) {
    return createErrorResponse({ error: '获取模组失败', message: error.message, status: 404 });
  }
}