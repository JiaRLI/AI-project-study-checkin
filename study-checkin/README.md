# 个人学习打卡（GitHub Pages）

一个纯前端、可离线使用的学习打卡网页：日历视图、连续天数统计、记录搜索、JSON 导入/导出。数据默认保存在浏览器本地（localStorage）。

## 本地预览

方式 A：直接双击打开 `study-checkin/index.html`（大多数浏览器可用）。

方式 B：用本地静态服务器（更推荐）。

如果你装了 Node.js：

```bash
npx serve .
```

然后访问终端里提示的地址（通常是 `http://localhost:3000`）。

## 部署到 GitHub Pages（最短步骤）

1. 在 GitHub 新建一个仓库（例如 `study-checkin`）。
2. 把本文件夹里的内容上传到仓库根目录（至少包含 `index.html` / `styles.css` / `app.js`）。
3. 打开仓库页面：Settings → Pages
4. 在 **Build and deployment**：
   - Source 选择 **Deploy from a branch**
   - Branch 选择 **main**（或 master）+ **/(root)**，保存
5. 等待 1–2 分钟，Pages 会给你一个访问地址。

> 想用你的个人域名主页地址（`https://<用户名>.github.io/`）：
> - 仓库名需要是 `<用户名>.github.io`
> - 同样在 Settings → Pages 设置 main + root

## 数据说明

- 数据存储：浏览器 localStorage（同一浏览器/同一设备/同一域名下可用）
- 建议：定期点击页面的“导出 JSON”做备份

