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
  permissions?: string;
}

interface Metrics {
  statistics?: Statistics;
}

interface Teams {
  recentEditors?: TeamMember[];
  recentVisitors?: TeamMember[];
}

interface Post {
  id: string;
  title: string;
  content: string;
  contentMarkdown?: string;
  author?: Author;
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

// 解析外部链接
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
    log('URL_DECODE', `解码链接失败: ${url}`, error);
    return url;
  }
};

// 处理URL路径
const resolveUrl = (path: string, base: string): string => {
  if (!path) return '';
  path = cleanImageUrl(path);
  if (path.includes('link.mcmod.cn/target/')) return decodeExternalLink(path);
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
  // 段落处理和格式化
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
    // 处理特殊类标签
    $('.uknowtoomuch').each((_, el) => {
      $(el).replaceWith(` ${$(el).text().trim()}`);
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
  // 处理表格转换
  processTables: ($: cheerio.CheerioAPI): void => {
    $('table').each((_, table) => {
      const $table = $(table);
      let markdown = '\n\n';
      // 计算列数
      const columnCount = Math.max(
        $table.find('tr').first().find('th').length,
        $table.find('tr').first().find('td').length
      );
      if (columnCount === 0) return;
      // 处理表头和内容
      const $headerRow = $table.find('tr').first();
      const hasHeader = $headerRow.find('th').length > 0;
      if (hasHeader) {
        // 表头行
        markdown += '|';
        $headerRow.find('th').each((_, th) => {
          markdown += ` ${$(th).text().trim()} |`;
        });
        markdown += '\n|';
        // 分隔行
        for (let i = 0; i < columnCount; i++) markdown += ' --- |';
        markdown += '\n';
        // 内容行
        $table.find('tr').slice(1).each((_, tr) => {
          markdown += '|';
          $(tr).find('td').each((_, td) => {
            markdown += ` ${$(td).text().trim().replace(/\n/g, ' ')} |`;
          });
          markdown += '\n';
        });
      } else {
        // 没有表头的表格处理
        $table.find('tr').each((i, tr) => {
          markdown += '|';
          $(tr).find('td').each((_, td) => { 
            markdown += ` ${$(td).text().trim().replace(/\n/g, ' ')} |`; 
          });
          markdown += '\n';
          // 在第一行后添加分隔行
          if (i === 0) {
            markdown += '|';
            const cellCount = $(tr).find('td').length;
            for (let j = 0; j < cellCount; j++) markdown += ' --- |';
            markdown += '\n';
          }
        });
      }
      markdown += '\n\n';
      $table.replaceWith(markdown);
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
      const $el = $(el);
      // 跳过特殊标题类
      if ($el.hasClass('common-text-title')) return;
      const styleAttr = $el.attr('style') || '';
      const content = $el.html() || '';
      const textContent = $el.text().trim();
      // 处理内联样式
      if (styleAttr) {
        const hasStrikethrough = styleAttr.includes('text-decoration: line-through') || 
                                styleAttr.includes('text-decoration:line-through');
        const hasUnderline = styleAttr.includes('text-decoration: underline') || 
                            styleAttr.includes('text-decoration:underline');
        if ($el.children().length === 0) {
          // 纯文本节点简化处理
          let formattedText = textContent;
          if (hasStrikethrough) formattedText = `~~${formattedText}~~`;
          if (hasUnderline) formattedText = `<u>${formattedText}</u>`;
          $el.replaceWith(formattedText);
        } else {
          // 有子元素的情况
          let prefix = '';
          let suffix = '';
          if (hasStrikethrough) {
            prefix += '~~';
            suffix = '~~' + suffix;
          }
          if (hasUnderline) {
            prefix += '<u>';
            suffix = '</u>' + suffix;
          }
          $el.replaceWith(prefix + content + suffix);
        }
      } else {
        $el.replaceWith(content);
      }
    });
    // 引用块处理
    $('blockquote').each((_, el) => {
      const content = $(el).html() || '';
      const quotedText = content.split('\n').map(line => `> ${line}`).join('\n');
      $(el).replaceWith(`\n\n${quotedText}\n\n`);
    });
    // 处理常见HTML标签
    $('u').each((_, el) => {
      $(el).replaceWith(`<u>${$(el).text().trim()}</u>`);
    });
    $('strike, del, s').each((_, el) => {
      $(el).replaceWith(`~~${$(el).text().trim()}~~`);
    });
    // 处理居中文本
    $('div, section, article').each((_, el) => {
      $(el).replaceWith($(el).html() || '');
    });
    // 移除空标签
    $('div, section, article').each((_, el) => {
      $(el).replaceWith($(el).html() || '');
    });
    // 移除空标签
    $('*:empty').remove();
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
  markdownTransformers.processTables($);
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
    .replace(/<u>(.*?)<\/u>/g, '<u>$1</u>')
    .replace(/<div align="center">([\s\S]*?)<\/div>/g, '\n\n<div align="center">\n\n$1\n\n</div>\n\n')
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

// 解析函数
async function parsePost(id: string, url: string, showOthers: boolean = false): Promise<Post> {
  log('POST', `解析教程: ${id}`);
  try {
    const html = await fetchHtml(`${url}/post/${id}.html`);
    const $ = cheerio.load(html);
    const popoverUrlMap = extractPopoverUrl(html);
    // 基本信息
    const title = $('.postname h5').text().trim();
    // 提取内容
    const contentContainer = $('div.post-content.common-text.font14 > div.text');
    let contentHtml = contentContainer.length ? 
                      contentContainer.html() || '' : 
                      $('div.post-content.common-text.font14').html() || '';
    // 转换为Markdown
    const markdownContent = htmlToMarkdown(contentHtml, popoverUrlMap);
    // 创建基础Post对象
    const post: Post = { id, title, content: markdownContent };
    // 只有需要时才添加额外信息
    if (showOthers) {
      // 统计信息
      post.metrics = {
        statistics: {
          viewCount: parseInt($('.common-rowlist-2 li:contains("浏览量")').text().match(/浏览量：(\d+)/)?.[1] || '0', 10),
          editCount: parseInt($('.common-rowlist-2 li:contains("编辑次数")').text().match(/编辑次数：(\d+)/)?.[1] || '0', 10),
          createTime: $('.common-rowlist-2 li[data-original-title]').first().attr('data-original-title')?.trim(),
          lastUpdate: $('.common-rowlist-2 li[data-original-title]:contains("最后编辑")').attr('data-original-title')?.trim(),
          permissions: $('.common-rowlist-2 li:contains("教程权限")').text().replace('教程权限：', '').trim()
        }
      };
      // 作者信息
      const authorEl = $('.post-info .common-imglist li').first();
      if (authorEl.length) {
        post.author = {
          name: authorEl.find('.text a').text().trim(),
          avatar: resolveUrl(authorEl.find('.img img').attr('src') || '', url),
          id: extractUserId(resolveUrl(authorEl.find('.text a').attr('href') || '', url))
        };
      }
      // 团队信息
      const teams: Teams = {};
      // 解析团队成员
      const recentEditors = parseTeamMembers($, '.common-imglist-block:contains("最近参与编辑") .common-imglist', url);
      if (recentEditors.length > 0) teams.recentEditors = recentEditors;
      const recentVisitors = parseTeamMembers($, '.common-imglist-block:contains("最近浏览") .common-imglist', url);
      if (recentVisitors.length > 0) teams.recentVisitors = recentVisitors;
      if (Object.keys(teams).length > 0) post.teams = teams;
    }
    return post;
  } catch (error: any) {
    log('POST', `解析教程失败: ${error.message}`);
    throw new Error(`解析教程详情失败: ${error.message}`);
  }
}

// API导出函数
export async function servePost(params: URLSearchParams): Promise<Response> {
  const id = params.get('id');
  const others = params.get('others') === 'true';
  log('POST_API', `请求教程: ${id}, 附加信息: ${others}`);
  const validId = validateId(id);
  if (typeof validId !== 'string') return createErrorResponse(validId);
  try {
    const data = await parsePost(validId, BASE_URL, others);
    return createSuccessResponse(data);
  } catch (error: any) {
    return createErrorResponse({ error: '获取教程失败', message: error.message, status: 404 });
  }
}