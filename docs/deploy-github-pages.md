# 部署到 GitHub Pages

本项目是纯静态站点，**不需要构建**，把仓库根目录直接发布即可。

## 一、首次发布

1. **创建仓库**（建议名字 `syu-campus-plants`），把本目录内容推到 `main` 分支：

   ```bash
   cd syu-plants
   git init
   git add .
   git commit -m "feat: 沈阳大学校园植物图鉴 v1.0"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/<仓库名>.git
   git push -u origin main
   ```

2. 仓库 **Settings → Pages**：
   - Source：`Deploy from a branch`
   - Branch：`main`，目录 `/ (root)`
   - 保存后等待 1–2 分钟

3. 访问：`https://<你的用户名>.github.io/<仓库名>/`

## 二、为什么能直接用

- 所有资源都是**相对路径**（`./assets/...`、`data/plants.json`），放在子路径（仓库名目录）下也能正常加载；
- 已包含 `.nojekyll`，避免 GitHub Pages 用 Jekyll 处理而以 `_` 开头的目录/文件被忽略；
- 路由用 `#/...` hash，不依赖服务器重写规则，刷新与直接访问深链都不会 404；
- `404.html` 会把未知路径带回首页，作为额外兜底。

## 三、更新数据后

1. 修改 `data/plants.json` / 新增 `images/...`；
2. 把 `sw.js` 第一行版本号改掉，例如 `syu-v1.0.0` → `syu-v1.0.1`（否则老访客可能继续用缓存中的旧数据）；
3. 推送：

   ```bash
   git add -A
   git commit -m "data: 增加 3 种植物"
   git push
   ```

4. 手机/浏览器刷新一次即可；如果仍是旧内容，可在浏览器开发者工具里「Update on reload」或清除站点数据。

## 四、自定义域名（可选）

1. 仓库 **Settings → Pages → Custom domain** 填域名；
2. 在域名服务商处加 CNAME 记录指向 `<用户名>.github.io`；
3. 仓库根目录会生成 `CNAME` 文件，**不要删除**；
4. 建议在 `data/site.json` 的 `repo` 字段写入仓库地址，关于页会显示入口。

## 五、Gitee Pages（国内访问更快）

步骤与 GitHub 类似：新建仓库 → 推送 → 服务 → Gitee Pages → 选择 `main` 分支、部署目录 `/`。
注意 Gitee Pages 需要实名认证，且免费版每次更新后需手动点「更新」。

## 六、常见问题

**页面空白 / 控制台报 `Failed to fetch`**
本地直接双击 `index.html` 会因 `file://` 协议被浏览器拦截 `fetch`。请用 `node scripts/serve.mjs` 或 `python -m http.server` 起本地服务。

**图片 404**
检查 `images/<code>/` 目录名与 `data/plants.json` 里的 `code` 是否一致，文件名是否为两位数字（`01.webp`、`01s.webp`）。运行 `node scripts/validate.mjs` 会列出缺失文件。

**新数据不生效**
90% 是 Service Worker 还在用旧缓存：改 `sw.js` 的 `VERSION` 并刷新。

**想关闭离线缓存**
删除 `index.html` 里的 `registerSW()` 调用，或把 `sw.js` 换成 `self.addEventListener('install', () => self.skipWaiting())` 后注销。
