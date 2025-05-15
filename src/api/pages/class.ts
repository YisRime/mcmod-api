import * as cheerio from 'cheerio';
import { createErrorResponse, createSuccessResponse, BASE_URL, validateId, fetchHtml, log } from '..';

// 简化的接口定义
interface Author {
  name: string;
  position?: string;
  avatar?: string;
  url?: string;
}

interface Status {
  isActive: boolean;
  isOpenSource: boolean;
}

// 新增基本信息接口
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

// 新增兼容性信息接口
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
  // 使用新的接口替代原有字段
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
  if (!url || !url.includes('/target/')) return url;
  try {
    const base64Part = url.split('/target/')[1];
    return base64Part ? Buffer.from(base64Part, 'base64').toString('utf-8') : url;
  } catch (error) {
    log('URL_DECODE', `解码链接失败: ${error}`, error);
    return url;
  }
};

const resolveUrl = (path: string, base: string): string => {
  if (!path) return '';
  
  path = cleanImageUrl(path);
  
  if (path.includes('link.mcmod.cn/target/')) {
    return decodeExternalLink(path);
  }
  
  if (path.startsWith('//')) {
    return 'https:' + path;
  }
  
  if (path.startsWith('/') && !path.startsWith('//')) {
    return base + path;
  }
  
  return path;
};

// 从HTML中提取popover链接映射
const extractPopoverLinks = ($: cheerio.CheerioAPI): Record<string, string> => {
  const linkMapping: Record<string, string> = {};
  const scripts = $('script').map((_, el) => $(el).html()).get().join('');
  const popoverRegex = /\$\("#(link_[^"]+)"\)\.webuiPopover\(\{[^}]*content:"[^"]*<p><strong>([^<]+)<\/strong>/g;
  let match;
  
  while ((match = popoverRegex.exec(scripts)) !== null) {
    linkMapping[match[1]] = match[2];
  }
  
  return linkMapping;
};

// 解析HTML为Markdown
const htmlToMarkdown = (html: string): string => {
  if (!html) return '';
  
  const $ = cheerio.load(html);
  $('script').remove();
  
  // 处理图片和链接
  $('img').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('data-src') || $el.attr('src') || '';
    const imgUrl = src.startsWith('//') ? 'https:' + src : src;
    const alt = $el.attr('alt') || '图片';
    $el.replaceWith(`![${alt}](${imgUrl})`);
  });
  
  $('a').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim() || 'link';
    let href = $el.attr('href') || '';
    if (href.startsWith('//')) href = 'https:' + href;
    
    if ($el.children('img').length === 1 && $el.contents().length === 1) {
      // 图片链接
      const $img = $el.children('img');
      const imgSrc = $img.attr('src') || '';
      const imgAlt = $img.attr('alt') || '图片';
      $el.replaceWith(`[![${imgAlt}](${imgSrc})](${href})`);
    } else {
      $el.replaceWith(`[${text}](${href})`);
    }
  });
  
  // 处理基本格式
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const $el = $(el);
    const level = parseInt(el.tagName.toLowerCase().charAt(1));
    $el.replaceWith(`\n\n${'#'.repeat(level)} ${$el.text().trim()}\n\n`);
  });
  
  $('p').each((_, el) => { $(el).replaceWith(`\n\n${$(el).text().trim()}\n\n`); });
  $('strong, b').each((_, el) => { $(el).replaceWith(`**${$(el).text().trim()}**`); });
  $('em, i').each((_, el) => { $(el).replaceWith(`*${$(el).text().trim()}*`); });
  
  // 处理列表
  $('ul').each((_, el) => {
    const $el = $(el);
    $el.find('li').each((__, li) => {
      $(li).replaceWith(`\n- ${$(li).text().trim()}`);
    });
    $el.replaceWith($el.html() + '\n\n');
  });
  
  $('ol').each((_, el) => {
    const $el = $(el);
    $el.find('li').each((i, li) => {
      $(li).replaceWith(`\n${i + 1}. ${$(li).text().trim()}`);
    });
    $el.replaceWith($el.html() + '\n\n');
  });
  
  // 简化输出处理
  let markdown = $.text()
    .replace(/([^\s])\n([^\s])/g, '$1 $2')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{3,}/g, ' ')
    .replace(/\[([^\]]+)\]\(\/\/([^)]+)\)/g, (_, text, url) => `[${text}](https://${url})`)
    .trim();
  
  return markdown;
};

// 解析URL中的用户ID
const extractUserId = (url: string): string => {
  const match = url.match(/\/(\d+)\/?$/);
  return match ? match[1] : '';
};

// 解析函数
const parseTeamMembers = ($: cheerio.CheerioAPI, selector: string, url: string): TeamMember[] => {
  const members: TeamMember[] = [];
  if ($(selector).find('.null').length) return members;
  
  $(selector).find('li').each((_, el) => {
    const name = $(el).find('.text a').text().trim();
    if (!name) return;
    
    const memberUrl = resolveUrl($(el).find('.text a').attr('href') || '', url);
    
    members.push({
      name,
      avatar: resolveUrl($(el).find('.img img').attr('src') || '', url),
      id: extractUserId(memberUrl)
    });
  });
  
  return members;
};

const parseAuthors = ($: cheerio.CheerioAPI, url: string): Author[] => {
  const authors: Author[] = [];
  
  $('.author .member').each((_, el) => {
    authors.push({
      name: $(el).find('.name a').text().trim(),
      position: $(el).find('.position').text().trim(),
      avatar: resolveUrl($(el).parent().find('.avatar a img').attr('src') || '', url),
      url: resolveUrl($(el).find('.name a').attr('href') || '', url)
    });
  });
  
  return authors;
};

const parseCategories = ($: cheerio.CheerioAPI): string[] => {
  const categories: string[] = [];
  
  $('.common-class-category .main a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const categoryId = extractCategoryId(href);
    
    const xlinkHref = $(el).find('svg use').attr('xlink:href') || '';
    const mainCategoryId = xlinkHref.match(/#common-icon-category-(\d+)/)?.[1] || categoryId;
    
    if (mainCategoryId && !categories.includes(mainCategoryId)) {
      categories.push(mainCategoryId);
    }
  });
  
  $('.common-class-category .normal').each((_, el) => {
    const categoryId = extractCategoryId($(el).attr('href') || '');
    if (categoryId && !categories.includes(categoryId)) {
      categories.push(categoryId);
    }
  });
  
  return categories;
};

const parseLinks = ($: cheerio.CheerioAPI, url: string): Link[] => {
  const links: Link[] = [];
  const popoverLinks = extractPopoverLinks($);
  
  $('.common-link-icon-frame li').each((_, el) => {
    const a = $(el).find('a');
    const href = a.attr('href') || '';
    let finalUrl = resolveUrl(href, url);
    
    if (href.includes('javascript:void(0);')) {
      const linkId = href.match(/id="(link_[^"]+)"/)?.[1];
      if (linkId && popoverLinks[linkId]) {
        finalUrl = popoverLinks[linkId];
      }
    }
    
    links.push({
      title: a.attr('data-original-title')?.trim(),
      url: finalUrl
    });
  });
  
  return links;
};

const parseStatistics = ($: cheerio.CheerioAPI): Statistics => {
  const stats: Statistics = {
    viewCount: $('.infos .span').first().find('.n').text().trim(),
    fillRate: $('.infos .span').last().find('.n').text().trim(),
    popularity: $('.block-left .up').text().trim(),
    downloadCount: $('.download-btn').attr('title')?.replace('共', '').replace('次下载', '').trim(),
    yesterdayIndex: $('.block-right .text').first().text().replace('昨日指数:', '').trim(),
    yesterdayAvgIndex: $('.block-right .text').eq(1).text().replace('昨日平均指数:', '').trim(),
    editCount: $('.class-info-left li').filter((_, el) => $(el).text().includes('编辑次数')).text().replace('编辑次数:', '').replace('次', '').trim()
  };
  
  // 其他统计数据
  const modpackCount = $('.infolist.modpack').text().match(/有\s+(\d+)\s+个已收录的整合包/)?.[1];
  if (modpackCount) stats.modpackCount = modpackCount;
  
  const resourceMatch = $('.infolist.worldgen').text().match(/有\s+(\d+)\s+条矿物\/自然资源分布图数据，共涉及\s+(\d+)\s+个资料/);
  if (resourceMatch) {
    stats.resourceCount = resourceMatch[1];
    stats.resourceDataCount = resourceMatch[2];
  }
  
  const serverCount = $('.infolist.server-count').text().match(/有\s+(\d+)\s+台已收录的服务器/)?.[1];
  const serverInstallRate = $('.infolist.server-pre').text().match(/安装率为\s+([0-9.]+)%/)?.[1];
  
  if (serverCount) stats.serverCount = serverCount;
  if (serverInstallRate) stats.serverInstallRate = serverInstallRate;
  
  return stats;
};

const parseModResources = ($: cheerio.CheerioAPI): ModResource[] => {
  const resources: ModResource[] = [];
  
  $('.class-item-type .mold').each((_, el) => {
    if ($(el).hasClass('mold-0')) return;
    
    const link = $(el).find('a');
    const typeId = link.attr('href')?.match(/\/\d+-(\d+)\.html$/)?.[1] || '';
    const count = parseInt(link.find('.count').text().match(/\((\d+)条\)/)?.[1] || '0');
    
    resources.push({ typeId, count });
  });
  
  return resources;
};

const parseModRelations = ($: cheerio.CheerioAPI): ModRelation[] => {
  const relations: ModRelation[] = [];
  
  $('.class-relation-list fieldset').each((_, fieldset) => {
    const version = $(fieldset).find('legend').text().trim();
    const relation: ModRelation = { version };
    
    $(fieldset).find('li.relation').each((_, relEl) => {
      const relType = $(relEl).find('span').text().includes('依赖') ? 'dependencyMods' : 'relationMods';
      const mods: RelatedMod[] = [];
      
      $(relEl).find('ul a').each((_, modEl) => {
        mods.push({
          id: $(modEl).attr('href')?.match(/\/class\/(\d+)\.html$/)?.[1],
          name: $(modEl).text().trim()
        });
      });
      
      if (mods.length > 0) {
        relation[relType as keyof Pick<ModRelation, 'dependencyMods' | 'relationMods'>] = mods;
      }
    });
    
    relations.push(relation);
  });
  
  return relations;
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

const parseModTutorials = ($: cheerio.CheerioAPI): ModTutorial[] => {
  const tutorials: ModTutorial[] = [];
  const processedIds = new Set<string>();
  
  const addTutorial = (title: string, url: string) => {
    const id = url.match(/\/post\/(\d+)\.html/)?.[1] || '';
    if (!id || processedIds.has(id)) return;
    
    processedIds.add(id);
    tutorials.push({ id, title });
  };
  
  $('.class-post-frame .post-block').each((_, block) => {
    const titleEl = $(block).find('.title a');
    if (titleEl.length) {
      addTutorial(titleEl.text().trim(), titleEl.attr('href') || '');
    }
  });
  
  $('.class-post-list li').each((_, item) => {
    const linkEl = $(item).find('a');
    if (linkEl.length) {
      addTutorial(linkEl.text().trim(), linkEl.attr('href') || '');
    }
  });
  
  return tutorials;
};

const parseModDiscussions = ($: cheerio.CheerioAPI): ModDiscussion[] => {
  const discussions: ModDiscussion[] = [];
  
  $('.class-thread-list li').each((_, item) => {
    const linkEl = $(item).find('a');
    if (!linkEl.length) return;
    
    const title = linkEl.text().trim();
    const url = linkEl.attr('href') || '';
    const id = url.match(/thread-(\d+)-/)?.[1] || '';
    
    if (id) discussions.push({ id, title });
  });
  
  return discussions;
};

const parseModIntroduction = ($: cheerio.CheerioAPI): string | undefined => {
  const introContainer = $('.class-menu-main .text-area.common-text.font14').first();
  if (!introContainer.length) return undefined;
  
  // 预处理并转换为Markdown
  return htmlToMarkdown(introContainer.html() || '');
};

// 主解析函数
async function parseMod(id: string, url: string, showOthers: boolean = false, showCommunity: boolean = false, showRelations: boolean = false): Promise<Mod> {
  log('MOD', `开始解析模组: ${id}`);
  try {
    const html = await fetchHtml(`${url}/class/${id}.html`);
    const $ = cheerio.load(html);
    
    if ($('.class-title').length === 0) {
      throw new Error(`未找到ID为${id}的模组`);
    }
    
    // 创建基本信息对象
    const basicInfo: BasicInfo = {
      id,
      name: $('.class-title h3').text().trim(),
      englishName: $('.class-title h4').text().trim(),
      shortName: $('.class-title .short-name').text().trim(),
      img: resolveUrl($('.class-cover-image img').attr('src') || '', url),
      status: {
        isActive: $('.class-status').text().trim() !== '停更',
        isOpenSource: $('.class-source').text().trim() !== '闭源'
      },
      categories: parseCategories($),
      tags: $('.class-info-left .tag a').map((_, el) => $(el).text().trim()).get()
    };
    
    // 创建兼容性信息对象
    const compatibility: Compatibility = {};
    
    // 提取平台和API信息
    compatibility.platforms = $('.class-info-left li').filter((_, el) => 
      $(el).text().includes('支持平台')
    ).find('a').map((_, el) => $(el).text().trim()).get();
    
    compatibility.apis = $('.class-info-left li').filter((_, el) => 
      $(el).text().includes('运作方式')
    ).find('a').map((_, el) => $(el).text().trim()).get();
    
    compatibility.environment = $('.class-info-left li').filter((_, el) => 
      $(el).text().includes('运行环境')
    ).text().replace('运行环境:', '').trim();
    
    // 提取MC版本支持
    compatibility.mcVersions = { forge: [], fabric: [], behaviorPack: [] };
    $('.mcver ul').each((_, el) => {
      const loaderLabel = $(el).find('li').first().text().trim();
      const versions = $(el).find('a').map((_, link) => $(link).text().trim()).get();
      
      if (loaderLabel.includes('行为包')) compatibility.mcVersions!.behaviorPack = versions;
      else if (loaderLabel.includes('Forge')) compatibility.mcVersions!.forge = versions;
      else if (loaderLabel.includes('Fabric')) compatibility.mcVersions!.fabric = versions;
    });
    
    // 创建基础模组对象
    const mod: Mod = {
      basicInfo,
      compatibility,
      authors: parseAuthors($, url),
      links: parseLinks($, url)
    };
    
    if (showOthers) {
      // 统计、评分和更新日志整合到metrics
      const statistics = parseStatistics($);
      
      // 时间信息添加到statistics中
      statistics.createTime = $('.class-info-left li').filter((_, el) => 
        $(el).text().includes('收录时间')
      ).attr('data-original-title')?.trim();
      
      statistics.lastUpdate = $('.class-info-left li').filter((_, el) => 
        $(el).text().includes('最后编辑')
      ).attr('data-original-title')?.trim();
      
      statistics.lastRecommend = $('.class-info-left li').filter((_, el) => 
        $(el).text().includes('最后推荐')
      ).attr('data-original-title')?.trim();
      
      // 提取评分
      const redVotes = $('.class-card .text-block span').first().text().match(/红票(\d+)/)?.[1];
      const blackVotes = $('.class-card .text-block span').last().text().match(/黑票(\d+)/)?.[1];
      
      const ratings = {
        redVotes,
        blackVotes,
        detailedRatings: parseDetailedRatings($)
      };
      
      // 更新日志
      const updateLogs = $('.common-rowlist.log li').map((_, el) => ({
        version: $(el).find('a').text().trim(),
        date: $(el).find('.time').text().trim()
      })).get();
      
      // 整合到metrics
      mod.metrics = {
        statistics,
        ratings,
        updateLogs
      };
      
      // 团队信息
      const teamSelectors = {
        managementTeam: '.common-imglist-block:contains("管理组") .common-imglist',
        editingTeam: '.common-imglist-block:contains("编辑组") .common-imglist',
        developmentTeam: '.common-imglist-block:contains("开发组") .common-imglist',
        recentEditors: '.common-imglist-block:contains("最近参与编辑") .common-imglist',
        recentVisitors: '.common-imglist-block:contains("最近浏览") .common-imglist'
      };
      
      const teams: Teams = {};
      
      for (const [key, selector] of Object.entries(teamSelectors)) {
        const members = parseTeamMembers($, selector, url);
        if (members.length > 0) {
          teams[key as keyof Teams] = members;
        }
      }
      
      if (Object.keys(teams).length > 0) {
        mod.teams = teams;
      }
    }
    
    // 如果请求包含社区内容，则解析教程和讨论
    if (showCommunity) {
      const tutorials = parseModTutorials($);
      const discussions = parseModDiscussions($);
      
      if (tutorials.length > 0 || discussions.length > 0) {
        mod.community = {};
        
        if (tutorials.length > 0) {
          mod.community.tutorials = tutorials;
        }
        
        if (discussions.length > 0) {
          mod.community.discussions = discussions;
        }
      }
    }
    
    // 提取资源和关系
    mod.resources = parseModResources($);
    
    // 仅当showRelations为true时解析模组关系
    if (showRelations) {
      mod.relations = parseModRelations($);
    }
    
    // 提取模组介绍内容
    const introduction = parseModIntroduction($);
    if (introduction) {
      mod.introduction = introduction;
    }
    
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
  if (typeof validId !== 'string') {
    return createErrorResponse(validId);
  }
  
  try {
    const data = await parseMod(validId, BASE_URL, others, community, relations);
    return createSuccessResponse(data);
  } catch (error: any) {
    return createErrorResponse({
      error: '获取模组失败',
      message: error.message,
      status: 404
    });
  }
}