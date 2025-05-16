import * as cheerio from 'cheerio';
import { createErrorResponse, createSuccessResponse, BASE_URL, validateId, fetchHtml, log } from '..';

// 接口定义
interface Author {
  name: string;
  position?: string;
  avatar?: string;
  id?: string;
}

// 基本信息接口
interface BasicInfo {
  id: string;
  name: string;
  englishName?: string;
  shortName?: string;
  img?: string;
  categories?: string[];
  tags?: string[];
}

// 兼容性信息接口
interface Compatibility {
  packType?: string;
  apiType?: string[];
  packMethod?: string[];
  mcVersions?: string[];
}

interface Statistics {
  viewCount?: string;
  popularity?: string;
  editCount?: string;
  createTime?: string;
  lastUpdate?: string;
  lastRecommend?: string;
  yesterdayIndex?: string;
  yesterdayAvgIndex?: string;
}

interface Ratings {
  redVotes?: string;
  blackVotes?: string;
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
  avatar?: string;
  id?: string;
}

interface Teams {
  recentEditors?: TeamMember[];
  recentVisitors?: TeamMember[];
}

interface ModInfo {
  id: string;
  name: string;
  version?: string;
}

interface Tutorial {
  id: string;
  title: string;
}

interface Metrics {
  statistics?: Statistics;
  ratings?: Ratings;
  updateLogs?: UpdateLog[];
}

interface ModpackRelations {
  mods?: ModInfo[];
  tutorials?: Tutorial[];
}

interface Modpack {
  basicInfo: BasicInfo;
  compatibility: Compatibility;
  authors?: Author[];
  metrics?: Metrics;
  links?: Link[];
  teams?: Teams;
  relations?: ModpackRelations;
  introduction?: string;
}

// 工具函数
const cleanImageUrl = (url: string): string => {
  if (!url) return '';
  return (url.startsWith('//') ? 'https:' + url : url)
    .replace(/https?:\/\/www\.mcmod\.cn\/\//, '//')
    .replace(/@\d+x\d+\.jpg$/, '');
};

const decodeExternalLink = (url: string): string => {
  if (!url || !url.includes('link.mcmod.cn/target/')) return url;
  const targetMatch = url.match(/link\.mcmod\.cn\/target\/([A-Za-z0-9+/=]+)/);
  if (!targetMatch) return url;
  try {
    const base64 = targetMatch[1].replace(/-/g, '+').replace(/_/g, '/');
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  } catch (error) {
    log('URL_DECODE', `解码链接失败: ${url}, 错误: ${error}`, error);
    return url;
  }
};

const resolveLink = (path: string, base: string): string => {
  if (!path) return '';
  path = cleanImageUrl(path);
  if (path.includes('link.mcmod.cn/target/')) return decodeExternalLink(path);
  if (path.startsWith('//')) return 'https:' + path;
  if (path.startsWith('/') && !path.startsWith('//')) return base + path;
  return path;
};

// HTML到Markdown的转换
const htmlToMarkdown = (html: string): string => {
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
    const text = $el.text().trim();
    if (!text) return;
    let href = $el.attr('href') || '';
    if (href.startsWith('//')) href = 'https:' + href;
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

// 解析分类标签
const parseCategories = ($: cheerio.CheerioAPI): string[] => {
  const categories: string[] = [];
  $('.class-category a').each((_, el) => {
    const categoryId = $(el).attr('href')?.match(/\/category\/(\d+)-/)?.[1];
    if (categoryId && !categories.includes(categoryId)) categories.push(categoryId);
  });
  return categories;
};

// 解析链接
const parseLinks = ($: cheerio.CheerioAPI, url: string): Link[] => {
  const links: Link[] = [];
  const processedUrls = new Set<string>();
  $('.common-link-icon-frame li').each((_, el) => {
    const a = $(el).find('a');
    const href = a.attr('href') || '';
    const title = a.attr('data-original-title')?.trim() || $(el).find('.name').text().trim();
    // 确定最终URL
    let finalUrl = '';
    if (href && !href.includes('javascript:')) finalUrl = href;
    // 添加有效链接
    finalUrl = resolveLink(finalUrl, url);
    if (finalUrl && !finalUrl.includes('javascript:') && !processedUrls.has(finalUrl)) {
      processedUrls.add(finalUrl);
      links.push({ title, url: finalUrl });
    }
  });
  return links;
};

// 解析团队成员
const parseTeamMembers = ($: cheerio.CheerioAPI, selector: string, url: string): TeamMember[] => {
  const members: TeamMember[] = [];
  $(selector).find('li').each((_, el) => {
    const name = $(el).find('.text a').text().trim();
    if (!name) return;
    const avatarUrl = $(el).find('.img img').attr('src') || '';
    const profileUrl = $(el).find('.text a').attr('href') || '';
    members.push({ name, avatar: resolveLink(avatarUrl, url), id: extractUserId(profileUrl) });
  });
  return members;
};

// 解析作者信息
const parseAuthors = ($: cheerio.CheerioAPI, url: string): Author[] => {
  const authors: Author[] = [];
  $('.author .member').each((_, el) => {
    const name = $(el).find('.name a').text().trim();
    if (!name) return;
    const authorUrl = $(el).find('.name a').attr('href') || '';
    const authorId = authorUrl.match(/\/author\/(\d+)\.html/)?.[1] || '';
    authors.push({
      name, id: authorId, position: $(el).find('.position').text().trim(),
      avatar: resolveLink($(el).parent().find('.avatar a img').attr('src') || '', url),
    });
  });
  return authors;
};

// 解析更新日志
const parseUpdateLogs = ($: cheerio.CheerioAPI, url: string): UpdateLog[] => {
  const logs: UpdateLog[] = [];
  $('.common-rowlist.log li').each((_, el) => {
    const version = $(el).find('a').text().trim();
    const date = $(el).find('.time').text().trim();
    if (version && date) logs.push({ version, date });
  });
  return logs;
};

// 解析包含的模组
const parseIncludedMods = ($: cheerio.CheerioAPI): ModInfo[] => {
  const mods: ModInfo[] = [];
  $('.class-relation-list .relation.modlist').each((_, categoryBlock) => {
    $(categoryBlock).find('ul li').each((_, modItem) => {
      const link = $(modItem).find('p a').first();
      const modUrl = link.attr('href') || '';
      const modId = modUrl.match(/\/class\/(\d+)\.html/)?.[1] || '';
      const version = $(modItem).find('p').last().text().trim();
      if (modId) mods.push({ id: modId, name: link.text().trim(), version });
    });
  });
  return mods;
};

// 解析教程
const parseTutorials = ($: cheerio.CheerioAPI, url: string): Tutorial[] => {
  const tutorials: Tutorial[] = [];
  const processedIds = new Set<string>();
  // 处理带封面的教程
  $('.class-post-frame .post-block').each((_, el) => {
    const titleEl = $(el).find('.title a');
    const title = titleEl.text().trim();
    const tutorialUrl = titleEl.attr('href') || '';
    const id = tutorialUrl.match(/\/post\/(\d+)\.html/)?.[1] || '';
    if (id && !processedIds.has(id)) {
      processedIds.add(id);
      tutorials.push({ id, title });
    }
  });
  // 处理无封面教程列表
  $('.class-post-list li').each((_, el) => {
    const a = $(el).find('a');
    const title = a.text().trim();
    const tutorialUrl = a.attr('href') || '';
    const id = tutorialUrl.match(/\/post\/(\d+)\.html/)?.[1] || '';
    if (id && !processedIds.has(id)) {
      processedIds.add(id);
      tutorials.push({ id, title });
    }
  });
  return tutorials;
};

// 主解析函数
async function parseModpack(id: string, url: string, showOthers: boolean = false, showCommunity: boolean = false, showRelations: boolean = false): Promise<Modpack> {
  log('MODPACK', `开始解析整合包: ${id}`);
  try {
    const html = await fetchHtml(`${url}/modpack/${id}.html`);
    const $ = cheerio.load(html);
    if ($('.class-title').length === 0) throw new Error(`未找到ID为${id}的整合包`);
    // 基本信息
    const basicInfo: BasicInfo = {
      id, name: $('.class-title h3').text().trim(),
      englishName: $('.class-title h4').text().trim(),
      shortName: $('.class-title .short-name').text().trim(),
      img: resolveLink($('.class-cover-image img').attr('src') || '', url),
      categories: parseCategories($),
      tags: $('.tag a').map((_, el) => $(el).text().replace(/^[\s\uFEFF\xA0i]+|[\s\uFEFF\xA0i]+$/g, '')).get()
    };
    // 兼容性信息
    const compatibility: Compatibility = {
      packType: $('.class-info-left li').filter((_, el) => $(el).text().includes('整合包类型')).find('a').text().trim(),
      apiType: $('.class-info-left li').filter((_, el) => $(el).text().includes('运作方式')).find('a').map((_, el) => $(el).text().trim()).get(),
      packMethod: $('.class-info-left li').filter((_, el) => $(el).text().includes('打包方式')).find('a').map((_, el) => $(el).text().trim()).get()
    };
    // MC版本支持
    const mcVersions: string[] = [];
    $('.mcver ul').each((_, el) => {
      $(el).find('a').each((_, link) => {
        const version = $(link).text().trim();
        if (version && !mcVersions.includes(version)) mcVersions.push(version);
      });
    });
    if (mcVersions.length > 0) compatibility.mcVersions = mcVersions;
    // 创建基础整合包对象
    const modpack: Modpack = {
      basicInfo,
      compatibility,
      authors: parseAuthors($, url),
      links: parseLinks($, url)
    };
    // 其他信息
    if (showOthers) {
      // 统计信息
      const statistics: Statistics = {
        viewCount: $('.infos .span').first().find('.n').text().trim(),
        popularity: $('.block-left .up').text().trim(),
        yesterdayIndex: $('.block-right .text').first().text().replace('昨日指数:', '').trim(),
        yesterdayAvgIndex: $('.block-right .text').eq(1).text().replace('昨日平均指数:', '').trim(),
        editCount: $('.class-info-left li').filter((_, el) => $(el).text().includes('编辑次数')).text().replace('编辑次数:', '').replace('次', '').trim()
      };
      // 时间信息
      const timeSelectors = [['createTime', '收录时间'], ['lastUpdate', '最后编辑'], ['lastRecommend', '最后推荐']];
      for (const [key, label] of timeSelectors) {
        statistics[key as keyof Statistics] = $('.class-info-left li')
          .filter((_, el) => $(el).text().includes(label))
          .attr('data-original-title')?.trim();
      }
      // 评分信息
      const ratings: Ratings = {};
      const redMatch = $('.class-card .text-block span').first().text().match(/红票(\d+)/);
      const blackMatch = $('.class-card .text-block span').last().text().match(/黑票(\d+)/);
      if (redMatch) ratings.redVotes = redMatch[1];
      if (blackMatch) ratings.blackVotes = blackMatch[1];
      // 更新日志
      const updateLogs = parseUpdateLogs($, url);
      modpack.metrics = { statistics, ratings, updateLogs };
      // 团队信息
      const teams: Teams = {
        recentEditors: parseTeamMembers($, '.common-imglist-block:contains("最近参与编辑") .common-imglist', url),
        recentVisitors: parseTeamMembers($, '.common-imglist-block:contains("最近浏览") .common-imglist', url)
      };
      if (Object.keys(teams).length > 0) modpack.teams = teams;
    }
    const relations: ModpackRelations = {};
    // 解析模组信息
    if (showRelations) {
      const mods = parseIncludedMods($);
      if (mods.length > 0) relations.mods = mods;
    }
    // 解析教程信息
    if (showCommunity) {
      const tutorials = parseTutorials($, url);
      if (tutorials.length > 0) relations.tutorials = tutorials;
    }
    // 只有当有关系信息时才添加到modpack对象
    if (Object.keys(relations).length > 0) modpack.relations = relations;
    // 介绍信息总是包含的
    const introContainer = $('.class-menu-main .text-area.common-text.font14').first();
    if (introContainer.length) modpack.introduction = htmlToMarkdown(introContainer.html() || '');
    log('MODPACK', `整合包解析完成: ${modpack.basicInfo.name}`);
    return modpack;
  } catch (error: any) {
    log('MODPACK', `解析整合包失败: ${error.message}`, error);
    throw new Error(`解析整合包详情失败: ${error.message}`);
  }
}

// API导出
export async function serveModPack(params: URLSearchParams): Promise<Response> {
  const id = params.get('id');
  const others = params.get('others') === 'true';
  const community = params.get('community') === 'true';
  const relations = params.get('relations') === 'true';
  log('PACK_API', `请求整合包详情: ${id}, 包含附加信息: ${others}, 包含社区信息: ${community}, 包含关系: ${relations}`);
  const validId = validateId(id);
  if (typeof validId !== 'string') {
    log('PACK_API', `ID验证失败: ${JSON.stringify(validId)}`);
    return createErrorResponse(validId);
  }
  try {
    log('PACK_API', `开始获取整合包数据: ${validId}`);
    const data = await parseModpack(validId, BASE_URL, others, community, relations);
    log('PACK_API', `整合包数据获取成功: ${data.basicInfo.name}`);
    return createSuccessResponse(data);
  } catch (error: any) {
    log('PACK_API', `获取整合包失败: ${error.message}`, error);
    return createErrorResponse({ error: '获取整合包失败', message: error.message, status: 404 });
  }
}