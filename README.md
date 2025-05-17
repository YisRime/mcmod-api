# MCmod API

基于Cloudflare Workers的轻量级API服务，提供MCMod中文网(mcmod.cn)数据的非官方API。

## API端点概览

| 端点 | 描述 | 主要参数 |
|------|------|------|
| `/api/search?q={关键词}` | 搜索MC百科内容 | `q`: 搜索关键词(必填)，`offset`/`page`: 分页，`mold`: 复杂搜索，`filter`: 结果过滤 |
| `/api/class?id={modId}` | 获取模组详情 | `id`: 模组ID(必填)，`others`/`community`/`relations`: 附加信息 |
| `/api/modpack?id={packId}` | 获取整合包详情 | `id`: 整合包ID(必填)，`others`/`community`/`relations`: 附加信息 |
| `/api/post?id={postId}` | 获取教程内容 | `id`: 教程ID(必填)，`others`: 附加信息 |
| `/api/item?id={itemId}` | 获取资料详情 | `id`: 资料ID(必填)，`others`: 附加信息 |

## 详细数据结构

### 搜索结果

```typescript
{
  results: Array<{
    id: string;       // 内容ID
    name: string;     // 内容名称
    description: string; // 内容简介
    url: string;      // 链接地址
  }>;
  page: number;       // 当前页码
  total: number;      // 总页数
  totalResults: number; // 匹配的总结果数
}
```

### 模组信息

```typescript
{
  basicInfo: {
    id: string;         // 模组ID
    name: string;       // 模组名称
    englishName: string; // 英文名称
    shortName: string;   // 简称
    img: string;         // 封面图片URL
    status: {            // 状态
      isActive: boolean; // 是否活跃
      isOpenSource: boolean; // 是否开源
    };
    categories: string[]; // 分类ID列表
    tags: string[];      // 标签列表
  };
  compatibility: {       // 兼容性信息
    platforms: string[]; // 支持平台
    apis: string[];      // 依赖API
    environment: object; // 运行环境
    mcVersions: object;  // 支持的MC版本
  };
  authors: Array<{       // 作者列表
    name: string;        // 作者名
    position: string;    // 职位/角色
    avatar: string;      // 头像URL
    id: string;          // 作者ID
  }>;
  links: Array<{         // 相关链接
    title: string;       // 链接标题
    url: string;         // 链接地址
  }>;
  introduction: string;  // 模组介绍(Markdown)
}
```

### 整合包信息

```typescript
{
  basicInfo: {
    id: string;          // 整合包ID
    name: string;        // 名称
    englishName: string; // 英文名称
    shortName: string;   // 简称
    img: string;         // 封面图片URL
    categories: string[]; // 分类ID列表
    tags: string[];      // 标签列表
  };
  compatibility: {
    packType: string;    // 整合包类型
    apiType: string[];   // 运作方式列表
    packMethod: string[]; // 打包方式列表
    mcVersions: string[]; // 支持的MC版本
  };
  authors: Array<{       // 作者信息
    name: string;        // 名称
    position: string;    // 职位
    avatar: string;      // 头像URL
    id: string;          // 作者ID
  }>;
  links: Array<{         // 相关链接
    title: string;       // 链接标题
    url: string;         // 链接地址
  }>;
  introduction: string;  // 整合包介绍(Markdown)
}
```

### 教程信息

```typescript
{
  id: string;           // 教程ID
  title: string;        // 教程标题
  content: string;      // 教程内容(Markdown)
  author: {             // 作者信息(需设置others=true)
    name: string;       // 作者名
    avatar: string;     // 头像URL
    id: string;         // 用户ID
  };
  metrics: {            // 统计信息(需设置others=true)
    statistics: {
      viewCount: number; // 浏览数
      editCount: number; // 编辑次数
      createTime: string; // 创建时间
      lastUpdate: string; // 最后更新时间
    }
  };
}
```

### 资料信息

```typescript
[
  {
    id: string;           // 资料ID
    name: string;         // 资料名称
    englishName: string;  // 英文名称
    icon: string;         // 图标URL
    command: string;      // 获取物品命令
    modId: string;        // 所属模组ID
    modName: string;      // 所属模组名称
    modUrl: string;       // 模组页面URL
    category: string;     // 分类名称
    categoryUrl: string;  // 分类页面URL
    introduction: string; // 资料介绍(Markdown)
    properties: Array<{   // 属性列表
      name: string;       // 属性名
      value: string;      // 属性值
    }>;
    recipes: Array<{      // 合成配方
      type: string;       // 配方类型
      materials: any[];   // 材料列表
      result: any;        // 产物信息
      notes: string;      // 备注说明
    }>;
  }
  // 可能包含多个物品
]
```

## 使用须知

- 所有API请求均支持CORS
- 数据来源于mcmod.cn，请遵守原站条款
- 仅供学习和研究使用
- 详细的API文档可通过访问API根路径获取
