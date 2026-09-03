'use strict';

let currentKind = 'class';

async function api(path, opts) {
  const res = await fetch(path, opts);
  return res.json();
}

function renderNode(node) {
  const div = document.createElement('div');
  div.className = 'node';
  const row = document.createElement('div');
  row.className = 'row';
  const twisty = document.createElement('span');
  twisty.className = 'twisty';
  const hasChildren = node.children && node.children.length > 0;
  twisty.textContent = hasChildren ? '▾' : '·';
  if (hasChildren) {
    twisty.onclick = () => {
      div.classList.toggle('collapsed');
      twisty.textContent = div.classList.contains('collapsed') ? '▸' : '▾';
    };
  }
  row.appendChild(twisty);
  const name = document.createElement('span');
  name.textContent = node.name;
  name.title = node.iri;
  row.appendChild(name);
  if (hasChildren) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = `(${node.children.length})`;
    row.appendChild(badge);
  }
  div.appendChild(row);
  if (hasChildren) {
    const ch = document.createElement('div');
    ch.className = 'children';
    for (const c of node.children) ch.appendChild(renderNode(c));
    div.appendChild(ch);
  }
  return div;
}

async function refreshTree() {
  const wrap = document.getElementById('tree-wrap');
  const data = await api('/api/tree?kind=' + encodeURIComponent(currentKind));
  wrap.innerHTML = '';
  if (!data.ok) {
    wrap.innerHTML = '<div id="empty">尚未加载本体。</div>';
    return;
  }
  if (!data.tree.length) {
    wrap.innerHTML = '<div id="empty">该层级为空。</div>';
    return;
  }
  for (const root of data.tree) wrap.appendChild(renderNode(root));
}

async function refreshStats() {
  const s = await api('/api/stats');
  const el = document.getElementById('stats');
  if (!s.loaded) { el.textContent = ''; return; }
  el.textContent = `公理 ${s.axiomCount} · 类 ${s.classes} · 对象属性 ${s.objectProperties} · 数据属性 ${s.dataProperties} · 个体 ${s.individuals}`;
}

async function loadOntology() {
  const filePath = document.getElementById('filePath').value.trim();
  const msg = document.getElementById('msg');
  if (!filePath) { msg.textContent = '请输入文件路径'; return; }
  msg.textContent = '加载中…';
  const r = await api('/api/load', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filePath })
  });
  if (r.error) { msg.textContent = '加载失败: ' + r.error; return; }
  msg.textContent = '已加载: ' + r.ontology.id;
  await refreshStats();
  await refreshTree();
}

document.getElementById('btn-load').addEventListener('click', loadOntology);
document.getElementById('filePath').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loadOntology();
});
document.querySelectorAll('nav .tab').forEach(tab => {
  tab.addEventListener('click', async () => {
    document.querySelectorAll('nav .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentKind = tab.dataset.kind;
    await refreshTree();
  });
});

refreshStats();
