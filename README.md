# MCMod中文网 API

基于Cloudflare Workers的轻量级API服务，提供MCMod中文网(mcmod.cn)数据。

## 快速部署

```bash
# 安装依赖
npm install

# 登录Cloudflare
npx wrangler login

# 部署
npm run deploy
```

## API端点概览

| 端点 | 描述 | 参数 |
|------|------|------|
| `/api/mod?id={modId}` | 获取模组详情 | `id`: 模组ID (必填) |
| `/api/item?id={itemId}` | 获取物品详情 | `id`: 物品ID (必填) |
| `/api/modpack?id={packId}` | 获取模组包详情 | `id`: 模组包ID (必填) |
| `/api/course?id={courseId}` | 获取教程详情 | `id`: 教程ID (必填) |
| `/api/server?id={serverId}` | 获取服务器详情 | `id`: 服务器ID (必填) |
| `/api/search?q={关键词}` | 搜索内容 | `q`: 搜索词 (必填) |
| `/api/search/server?q={关键词}&page={页码}` | 搜索服务器 | `q`: 搜索词 (必填)，`page`: 页码 |
| `/api/list?category={分类}&page={页码}` | 获取模组列表 | `category`: 分类 (可选)，`page`: 页码 |

## 数据结构

### 模组 (Module)
```typescript
{
  id: string;         // 模组ID
  name: string;       // 模组名称
  description: string; // 模组描述
  imageUrl?: string;   // 模组图片URL
  authors?: string[];  // 作者列表
  version?: string;    // 版本
  downloadUrl?: string; // 下载链接
  categories?: string[]; // 分类
  mcVersions?: string[]; // 支持的Minecraft版本
}
```

### 物品 (Item)
```typescript
{
  id: string;        // 物品ID
  name: string;      // 物品名称
  iconUrl?: string;   // 物品图标URL
  introduction: string; // 物品介绍
  tabUrl?: string;     // 所属模组页面链接
  moduleId?: string;   // 所属模组ID
  moduleName?: string; // 所属模组名称
}
```

### 模组包 (ModulePackage)
```typescript
{
  id: string;        // 模组包ID
  name: string;      // 模组包名称
  description: string; // 模组包描述
  imageUrl?: string;   // 模组包图片URL
  authors?: string[];  // 作者列表
  mcVersion?: string;  // Minecraft版本
  downloadUrl?: string; // 下载链接
  modules?: Array<{id: string, name: string, imageUrl?: string}>; // 包含的模组
}
```

### 教程 (Course)
```typescript
{
  id: string;       // 教程ID
  title: string;    // 教程标题
  content: string;  // 教程内容
  author?: string;  // 作者
  date?: string;    // 发布日期
  viewCount?: number; // 查看次数
}
```

### 服务器 (Server)
```typescript
{
  id: string;       // 服务器ID
  name: string;     // 服务器名称
  description: string; // 服务器描述
  imageUrl?: string;   // 服务器图片URL
  ip?: string;       // 服务器IP
  port?: string;     // 服务器端口
  version?: string;  // 游戏版本
  online?: number;   // 当前在线人数
  players?: number;  // 总人数上限
  status?: string;   // 状态（online/offline）
}
```

## 使用须知

- 所有API请求均支持CORS
- 请求超时限制为10秒
- 数据来源于mcmod.cn，请遵守原站条款
- 仅供学习和研究使用

## 许可证

MIT
