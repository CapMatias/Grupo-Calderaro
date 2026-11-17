// Monta o site: src/layout.html + src/pages/*.html.
//   node build.js            -> publicar/ (o site para a hospedagem: fotos e vídeos como arquivos, o navegador guarda em cache)
//   node build.js --preview  -> .preview/ (fotos embutidas em cada página, para abrir no preview do app, que não carrega arquivos ao lado)
const fs = require('fs'), path = require('path');

const PREVIEW = process.argv.includes('--preview');
const OUT = PREVIEW ? '.preview' : 'publicar';
const LIMIT_KB = 500; // acima disso o preview do app recusa abrir o arquivo
const layout = fs.readFileSync('src/layout.html', 'utf8');
const pages = fs.readdirSync('src/pages').filter(f => f.endsWith('.html'));

// recomeça do zero: página ou arquivo removido de src/ não pode continuar no ar
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// copia só os arquivos que alguma página usa (video/ e img/ também guardam originais e rascunhos)
const copy = p => {
  if (!fs.existsSync(p)) throw new Error(`arquivo não encontrado: ${p}`);
  fs.mkdirSync(path.join(OUT, path.dirname(p)), { recursive: true });
  fs.copyFileSync(p, path.join(OUT, p));
};
const used = new Set();
for (const f of pages) {
  for (const m of fs.readFileSync(path.join('src/pages', f), 'utf8').matchAll(/src="((?:video|img\/web)\/[^"]+)"/g)) used.add(m[1]);
}
for (const p of used) if (p.startsWith('video/') || !PREVIEW) copy(p);

for (const file of pages) {
  let page = fs.readFileSync(path.join('src/pages', file), 'utf8');
  const head = page.match(/^<!--(\{.*?\})-->\r?\n/);
  if (!head) throw new Error(`${file}: falta a primeira linha <!--{"title":...,"description":...}-->`);
  const meta = JSON.parse(head[1]);
  page = page.slice(head[0].length);

  // funções no replace para que "$" no conteúdo não seja interpretado como padrão
  let html = layout
    .replace('{{title}}', () => meta.title)
    .replace('{{description}}', () => meta.description)
    .replace('{{content}}', () => page)
    .replace(/(<a [^>]*href="([a-z-]+\.html)")/g, (m, a, href) => href === file ? a + ' aria-current="page"' : a);

  if (PREVIEW) html = html.replace(/src="(img\/web\/[^"]+\.jpg)"/g, (m, p) => {
    if (!fs.existsSync(p)) throw new Error(`${file}: imagem não encontrada: ${p}`);
    return `src="data:image/jpeg;base64,${fs.readFileSync(p).toString('base64')}"`;
  });

  fs.writeFileSync(path.join(OUT, file), html);
  const kb = Math.round(Buffer.byteLength(html) / 1024);
  console.log(file.padEnd(16), `${kb}KB`, PREVIEW && kb > LIMIT_KB ? '  ATENÇÃO: acima do limite do preview' : '');
}
console.log(`-> ${OUT}/`);
