/* =====================================================================
   Rede Bolha — Painel Administrativo
   CMS Git-based: autentica no GitHub via token pessoal (guardado apenas
   no navegador) e publica artigos como HTML estatico no mesmo padrao do
   site (blog.css + JSON-LD), preservando URLs e SEO.
   ===================================================================== */
(function(){
"use strict";

/* ---------- Config do repositorio ---------- */
var REPO = { owner: "Redebolha", name: "Redebolha", branch: "main" };
var SITE = "https://redebolha.com.br";
var TZ = "America/Sao_Paulo"; // Porto Alegre / RS
var API = "https://api.github.com";

/* ---------- Estado ---------- */
var state = {
  token: null,
  user: null,          // e-mail informado no login
  ghUser: null,        // login do GitHub
  route: "dashboard",
  articles: [],        // cache de artigos (metadados)
  categories: JSON.parse(localStorage.getItem("rb_cats")||'["Solidão","Masculinidade","Paternidade","Propósito","Relacionamentos","Fé e Identidade","Saúde Emocional"]'),
  tags: JSON.parse(localStorage.getItem("rb_tags")||'[]'),
  editing: null,       // artigo em edicao
  loginTries: parseInt(localStorage.getItem("rb_tries")||"0",10),
  lockUntil: parseInt(localStorage.getItem("rb_lock")||"0",10)
};

/* ---------- Utilidades ---------- */
function $(s,c){return (c||document).querySelector(s);}
function $all(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s));}
function el(tag,attrs,html){var e=document.createElement(tag);if(attrs)for(var k in attrs){if(k==="class")e.className=attrs[k];else if(k==="text")e.textContent=attrs[k];else e.setAttribute(k,attrs[k]);}if(html!=null)e.innerHTML=html;return e;}
function esc(s){return (s==null?"":String(s)).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function slugify(s){return (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80);}
function nowISO(){return new Date().toISOString();}
function fmtDate(iso){if(!iso)return "—";try{return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:TZ}).format(new Date(iso));}catch(e){return iso;}}
function readingTime(text){var w=(text||"").trim().split(/\s+/).filter(Boolean).length;return Math.max(1,Math.round(w/200));}
function toast(msg,type){var t=el("div",{class:"toast "+(type||"")},esc(msg));$("#toasts").appendChild(t);setTimeout(function(){t.style.opacity="0";t.style.transition="opacity .4s";setTimeout(function(){t.remove();},400);},3200);}

/* base64 utf-8 (para a API de conteudo do GitHub) */
function b64encode(str){return btoa(unescape(encodeURIComponent(str)));}
function b64decode(b64){try{return decodeURIComponent(escape(atob(b64.replace(/\n/g,""))));}catch(e){return atob(b64.replace(/\n/g,""));}}

/* ---------- Camada de API do GitHub ---------- */
function gh(path, opts){
  opts = opts || {};
  var headers = { "Accept":"application/vnd.github+json" };
  if(state.token) headers["Authorization"]="Bearer "+state.token;
  if(opts.body) headers["Content-Type"]="application/json";
  return fetch(API+path, { method: opts.method||"GET", headers: headers, body: opts.body?JSON.stringify(opts.body):undefined })
    .then(function(r){
      if(r.status===401) throw new Error("Token inválido ou expirado.");
      if(r.status===403) throw new Error("Sem permissão ou limite da API atingido.");
      return r.json().then(function(j){ if(!r.ok) throw new Error(j.message||("Erro "+r.status)); return j; });
    });
}
function ghContent(filepath){ return gh("/repos/"+REPO.owner+"/"+REPO.name+"/contents/"+filepath+"?ref="+REPO.branch); }
function ghPut(filepath, contentStr, message, sha){
  var body = { message: message, content: b64encode(contentStr), branch: REPO.branch };
  if(sha) body.sha = sha;
  return gh("/repos/"+REPO.owner+"/"+REPO.name+"/contents/"+filepath, { method:"PUT", body: body });
}
function ghListDir(dir){ return gh("/repos/"+REPO.owner+"/"+REPO.name+"/contents/"+dir+"?ref="+REPO.branch); }

/* ===================================================================
   LOGIN / SEGURANCA
   =================================================================== */
function initLogin(){
  var form=$("#loginForm"), msg=$("#loginMsg"), toggle=$("#togglePwd"), tokenIn=$("#token");
  // preencher se lembrado
  var savedEmail=localStorage.getItem("rb_email");
  if(savedEmail) $("#email").value=savedEmail;
  var savedTok=localStorage.getItem("rb_token");
  if(savedTok){ state.token=savedTok; }

  toggle.addEventListener("click",function(){
    var t=tokenIn.type==="password"?"text":"password";
    tokenIn.type=t; toggle.textContent=t==="password"?"Mostrar":"Ocultar";
  });

  form.addEventListener("submit",function(e){
    e.preventDefault();
    // bloqueio por tentativas
    if(Date.now()<state.lockUntil){
      var s=Math.ceil((state.lockUntil-Date.now())/1000);
      showLoginMsg("Muitas tentativas. Tente novamente em "+s+"s.","err");return;
    }
    var email=$("#email").value.trim();
    var token=tokenIn.value.trim()||state.token;
    if(!token){ showLoginMsg("Informe o token de acesso.","err"); return; }
    $("#loginBtn").disabled=true; $("#loginBtn").textContent="Verificando…";
    state.token=token;
    gh("/user").then(function(u){
      state.ghUser=u.login; state.user=email||u.login;
      // sucesso: zera tentativas
      state.loginTries=0; localStorage.setItem("rb_tries","0"); localStorage.removeItem("rb_lock");
      if($("#remember").checked){
        localStorage.setItem("rb_token",token);
        localStorage.setItem("rb_email",email);
      } else { sessionStorage.setItem("rb_token",token); }
      logActivity("login","Acesso ao painel");
      enterApp();
    }).catch(function(err){
      state.loginTries++; localStorage.setItem("rb_tries",String(state.loginTries));
      if(state.loginTries>=5){
        state.lockUntil=Date.now()+60000; localStorage.setItem("rb_lock",String(state.lockUntil));
        showLoginMsg("5 tentativas incorretas. Acesso bloqueado por 1 minuto.","err");
      } else {
        showLoginMsg((err.message||"Falha no acesso.")+" (tentativa "+state.loginTries+"/5)","err");
      }
      $("#loginBtn").disabled=false; $("#loginBtn").textContent="Entrar com segurança";
    });
  });
}
function showLoginMsg(t,type){ $("#loginMsg").innerHTML='<div class="msg '+(type||"")+'">'+esc(t)+'</div>'; }

/* registro de atividades (auditoria local) */
function logActivity(action,detail){
  var logs=JSON.parse(localStorage.getItem("rb_logs")||"[]");
  logs.unshift({ who: state.user||state.ghUser||"?", action: action, detail: detail, at: nowISO() });
  localStorage.setItem("rb_logs",JSON.stringify(logs.slice(0,300)));
}

function logout(){
  logActivity("logout","Encerrou a sessão");
  sessionStorage.removeItem("rb_token");
  // mantem token lembrado apenas se "lembrar-me" estava marcado
  state.token=null;
  location.reload();
}

/* ===================================================================
   SHELL DO APP (menu lateral + roteamento)
   =================================================================== */
var NAV=[
  ["dashboard","Visão Geral","▦"],
  ["articles","Artigos","✎"],
  ["pages","Páginas","▤"],
  ["categories","Categorias","❏"],
  ["tags","Tags","#"],
  ["media","Biblioteca de Mídia","▣"],
  ["comments","Comentários","💬"],
  ["forms","Formulários","✉"],
  ["menus","Menus","☰"],
  ["authors","Autores","✍"],
  ["users","Usuários","⚇"],
  ["reports","Relatórios","▨"],
  "sep",
  ["settings","Configurações","⚙"],
  ["security","Segurança","🛡"],
  ["help","Ajuda","?"]
];

function enterApp(){
  $("#login").style.display="none";
  var app=$("#app"); app.style.display="block";
  app.innerHTML=
    '<aside class="sidebar" id="sidebar">'+
      '<span class="brand"><b>Rede Bolha</b> — Painel</span>'+
      '<nav class="nav" id="nav"></nav>'+
    '</aside>'+
    '<div class="main">'+
      '<div class="topbar">'+
        '<button class="hamburger" id="hbtn" aria-label="Abrir menu">☰</button>'+
        '<h2 id="pageTitle">Visão Geral</h2>'+
        '<div style="display:flex;gap:10px;align-items:center">'+
          '<span style="font-size:.85rem;color:var(--dim)" class="hide-mobile">'+esc(state.user||"")+'</span>'+
          '<button class="btn ghost sm" id="logoutBtn">Sair</button>'+
        '</div>'+
      '</div>'+
      '<div class="content" id="view"></div>'+
    '</div>';
  var nav=$("#nav");
  NAV.forEach(function(item){
    if(item==="sep"){ nav.appendChild(el("div",{class:"sep"})); return; }
    var a=el("a",{href:"#"+item[0],"data-route":item[0]},'<span class="ico" aria-hidden="true">'+item[2]+'</span>'+esc(item[1]));
    a.addEventListener("click",function(e){e.preventDefault();go(item[0]);$("#sidebar").classList.remove("open");});
    nav.appendChild(a);
  });
  $("#logoutBtn").addEventListener("click",logout);
  $("#hbtn").addEventListener("click",function(){$("#sidebar").classList.toggle("open");});
  window.addEventListener("hashchange",function(){ var r=location.hash.replace("#","")||"dashboard"; if(r!==state.route) go(r); });
  var initial=location.hash.replace("#","")||"dashboard";
  go(initial);
  loadArticles();
}

function go(route){
  state.route=route;
  $all("#nav a").forEach(function(a){a.classList.toggle("active",a.getAttribute("data-route")===route);});
  var titles={dashboard:"Visão Geral",articles:"Artigos",pages:"Páginas",categories:"Categorias",tags:"Tags",media:"Biblioteca de Mídia",comments:"Comentários",forms:"Formulários",menus:"Menus",authors:"Autores",users:"Usuários",reports:"Relatórios",settings:"Configurações",security:"Segurança",help:"Ajuda"};
  $("#pageTitle").textContent=titles[route]||"Painel";
  location.hash=route;
  var v=$("#view"); v.innerHTML="";
  ({dashboard:viewDashboard,articles:viewArticles,categories:viewCategories,tags:viewTags,media:viewMedia,pages:viewPages,comments:viewSimple,forms:viewSimple,menus:viewSimple,authors:viewSimple,users:viewUsers,reports:viewReports,settings:viewSettings,security:viewSecurity,help:viewHelp}[route]||viewDashboard)(v,route);
}

/* ===================================================================
   ARTIGOS — carregamento (le /artigos/*.html do repositorio)
   =================================================================== */
function loadArticles(){
  return ghListDir("artigos").then(function(items){
    var files=items.filter(function(f){return f.type==="file" && /\.html$/.test(f.name) && f.name!=="index.html";});
    // metadados vem do localStorage (indice) + arquivo
    var index=JSON.parse(localStorage.getItem("rb_index")||"{}");
    state.articles=files.map(function(f){
      var m=index[f.name]||{};
      return {
        file:f.name, sha:f.sha, path:f.path,
        title:m.title||f.name.replace(/\.html$/,"").replace(/-/g," "),
        author:m.author||"Adm. Romário Cruz",
        category:m.category||"—",
        status:m.status||"published",
        created:m.created||null, published:m.published||null, updated:m.updated||null,
        views:m.views||0, cover:m.cover||null, slug:f.name.replace(/\.html$/,"")
      };
    });
    if(state.route==="dashboard") go("dashboard");
    if(state.route==="articles") go("articles");
    return state.articles;
  }).catch(function(e){ toast("Não foi possível carregar os artigos: "+e.message,"err"); });
}
function saveIndex(){
  var index={};
  state.articles.forEach(function(a){ index[a.file]={title:a.title,author:a.author,category:a.category,status:a.status,created:a.created,published:a.published,updated:a.updated,views:a.views,cover:a.cover}; });
  localStorage.setItem("rb_index",JSON.stringify(index));
}

/* ===================================================================
   DASHBOARD
   =================================================================== */
function viewDashboard(v){
  var pub=state.articles.filter(function(a){return a.status==="published";}).length;
  var rasc=state.articles.filter(function(a){return a.status==="draft";}).length;
  var rev=state.articles.filter(function(a){return a.status==="review";}).length;
  var agend=state.articles.filter(function(a){return a.status==="scheduled";}).length;
  v.innerHTML=
    '<div class="hero-cta"><div><h3>Pronto para escrever?</h3><p>Crie um novo artigo jornalístico com o editor visual por blocos.</p></div>'+
    '<button class="btn" id="newArt">+ Criar novo artigo</button></div>'+
    '<div class="cards">'+
      statCard(pub,"Publicados")+statCard(rasc,"Rascunhos")+statCard(agend,"Agendados")+statCard(rev,"Aguardando revisão")+
    '</div>'+
    '<div class="panel"><h3>Conteúdos recentemente alterados</h3><div id="recent"></div></div>'+
    '<div class="cards">'+
      '<div class="panel"><h3>Artigos mais acessados</h3><div id="topArts"></div></div>'+
      '<div class="panel"><h3>Atalhos</h3>'+
        '<div style="display:flex;flex-direction:column;gap:10px">'+
        '<a href="#media" class="btn ghost sm">▣ Biblioteca de Mídia</a>'+
        '<a href="#pages" class="btn ghost sm">▤ Páginas do site</a>'+
        '<a href="#categories" class="btn ghost sm">❏ Categorias</a>'+
        '<a href="#settings" class="btn ghost sm">⚙ Configurações</a>'+
        '</div>'+
      '</div>'+
    '</div>';
  $("#newArt").addEventListener("click",function(){openEditor(null);});
  var recent=state.articles.slice().sort(function(a,b){return (b.updated||"").localeCompare(a.updated||"");}).slice(0,5);
  var rc=$("#recent");
  if(!recent.length){rc.innerHTML='<p class="empty">Nenhum artigo ainda. Crie o primeiro!</p>';}
  recent.forEach(function(a){
    var r=el("div",{class:"a11y-item"},'<span>'+esc(a.title)+'</span><span style="margin-left:auto;color:var(--dim)">'+statusBadge(a.status)+' · '+fmtDate(a.updated)+'</span>');
    rc.appendChild(r);
  });
  var top=state.articles.slice().sort(function(a,b){return b.views-a.views;}).slice(0,5);
  var tc=$("#topArts");
  if(!top.length||top[0].views===0){tc.innerHTML='<p class="empty" style="padding:20px">Sem dados de acesso ainda.</p>';}
  else top.forEach(function(a){ tc.appendChild(el("div",{class:"a11y-item"},'<span>'+esc(a.title)+'</span><span style="margin-left:auto;color:var(--gold)">'+a.views+' views</span>')); });
}
function statCard(n,l){return '<div class="stat"><div class="num">'+n+'</div><div class="lbl">'+esc(l)+'</div></div>';}
function statusBadge(s){var map={published:['pub','Publicado'],draft:['rasc','Rascunho'],review:['rev','Em revisão'],scheduled:['agend','Agendado'],archived:['rasc','Arquivado']};var m=map[s]||['rasc',s];return '<span class="badge '+m[0]+'">'+m[1]+'</span>';}

/* placeholder simples usado pela shell antes do render completo */
function viewSimple(v,route){ v.innerHTML='<div class="panel"><p class="empty">Módulo “'+esc(route)+'” — em construção nesta etapa.</p></div>'; }


/* ===================================================================
   ARTIGOS — LISTAGEM
   =================================================================== */
var artFilters={q:"",cat:"",status:"",sort:"updated"};
function viewArticles(v){
  v.innerHTML=
    '<div class="toolbar">'+
      '<input type="search" id="fq" placeholder="Pesquisar artigos…" aria-label="Pesquisar">'+
      '<select id="fcat" aria-label="Categoria"><option value="">Todas as categorias</option>'+state.categories.map(function(c){return '<option>'+esc(c)+'</option>';}).join("")+'</select>'+
      '<select id="fstatus" aria-label="Status"><option value="">Todos os status</option><option value="published">Publicados</option><option value="draft">Rascunhos</option><option value="review">Em revisão</option><option value="scheduled">Agendados</option><option value="archived">Arquivados</option></select>'+
      '<select id="fsort" aria-label="Ordenar"><option value="updated">Mais recentes</option><option value="title">Título (A-Z)</option><option value="views">Mais vistos</option></select>'+
      '<button class="btn" id="newArt2">+ Adicionar novo</button>'+
    '</div>'+
    '<div class="panel" style="padding:0;overflow-x:auto"><table><thead><tr>'+
      '<th></th><th>Título</th><th class="hide-mobile">Autor</th><th class="hide-mobile">Categoria</th><th>Status</th><th class="hide-mobile">Atualizado</th><th class="hide-mobile">Views</th><th></th>'+
    '</tr></thead><tbody id="artBody"></tbody></table></div>';
  $("#newArt2").addEventListener("click",function(){openEditor(null);});
  ["fq","fcat","fstatus","fsort"].forEach(function(id){$("#"+id).addEventListener("input",renderArtRows);});
  renderArtRows();
}
function renderArtRows(){
  artFilters.q=($("#fq")||{}).value||""; artFilters.cat=($("#fcat")||{}).value||"";
  artFilters.status=($("#fstatus")||{}).value||""; artFilters.sort=($("#fsort")||{}).value||"updated";
  var rows=state.articles.filter(function(a){
    if(artFilters.q && a.title.toLowerCase().indexOf(artFilters.q.toLowerCase())<0) return false;
    if(artFilters.cat && a.category!==artFilters.cat) return false;
    if(artFilters.status && a.status!==artFilters.status) return false;
    return true;
  });
  rows.sort(function(a,b){
    if(artFilters.sort==="title") return a.title.localeCompare(b.title);
    if(artFilters.sort==="views") return b.views-a.views;
    return (b.updated||"").localeCompare(a.updated||"");
  });
  var tb=$("#artBody"); tb.innerHTML="";
  if(!rows.length){ tb.innerHTML='<tr><td colspan="8"><p class="empty">Nenhum artigo encontrado.</p></td></tr>'; return; }
  rows.forEach(function(a){
    var tr=el("tr");
    tr.innerHTML=
      '<td>'+(a.cover?'<img class="thumb" src="'+esc(a.cover)+'" alt="">':'<div class="thumb"></div>')+'</td>'+
      '<td><strong style="color:var(--txt)">'+esc(a.title)+'</strong><br><span style="color:var(--dim);font-size:.78rem">'+esc(a.slug)+'</span></td>'+
      '<td class="hide-mobile">'+esc(a.author)+'</td>'+
      '<td class="hide-mobile">'+esc(a.category)+'</td>'+
      '<td>'+statusBadge(a.status)+'</td>'+
      '<td class="hide-mobile">'+fmtDate(a.updated)+'</td>'+
      '<td class="hide-mobile">'+a.views+'</td>'+
      '<td class="row-actions"></td>';
    var cell=$(".row-actions",tr);
    var btn=el("button",{class:"btn ghost sm","aria-label":"Ações"},"⋯");
    btn.addEventListener("click",function(e){e.stopPropagation();toggleRowMenu(cell,a);});
    cell.appendChild(btn);
    tr.addEventListener("dblclick",function(){openEditor(a);});
    tb.appendChild(tr);
  });
}
function toggleRowMenu(cell,a){
  var open=$(".menu",cell); if(open){open.remove();return;}
  $all(".row-actions .menu").forEach(function(m){m.remove();});
  var m=el("div",{class:"menu"});
  [["Editar",function(){openEditor(a);}],
   ["Visualizar",function(){window.open(SITE+"/artigos/"+a.file,"_blank");}],
   ["Duplicar",function(){duplicateArticle(a);}],
   ["Arquivar",function(){setStatus(a,"archived");}],
   ["Excluir",function(){confirmDelete(a);},"del"]].forEach(function(it){
    var b=el("button",it[2]?{class:it[2]}:null,esc(it[0])); b.addEventListener("click",function(e){e.stopPropagation();m.remove();it[1]();}); m.appendChild(b);
  });
  cell.appendChild(m);
  setTimeout(function(){document.addEventListener("click",function h(){m.remove();document.removeEventListener("click",h);});},0);
}
function setStatus(a,s){ a.status=s; a.updated=nowISO(); saveIndex(); logActivity("status","“"+a.title+"” → "+s); renderArtRows(); toast("Status atualizado.","ok"); }
function duplicateArticle(a){ toast("Abrindo cópia de “"+a.title+"”…"); openEditor(a,true); }
function confirmDelete(a){
  openModal('<h3>Mover para a lixeira?</h3><p style="color:var(--body);margin:10px 0 18px">O artigo “'+esc(a.title)+'” será movido para a lixeira. Esta ação pode ser desfeita restaurando o arquivo pelo histórico do repositório.</p>'+
    '<div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn ghost" id="cD">Cancelar</button><button class="btn danger" id="okD">Sim, mover</button></div>',
    function(m){ $("#cD",m).onclick=closeModal; $("#okD",m).onclick=function(){ setStatus(a,"archived"); closeModal(); toast("Movido para arquivados.","ok"); }; });
}

/* ===================================================================
   EDITOR VISUAL POR BLOCOS
   =================================================================== */
var BLOCK_TYPES=[
  ["para","Parágrafo","¶"],["h2","Intertítulo","H"],["quote","Citação","❝"],
  ["ul","Lista","•"],["ol","Lista numerada","1."],["image","Imagem","▣"],
  ["cta","Chamada / CTA","◈"],["button","Botão","▭"],["divider","Separador","—"],
  ["box","Box informativo","ⓘ"],["video","Vídeo","▶"],["embed","Incorporar","</>"]
];
function openEditor(article,asCopy){
  var isNew=!article;
  var data=article?{
    title:article.title, eyebrow:article.category!=="—"?article.category:"", sub:"",
    author:article.author, slug:asCopy?"":article.slug, status:article.status,
    desc:"", category:article.category, tags:[], blocks:null, sha:asCopy?null:article.sha, file:asCopy?null:article.file
  }:{ title:"", eyebrow:"", sub:"", author:"Adm. Romário Cruz", slug:"", status:"draft", desc:"", category:state.categories[0]||"", tags:[], blocks:null, sha:null, file:null };
  state.editing=data;

  // se editar artigo existente, buscar HTML e extrair blocos
  var app=$("#app");
  app.innerHTML=editorShell(data);
  bindEditor(data,isNew);
  if(article && !asCopy){
    ghContent("artigos/"+article.file).then(function(c){
      var html=b64decode(c.content);
      parseArticleIntoEditor(html,data);
    }).catch(function(e){ toast("Não foi possível abrir o artigo: "+e.message,"err"); });
  } else {
    addBlock("para","Comece a escrever o primeiro parágrafo…");
  }
}
function editorShell(d){
  return ''+
  '<div class="editor-top">'+
    '<button class="btn ghost sm" id="edBack">← Voltar</button>'+
    '<button class="btn ghost sm" id="edSave">Salvar rascunho</button>'+
    '<button class="btn ghost sm" id="edPreview">Pré-visualizar</button>'+
    '<button class="btn ghost sm" id="edReview">Enviar p/ revisão</button>'+
    '<button class="btn sm" id="edPublish">Publicar</button>'+
    '<span class="save-status" id="saveStatus">Não salvo</span>'+
  '</div>'+
  '<div class="editor-wrap">'+
    '<div class="editor-canvas">'+
      '<input class="ti eyebrow-in" id="edEyebrow" placeholder="CHAPÉU / CATEGORIA EDITORIAL" value="'+esc(d.eyebrow)+'">'+
      '<input class="ti" id="edTitle" placeholder="Título principal do artigo" value="'+esc(d.title)+'">'+
      '<input class="ti sub-in" id="edSub" placeholder="Subtítulo ou linha fina (opcional)" value="'+esc(d.sub)+'">'+
      '<p class="byline" style="color:var(--dim);border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:20px">Por <span id="edBy">'+esc(d.author)+'</span> · <span id="edRT">1 min</span> de leitura</p>'+
      '<div class="fmt-toolbar" id="fmtBar">'+
        '<button data-cmd="bold" title="Negrito"><b>B</b></button>'+
        '<button data-cmd="italic" title="Itálico"><i>I</i></button>'+
        '<button data-cmd="underline" title="Sublinhado"><u>U</u></button>'+
        '<button data-cmd="strikeThrough" title="Tachado"><s>S</s></button>'+
        '<button data-cmd="createLink" title="Link">🔗</button>'+
        '<button data-cmd="unlink" title="Remover link">⛓</button>'+
        '<button data-cmd="undo" title="Desfazer">↶</button>'+
        '<button data-cmd="redo" title="Refazer">↷</button>'+
        '<button data-cmd="removeFormat" title="Limpar formatação">✕</button>'+
      '</div>'+
      '<div id="blocks"></div>'+
      '<button class="add-block" id="addBlockBtn">+ Adicionar bloco</button>'+
      '<div id="blockMenu"></div>'+
      '<div class="wordcount" id="wc">0 palavras · 0 caracteres</div>'+
    '</div>'+
    '<aside class="editor-side">'+
      '<h4>Publicação</h4>'+
      '<div class="field"><label>Status</label><select id="sStatus">'+
        ['draft:Rascunho','review:Aguardando revisão','scheduled:Agendado','published:Publicado','archived:Arquivado'].map(function(o){var p=o.split(":");return '<option value="'+p[0]+'"'+(d.status===p[0]?' selected':'')+'>'+p[1]+'</option>';}).join("")+
      '</select></div>'+
      '<div class="field" id="schedField" style="display:none"><label>Data e hora (Porto Alegre)</label><input type="datetime-local" id="sWhen"></div>'+
      '<h4>Autor</h4>'+
      '<div class="field"><input id="sAuthor" value="'+esc(d.author)+'"></div>'+
      '<h4>Categoria e tags</h4>'+
      '<div class="field"><label>Categoria</label><select id="sCat">'+state.categories.map(function(c){return '<option'+(d.category===c?' selected':'')+'>'+esc(c)+'</option>';}).join("")+'</select></div>'+
      '<div class="field"><label>Tags (Enter para adicionar)</label><input id="sTagInput" placeholder="ex.: solidão"><div class="chips" id="sTags"></div></div>'+
      '<h4>Endereço (URL)</h4>'+
      '<div class="field"><input id="sSlug" placeholder="endereco-do-artigo" value="'+esc(d.slug)+'"><small style="color:var(--dim)">redebolha.com.br/artigos/<span id="slugPrev">'+esc(d.slug||"...")+'</span>.html</small></div>'+
      '<h4>Resumo / meta descrição</h4>'+
      '<div class="field"><textarea id="sDesc" rows="3" placeholder="Resumo para busca e redes sociais">'+esc(d.desc)+'</textarea></div>'+
      '<h4>SEO — prévia</h4>'+
      '<div class="seo-preview"><div class="g-title" id="seoT">'+esc(d.title||"Título do artigo")+'</div><div class="g-url">redebolha.com.br › artigos › <span id="seoU">'+esc(d.slug||"...")+'</span></div><div class="g-desc" id="seoD">'+esc(d.desc||"A meta descrição aparecerá aqui.")+'</div></div>'+
      '<h4>Verificação de acessibilidade</h4>'+
      '<div id="a11y"></div>'+
    '</aside>'+
  '</div>';
}

/* ---- Bindings do editor ---- */
var edState={blocks:[],selBlock:null,dirty:false,saveTimer:null};
function bindEditor(d,isNew){
  edState.blocks=[]; edState.selBlock=null; edState.dirty=false;
  $("#edBack").onclick=function(){ if(edState.dirty && !confirm("Há alterações não salvas. Sair mesmo assim?"))return; go("articles"); };
  $("#edSave").onclick=function(){ saveDraft(d,false); };
  $("#edPreview").onclick=function(){ openPreview(d); };
  $("#edReview").onclick=function(){ $("#sStatus").value="review"; d.status="review"; saveDraft(d,false); toast("Enviado para revisão.","ok"); };
  $("#edPublish").onclick=function(){ publishArticle(d); };
  $("#addBlockBtn").onclick=function(){ toggleBlockMenu(); };
  // toolbar de formatacao
  $all("#fmtBar button").forEach(function(b){ b.addEventListener("mousedown",function(e){e.preventDefault();}); b.onclick=function(){ var c=b.getAttribute("data-cmd"); if(c==="createLink"){var u=prompt("Endereço do link (URL):");if(u)document.execCommand(c,false,u);}else document.execCommand(c,false,null); markDirty(); }; });
  // campos que afetam preview/seo
  var upd=function(){ syncMeta(d); };
  ["edEyebrow","edTitle","edSub"].forEach(function(id){$("#"+id).addEventListener("input",function(){ if(id==="edTitle"){ if(!d._slugTouched){ $("#sSlug").value=slugify($("#edTitle").value); } } upd(); });});
  $("#sAuthor").addEventListener("input",function(){$("#edBy").textContent=$("#sAuthor").value;upd();});
  $("#sSlug").addEventListener("input",function(){d._slugTouched=true;upd();});
  $("#sDesc").addEventListener("input",upd);
  $("#sCat").addEventListener("change",upd);
  $("#sStatus").addEventListener("change",function(){ d.status=$("#sStatus").value; $("#schedField").style.display=d.status==="scheduled"?"block":"none"; });
  // tags
  $("#sTagInput").addEventListener("keydown",function(e){ if(e.key==="Enter"){e.preventDefault();addTag(this.value.trim());this.value="";} });
  d.tags.forEach(addTagChip);
  syncMeta(d);
  // salvamento automatico a cada 8s se sujo
  edState.saveTimer=setInterval(function(){ if(edState.dirty) saveDraft(d,true); },8000);
  // recuperacao local
  restoreLocal(d);
}
function markDirty(){ edState.dirty=true; var s=$("#saveStatus"); if(s){s.textContent="Alterações não salvas…";s.classList.remove("saved");} persistLocal(); }
function syncMeta(d){
  d.title=$("#edTitle").value; d.eyebrow=$("#edEyebrow").value; d.sub=$("#edSub").value;
  d.author=$("#sAuthor").value; d.slug=$("#sSlug").value=slugify($("#sSlug").value); d.desc=$("#sDesc").value; d.category=$("#sCat").value;
  $("#slugPrev").textContent=d.slug||"..."; $("#seoT").textContent=d.title||"Título do artigo";
  $("#seoU").textContent=d.slug||"..."; $("#seoD").textContent=d.desc||"A meta descrição aparecerá aqui.";
  updateWordCount(); runA11y(d); markDirty();
}
function addTag(t){ if(!t)return; var d=state.editing; if(d.tags.indexOf(t)>=0)return; d.tags.push(t); addTagChip(t); if(state.tags.indexOf(t)<0){state.tags.push(t);localStorage.setItem("rb_tags",JSON.stringify(state.tags));} markDirty(); }
function addTagChip(t){ var chip=el("span",{class:"chip"},esc(t)+' '); var x=el("button",{"aria-label":"Remover tag"},"×"); x.onclick=function(){var d=state.editing;d.tags=d.tags.filter(function(g){return g!==t;});chip.remove();markDirty();}; chip.appendChild(x); $("#sTags").appendChild(chip); }

/* ---- Blocos ---- */
function toggleBlockMenu(){
  var m=$("#blockMenu");
  if(m.innerHTML){m.innerHTML="";return;}
  var wrap=el("div",{class:"block-menu"});
  BLOCK_TYPES.forEach(function(bt){ var b=el("button",null,'<span class="ico">'+bt[2]+'</span>'+esc(bt[1])); b.onclick=function(){addBlock(bt[0]);m.innerHTML="";}; wrap.appendChild(b); });
  m.appendChild(wrap);
}
function addBlock(type,initial){
  var id="b"+Date.now()+Math.floor(Math.random()*999);
  var block={id:id,type:type,html:initial||"",data:{}};
  edState.blocks.push(block);
  renderBlock(block);
  markDirty();
}
function renderBlock(block){
  var host=$("#blocks");
  var wrap=el("div",{class:"block",id:block.id,"data-type":block.type});
  var ctrls=el("div",{class:"block-ctrls"});
  [["↑",function(){moveBlock(block,-1);}],["↓",function(){moveBlock(block,1);}],["⧉",function(){dupBlock(block);}],["✕",function(){delBlock(block);}]].forEach(function(c){var b=el("button",null,c[0]);b.title=c[0];b.onclick=c[1];ctrls.appendChild(b);});
  wrap.appendChild(ctrls);
  var body=blockBody(block);
  wrap.appendChild(body);
  host.appendChild(wrap);
  wrap.addEventListener("click",function(){$all(".block.sel").forEach(function(x){x.classList.remove("sel");});wrap.classList.add("sel");edState.selBlock=block;});
}
function blockBody(block){
  var t=block.type, e;
  if(t==="para"){ e=el("div",{class:"editable block-para",contenteditable:"true","data-ph":"Escreva um parágrafo…"},block.html); }
  else if(t==="h2"){ e=el("div",{class:"editable block-h2",contenteditable:"true"},block.html||"Intertítulo"); }
  else if(t==="quote"){ e=el("div",{class:"editable block-quote",contenteditable:"true"},block.html||"Citação em destaque"); }
  else if(t==="ul"||t==="ol"){ e=el(t,null,"<li>Item da lista</li>"); e.setAttribute("contenteditable","true"); e.className="editable"; }
  else if(t==="divider"){ e=el("hr",{style:"border:none;border-top:1px solid var(--line);margin:10px 0"}); }
  else if(t==="image"){ e=el("div"); e.innerHTML='<div style="border:1px dashed var(--line2);border-radius:8px;padding:24px;text-align:center;color:var(--dim)">Cole a URL da imagem</div><input class="editable" placeholder="https://redebolha.com.br/imagem.jpg" style="width:100%;margin-top:8px;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px;color:var(--txt)"><input class="cap" placeholder="Legenda / crédito (opcional)" style="width:100%;margin-top:6px;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px;color:var(--body);font-size:.85rem">'; var url=$(".editable",e),img=$("div",e); url.oninput=function(){img.innerHTML=url.value?'<img class="hero-img" src="'+esc(url.value)+'" alt="" style="border-radius:8px">':'';markDirty();}; }
  else if(t==="cta"){ e=el("div",{class:"cta",style:"border:1px solid var(--line);background:var(--bg2);border-radius:12px;padding:22px"}); e.innerHTML='<div class="editable" contenteditable="true" style="font-family:Cormorant Garamond,serif;font-size:1.4rem;color:var(--txt);margin-bottom:8px">Título da chamada</div><div class="editable2" contenteditable="true" style="margin-bottom:12px">Texto que convida o leitor à ação.</div><input class="btnlbl" placeholder="Texto do botão" value="Quero saber mais" style="background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px;color:var(--txt);margin-right:6px"><input class="btnurl" placeholder="URL do botão" value="/#comprar" style="background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px;color:var(--txt)">'; }
  else if(t==="button"){ e=el("div"); e.innerHTML='<input class="btnlbl" placeholder="Texto do botão" value="Clique aqui" style="background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px;color:var(--txt);margin-right:6px"><input class="btnurl" placeholder="URL" value="#" style="background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px;color:var(--txt)">'; }
  else if(t==="box"){ e=el("div",{class:"editable",contenteditable:"true",style:"border:1px solid var(--line);border-left:3px solid var(--gold);background:var(--bg2);border-radius:8px;padding:16px"},block.html||"Box informativo: um destaque complementar ao texto."); }
  else if(t==="video"){ e=el("div"); e.innerHTML='<input class="editable" placeholder="Link do YouTube, Vimeo ou MP4" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px;color:var(--txt)"><div class="vprev" style="margin-top:8px;color:var(--dim);font-size:.85rem">O vídeo será incorporado de forma responsiva.</div>'; }
  else if(t==="embed"){ e=el("textarea",{class:"editable",placeholder:"Cole o código de incorporação (embed)",rows:"4",style:"width:100%;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px;color:var(--txt)"}); }
  else { e=el("div",{class:"editable",contenteditable:"true"},block.html); }
  var sync=function(){ block.html=e.innerHTML||e.value||""; updateWordCount(); markDirty(); };
  e.addEventListener("input",sync,true);
  $all("[contenteditable],input,textarea",e).forEach(function(x){x.addEventListener("input",function(){collectBlock(block,e);});});
  if(e.getAttribute&&e.getAttribute("contenteditable")) e.addEventListener("input",function(){collectBlock(block,e);});
  return e;
}
function collectBlock(block,e){
  var t=block.type;
  if(t==="para"||t==="h2"||t==="quote"||t==="box"||t==="ul"||t==="ol"){ block.html=e.innerHTML; }
  else if(t==="image"){ block.data.url=($(".editable",e)||{}).value; block.data.cap=($(".cap",e)||{}).value; }
  else if(t==="cta"){ block.data.title=$(".editable",e).innerHTML; block.data.text=$(".editable2",e).innerHTML; block.data.lbl=$(".btnlbl",e).value; block.data.url=$(".btnurl",e).value; }
  else if(t==="button"){ block.data.lbl=$(".btnlbl",e).value; block.data.url=$(".btnurl",e).value; }
  else if(t==="video"||t==="embed"){ block.data.src=($(".editable",e)||e).value; }
  updateWordCount(); markDirty();
}
function moveBlock(block,dir){ var i=edState.blocks.indexOf(block),j=i+dir; if(j<0||j>=edState.blocks.length)return; edState.blocks.splice(i,1);edState.blocks.splice(j,0,block); rerenderBlocks(); markDirty(); }
function dupBlock(block){ var c=JSON.parse(JSON.stringify(block)); c.id="b"+Date.now(); var i=edState.blocks.indexOf(block); edState.blocks.splice(i+1,0,c); rerenderBlocks(); markDirty(); }
function delBlock(block){ edState.blocks=edState.blocks.filter(function(b){return b!==block;}); rerenderBlocks(); markDirty(); }
function rerenderBlocks(){ $("#blocks").innerHTML=""; edState.blocks.forEach(renderBlock); }
function updateWordCount(){ var txt=$("#blocks").innerText||""; var w=txt.trim().split(/\s+/).filter(Boolean).length; $("#wc").textContent=w+" palavras · "+txt.length+" caracteres"; $("#edRT").textContent=readingTime(txt)+" min"; }

/* ---- Salvamento local (recuperacao) ---- */
function persistLocal(){ try{ var d=state.editing; if(!d)return; localStorage.setItem("rb_recover",JSON.stringify({d:{title:d.title,eyebrow:d.eyebrow,sub:d.sub,author:d.author,slug:d.slug,desc:d.desc,category:d.category,tags:d.tags,status:d.status},blocks:edState.blocks,at:nowISO()})); }catch(e){} }
function restoreLocal(d){
  try{ var r=JSON.parse(localStorage.getItem("rb_recover")||"null");
    if(r && r.d && r.d.slug===d.slug && edState.blocks.length===0 && r.blocks && r.blocks.length){
      if(confirm("Encontramos uma versão não salva deste artigo. Deseja recuperá-la?")){ edState.blocks=r.blocks; rerenderBlocks(); }
    }
  }catch(e){}
}

/* ---- Acessibilidade ---- */
function runA11y(d){
  var box=$("#a11y"); if(!box)return; var items=[];
  items.push(["Título principal preenchido", !!(d.title&&d.title.length>3)]);
  items.push(["Meta descrição preenchida", !!(d.desc&&d.desc.length>=50)]);
  var imgs=edState.blocks.filter(function(b){return b.type==="image";});
  var imgOk=imgs.every(function(b){return b.data&&b.data.cap;});
  items.push(["Imagens com legenda/crédito", imgs.length===0||imgOk]);
  items.push(["Endereço (URL) definido", !!d.slug]);
  var vids=edState.blocks.filter(function(b){return b.type==="video";});
  items.push(["Vídeos com transcrição prevista", vids.length===0]);
  box.innerHTML=items.map(function(it){return '<div class="a11y-item '+(it[1]?"ok":"warn")+'">'+(it[1]?"✓":"!")+' '+esc(it[0])+'</div>';}).join("");
}

/* ---- GERACAO DO HTML (mesmo padrao do site) ---- */
function blocksToHTML(){
  return edState.blocks.map(function(b){
    var t=b.type,d=b.data||{};
    if(t==="para") return "<p>"+(b.html||"")+"</p>";
    if(t==="h2") return "<h2>"+stripTags(b.html)+"</h2>";
    if(t==="quote") return "<blockquote>"+(b.html||"")+"</blockquote>";
    if(t==="ul") return "<ul>"+(b.html||"")+"</ul>";
    if(t==="ol") return "<ol>"+(b.html||"")+"</ol>";
    if(t==="box") return '<div class="box" style="border:1px solid rgba(201,162,75,.18);border-left:3px solid #C9A24B;background:#121013;border-radius:8px;padding:16px;margin:22px 0">'+(b.html||"")+"</div>";
    if(t==="divider") return '<hr style="border:none;border-top:1px solid rgba(201,162,75,.18);margin:32px 0">';
    if(t==="image"){ if(!d.url)return ""; return '<figure style="margin:26px 0"><img class="hero-img" src="'+esc(d.url)+'" alt="'+esc(d.cap||"")+'">'+(d.cap?'<figcaption style="color:#857F75;font-size:.85rem;margin-top:6px">'+esc(d.cap)+"</figcaption>":"")+"</figure>"; }
    if(t==="button"){ return '<p><a class="btn" href="'+esc(d.url||"#")+'">'+esc(d.lbl||"Botão")+"</a></p>"; }
    if(t==="cta"){ return '<div class="cta"><p class="eyebrow">Rede Bolha</p><h3>'+stripTags(d.title||"")+"</h3><p>"+(d.text||"")+'</p><a class="btn" href="'+esc(d.url||"/#comprar")+'">'+esc(d.lbl||"Saiba mais")+"</a></div>"; }
    if(t==="video"){ return videoEmbed(d.src||""); }
    if(t==="embed"){ return sanitizeEmbed(d.src||""); }
    return "";
  }).filter(Boolean).join("\n");
}
function stripTags(s){var t=document.createElement("div");t.innerHTML=s||"";return t.textContent||"";}
function videoEmbed(src){
  if(!src)return "";
  var yt=src.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
  if(yt) return '<div style="position:relative;padding-bottom:56.25%;height:0;margin:24px 0"><iframe src="https://www.youtube.com/embed/'+yt[1]+'" style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:8px" allowfullscreen loading="lazy" title="Vídeo"></iframe></div>';
  var vm=src.match(/vimeo\.com\/(\d+)/);
  if(vm) return '<div style="position:relative;padding-bottom:56.25%;height:0;margin:24px 0"><iframe src="https://player.vimeo.com/video/'+vm[1]+'" style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:8px" allowfullscreen loading="lazy" title="Vídeo"></iframe></div>';
  if(/\.mp4($|\?)/.test(src)) return '<video controls preload="none" style="width:100%;border-radius:8px;margin:24px 0"><source src="'+esc(src)+'" type="video/mp4"></video>';
  return "";
}
function sanitizeEmbed(code){
  // permite apenas iframes de dominios confiaveis
  var ok=/^<iframe[^>]+src="https:\/\/(www\.)?(youtube\.com|player\.vimeo\.com|open\.spotify\.com)\//.test(code.trim());
  return ok? code : '<p style="color:#857F75">[Incorporação bloqueada por segurança]</p>';
}

function buildArticleHTML(d){
  var title=d.title||"Sem título";
  var desc=d.desc||"";
  var url=SITE+"/artigos/"+(d.slug||"artigo")+".html";
  var pub=d.published||nowISO();
  var jsonld={ "@context":"https://schema.org","@graph":[
    {"@type":"Article","headline":title,"description":desc,"author":{"@type":"Person","name":d.author,"url":SITE+"/sobre-o-autor.html"},"publisher":{"@type":"Organization","name":"Rede Bolha","url":SITE+"/"},"mainEntityOfPage":{"@type":"WebPage","@id":url},"datePublished":pub,"dateModified":nowISO(),"inLanguage":"pt-BR","url":url},
    {"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Início","item":SITE+"/"},{"@type":"ListItem","position":2,"name":"Artigos","item":SITE+"/artigos/"},{"@type":"ListItem","position":3,"name":title,"item":url}]}
  ]};
  return '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n'+
    '<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'+
    '<title>'+esc(title)+' | Adm. Romário Cruz</title>\n'+
    '<meta name="description" content="'+esc(desc)+'">\n'+
    '<link rel="canonical" href="'+url+'">\n'+
    '<meta property="og:type" content="article">\n'+
    '<meta property="og:title" content="'+esc(title)+'">\n'+
    '<meta property="og:description" content="'+esc(desc)+'">\n'+
    '<meta property="og:url" content="'+url+'">\n'+
    '<link rel="stylesheet" href="blog.css">\n'+
    '<script type="application/ld+json">\n'+JSON.stringify(jsonld,null,2)+'\n</'+'script>\n'+
    '</head>\n<body>\n'+
    '<header class="topbar"><div class="wrap">\n<a class="brand" href="/"><b>Homem,</b> Você Não É Ridículo</a>\n<nav class="topnav"><a href="/artigos/">Artigos</a> <a href="/#comprar">O livro</a></nav>\n</div></header>\n'+
    '<main class="wrap">\n<article>\n'+
    (d.eyebrow?'<p class="eyebrow">'+esc(d.eyebrow)+'</p>\n':'')+
    '<h1>'+esc(title)+'</h1>\n'+
    (d.sub?'<p class="lead" style="font-style:italic;color:#C6C0B5">'+esc(d.sub)+'</p>\n':'')+
    '<p class="byline">Por '+esc(d.author)+' · Leitura de '+readingTime($("#blocks")?$("#blocks").innerText:"")+' minutos</p>\n'+
    blocksToHTML()+'\n'+
    '<p class="back"><a href="/artigos/">← Voltar para todos os artigos</a></p>\n'+
    '</article>\n</main>\n'+
    '<footer class="foot"><div class="wrap">© Rede Bolha · <a href="/sobre-o-autor.html">Sobre o autor</a></div></footer>\n'+
    '</body>\n</html>';
}

/* ---- Prévia responsiva ---- */
function openPreview(d){
  syncMeta(d);
  var html=buildArticleHTML(d);
  openModal('<button class="close" id="pvX">×</button><h3 class="serif">Pré-visualização</h3>'+
    '<div class="dev-tabs"><button data-w="100%" class="active">Computador</button><button data-w="768px">Tablet</button><button data-w="390px">Celular</button></div>'+
    '<div id="pvHost" style="display:flex;justify-content:center"><iframe class="preview-frame" id="pvFrame" style="width:100%"></iframe></div>',
    function(m){
      $("#pvX",m).onclick=closeModal;
      var frame=$("#pvFrame",m);
      frame.srcdoc=html.replace('href="blog.css"','href="'+SITE+'/artigos/blog.css"');
      $all(".dev-tabs button",m).forEach(function(b){b.onclick=function(){$all(".dev-tabs button",m).forEach(function(x){x.classList.remove("active");});b.classList.add("active");frame.style.width=b.getAttribute("data-w");};});
    },true);
}

/* ---- Salvar rascunho (grava metadados localmente; nao commita) ---- */
function saveDraft(d,auto){
  syncMeta(d);
  if(!d.slug){ if(!auto) toast("Defina um endereço (URL) antes de salvar.","err"); return; }
  d.file=d.slug+".html"; d.updated=nowISO(); if(!d.created)d.created=nowISO();
  // atualiza cache/indice
  var existing=state.articles.filter(function(a){return a.file===d.file;})[0];
  if(existing){ existing.title=d.title;existing.author=d.author;existing.category=d.category;existing.status=d.status;existing.updated=d.updated;existing.cover=firstImage(); }
  else { state.articles.push({file:d.file,sha:d.sha,path:"artigos/"+d.file,title:d.title,author:d.author,category:d.category,status:d.status,created:d.created,published:d.published,updated:d.updated,views:0,cover:firstImage(),slug:d.slug}); }
  saveIndex(); persistLocal();
  var s=$("#saveStatus"); if(s){s.textContent="Alterações salvas ✓";s.classList.add("saved");}
  edState.dirty=false;
  logActivity("save","Rascunho salvo: “"+d.title+"”");
  if(!auto) toast("Rascunho salvo.","ok");
}
function firstImage(){ var b=edState.blocks.filter(function(x){return x.type==="image"&&x.data&&x.data.url;})[0]; return b?b.data.url:null; }

/* ---- Publicar (COMMIT real no repositório) ---- */
function publishArticle(d){
  syncMeta(d);
  if(!d.title){ toast("Informe o título do artigo.","err"); return; }
  if(!d.slug){ toast("Informe o endereço (URL) do artigo.","err"); return; }
  var warnings=[];
  if(!d.desc||d.desc.length<50) warnings.push("A meta descrição está curta (recomendado 50+ caracteres).");
  var imgsNoCap=edState.blocks.filter(function(b){return b.type==="image"&&b.data&&b.data.url&&!b.data.cap;}).length;
  if(imgsNoCap) warnings.push(imgsNoCap+" imagem(ns) sem legenda/crédito.");
  var when=d.status==="scheduled"?($("#sWhen")||{}).value:"";
  openModal('<button class="close" id="cX">×</button><h3 class="serif">'+(d.status==="scheduled"?"Agendar publicação":"Publicar artigo")+'</h3>'+
    '<p style="color:var(--body);margin:8px 0 14px">Isto irá gravar o arquivo <strong style="color:var(--txt)">artigos/'+esc(d.slug)+'.html</strong> no repositório do site e publicá-lo em <a href="'+SITE+'/artigos/'+esc(d.slug)+'.html" target="_blank">redebolha.com.br</a>.</p>'+
    (warnings.length?'<div class="msg" style="background:rgba(217,164,65,.12);border:1px solid var(--warn);color:#e6c078">Recomendações (não impedem a publicação):<ul style="margin:6px 0 0 18px">'+warnings.map(function(w){return "<li>"+esc(w)+"</li>";}).join("")+'</ul></div>':'')+
    (d.status==="scheduled"&&when?'<p style="color:var(--gold)">Agendado para '+fmtDate(when)+' (Porto Alegre).</p>':'')+
    '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn ghost" id="cCancel">Cancelar</button><button class="btn" id="cGo">'+(d.status==="scheduled"?"Confirmar agendamento":"Publicar agora")+'</button></div>',
    function(m){
      $("#cX",m).onclick=closeModal; $("#cCancel",m).onclick=closeModal;
      $("#cGo",m).onclick=function(){ doPublish(d,when); };
    });
}
function doPublish(d,when){
  var btn=$("#cGo"); if(btn){btn.disabled=true;btn.textContent="Publicando…";}
  d.file=d.slug+".html";
  if(d.status==="scheduled"&&when){ d.published=new Date(when).toISOString(); }
  else { d.status="published"; d.published=d.published||nowISO(); }
  d.updated=nowISO();
  var html=buildArticleHTML(d);
  var msg="Publica artigo: "+d.title+" (via Painel Rede Bolha)";
  // se ja existe, precisamos do sha atual
  var doWrite=function(sha){
    return ghPut("artigos/"+d.file, html, msg, sha).then(function(res){
      logActivity("publish","Publicou “"+d.title+"”");
      // atualiza cache
      saveDraft(d,true);
      var a=state.articles.filter(function(x){return x.file===d.file;})[0]; if(a){a.sha=res.content.sha;a.status=d.status;a.published=d.published;}
      saveIndex();
      localStorage.removeItem("rb_recover");
      closeModal();
      showPublished(d);
    });
  };
  var chain = d.sha ? doWrite(d.sha) : ghContent("artigos/"+d.file).then(function(c){return doWrite(c.sha);}).catch(function(){return doWrite(null);});
  chain.catch(function(e){ toast("Falha ao publicar: "+e.message,"err"); if(btn){btn.disabled=false;btn.textContent="Publicar agora";} });
}
function showPublished(d){
  var link=SITE+"/artigos/"+d.slug+".html";
  openModal('<h3 class="serif">✓ '+(d.status==="scheduled"?"Agendado":"Publicado")+' com sucesso!</h3>'+
    '<p style="color:var(--body);margin:10px 0 14px">Seu artigo está no ar (o GitHub Pages pode levar 1–2 minutos para atualizar).</p>'+
    '<div class="field"><input readonly value="'+esc(link)+'" id="pubLink"></div>'+
    '<div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn" href="'+link+'" target="_blank">Abrir artigo</a><button class="btn ghost" id="copyLink">Copiar endereço</button><a class="btn ghost" href="https://wa.me/?text='+encodeURIComponent(link)+'" target="_blank">Compartilhar</a><button class="btn ghost" id="pubDone">Concluir</button></div>',
    function(m){ $("#copyLink",m).onclick=function(){navigator.clipboard.writeText(link);toast("Endereço copiado.","ok");}; $("#pubDone",m).onclick=function(){closeModal();go("articles");}; });
}

/* ---- Parsear artigo existente para edicao ---- */
function parseArticleIntoEditor(html,d){
  try{
    var doc=new DOMParser().parseFromString(html,"text/html");
    var art=doc.querySelector("article");
    d.title=(doc.querySelector("h1")||{}).textContent||d.title;
    d.desc=(doc.querySelector('meta[name=description]')||{}).content||"";
    d.eyebrow=(doc.querySelector(".eyebrow")||{}).textContent||"";
    $("#edTitle").value=d.title; $("#edEyebrow").value=d.eyebrow; $("#sDesc").value=d.desc;
    edState.blocks=[];
    if(art){ Array.prototype.forEach.call(art.children,function(node){
      var tag=node.tagName.toLowerCase();
      if(tag==="p"&&(node.className==="eyebrow"||node.className==="byline"||node.className==="back"||node.className==="lead"))return;
      if(tag==="p") edState.blocks.push({id:"b"+Math.random(),type:"para",html:node.innerHTML,data:{}});
      else if(tag==="h2") edState.blocks.push({id:"b"+Math.random(),type:"h2",html:node.innerHTML,data:{}});
      else if(tag==="blockquote") edState.blocks.push({id:"b"+Math.random(),type:"quote",html:node.innerHTML,data:{}});
      else if(tag==="ul") edState.blocks.push({id:"b"+Math.random(),type:"ul",html:node.innerHTML,data:{}});
      else if(tag==="ol") edState.blocks.push({id:"b"+Math.random(),type:"ol",html:node.innerHTML,data:{}});
      else if(tag==="figure"){var img=node.querySelector("img");edState.blocks.push({id:"b"+Math.random(),type:"image",html:"",data:{url:img?img.src:"",cap:(node.querySelector("figcaption")||{}).textContent||""}});}
    }); }
    if(!edState.blocks.length) edState.blocks.push({id:"b"+Math.random(),type:"para",html:"",data:{}});
    rerenderBlocks(); syncMeta(d);
  }catch(e){ toast("Aviso ao abrir: "+e.message,"err"); }
}

/* ===================================================================
   MODAIS
   =================================================================== */
function openModal(inner,after,wide){
  var bg=el("div",{class:"modal-bg"});
  var m=el("div",{class:"modal"+(wide?" wide":"")},inner);
  bg.appendChild(m); $("#modals").appendChild(bg);
  bg.addEventListener("click",function(e){if(e.target===bg)closeModal();});
  document.addEventListener("keydown",function esc(e){if(e.key==="Escape"){closeModal();document.removeEventListener("keydown",esc);}});
  if(after)after(m);
}
function closeModal(){ var b=$("#modals"); if(b)b.innerHTML=""; }

/* ===================================================================
   CATEGORIAS
   =================================================================== */
function viewCategories(v){
  v.innerHTML='<div class="toolbar"><input type="search" id="cq" placeholder="Buscar categoria…"><button class="btn" id="addCat">+ Nova categoria</button></div><div class="panel" style="padding:0"><table><thead><tr><th>Nome</th><th>Endereço</th><th>Artigos</th><th></th></tr></thead><tbody id="catBody"></tbody></table></div>';
  $("#addCat").onclick=function(){ var n=prompt("Nome da nova categoria:"); if(!n)return; if(state.categories.map(function(c){return c.toLowerCase();}).indexOf(n.toLowerCase())>=0){toast("Categoria já existe.","err");return;} state.categories.push(n); localStorage.setItem("rb_cats",JSON.stringify(state.categories)); renderCats(); toast("Categoria criada.","ok"); };
  $("#cq").oninput=renderCats; renderCats();
}
function renderCats(){
  var q=(($("#cq")||{}).value||"").toLowerCase();
  var tb=$("#catBody"); tb.innerHTML="";
  state.categories.filter(function(c){return c.toLowerCase().indexOf(q)>=0;}).forEach(function(c){
    var count=state.articles.filter(function(a){return a.category===c;}).length;
    var tr=el("tr"); tr.innerHTML='<td style="color:var(--txt)">'+esc(c)+'</td><td style="color:var(--dim)">/'+slugify(c)+'</td><td>'+count+'</td><td></td>';
    var td=tr.lastChild; var d=el("button",{class:"btn ghost sm"},"Renomear"); d.onclick=function(){var n=prompt("Novo nome:",c);if(n){state.categories=state.categories.map(function(x){return x===c?n:x;});localStorage.setItem("rb_cats",JSON.stringify(state.categories));renderCats();}}; var x=el("button",{class:"btn danger sm",style:"margin-left:6px"},"Excluir"); x.onclick=function(){if(confirm("Excluir a categoria “"+c+"”?")){state.categories=state.categories.filter(function(g){return g!==c;});localStorage.setItem("rb_cats",JSON.stringify(state.categories));renderCats();}}; td.appendChild(d);td.appendChild(x);
    tb.appendChild(tr);
  });
}

/* ===================================================================
   TAGS
   =================================================================== */
function viewTags(v){
  v.innerHTML='<div class="panel"><h3>Tags</h3><div class="chips" id="tagChips"></div><div class="field" style="margin-top:16px"><input id="newTag" placeholder="Nova tag + Enter"></div></div>';
  var render=function(){ var c=$("#tagChips"); c.innerHTML=""; if(!state.tags.length)c.innerHTML='<span class="empty">Nenhuma tag ainda.</span>'; state.tags.forEach(function(t){var chip=el("span",{class:"chip"},esc(t)+" ");var x=el("button",null,"×");x.onclick=function(){state.tags=state.tags.filter(function(g){return g!==t;});localStorage.setItem("rb_tags",JSON.stringify(state.tags));render();};chip.appendChild(x);c.appendChild(chip);}); };
  $("#newTag").onkeydown=function(e){if(e.key==="Enter"){var t=this.value.trim();if(t&&state.tags.indexOf(t)<0){state.tags.push(t);localStorage.setItem("rb_tags",JSON.stringify(state.tags));}this.value="";render();}};
  render();
}

/* ===================================================================
   BIBLIOTECA DE MIDIA (lista imagens do repositorio)
   =================================================================== */
function viewMedia(v){
  v.innerHTML='<div class="toolbar"><input type="search" id="mq" placeholder="Buscar mídia…"><span style="color:var(--dim);font-size:.85rem">Imagens hospedadas no repositório do site</span></div><div id="mediaGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px"></div>';
  var grid=$("#mediaGrid"); grid.innerHTML='<p class="empty">Carregando…</p>';
  ghListDir("").then(function(items){
    var imgs=items.filter(function(f){return /\.(jpe?g|png|gif|webp|svg)$/i.test(f.name);});
    grid.innerHTML="";
    if(!imgs.length){grid.innerHTML='<p class="empty">Nenhuma imagem no diretório raiz.</p>';return;}
    imgs.forEach(function(f){
      var card=el("div",{class:"panel",style:"padding:8px"});
      card.innerHTML='<img src="'+SITE+'/'+f.name+'" alt="'+esc(f.name)+'" style="width:100%;height:110px;object-fit:cover;border-radius:6px"><div style="font-size:.72rem;color:var(--dim);margin-top:6px;word-break:break-all">'+esc(f.name)+'</div>';
      var copy=el("button",{class:"btn ghost sm",style:"margin-top:6px;width:100%"},"Copiar URL");
      copy.onclick=function(){navigator.clipboard.writeText(SITE+"/"+f.name);toast("URL copiada.","ok");};
      card.appendChild(copy); grid.appendChild(card);
    });
  }).catch(function(e){grid.innerHTML='<p class="empty">Erro: '+esc(e.message)+'</p>';});
}

/* ===================================================================
   PAGINAS (lista arquivos .html institucionais)
   =================================================================== */
function viewPages(v){
  v.innerHTML='<div class="panel"><h3>Páginas do site</h3><p style="color:var(--dim);margin-bottom:14px">Páginas institucionais existentes no repositório. Clique para abrir no site.</p><div id="pagesList"></div></div>';
  var list=$("#pagesList"); list.innerHTML='<p class="empty">Carregando…</p>';
  ghListDir("").then(function(items){
    var pages=items.filter(function(f){return f.type==="file"&&/\.html$/.test(f.name)&&f.name!=="google2811742ec626a64f.html";});
    list.innerHTML="";
    pages.forEach(function(f){ list.appendChild(el("div",{class:"a11y-item"},'<a href="'+SITE+'/'+f.name+'" target="_blank">'+esc(f.name)+'</a>')); });
    ["contato","livros"].forEach(function(dir){ list.appendChild(el("div",{class:"a11y-item"},'<a href="'+SITE+'/'+dir+'/" target="_blank">'+dir+'/ (seção)</a>')); });
  }).catch(function(e){list.innerHTML='<p class="empty">'+esc(e.message)+'</p>';});
}

/* ===================================================================
   USUARIOS / PERFIS
   =================================================================== */
function viewUsers(v){
  v.innerHTML='<div class="panel"><h3>Usuários e perfis</h3>'+
    '<p style="color:var(--body);margin-bottom:14px">O acesso ao painel é feito pela sua conta do GitHub. Os perfis abaixo definem o fluxo editorial.</p>'+
    '<table><thead><tr><th>Perfil</th><th>Permissões</th></tr></thead><tbody>'+
    '<tr><td style="color:var(--gold)">Administrador</td><td>Acesso completo ao sistema.</td></tr>'+
    '<tr><td style="color:var(--gold)">Editor</td><td>Cria, edita, revisa e publica conteúdos.</td></tr>'+
    '<tr><td style="color:var(--gold)">Autor</td><td>Cria e edita seus artigos; depende de aprovação para publicar.</td></tr>'+
    '<tr><td style="color:var(--gold)">Revisor</td><td>Revisa e aprova ou devolve para correção.</td></tr>'+
    '</tbody></table>'+
    '<p style="color:var(--dim);font-size:.85rem;margin-top:14px">Para adicionar pessoas, convide-as como colaboradoras do repositório em github.com — cada uma usa o próprio token. Por segurança, contas não são criadas pelo painel.</p></div>';
}

/* ===================================================================
   RELATORIOS
   =================================================================== */
function viewReports(v){
  var total=state.articles.length;
  var pub=state.articles.filter(function(a){return a.status==="published";}).length;
  v.innerHTML='<div class="cards">'+statCard(total,"Total de artigos")+statCard(pub,"Publicados")+statCard(state.categories.length,"Categorias")+statCard(state.tags.length,"Tags")+'</div>'+
    '<div class="panel"><h3>Artigos recentes</h3><div id="repRecent"></div></div>'+
    '<div class="panel"><h3>Sobre os dados de acesso</h3><p style="color:var(--body)">Para métricas de visitantes, origem e dispositivos, recomenda-se conectar uma ferramenta de analytics que respeite a privacidade (ex.: Plausible ou GoatCounter). O painel exibirá os números aqui quando a integração estiver ativa, sem coletar dados pessoais.</p></div>';
  var r=$("#repRecent");
  state.articles.slice().sort(function(a,b){return (b.updated||"").localeCompare(a.updated||"");}).slice(0,8).forEach(function(a){ r.appendChild(el("div",{class:"a11y-item"},'<span>'+esc(a.title)+'</span><span style="margin-left:auto;color:var(--dim)">'+fmtDate(a.updated)+'</span>')); });
  if(!state.articles.length)r.innerHTML='<p class="empty">Sem artigos ainda.</p>';
}

/* ===================================================================
   CONFIGURACOES
   =================================================================== */
function viewSettings(v){
  var s=JSON.parse(localStorage.getItem("rb_settings")||'{}');
  v.innerHTML='<div class="panel"><h3>Configurações do site</h3>'+
    '<div class="field"><label>Nome do site</label><input id="setName" value="'+esc(s.name||"Rede Bolha")+'"></div>'+
    '<div class="field"><label>Descrição</label><input id="setDesc" value="'+esc(s.desc||"Masculinidade, saúde emocional e propósito")+'"></div>'+
    '<div class="field"><label>Autor padrão</label><input id="setAuthor" value="'+esc(s.author||"Adm. Romário Cruz")+'"></div>'+
    '<div class="field"><label>E-mail de contato</label><input id="setEmail" value="'+esc(s.email||"")+'"></div>'+
    '<div class="field"><label>Fuso horário</label><input value="America/Sao_Paulo (Porto Alegre)" disabled></div>'+
    '<div class="field"><label>Formato de data</label><select id="setDate"><option>dd/mm/aaaa</option><option>aaaa-mm-dd</option></select></div>'+
    '<button class="btn" id="saveSet">Salvar configurações</button></div>';
  $("#saveSet").onclick=function(){ localStorage.setItem("rb_settings",JSON.stringify({name:$("#setName").value,desc:$("#setDesc").value,author:$("#setAuthor").value,email:$("#setEmail").value})); toast("Configurações salvas.","ok"); };
}

/* ===================================================================
   SEGURANCA
   =================================================================== */
function viewSecurity(v){
  var logs=JSON.parse(localStorage.getItem("rb_logs")||"[]");
  v.innerHTML='<div class="panel"><h3>Segurança</h3>'+
    '<div class="a11y-item ok">✓ Conexão HTTPS ativa</div>'+
    '<div class="a11y-item ok">✓ Token armazenado apenas neste navegador (nunca enviado a terceiros)</div>'+
    '<div class="a11y-item ok">✓ Bloqueio após 5 tentativas incorretas de acesso</div>'+
    '<div class="a11y-item ok">✓ Painel marcado como não indexável (noindex)</div>'+
    '<div class="a11y-item warn">! Ative a verificação em duas etapas na sua conta do GitHub para proteção adicional</div>'+
    '<button class="btn danger sm" id="clearTok" style="margin-top:14px">Esquecer token deste dispositivo</button>'+
    '</div>'+
    '<div class="panel"><h3>Registro de atividades</h3><div id="logList"></div></div>';
  $("#clearTok").onclick=function(){ localStorage.removeItem("rb_token");localStorage.removeItem("rb_email");sessionStorage.removeItem("rb_token"); toast("Token removido. Você sairá do painel.","ok"); setTimeout(logout,1200); };
  var ll=$("#logList");
  if(!logs.length)ll.innerHTML='<p class="empty">Sem registros ainda.</p>';
  logs.slice(0,40).forEach(function(l){ ll.appendChild(el("div",{class:"a11y-item"},'<span>'+esc(l.who)+' — '+esc(l.detail)+'</span><span style="margin-left:auto;color:var(--dim)">'+fmtDate(l.at)+'</span>')); });
}

/* ===================================================================
   AJUDA
   =================================================================== */
function viewHelp(v){
  v.innerHTML='<div class="panel"><h3>Como usar o painel</h3>'+
    '<ol style="line-height:2;padding-left:20px;color:var(--body)">'+
    '<li>Clique em <strong style="color:var(--txt)">Criar novo artigo</strong> na Visão Geral.</li>'+
    '<li>Escreva o <strong style="color:var(--txt)">título</strong>, o chapéu e o subtítulo.</li>'+
    '<li>Use <strong style="color:var(--txt)">+ Adicionar bloco</strong> para inserir parágrafos, intertítulos, imagens, citações, vídeos e chamadas.</li>'+
    '<li>Preencha a <strong style="color:var(--txt)">categoria, tags, endereço (URL) e resumo</strong> no painel lateral.</li>'+
    '<li>Confira a <strong style="color:var(--txt)">pré-visualização</strong> no computador, tablet e celular.</li>'+
    '<li>Clique em <strong style="color:var(--txt)">Publicar</strong>. O artigo entra no ar em redebolha.com.br.</li>'+
    '</ol>'+
    '<p style="color:var(--dim);margin-top:14px">Tudo é salvo automaticamente enquanto você escreve. Se fechar a página sem querer, o texto é recuperado ao voltar.</p></div>';
}

/* ===================================================================
   BOOTSTRAP
   =================================================================== */
document.addEventListener("DOMContentLoaded",function(){
  initLogin();
  // sessao ja iniciada?
  var tok=sessionStorage.getItem("rb_token")||localStorage.getItem("rb_token");
  if(tok){ state.token=tok; gh("/user").then(function(u){ state.ghUser=u.login; state.user=localStorage.getItem("rb_email")||u.login; enterApp(); }).catch(function(){ /* token invalido: fica no login */ }); }
});
window.addEventListener("beforeunload",function(e){ if(edState.dirty){ e.preventDefault(); e.returnValue=""; } });

window.__RB={state:state,go:go};
})();
