# Cloudflare 免费版部署与提速

本项目运行在 Node.js 或 Docker 中，由 Cloudflare 域名代理或 Tunnel 转发。它不是可以直接上传到 Cloudflare Pages 的纯静态站点。

## 先用生产模式运行

推荐使用本仓库构建的 Docker 镜像 `ghcr.io/lxy1338832064-byte/lunatv-lxy:latest`，或执行：

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

不要通过 Cloudflare 对外转发 `pnpm dev`。开发模式需要临时编译页面，首次跳转等待不能代表生产性能。

环境变量和 Redis 持久化数据沿用原部署。切换镜像前保留 Redis 数据卷。`.env.local`、`.local`、本地 Redis 数据及开发启动脚本均已从 Git / Docker 上下文排除。

## 免费缓存如何生效

普通海报通过 `/api/image-proxy/poster.webp?w=240&url=...` 返回压缩 WebP。Banner 使用较大尺寸。路径中的 `.webp` 使 Cloudflare 默认缓存能够识别图片；服务端同时返回浏览器缓存、共享缓存和 ETag。

- 浏览器缓存海报 1 天，Cloudflare 边缘缓存最多 7 天，实际缓存可能提前被淘汰。
- URL 中的 `w`、`url` 等全部查询参数必须参与缓存键，否则不同影片可能显示成同一张图。
- 默认缓存级别使用 **Standard**；不要选 **Ignore Query String**。
- 保留 HTTPS 和原站登录验证。海报响应中只包含公开封面，不包含账户资料、播放地址或观看进度。

如果已有覆盖规则导致海报不缓存，可添加一条 Cache Rule，仅匹配：

```text
http.request.uri.path eq "/api/image-proxy/poster.webp"
```

设置为允许缓存，并尊重源站 Cache-Control；使用默认查询参数缓存键。不要对整个 `/api/` 或全站启用 Cache Everything。HTML、登录、用户管理、搜索、详情和观看记录应沿用动态响应。特别是 `/api/detail` 会校验当前用户可用源，响应为 `private, no-store`；详情缓存仅在源站内部复用，权限校验仍逐次执行。

参考：[Cloudflare 默认缓存行为](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/)、[查询参数与缓存级别](https://developers.cloudflare.com/cache/how-to/set-caching-levels/)。

## 已实施的应用优化

- 隐藏的观看记录、测速、影片操作和版本面板按需下载，版本检查在打开用户菜单后执行。
- 首页每类只取当前显示的 12 条推荐；同一标签页内缓存 5 分钟，切换豆瓣代理后使用独立缓存。
- 下方片单和其他用户观看模块在接近可视区域时才挂载，减少首次打开时的图片和数据请求。
- 常用海报缩小至 240px；源站 WebP 缓存限制 32MB，相同海报并发请求合并，图片下载和解码最多同时执行 6 个任务。
- 同源同影片的详情在源站复用 30 秒，并发请求合并；切换源地址或配置后不会误用旧源缓存。
- 已知影片来源时先取该来源详情进入播放，再在后台搜索替代源。点击后顶部立即显示加载反馈。

## 部署后验证

1. 首次打开首页，再刷新一次，比较第二次海报加载情况。
2. 在浏览器网络面板查看 `poster.webp` 响应。经 Cloudflare 重复请求时应有机会看到 `CF-Cache-Status: HIT`；首次 `MISS`、本地访问没有此响应头都属正常情况。
3. 检查不同 `url`、不同 `w` 的海报仍正确，确认没有忽略查询参数的旧规则。
4. 测试搜索、收藏、继续观看、换集、切换来源和用户管理。

本地构建体积和源站缓存测试不能替代部署后的 Cloudflare 链路实测。免费线路的跨网延迟、源站上行及第三方视频线路仍会影响加载和播放；视频本身的速度也取决于所选资源站。

## 本次本地验证（2026-11-09）

按生产构建中首屏所需 JS 文件逐个 gzip 后相加，与优化前保存的构建对比：

| 页面   |    优化前 |    优化后 | 降幅 |
| ------ | --------: | --------: | ---: |
| 首页   | 181,818 B | 137,711 B |  24% |
| 搜索页 | 180,510 B | 137,183 B |  24% |
| 播放页 | 360,644 B | 318,521 B |  12% |

这些数字只统计首屏脚本，不包含 CSS、图片和随后按需下载的代码。3 张真实海报从原有 360px WebP 改为 240px 后，合计从 46,054 B 降至 36,564 B，减少约 21%。真实 WebP 解码、登录校验、错误请求、缓存响应头、ETag 304、搜索和播放详情均已验证。此结果来自本地源站，不代表 Cloudflare 外网加载时长。
