/* 关于：项目说明、数据订正、免责声明 */
import { S } from '../data.js';
import { escapeHtml, icons } from '../util.js';

export function renderAbout(root) {
  const rev = S.site.review || { family: [], toxic: [], protected: [], missingEcology: [], missingLifeForm: [] };
  const c = S.site.counts;
  root.innerHTML = `<div class="container about">
    <div class="section">
      <div class="eyebrow">About</div>
      <h2 style="font-size:22px;margin-top:4px">关于本站</h2>
      <p>「沈阳大学校园植物图鉴」是一个纯静态网页应用，用来辅助校园植物识别与植物学实习：按科、生活型、用途、功效检索，查看每种植物在校园里的位置，并可离线使用。</p>
      <p>当前收录 <b>${c.species}</b> 种植物、<b>${c.images}</b> 张照片、<b>${c.families}</b> 个科。数据来自${escapeHtml(S.site.source)}。</p>
    </div>

    <div class="card-block" style="margin-left:0;margin-right:0">
      <h3>数据是怎么处理的</h3>
      <p style="font-size:13px;line-height:1.95;color:var(--ink-2);margin-top:8px">
        每条物种的「别名 / 形态特征 / 生态习性 / 价值功用 / 校园位置」正文<strong>原样保留</strong>，未改写、未润色。
        页面上的「生活型、常绿/落叶、用途、功效、花期、果期」等标签，由原文关键词自动提取，
        每条依据都保存在数据文件的 <code>derived</code> 字段里，详情页可展开查看原文片段。
      </p>
      <p style="font-size:12.5px;line-height:1.9;color:var(--muted);margin-top:8px">
        科名做了 ${rev.family?.length || 0} 处订正：原文中的「蔷薇亚目科」「桔梗目科」「牛栓藤科」等不是规范科名或属于误标，已按属的归属改正。
        中文名做了 ${rev.name?.length || 0} 处笔误订正，依据拉丁名与原文描述，详情页会标注原文写法。
      </p>
      ${rev.name?.length ? `<details style="margin-top:10px"><summary style="font-size:12px;color:var(--brand-2);cursor:pointer">查看中文名订正（${rev.name.length} 条）</summary>
        <ul style="font-size:11.5px;color:var(--muted);line-height:1.9;margin-top:8px;padding-left:18px">
          ${rev.name.map(n => `<li>原文「${escapeHtml(n.species)}」→ <b>${escapeHtml(n.to)}</b>：${escapeHtml(n.reason)}</li>`).join('')}
        </ul></details>` : ''}
      ${rev.family?.length ? `<details style="margin-top:10px"><summary style="font-size:12px;color:var(--brand-2);cursor:pointer">查看科名订正明细（${rev.family.length} 条）</summary>
        <div style="margin-top:10px;overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:11.5px;line-height:1.7">
          <thead><tr style="text-align:left;color:var(--muted)"><th style="padding:6px 8px;border-bottom:1px solid var(--line)">物种</th>
          <th style="padding:6px 8px;border-bottom:1px solid var(--line)">原文</th>
          <th style="padding:6px 8px;border-bottom:1px solid var(--line)">改为</th></tr></thead>
          <tbody>${rev.family.map(f => `<tr>
            <td style="padding:6px 8px;border-bottom:1px solid var(--line)">${escapeHtml(f.species)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid var(--line);color:var(--muted)">${escapeHtml(f.from)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid var(--line)">${escapeHtml(f.to)}</td></tr>`).join('')}</tbody>
        </table></div></details>` : ''}
    </div>

    <div class="card-block" style="margin-left:0;margin-right:0">
      <h3>功能</h3>
      <p style="font-size:13px;line-height:2;color:var(--ink-2);margin-top:8px">
        图鉴浏览 · 多维检索（名称/别名/拉丁/科属/正文）· 科/生活型/用途/功效/校区筛选 · 多图详情 · 校园分布示意图 ·
        看图识种与特征辨种测验 · 错题本 · 收藏与掌握标记 · 观察记录（拍照 + 地点 + 笔记）· 学习打卡 ·
        深色模式 · 离线使用（PWA）
      </p>
    </div>

    <div class="card-block" style="margin-left:0;margin-right:0">
      <h3>需要说明的地方</h3>
      <ul style="font-size:12.5px;line-height:1.95;color:var(--ink-2);margin-top:8px;padding-left:18px;list-style:disc">
        <li>地图是<strong>教学示意图</strong>，只表示物种与建筑/区域的对应关系，不是实测平面图。</li>
        <li>${rev.missingEcology?.length || 0} 种植物原文没有独立的生态习性段落，页面显示「原文未写」，没有补写。</li>
        <li>${rev.missingLifeForm?.length || 0} 种原文未明示生活型，筛选时不计入任何生活型。</li>
        <li>「有毒」标记只在原文出现毒性表述时给出，${rev.toxic?.length || 0} 种有标记。</li>
        <li>图片来自校园植物名录文档，版权归原拍摄者所有；仅用于教学识别，如涉侵权请联系删除。</li>
      </ul>
    </div>

    <div class="card-block" style="margin-left:0;margin-right:0">
      <h3>免责声明</h3>
      <p style="font-size:12.5px;line-height:1.9;color:var(--ink-2);margin-top:8px">
        本站所有植物信息与药用记载均为教学学术参考，<strong>不构成任何医疗诊断、治疗、用药或食用建议</strong>。
        野外植物存在误认风险，请勿依据本站内容采食或药用。如有健康问题，请咨询专业医疗人员。
      </p>
    </div>

    <div class="card-block" style="margin-left:0;margin-right:0">
      <h3>开源与更新</h3>
      <p style="font-size:12.5px;line-height:1.9;color:var(--ink-2);margin-top:8px">
        项目以纯静态方式构建，可部署在 GitHub Pages / Gitee Pages。添加新植物的方法见仓库内
        <code>docs/adding-plants.md</code>。
      </p>
      ${S.site.repo ? `<a class="link-out" href="${escapeHtml(S.site.repo)}" target="_blank" rel="noopener">${icons.share} 查看 GitHub 仓库</a>` : `<p class="note">仓库地址发布后填写在 <code>data/site.json</code> 的 <code>repo</code> 字段。</p>`}
      <p class="note">许可：代码 MIT · 文字与数据 CC BY-NC-SA 4.0 · 照片版权归原拍摄者，仅限教学使用。</p>
      <p class="note">版本 v1.0 · 数据更新 ${escapeHtml(S.site.updated)}</p>
    </div>

    <p class="foot-note">沈阳大学校园植物图鉴 · 教学用途</p>
  </div>`;
}
