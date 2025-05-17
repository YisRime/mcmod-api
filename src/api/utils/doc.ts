import { createErrorResponse } from '..';

const DOC_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Access-Control-Allow-Origin': '*'
};

// 处理API文档请求
export async function genDoc(): Promise<Response> {
  try {
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <title>MCmod API 文档</title>
  <style>
    :root {
      --primary: #3498db; --secondary: #2c3e50; --success: #2ecc71; --info: #61affe;
      --warning: #f39c12; --danger: #e74c3c; --light: #f8f9fa; --dark: #343a40; --border: #e9ecef;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.5; color: #333; max-width: 1000px; margin: 0 auto;
      padding: 20px; background-color: var(--light); font-size: 14px;
    }
    header { margin-bottom: 30px; }
    h1, h2, h3, h4 { color: var(--secondary); margin: 1em 0 0.5em; }
    h1 { font-size: 2em; border-bottom: 2px solid var(--primary); padding-bottom: 10px; }
    h2 { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: 5px; }
    h3 { font-size: 1.2em; }
    p { margin-bottom: 1em; }
    .api-info, .endpoint {
      background-color: #fff; border-radius: 6px; margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .api-info { padding: 15px; }
    .endpoint { padding: 20px; }
    .endpoint-title { display: flex; align-items: center; margin-bottom: 15px; }
    .http-method {
      display: inline-block; padding: 4px 8px; border-radius: 4px; color: white;
      font-weight: bold; margin-right: 10px; min-width: 60px; text-align: center; font-size: 13px;
    }
    .get { background-color: var(--info); }
    .post { background-color: var(--success); }
    .endpoint-url { font-family: monospace; font-weight: bold; font-size: 16px; }
    .endpoint-description { margin: 10px 0; color: var(--secondary); font-size: 15px; }
    .code-block {
      background-color: #f5f5f5; padding: 12px; border-radius: 4px;
      overflow-x: auto; font-family: Consolas, monospace; font-size: 13px;
      margin: 10px 0; border: 1px solid var(--border);
    }
    .parameters, .response-fields { margin: 20px 0; }
    table {
      width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 14px;
    }
    th, td {
      border: 1px solid var(--border); padding: 8px 12px; text-align: left;
    }
    th { background-color: var(--light); font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .parameter-required { color: var(--danger); font-weight: bold; }
    .parameter-optional { color: var(--info); }
    .data-type { font-family: monospace; color: var(--secondary); font-weight: bold; }
    footer {
      margin-top: 40px; padding-top: 10px; border-top: 1px solid var(--border);
      text-align: center; color: #7f8c8d; font-size: 12px;
    }
    @media (max-width: 768px) {
      body { padding: 10px; }
      .endpoint { padding: 15px; }
      h1 { font-size: 1.8em; }
      .endpoint-url { font-size: 14px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>MCmod API 文档</h1>
    <div class="api-info">
      <p>非官方的 MC 百科 API ，用于获取 MC 百科的数据</p>
      <p>Powered By Yis_Rime</p>
    </div>
  </header>

  <main>
    <h2>API 端点</h2>

    <div class="endpoint">
      <div class="endpoint-title">
        <span class="http-method get">GET</span>
        <span class="endpoint-url">/api/search</span>
      </div>
      <div class="endpoint-description">
        根据关键词搜索 MC 百科内容，包括模组、资料、模组包等
      </div>

      <div class="code-block">GET /api/search?q=关键词&page=1&mold=0&filter=0</div>

      <div class="parameters">
        <h3>请求参数</h3>
        <table>
          <thead>
            <tr>
              <th>参数名</th>
              <th>类型</th>
              <th>是否必须</th>
              <th>描述</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>q</td>
              <td class="data-type">string</td>
              <td class="parameter-required">是</td>
              <td>搜索关键词</td>
            </tr>
            <tr>
              <td>offset</td>
              <td class="data-type">number</td>
              <td class="parameter-optional">否</td>
              <td>结果偏移量，默认为 0 （每页 30 个结果）</td>
            </tr>
            <tr>
              <td>page</td>
              <td class="data-type">number</td>
              <td class="parameter-optional">否</td>
              <td>页码，从 1 开始，默认为 1（提供 offset 时忽略此参数）</td>
            </tr>
            <tr>
              <td>mold</td>
              <td class="data-type">number</td>
              <td class="parameter-optional">否</td>
              <td>是否启用复杂搜索， 1 表示启用， 0 表示禁用，默认为 0</td>
            </tr>
            <tr>
              <td>filter</td>
              <td class="data-type">number</td>
              <td class="parameter-optional">否</td>
              <td>结果类型过滤器，值范围 1-7（模组、整合包、资料、教程、作者、用户、社群），默认为 0（不过滤）</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="response-fields">
        <h3>响应字段</h3>
        <table>
          <thead>
            <tr>
              <th>字段</th>
              <th>类型</th>
              <th>描述</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>results</td>
              <td class="data-type">array</td>
              <td>搜索结果列表，包含匹配的内容项，每项包含 id(模组ID)、name(模组名称)、description(内容简介) 和 url(链接地址)</td>
            </tr>
            <tr>
              <td>page</td>
              <td class="data-type">number</td>
              <td>当前页码</td>
            </tr>
            <tr>
              <td>total</td>
              <td class="data-type">number</td>
              <td>总页数</td>
            </tr>
            <tr>
              <td>totalResults</td>
              <td class="data-type">number</td>
              <td>匹配的总结果数</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-title">
        <span class="http-method get">GET</span>
        <span class="endpoint-url">/api/class</span>
      </div>
      <div class="endpoint-description">
        获取模组的详细信息，包括基本信息、作者、兼容性等
      </div>

      <div class="code-block">GET /api/class?id=模组ID&others=false&community=false&relations=false</div>

      <div class="parameters">
        <h3>请求参数</h3>
        <table>
          <thead>
            <tr>
              <th>参数名</th>
              <th>类型</th>
              <th>是否必须</th>
              <th>描述</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>id</td>
              <td class="data-type">string</td>
              <td class="parameter-required">是</td>
              <td>模组ID</td>
            </tr>
            <tr>
              <td>others</td>
              <td class="data-type">boolean</td>
              <td class="parameter-optional">否</td>
              <td>是否包含附加信息（如统计、评分、团队信息等），默认为 false</td>
            </tr>
            <tr>
              <td>community</td>
              <td class="data-type">boolean</td>
              <td class="parameter-optional">否</td>
              <td>是否包含社区信息（如教程和讨论），默认为 false</td>
            </tr>
            <tr>
              <td>relations</td>
              <td class="data-type">boolean</td>
              <td class="parameter-optional">否</td>
              <td>是否包含与其他模组的依赖和关联关系，默认为 false</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="response-fields">
        <h3>响应字段</h3>
        <table>
          <thead>
            <tr>
              <th>字段</th>
              <th>类型</th>
              <th>描述</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>basicInfo</td>
              <td class="data-type">object</td>
              <td>模组的基本信息，包含 id(模组ID)、name(模组名称)、englishName(英文名称)、shortName(简称)、img(封面图片URL)、status(包含isActive和isOpenSource的状态对象)、categories(分类ID列表)、tags(标签名称列表)</td>
            </tr>
            <tr>
              <td>compatibility</td>
              <td class="data-type">object</td>
              <td>模组兼容性信息，包含 platforms(支持的平台列表)、apis(依赖的API列表)、environment(运行环境信息)、mcVersions(支持的Minecraft版本对象，包含forge/neoforge/fabric/dataPack/behaviorPack等版本数组)</td>
            </tr>
            <tr>
              <td>authors</td>
              <td class="data-type">array</td>
              <td>模组作者信息列表，每项包含 name(名称), position(职位/角色), avatar(头像URL), id(作者ID) 属性</td>
            </tr>
            <tr>
              <td>links</td>
              <td class="data-type">array</td>
              <td>模组相关链接列表，每项包含 title(链接标题) 和 url(链接地址) 属性</td>
            </tr>
            <tr>
              <td>resources</td>
              <td class="data-type">array</td>
              <td>模组相关资源信息，每项包含 typeId(资源类型ID) 和 count(资源数量) 属性</td>
            </tr>
            <tr>
              <td>introduction</td>
              <td class="data-type">string</td>
              <td>模组介绍内容(Markdown格式)</td>
            </tr>
            <tr>
              <td>metrics</td>
              <td class="data-type">object</td>
              <td>模组统计和评分信息(需设置others=true)</td>
            </tr>
            <tr>
              <td>metrics.statistics</td>
              <td class="data-type">object</td>
              <td>统计数据，包含 viewCount(浏览数), downloadCount(下载数), popularity(人气指数), fillRate(填充率), yesterdayIndex(昨日指数), yesterdayAvgIndex(昨日平均指数), editCount(编辑次数), modpackCount(包含此模组的整合包数量), resourceCount(资源数量), resourceDataCount(资源数据数量), serverCount(安装此模组的服务器数量), serverInstallRate(服务器安装率), createTime(收录时间), lastUpdate(最后编辑时间), lastRecommend(最后推荐时间) 等属性</td>
            </tr>
            <tr>
              <td>metrics.ratings</td>
              <td class="data-type">object</td>
              <td>评分数据，包含 redVotes(红票/赞成数), blackVotes(黑票/反对数), detailedRatings(详细评分，按不同维度的评价) 等属性</td>
            </tr>
            <tr>
              <td>metrics.updateLogs</td>
              <td class="data-type">array</td>
              <td>更新日志列表，每项包含 version(版本号) 和 date(更新日期) 属性</td>
            </tr>
            <tr>
              <td>teams</td>
              <td class="data-type">object</td>
              <td>模组团队信息(需设置others=true)，包含 managementTeam(管理团队), editingTeam(编辑团队), developmentTeam(开发团队), recentEditors(最近编辑者), recentVisitors(最近访问者) 等属性，每个属性是一个包含团队成员的数组，每个成员有 name(名称), avatar(头像URL), id(成员ID) 属性</td>
            </tr>
            <tr>
              <td>community</td>
              <td class="data-type">object</td>
              <td>模组社区信息(需设置community=true)，包含 tutorials(教程列表, 每项有id和title) 和 discussions(讨论列表, 每项有id和title) 属性</td>
            </tr>
            <tr>
              <td>relations</td>
              <td class="data-type">array</td>
              <td>模组依赖和关联关系(需设置relations=true)，每项包含 version(适用版本), dependencyMods(依赖模组列表), relationMods(关联模组列表) 属性，其中模组列表中的每项包含 id(模组ID) 和 name(模组名称) 属性</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-title">
        <span class="http-method get">GET</span>
        <span class="endpoint-url">/api/modpack</span>
      </div>
      <div class="endpoint-description">
        获取整合包的详细信息，包括基本信息、作者、兼容性等
      </div>

      <div class="code-block">GET /api/modpack?id=整合包ID&others=false&community=false&relations=false</div>

      <div class="parameters">
        <h3>请求参数</h3>
        <table>
          <thead>
            <tr>
              <th>参数名</th>
              <th>类型</th>
              <th>是否必须</th>
              <th>描述</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>id</td>
              <td class="data-type">string</td>
              <td class="parameter-required">是</td>
              <td>整合包ID</td>
            </tr>
            <tr>
              <td>others</td>
              <td class="data-type">boolean</td>
              <td class="parameter-optional">否</td>
              <td>是否包含附加信息（如统计、评分、团队信息等），默认为 false</td>
            </tr>
            <tr>
              <td>community</td>
              <td class="data-type">boolean</td>
              <td class="parameter-optional">否</td>
              <td>是否包含社区信息（如教程），默认为 false</td>
            </tr>
            <tr>
              <td>relations</td>
              <td class="data-type">boolean</td>
              <td class="parameter-optional">否</td>
              <td>是否包含整合包中包含的模组信息，默认为 false</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="response-fields">
        <h3>响应字段</h3>
        <table>
          <thead>
            <tr>
              <th>字段</th>
              <th>类型</th>
              <th>描述</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>basicInfo</td>
              <td class="data-type">object</td>
              <td>整合包的基本信息，包含 id(整合包ID)、name(名称)、englishName(英文名称)、shortName(简称)、img(封面图片URL)、categories(分类ID列表)、tags(标签名称列表)</td>
            </tr>
            <tr>
              <td>compatibility</td>
              <td class="data-type">object</td>
              <td>整合包兼容性信息，包含 packType(整合包类型)、apiType(运作方式列表)、packMethod(打包方式列表)、mcVersions(支持的Minecraft版本列表)</td>
            </tr>
            <tr>
              <td>authors</td>
              <td class="data-type">array</td>
              <td>整合包作者信息列表，每项包含 name(名称)、position(职位/角色)、avatar(头像URL)、id(作者ID) 属性</td>
            </tr>
            <tr>
              <td>links</td>
              <td class="data-type">array</td>
              <td>整合包相关链接列表，每项包含 title(链接标题) 和 url(链接地址) 属性</td>
            </tr>
            <tr>
              <td>introduction</td>
              <td class="data-type">string</td>
              <td>整合包介绍内容(Markdown格式)</td>
            </tr>
            <tr>
              <td>metrics</td>
              <td class="data-type">object</td>
              <td>整合包统计和评分信息(需设置others=true)</td>
            </tr>
            <tr>
              <td>metrics.statistics</td>
              <td class="data-type">object</td>
              <td>统计数据，包含 viewCount(浏览数)、popularity(人气指数)、yesterdayIndex(昨日指数)、yesterdayAvgIndex(昨日平均指数)、editCount(编辑次数)、createTime(收录时间)、lastUpdate(最后编辑时间)、lastRecommend(最后推荐时间)</td>
            </tr>
            <tr>
              <td>metrics.ratings</td>
              <td class="data-type">object</td>
              <td>评分数据，包含 redVotes(红票/赞成数)、blackVotes(黑票/反对数)</td>
            </tr>
            <tr>
              <td>metrics.updateLogs</td>
              <td class="data-type">array</td>
              <td>更新日志列表，每项包含 version(版本号) 和 date(更新日期) 属性</td>
            </tr>
            <tr>
              <td>teams</td>
              <td class="data-type">object</td>
              <td>整合包团队信息(需设置others=true)，包含 recentEditors(最近编辑者)、recentVisitors(最近访问者) 等属性，每个属性是一个包含团队成员的数组，每个成员有 name(名称)、avatar(头像URL)、id(成员ID)</td>
            </tr>
            <tr>
              <td>relations</td>
              <td class="data-type">object</td>
              <td>整合包关联信息</td>
            </tr>
            <tr>
              <td>relations.mods</td>
              <td class="data-type">array</td>
              <td>包含的模组列表(需设置relations=true)，每项包含 id(模组ID)、name(模组名称)、version(模组版本) 属性</td>
            </tr>
            <tr>
              <td>relations.tutorials</td>
              <td class="data-type">array</td>
              <td>相关教程列表(需设置community=true)，每项包含 id(教程ID) 和 title(教程标题) 属性</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-title">
        <span class="http-method get">GET</span>
        <span class="endpoint-url">/api/post</span>
      </div>
      <div class="endpoint-description">
        获取MC百科上的教程内容，包括文章内容、作者信息等
      </div>

      <div class="code-block">GET /api/post?id=教程ID&others=false</div>

      <div class="parameters">
        <h3>请求参数</h3>
        <table>
          <thead>
            <tr>
              <th>参数名</th>
              <th>类型</th>
              <th>是否必须</th>
              <th>描述</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>id</td>
              <td class="data-type">string</td>
              <td class="parameter-required">是</td>
              <td>教程ID</td>
            </tr>
            <tr>
              <td>others</td>
              <td class="data-type">boolean</td>
              <td class="parameter-optional">否</td>
              <td>是否包含附加信息（如统计、作者、团队信息等），默认为 false</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="response-fields">
        <h3>响应字段</h3>
        <table>
          <thead>
            <tr>
              <th>字段</th>
              <th>类型</th>
              <th>描述</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>id</td>
              <td class="data-type">string</td>
              <td>教程ID</td>
            </tr>
            <tr>
              <td>title</td>
              <td class="data-type">string</td>
              <td>教程标题</td>
            </tr>
            <tr>
              <td>content</td>
              <td class="data-type">string</td>
              <td>教程内容（Markdown格式）</td>
            </tr>
            <tr>
              <td>author</td>
              <td class="data-type">object</td>
              <td>作者信息（需设置others=true），包含 name(名称)、avatar(头像URL)、id(用户ID) 属性</td>
            </tr>
            <tr>
              <td>metrics</td>
              <td class="data-type">object</td>
              <td>教程统计信息（需设置others=true）</td>
            </tr>
            <tr>
              <td>metrics.statistics</td>
              <td class="data-type">object</td>
              <td>统计数据，包含 viewCount(浏览数)、editCount(编辑次数)、createTime(创建时间)、lastUpdate(最后更新时间)、permissions(权限) 属性</td>
            </tr>
            <tr>
              <td>teams</td>
              <td class="data-type">object</td>
              <td>教程团队信息（需设置others=true）</td>
            </tr>
            <tr>
              <td>teams.recentEditors</td>
              <td class="data-type">array</td>
              <td>最近编辑者列表，每项包含 name(名称)、avatar(头像URL)、id(用户ID) 属性</td>
            </tr>
            <tr>
              <td>teams.recentVisitors</td>
              <td class="data-type">array</td>
              <td>最近访问者列表，每项包含 name(名称)、avatar(头像URL)、id(用户ID) 属性</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-title">
        <span class="http-method get">GET</span>
        <span class="endpoint-url">/api/item</span>
      </div>
      <div class="endpoint-description">
        获取MC百科上资料的详细信息，包括基本信息、属性、合成表等
      </div>

      <div class="code-block">GET /api/item?id=资料ID&others=false</div>

      <div class="parameters">
        <h3>请求参数</h3>
        <table>
          <thead>
            <tr>
              <th>参数名</th>
              <th>类型</th>
              <th>是否必须</th>
              <th>描述</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>id</td>
              <td class="data-type">string</td>
              <td class="parameter-required">是</td>
              <td>资料ID</td>
            </tr>
            <tr>
              <td>others</td>
              <td class="data-type">boolean</td>
              <td class="parameter-optional">否</td>
              <td>是否包含附加信息（如统计、团队信息等），默认为 false</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="response-fields">
        <h3>响应字段</h3>
        <table>
          <thead>
            <tr>
              <th>字段</th>
              <th>类型</th>
              <th>描述</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td></td>
              <td class="data-type">array</td>
              <td>物品信息数组，可能包含多个物品</td>
            </tr>
            <tr>
              <td>[].id</td>
              <td class="data-type">string</td>
              <td>资料ID</td>
            </tr>
            <tr>
              <td>[].name</td>
              <td class="data-type">string</td>
              <td>资料名称</td>
            </tr>
            <tr>
              <td>[].englishName</td>
              <td class="data-type">string</td>
              <td>资料英文名称</td>
            </tr>
            <tr>
              <td>[].icon</td>
              <td class="data-type">string</td>
              <td>资料图标URL</td>
            </tr>
            <tr>
              <td>[].command</td>
              <td class="data-type">string</td>
              <td>获取物品的命令</td>
            </tr>
            <tr>
              <td>[].modId</td>
              <td class="data-type">string</td>
              <td>资料所属模组ID</td>
            </tr>
            <tr>
              <td>[].modName</td>
              <td class="data-type">string</td>
              <td>资料所属模组名称</td>
            </tr>
            <tr>
              <td>[].modUrl</td>
              <td class="data-type">string</td>
              <td>资料所属模组页面URL</td>
            </tr>
            <tr>
              <td>[].category</td>
              <td class="data-type">string</td>
              <td>资料分类名称</td>
            </tr>
            <tr>
              <td>[].categoryUrl</td>
              <td class="data-type">string</td>
              <td>资料分类页面URL</td>
            </tr>
            <tr>
              <td>[].introduction</td>
              <td class="data-type">string</td>
              <td>资料介绍(Markdown格式)</td>
            </tr>
            <tr>
              <td>[].properties</td>
              <td class="data-type">array</td>
              <td>资料属性列表，每项包含 name(属性名) 和 value(属性值)</td>
            </tr>
            <tr>
              <td>[].recipes</td>
              <td class="data-type">array</td>
              <td>物品合成配方列表，每项包含 type(配方类型)、materials(材料列表)、result(产物信息) 和 notes(备注说明) 属性</td>
            </tr>
            <tr>
              <td>[].metrics</td>
              <td class="data-type">object</td>
              <td>资料统计信息(需设置others=true)</td>
            </tr>
            <tr>
              <td>[].metrics.statistics</td>
              <td class="data-type">object</td>
              <td>统计数据，包含 viewCount(浏览数)、editCount(编辑次数)、createTime(收录时间)、lastUpdate(最后编辑时间) 属性</td>
            </tr>
            <tr>
              <td>[].teams</td>
              <td class="data-type">object</td>
              <td>资料相关团队和资料信息(需设置others=true)</td>
            </tr>
            <tr>
              <td>[].teams.recentEditors</td>
              <td class="data-type">array</td>
              <td>最近编辑者列表，每项包含 name(名称)、avatar(头像URL)、id(用户ID) 属性</td>
            </tr>
            <tr>
              <td>[].teams.recentVisitors</td>
              <td class="data-type">array</td>
              <td>最近访问者列表，每项包含 name(名称)、avatar(头像URL)、id(用户ID) 属性</td>
            </tr>
            <tr>
              <td>[].teams.relatedItems</td>
              <td class="data-type">array</td>
              <td>相关资料列表，每项包含 id(资料ID)、name(资料名称)、icon(资料图标URL)、url(资料页面URL)、isHighlight(是否高亮显示) 属性</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </main>

  <footer>
    <p>MCmod API - MC 百科非官方 API Powered By Yis_Rime</p>
    <p>数据仅供学习和参考，请勿用于商业用途</p>
  </footer>
</body>
</html>
  `;
    return new Response(html, { headers: DOC_HEADERS });
  } catch (error) {
    console.error('加载文档模块失败:', error);
    return createErrorResponse({
      error: '文档加载失败',
      message: '无法生成API文档',
      status: 500
    });
  }
}