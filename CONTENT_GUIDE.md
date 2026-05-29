# 个人主页内容维护指南

这个项目的原则是：改个人信息时优先改 `assets/js/data.js`，尽量不要改 `index.html` 和 `assets/js/main.js`。

## 最常改的位置

打开：

```text
assets/js/data.js
```

按下面这些字段替换：

- `personal.name`: 中文名。
- `personal.englishName`: 英文名。
- `personal.initials`: 首页头像占位缩写。
- `personal.photoUrl`: 真实头像路径，例如 `assets/profile/photo.jpg`。留空会显示默认缩写头像。
- `personal.role`: 当前身份。
- `personal.affiliation`: 学校、学院、实验室。
- `personal.email`: 邮箱。
- `personal.cvUrl`: CV 文件路径，例如 `assets/docs/cv.pdf`。
- `hero.keywords`: 首页研究关键词。
- `snapshot`: 首页后的快速概览条，适合放研究方向、代表论文数量、当前研究重点、荣誉状态。
- `about.paragraphs`: About 段落。
- `education`: 教育经历。
- `interests`: 研究方向。
- `publications`: 论文列表。
- `honors`: 荣誉奖项。
- `services`: 学术服务。
- `news`: 最新动态。
- `collaboration`: Contact 区域的合作偏好卡。

## 论文怎么加

复制 `publications` 里的一个对象，改这些字段：

```js
{
  title: "论文标题",
  authors: "作者列表",
  venue: "会议/期刊",
  year: "2026",
  type: "conference",
  status: "Accepted",
  featured: true,
  summary: "一句话说明贡献和结果。",
  links: {
    PDF: "#",
    Code: "#",
    Project: "#"
  },
  bibtex: "@article{...}"
}
```

`type` 建议用 `journal`、`conference` 或 `preprint`。年份筛选会自动补齐。

`bibtex` 会渲染成可展开、可复制的 BibTeX 面板。没有 BibTeX 时可以留空或删除这个字段。

Publications 的搜索框会自动检索标题、作者、会议/期刊、年份、状态和摘要，不需要额外配置。后续只要把新论文加进 `publications` 数组，筛选和搜索都会自动生效。

## 改完以后怎么自检

```powershell
node --check assets/js/data.js
node --check assets/js/main.js
node tools/validate-data.mjs
node tools/audit-page.mjs
```

`tools/validate-data.mjs` 会检查常见维护问题，例如漏写 `personal.email`、论文链接结构不完整、BibTeX 格式明显异常等。占位链接会以 warning 显示，不会阻止页面运行。
`tools/audit-page.mjs` 会检查页面结构、导航锚点、资源版本、关键渲染容器和已删除模块残留，也会防止重新引入硬直线背景和顶部滚动进度线。
`tools/chrome-cdp-qa.mjs` 会通过本机 Chrome 做桌面、平板和手机端渲染自测，并把截图写到 `qa-screenshots/`；脚本也会验证移动菜单、论文筛选和主题切换。

## 学术概览条怎么改

`snapshot.items` 是首页后方的四个快速扫读信息块：

```js
{
  label: "Representative Work",
  value: "3 papers",
  detail: "Featured publications, preprints, and manuscripts in progress"
}
```

建议保持 3-5 个条目。这里适合放事实，不适合写口号。

## 文件放哪里

建议新建这些目录：

```text
assets/profile/
assets/docs/
```

常见路径：

- 头像：`assets/profile/photo.jpg`
- CV：`assets/docs/cv.pdf`

## 样式和特效在哪里

- 页面结构：`index.html`
- 视觉样式：`assets/css/styles.css`
- 数据渲染和交互：`assets/js/main.js`
- 个人数据：`assets/js/data.js`

点击波纹、轻量点击火花、滚动 reveal、主题切换、论文筛选/搜索、新闻展开、返回顶部、背景 Canvas 和首屏鼠标扰动都在 `assets/js/main.js`。一般只改 `data.js` 就够。

## 首屏科技背景怎么调

背景不是图片，主要由代码生成，方便后续部署和维护：

- 静态点阵、柔和光晕：`assets/css/styles.css` 里的 `body::before` 和 `.hero::before`。
- 动态节点网络、粒子脉冲、遥测弧线、信号条：`assets/js/main.js` 里的 `setupHeroCanvas()`。
- 想弱一点：把 `.hero-canvas` 的 `opacity` 从 `0.98` 调低到 `0.7` 左右。
- 想更亮：调高 `themeColors()` 里 `ring`、`bar`、`scan` 的透明度，但建议不要超过 `0.25`，否则会影响首屏文字可读性。
- 不喜欢某一种动画时，可以在 `draw()` 里注释对应函数调用，例如 `drawSignalBars(colors, elapsed)`。

## 全站背景怎么调

页面默认使用浅色学术主题。桌面端用右上角按钮切换深色主题，窄屏手机端在菜单里切换；切换后的选择会保存在浏览器 `localStorage` 里。

现在页面有两层背景：
- 全站环境背景：`index.html` 里的 `data-site-canvas`，样式在 `.site-backdrop-canvas`，动画逻辑在 `setupSiteBackdropCanvas()`。
- 首屏强化背景：`data-hero-canvas`，样式在 `.hero-canvas`，动画逻辑在 `setupHeroCanvas()`。

想更克制时，先调低 `.site-backdrop-canvas` 的 `opacity`。想更有科技感时，优先增强 `setupSiteBackdropCanvas()` 里的点阵密度、`pulse` 和 `scan` 透明度，不建议改成大面积霓虹色、硬直线网格或黄色鼠标光圈。
