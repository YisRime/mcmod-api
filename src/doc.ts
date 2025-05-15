import { createErrorResponse } from './api';

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
        根据关键词搜索 MC 百科内容，包括模组、物品、模组包等
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
              <td>结果偏移量，默认为 0 （注：搜索结果每页固定为 30 个结果）</td>
            </tr>
            <tr>
              <td>page</td>
              <td class="data-type">number</td>
              <td class="parameter-optional">否</td>
              <td>页码，从 1 开始，默认为 1。当提供 offset 时，此参数被忽略</td>
            </tr>
            <tr>
              <td>mold</td>
              <td class="data-type">boolean</td>
              <td class="parameter-optional">否</td>
              <td>是否启用复杂搜索， 1 表示启用， 0 表示禁用，默认为 0</td>
            </tr>
            <tr>
              <td>filter</td>
              <td class="data-type">number</td>
              <td class="parameter-optional">否</td>
              <td>结果类型过滤器，值范围 1-7 ，分别代表模组、整合包、资料、教程、作者、用户、社群，默认为 0 （不过滤）</td>
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
              <td>搜索结果列表，包含匹配的内容项</td>
            </tr>
            <tr>
              <td>results[].id</td>
              <td class="data-type">string</td>
              <td>内容ID</td>
            </tr>
            <tr>
              <td>results[].name</td>
              <td class="data-type">string</td>
              <td>内容名称</td>
            </tr>
            <tr>
              <td>results[].description</td>
              <td class="data-type">string</td>
              <td>内容描述</td>
            </tr>
            <tr>
              <td>results[].type</td>
              <td class="data-type">string</td>
              <td>内容类型，可能的值： class(模组)、modpack(整合包)、item(资料)、post(教程)、author(作者)、user(用户)、community(社群)</td>
            </tr>
            <tr>
              <td>results[].url</td>
              <td class="data-type">string</td>
              <td>内容在 MC 百科上的 URL</td>
            </tr>
            <tr>
              <td>results[].category</td>
              <td class="data-type">string</td>
              <td>分类 ID ，仅当 type 为 class 时可能存在</td>
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
              <td>模组的基本信息</td>
            </tr>
            <tr>
              <td>basicInfo.id</td>
              <td class="data-type">string</td>
              <td>模组ID</td>
            </tr>
            <tr>
              <td>basicInfo.name</td>
              <td class="data-type">string</td>
              <td>模组名称</td>
            </tr>
            <tr>
              <td>basicInfo.englishName</td>
              <td class="data-type">string</td>
              <td>模组英文名称</td>
            </tr>
            <tr>
              <td>basicInfo.shortName</td>
              <td class="data-type">string</td>
              <td>模组简称</td>
            </tr>
            <tr>
              <td>basicInfo.img</td>
              <td class="data-type">string</td>
              <td>模组封面图片URL</td>
            </tr>
            <tr>
              <td>basicInfo.status</td>
              <td class="data-type">object</td>
              <td>模组状态信息</td>
            </tr>
            <tr>
              <td>basicInfo.categories</td>
              <td class="data-type">array</td>
              <td>模组所属分类ID列表</td>
            </tr>
            <tr>
              <td>basicInfo.tags</td>
              <td class="data-type">array</td>
              <td>模组标签列表</td>
            </tr>
            <tr>
              <td>compatibility</td>
              <td class="data-type">object</td>
              <td>模组兼容性信息</td>
            </tr>
            <tr>
              <td>compatibility.platforms</td>
              <td class="data-type">array</td>
              <td>支持的平台列表</td>
            </tr>
            <tr>
              <td>compatibility.apis</td>
              <td class="data-type">array</td>
              <td>依赖的API列表</td>
            </tr>
            <tr>
              <td>compatibility.environment</td>
              <td class="data-type">string</td>
              <td>运行环境信息</td>
            </tr>
            <tr>
              <td>compatibility.mcVersions</td>
              <td class="data-type">object</td>
              <td>支持的Minecraft版本信息</td>
            </tr>
            <tr>
              <td>authors</td>
              <td class="data-type">array</td>
              <td>模组作者信息列表</td>
            </tr>
            <tr>
              <td>links</td>
              <td class="data-type">array</td>
              <td>模组相关链接列表</td>
            </tr>
            <tr>
              <td>resources</td>
              <td class="data-type">array</td>
              <td>模组相关资源信息</td>
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
              <td>teams</td>
              <td class="data-type">object</td>
              <td>模组团队信息(需设置others=true)</td>
            </tr>
            <tr>
              <td>community</td>
              <td class="data-type">object</td>
              <td>模组社区信息(需设置community=true)</td>
            </tr>
            <tr>
              <td>relations</td>
              <td class="data-type">array</td>
              <td>模组依赖和关联关系(需设置relations=true)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </main>

  <footer>
    <p>MCmod API - MC 百科 非官方 API</p>
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