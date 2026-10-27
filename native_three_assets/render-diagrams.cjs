// Usage: node render-diagrams.cjs <mermaid.min.js>
// Dependencies: Playwright with Chromium, or installed Microsoft Edge.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const names = [
    ['normalize-flow', 'ChangelogNormalize · 运行流程'],
    ['normalize-sequence', 'ChangelogNormalize · 运行时序'],
    ['drop-flow', 'DropUpdateBefore · 运行流程'],
    ['drop-sequence', 'DropUpdateBefore · 运行时序'],
    ['window-flow', 'WindowDeduplicate · 运行流程'],
    ['window-sequence', 'WindowDeduplicate · 运行时序'],
];
async function main() {
    if (!process.argv[2]) throw new Error('Expected local Mermaid script path');
    let browser;
    try { browser = await chromium.launch({ headless: true }); }
    catch { browser = await chromium.launch({ headless: true, channel: 'msedge' }); }
    try {
        const page = await browser.newPage({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: 1.5 });
        await page.setContent('<html><head><meta charset="utf-8"></head><body><div id="diagram"></div></body></html>');
        await page.addScriptTag({ path: process.argv[2] });
        await page.evaluate(() => mermaid.initialize({
            startOnLoad: false, securityLevel: 'strict', theme: 'base',
            themeVariables: {
                fontFamily: 'Microsoft YaHei, Arial, sans-serif', fontSize: '16px',
                primaryColor: '#eef5ff', primaryTextColor: '#172b4d', primaryBorderColor: '#4779b8',
                lineColor: '#62758c', secondaryColor: '#f1f5f9', tertiaryColor: '#fff5df',
                actorBkg: '#eef5ff', actorBorder: '#4779b8', actorTextColor: '#172b4d',
                signalColor: '#334e68', noteBkgColor: '#fff5df', noteBorderColor: '#c2a05a',
                noteTextColor: '#513b11',
            },
            flowchart: { useMaxWidth: false, htmlLabels: true, curve: 'linear', nodeSpacing: 28, rankSpacing: 34 },
            sequence: { useMaxWidth: false, actorMargin: 35, messageMargin: 26, mirrorActors: false },
        }));
        const cards = [];
        for (const [name, title] of names) {
            const source = fs.readFileSync(path.join(__dirname, name + '.mmd'), 'utf8');
            const svg = await page.evaluate(async ({ source, name }) => {
                const result = await mermaid.render(name, source);
                document.querySelector('#diagram').innerHTML = result.svg;
                await document.fonts.ready;
                return result.svg;
            }, { source, name });
            fs.writeFileSync(path.join(__dirname, name + '.svg'), svg);
            await page.locator('#diagram svg').screenshot({ path: path.join(__dirname, name + '.png') });
            cards.push(`<section id="${name}"><h2>${title}</h2><div class="graph">${svg}</div><p><a href="${name}.png">PNG</a> · <a href="${name}.svg">SVG</a> · <a href="${name}.mmd">Mermaid 源码</a></p></section>`);
            console.log(name + ': rendered');
        }
        fs.writeFileSync(path.join(__dirname, '运行图预览.html'), `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>三个 Native 算子 · 运行图</title>
<style>
body{margin:0;background:#f2f5f9;color:#172b4d;font-family:"Microsoft YaHei",Arial,sans-serif}
main{max-width:1600px;margin:auto;padding:36px}h1{font-size:28px}h2{font-size:22px}
p{line-height:1.8;color:#53647a}a{color:#245f9c}nav{display:flex;gap:20px;flex-wrap:wrap}
section{background:white;border:1px solid #dce4ee;border-radius:12px;padding:24px;margin:24px 0}
.graph{overflow:auto;padding:16px 0}.graph svg{display:block;margin:auto;max-width:100%;height:auto}
@media print{main{padding:0}section{break-before:page;border:0}nav{display:none}}
</style></head><body><main><h1>三个 Native 算子 · 运行流程与时序</h1>
<p>V1.1 · 2026-10-27 · 已对照对应验收版本源码核对<br>流程图描述分支与循环；时序图描述调用先后。图示为已初始化的合法输入路径，校验失败时抛异常。WindowDeduplicate 的数据处理与 Watermark 触发分为两个阶段。</p>
<nav>${names.map(([name,title])=>`<a href="#${name}">${title}</a>`).join('')}</nav>
${cards.join('\n')}</main></body></html>`);
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
