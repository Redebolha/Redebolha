/* =====================================================================
   Rede Bolha — Painel Administrativo
   CMS Git-based: autentica no GitHub via token pessoal (guardado apenas
   no navegador) e publica artigos como HTML estatico no mesmo padrao do
   site (blog.css + brasil.css + JSON-LD + Analytics + AdSense).
   Cada publicacao vira UM commit com: o artigo, a lista /artigos/,
   o sitemap.xml e o feed.xml.
   ===================================================================== */
(function(){
"use strict";

/* ---------- Config do repositorio ---------- */
var REPO = { owner: "Redebolha", name: "Redebolha", branch: "main" };
var SITE = "https://redebolha.com.br";
var TZ = "America/Sao_Paulo"; // Porto Alegre / RS
var API = "https://api.github.com";
var BASE = "/repos/" + REPO.owner + "/" + REPO.name;
var GA_ID = "G-6DSL2EMZSL";
var ADS_CLIENT = "ca-pub-6315134930280019";

/* ---------- Armazenamento local seguro ---------- */
function lsGet(k, def){ try{ var v = localStorage.getItem(k); return v == null ? def : v; }catch(e){ return def; } }
function lsSet(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
function lsDel(k){ try{ localStorage.removeItem(k); }catch(e){} }
function lsJSON(k, def){ try{ var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; }catch(e){ return def; } }
function settings(){ return lsJSON("rb_settings", {}); }
function defaultAuthor(){ return settings().author || "Adm. Romário Cruz"; }

/* ---------- Estado ---------- */
var state = {
  token: null,
  user: null,          // e-mail informado no login
  ghUser: null,        // login do GitHub
  route: "dashboard",
  articles: [],        // artigos (publicados no site + rascunhos locais)
  categories: lsJSON("rb_cats", ["Solidão","Masculinidade","Paternidade","Propósito","Relacionamentos","Fé e Identidade","Saúde Emocional","Dinheiro"]),
  tags: lsJSON("rb_tags", []),
  editing: null,       // artigo em edicao
  loginTries: parseInt(lsGet("rb_tries","0"),10) || 0,
  lockUntil: parseInt(lsGet("rb_lock","0"),10) || 0
};

/* ---------- Utilidades ---------- */
function $(s,c){return (c||document).querySelector(s);}
function $all(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s));}
function el(tag,attrs,html){var e=document.createElement(tag);if(attrs)for(var k in attrs){if(k==="class")e.className=attrs[k];else if(k==="text")e.textContent=attrs[k];else e.setAttribute(k,attrs[k]);}if(html!=null)e.innerHTML=html;return e;}
function esc(s){return (s==null?"":String(s)).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function reEsc(s){return (s||"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}
function slugify(s){return (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80);}
function nowISO(){return new Date().toISOString();}
function fmtDate(iso){if(!iso)return "—";try{return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:TZ}).format(new Date(iso));}catch(e){return iso;}}
function fmtDay(iso){if(!iso)return "—";try{return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeZone:TZ}).format(new Date(iso));}catch(e){return iso;}}
function readingTime(text){var w=(text||"").trim().split(/\s+/).filter(Boolean).length;return Math.max(1,Math.round(w/200));}
function stripTags(s){var t=document.createElement("div");t.innerHTML=s||"";return t.textContent||"";}
function decodeEntities(s){var t=document.createElement("textarea");t.innerHTML=s||"";return t.value;}
function toast(msg,type){var box=$("#toasts");if(!box)return;var t=el("div",{class:"toast "+(type||""),role:type==="err"?"alert":"status"},esc(msg));box.appendChild(t);setTimeout(function(){t.style.opacity="0";t.style.transition="opacity .4s";setTimeout(function(){t.remove();},400);},type==="err"?6000:3500);}
function absUrl(u){ if(!u) return ""; if(/^https?:\/\//i.test(u)) return u; if(u.charAt(0)==="/") return SITE+u; return SITE+"/artigos/"+u; }
function sitePath(u){ if(!u) return ""; return u.indexOf(SITE)===0 ? (u.slice(SITE.length)||"/") : u; }
function todayISO(){ return new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()); }
/* data no formato RSS, no horario de Brasilia (sem horario de verao desde 2019) */
function rfc822(d){
  var t=new Date((d?new Date(d):new Date()).getTime()-3*3600*1000);
  var D=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function p(n){return (n<10?"0":"")+n;}
  return D[t.getUTCDay()]+", "+p(t.getUTCDate())+" "+M[t.getUTCMonth()]+" "+t.getUTCFullYear()+" "+p(t.getUTCHours())+":"+p(t.getUTCMinutes())+":"+p(t.getUTCSeconds())+" -0300";
}
/* executa tarefas em paralelo com limite */
function pMap(list,limit,fn){
  var i=0, out=[];
  function next(){ if(i>=list.length) return Promise.resolve(); var k=i++; return Promise.resolve(fn(list[k],k)).then(function(r){out[k]=r;},function(){out[k]=null;}).then(next); }
  var runners=[]; for(var n=0;n<Math.min(limit,list.length);n++) runners.push(next());
  return Promise.all(runners).then(function(){return out;});
}

/* base64 utf-8 (para a API de conteudo do GitHub) */
function b64encode(str){return btoa(unescape(encodeURIComponent(str)));}
function b64decode(b64){try{return decodeURIComponent(escape(atob(b64.replace(/\n/g,""))));}catch(e){return atob(b64.replace(/\n/g,""));}}
function encPath(p){ return String(p).split("/").map(encodeURIComponent).join("/"); }

/* ---------- Camada de API do GitHub ---------- */
function gh(path, opts){
  opts = opts || {};
  var method = opts.method || "GET";
  var headers = { "Accept":"application/vnd.github+json" };
  if(state.token) headers["Authorization"]="Bearer "+state.token;
  if(opts.body) headers["Content-Type"]="application/json";
  // no-store: sem isso o navegador guarda as leituras por 60s e o painel
  // podia salvar em cima de uma versao velha de um arquivo.
  return fetch(API+path, { method: method, headers: headers, body: opts.body?JSON.stringify(opts.body):undefined, cache: "no-store" })
    .then(function(r){
      return r.text().then(function(txt){
        var j=null; try{ j = txt ? JSON.parse(txt) : {}; }catch(e){ j = {}; }
        if(r.ok) return j;
        var msg = (j && j.message) || ("Erro "+r.status);
        if(r.status===401) msg = "Token inválido ou expirado.";
        else if(r.status===403) msg = /rate limit/i.test(msg) ? "Limite da API do GitHub atingido. Tente de novo em alguns minutos." : "Sem permissão: o token precisa de acesso “Contents: Read and write” ao repositório.";
        else if(r.status===404) msg = "Arquivo não encontrado.";
        var err = new Error(msg); err.status = r.status; err.raw = j && j.message; throw err;
      });
    });
}
function ghContent(filepath, ref){ return gh(BASE+"/contents/"+encPath(filepath)+"?ref="+(ref||REPO.branch)); }
function ghPut(filepath, contentStr, message, sha){
  var body = { message: message, content: b64encode(contentStr), branch: REPO.branch };
  if(sha) body.sha = sha;
  return gh(BASE+"/contents/"+encPath(filepath), { method:"PUT", body: body });
}
function ghListDir(dir){ return gh(BASE+"/contents/"+(dir?encPath(dir):"")+"?ref="+REPO.branch); }
function ghDelete(filepath, message, sha){
  return gh(BASE+"/contents/"+encPath(filepath), { method:"DELETE", body:{ message: message, sha: sha, branch: REPO.branch } });
}
/* le um arquivo de texto numa versao exata do repositorio (null se nao existe) */
function ghReadText(path, ref){
  return ghContent(path, ref).then(function(c){ return c && c.content!=null ? b64decode(c.content) : null; })
    .catch(function(e){ if(e.status===404) return null; throw e; });
}
/* Commit unico com varios arquivos (API Git Data).
   paths: arquivos a ler; mutate(files) devolve [{path, content}] ou [{path, remove:true}].
   Le tudo na mesma versao (head) e grava so se ninguem mexeu no meio do caminho. */
function ghCommitEdit(paths, mutate, message, isRetry){
  var head;
  return gh(BASE+"/git/ref/heads/"+REPO.branch).then(function(ref){
    head = ref.object.sha;
    return Promise.all(paths.map(function(p){ return ghReadText(p, head); }));
  }).then(function(texts){
    var files = {}; paths.forEach(function(p,i){ files[p] = texts[i]; });
    var changes = mutate(files) || [];
    if(!changes.length) return { nothing:true };
    return gh(BASE+"/git/commits/"+head).then(function(c){
      var tree = changes.map(function(ch){
        return ch.remove ? { path: ch.path, mode:"100644", type:"blob", sha: null }
                         : { path: ch.path, mode:"100644", type:"blob", content: ch.content };
      });
      return gh(BASE+"/git/trees", { method:"POST", body:{ base_tree: c.tree.sha, tree: tree } });
    }).then(function(t){
      return gh(BASE+"/git/commits", { method:"POST", body:{ message: message, tree: t.sha, parents: [head] } });
    }).then(function(nc){
      return gh(BASE+"/git/refs/heads/"+REPO.branch, { method:"PATCH", body:{ sha: nc.sha } }).then(function(){ return nc; });
    });
  }).catch(function(e){
    if(!isRetry && (e.status===409 || e.status===422)) return ghCommitEdit(paths, mutate, message, true);
    if(e.status===409 || e.status===422) e.message = "O site foi alterado enquanto você salvava. Tente de novo.";
    throw e;
  });
}

/* ===================================================================
   LOGIN / SEGURANCA
   =================================================================== */
function initLogin(){
  var form=$("#loginForm"), toggle=$("#togglePwd"), tokenIn=$("#token");
  var savedEmail=lsGet("rb_email","");
  if(savedEmail) $("#email").value=savedEmail;

  toggle.addEventListener("click",function(){
    var t=tokenIn.type==="password"?"text":"password";
    tokenIn.type=t; toggle.textContent=t==="password"?"Mostrar":"Ocultar";
  });

  form.addEventListener("submit",function(e){
    e.preventDefault();
    if(Date.now()<state.lockUntil){
      var s=Math.ceil((state.lockUntil-Date.now())/1000);
      showLoginMsg("Muitas tentativas. Tente novamente em "+s+"s.","err");return;
    }
    var email=$("#email").value.trim();
    var token=tokenIn.value.trim();
    if(!token){ showLoginMsg("Informe o token de acesso.","err"); return; }
    $("#loginBtn").disabled=true; $("#loginBtn").textContent="Verificando…";
    state.token=token;
    gh("/user").then(function(u){
      state.ghUser=u.login; state.user=email||u.login;
      state.loginTries=0; lsSet("rb_tries","0"); lsDel("rb_lock");
      if($("#remember").checked){ lsSet("rb_token",token); }
      else { try{ sessionStorage.setItem("rb_token",token); }catch(e){} }
      if(email) lsSet("rb_email",email);
      tokenIn.value="";
      logActivity("login","Acesso ao painel");
      enterApp();
    }).catch(function(err){
      state.token=null;
      state.loginTries++; lsSet("rb_tries",String(state.loginTries));
      if(state.loginTries>=5){
        state.lockUntil=Date.now()+60000; lsSet("rb_lock",String(state.lockUntil));
        state.loginTries=0; lsSet("rb_tries","0");
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
  var logs=lsJSON("rb_logs",[]);
  logs.unshift({ who: state.user||state.ghUser||"?", action: action, detail: detail, at: nowISO() });
  lsSet("rb_logs",JSON.stringify(logs.slice(0,300)));
}

/* Sair: apaga o token deste navegador (o e-mail continua lembrado) */
function logout(){
  logActivity("logout","Encerrou a sessão");
  try{ sessionStorage.removeItem("rb_token"); }catch(e){}
  lsDel("rb_token");
  state.token=null;
  location.hash="";
  location.reload();
}

/* ===================================================================
   SHELL DO APP (menu lateral + roteamento)
   =================================================================== */
var NAV=[
  ["dashboard","Visão Geral","▦"],
  ["home","Página Inicial","★"],
  ["articles","Artigos","✎"],
  ["pages","Páginas","▤"],
  ["categories","Categorias","❏"],
  ["tags","Tags","#"],
  ["media","Biblioteca de Mídia","▣"],
  ["acessibilidade","Acessibilidade RS","♿"],
  ["users","Usuários","⚇"],
  ["reports","Relatórios","▨"],
  "sep",
  ["settings","Configurações","⚙"],
  ["security","Segurança","🛡"],
  ["help","Ajuda","?"]
];
var TITLES={dashboard:"Visão Geral",home:"Página Inicial — Capa",articles:"Artigos",pages:"Páginas",categories:"Categorias",tags:"Tags",media:"Biblioteca de Mídia",acessibilidade:"Acessibilidade RS",users:"Usuários",reports:"Relatórios",settings:"Configurações",security:"Segurança",help:"Ajuda"};
var appStarted=false;

function buildShell(){
  var app=$("#app");
  app.innerHTML=
    '<aside class="sidebar" id="sidebar" aria-label="Menu do painel">'+
      '<span class="brand"><b>Rede Bolha</b> — Painel</span>'+
      '<nav class="nav" id="nav"></nav>'+
    '</aside>'+
    '<div class="nav-backdrop" id="navBackdrop"></div>'+
    '<div class="main">'+
      '<div class="topbar">'+
        '<button class="hamburger" id="hbtn" aria-label="Abrir menu" aria-controls="sidebar" aria-expanded="false">☰</button>'+
        '<h2 id="pageTitle">Visão Geral</h2>'+
        '<span style="font-size:.85rem;color:var(--dim)" class="hide-mobile">'+esc(state.user||"")+'</span>'+
        '<a class="btn ghost sm hide-mobile" href="'+SITE+'/" target="_blank" rel="noopener">Ver site</a>'+
        '<button class="btn ghost sm" id="logoutBtn">Sair</button>'+
      '</div>'+
      '<div class="content" id="view"></div>'+
    '</div>';
  var nav=$("#nav");
  NAV.forEach(function(item){
    if(item==="sep"){ nav.appendChild(el("div",{class:"sep"})); return; }
    var a=el("a",{href:"#"+item[0],"data-route":item[0]},'<span class="ico" aria-hidden="true">'+item[2]+'</span>'+esc(item[1]));
    a.addEventListener("click",function(e){e.preventDefault();closeSidebar();go(item[0]);});
    nav.appendChild(a);
  });
  $("#logoutBtn").addEventListener("click",logout);
  $("#hbtn").addEventListener("click",function(){ var s=$("#sidebar"); var open=!s.classList.contains("open"); s.classList.toggle("open",open); $("#navBackdrop").classList.toggle("show",open); this.setAttribute("aria-expanded",open?"true":"false"); });
  $("#navBackdrop").addEventListener("click",closeSidebar);
}
function closeSidebar(){ var s=$("#sidebar"); if(s) s.classList.remove("open"); var b=$("#navBackdrop"); if(b) b.classList.remove("show"); var h=$("#hbtn"); if(h) h.setAttribute("aria-expanded","false"); }

function enterApp(){
  $("#login").style.display="none";
  $("#app").style.display="block";
  buildShell();
  if(!appStarted){
    appStarted=true;
    window.addEventListener("hashchange",function(){ var r=location.hash.replace("#","")||"dashboard"; if(r!==state.route || !$("#view")) go(r); });
  }
  var initial=location.hash.replace("#","")||"dashboard";
  if(!TITLES[initial]) initial="dashboard";
  go(initial);
  loadArticles();
}

function leaveEditor(){
  if(edState.saveTimer){ clearInterval(edState.saveTimer); edState.saveTimer=null; }
  edState.dirty=false; state.editing=null;
}

function go(route){
  if(!TITLES[route]) route="dashboard";
  if(!$("#view")){ // estava no editor
    if(edState.dirty && !confirm("Há alterações não salvas neste artigo. Sair mesmo assim?")){ try{ history.replaceState(null,"","#"+state.route); }catch(e){} return; }
    leaveEditor(); buildShell();
  }
  state.route=route;
  $all("#nav a").forEach(function(a){a.classList.toggle("active",a.getAttribute("data-route")===route);});
  $("#pageTitle").textContent=TITLES[route]||"Painel";
  if(location.hash!=="#"+route) location.hash=route;
  var v=$("#view"); v.innerHTML="";
  window.scrollTo(0,0);
  ({dashboard:viewDashboard,home:viewHome,articles:viewArticles,categories:viewCategories,tags:viewTags,media:viewMedia,acessibilidade:viewAcessibilidade,pages:viewPages,users:viewUsers,reports:viewReports,settings:viewSettings,security:viewSecurity,help:viewHelp}[route])(v,route);
}

/* ===================================================================
   ARTIGOS — carregamento (le /artigos/*.html do repositorio)
   =================================================================== */
/* extrai os dados de um artigo publicado */
function extractMeta(html){
  var doc=new DOMParser().parseFromString(html,"text/html");
  var m={};
  var og=function(p){ var x=doc.querySelector('meta[property="'+p+'"]'); return x?x.getAttribute("content")||"":""; };
  var h1=doc.querySelector("article h1")||doc.querySelector("h1");
  m.title=(h1&&h1.textContent.trim())||og("og:title")||(doc.title||"").replace(/\s*\|.*$/,"");
  var eb=doc.querySelector("article .eyebrow"); m.eyebrow=eb?eb.textContent.trim():"";
  var md=doc.querySelector('meta[name="description"]'); m.desc=md?md.getAttribute("content")||"":"";
  m.cover=og("og:image")||"";
  if(!m.cover){ var im=doc.querySelector("article img"); if(im) m.cover=absUrl(im.getAttribute("src")); }
  var by=doc.querySelector("article .byline"); var au=by?/Por\s+(.+?)\s*·/.exec(by.textContent):null; m.author=au?au[1].trim():"";
  $all('script[type="application/ld+json"]',doc).forEach(function(s){
    try{
      var j=JSON.parse(s.textContent); var list=j["@graph"]||[j];
      list.forEach(function(n){ if(n && /Article/.test(n["@type"]||"")){ m.published=n.datePublished||m.published; m.modified=n.dateModified||m.modified; if(n.author&&n.author.name&&!m.author) m.author=n.author.name; } });
    }catch(e){}
  });
  return m;
}

function loadArticles(){
  return ghListDir("artigos").then(function(items){
    var files=items.filter(function(f){return f.type==="file" && /\.html$/.test(f.name) && f.name!=="index.html";});
    var cache=lsJSON("rb_meta",{});
    var index=lsJSON("rb_index",{});
    var build=function(){
      var names={};
      state.articles=files.map(function(f){
        names[f.name]=true;
        var c=cache[f.name]||{}, m=index[f.name]||{};
        var draft = m.status==="draft"||m.status==="review";
        return {
          file:f.name, sha:f.sha, path:f.path, slug:f.name.replace(/\.html$/,""), live:true,
          title:c.title||m.title||f.name.replace(/\.html$/,"").replace(/-/g," "),
          author:c.author||m.author||defaultAuthor(),
          category:c.eyebrow||m.category||"—",
          desc:c.desc||"",
          status: draft && m.updated && (!c.modified || m.updated>c.modified) ? m.status : "published",
          published:c.published||null, updated:(m.updated && m.updated>(c.modified||"") ? m.updated : (c.modified||c.published||null)),
          cover:c.cover||m.cover||null
        };
      });
      // rascunhos que so existem neste navegador
      Object.keys(index).forEach(function(k){
        var m=index[k]; if(names[k]) return;
        if(m.status!=="draft" && m.status!=="review") return;
        state.articles.push({ file:k, sha:null, path:"artigos/"+k, slug:k.replace(/\.html$/,""), live:false, title:m.title||k, author:m.author||defaultAuthor(), category:m.category||"—", desc:"", status:m.status, published:null, updated:m.updated||null, cover:m.cover||null });
      });
    };
    build(); refreshArticleViews();
    var need=files.filter(function(f){ return !cache[f.name] || cache[f.name].sha!==f.sha; });
    if(!need.length) return state.articles;
    return pMap(need,6,function(f){
      return ghContent("artigos/"+f.name).then(function(c){ var meta=extractMeta(b64decode(c.content)); meta.sha=f.sha; cache[f.name]=meta; });
    }).then(function(){
      lsSet("rb_meta",JSON.stringify(cache));
      build(); refreshArticleViews();
      return state.articles;
    });
  }).catch(function(e){ toast("Não foi possível carregar os artigos: "+e.message,"err"); });
}
function refreshArticleViews(){
  if(!$("#view")) return;
  if(state.route==="dashboard"||state.route==="reports"||state.route==="categories") go(state.route);
  else if(state.route==="articles" && $("#artBody")) renderArtRows();
}
function saveIndex(){
  var index=lsJSON("rb_index",{});
  state.articles.forEach(function(a){
    if(a.status==="draft"||a.status==="review") index[a.file]={title:a.title,author:a.author,category:a.category,status:a.status,updated:a.updated,cover:a.cover};
    else delete index[a.file];
  });
  lsSet("rb_index",JSON.stringify(index));
}

/* ===================================================================
   DASHBOARD
   =================================================================== */
function viewDashboard(v){
  var pub=state.articles.filter(function(a){return a.live;}).length;
  var rasc=state.articles.filter(function(a){return a.status==="draft";}).length;
  var rev=state.articles.filter(function(a){return a.status==="review";}).length;
  v.innerHTML=
    '<div class="hero-cta"><div><h3>Pronto para escrever?</h3><p>Crie um novo artigo com o editor visual por blocos.</p></div>'+
    '<button class="btn" id="newArt">+ Criar novo artigo</button></div>'+
    '<div class="cards">'+
      statCard(pub,"Publicados no site")+statCard(rasc,"Rascunhos")+statCard(rev,"Aguardando revisão")+
    '</div>'+
    '<div class="panel"><h3>Conteúdos recentemente alterados</h3><div id="recent" class="row-list"></div></div>'+
    '<div class="cards">'+
      '<div class="panel"><h3>Acessos e anúncios</h3>'+
        '<p style="color:var(--body);font-size:.9rem;margin-bottom:14px">Visitas, origem dos leitores e ganhos ficam nas ferramentas do Google já instaladas no site.</p>'+
        '<div style="display:flex;flex-direction:column;gap:10px">'+
        '<a href="https://analytics.google.com/" target="_blank" rel="noopener" class="btn ghost sm">▨ Google Analytics</a>'+
        '<a href="https://search.google.com/search-console" target="_blank" rel="noopener" class="btn ghost sm">⌕ Search Console</a>'+
        '<a href="https://adsense.google.com/" target="_blank" rel="noopener" class="btn ghost sm">$ AdSense</a>'+
        '</div></div>'+
      '<div class="panel"><h3>Atalhos</h3>'+
        '<div style="display:flex;flex-direction:column;gap:10px">'+
        '<a href="#home" class="btn ghost sm">★ Destaques da capa</a>'+
        '<a href="#media" class="btn ghost sm">▣ Biblioteca de Mídia</a>'+
        '<a href="#pages" class="btn ghost sm">▤ Páginas do site</a>'+
        '<a href="#categories" class="btn ghost sm">❏ Categorias</a>'+
        '</div>'+
      '</div>'+
    '</div>';
  $("#newArt").addEventListener("click",function(){openEditor(null);});
  var recent=state.articles.slice().sort(function(a,b){return (b.updated||"").localeCompare(a.updated||"");}).slice(0,6);
  var rc=$("#recent");
  if(!recent.length){rc.innerHTML='<p class="empty">Carregando artigos…</p>';}
  recent.forEach(function(a){
    var r=el("div",{class:"a11y-item"},'<span>'+esc(a.title)+'</span><span style="margin-left:auto;color:var(--dim)">'+statusBadge(a.status)+' · '+fmtDate(a.updated)+'</span>');
    r.style.cursor="pointer"; r.title="Abrir no editor"; r.addEventListener("click",function(){openEditor(a);});
    rc.appendChild(r);
  });
}
function statCard(n,l){return '<div class="stat"><div class="num">'+n+'</div><div class="lbl">'+esc(l)+'</div></div>';}
function statusBadge(s){var map={published:['pub','Publicado'],draft:['rasc','Rascunho'],review:['rev','Em revisão']};var m=map[s]||['rasc',s];return '<span class="badge '+m[0]+'">'+m[1]+'</span>';}

/* ===================================================================
   ARTIGOS — LISTAGEM
   =================================================================== */
var artFilters={q:"",cat:"",status:"",sort:"updated"};
function allCategories(){
  var set={}; state.categories.forEach(function(c){set[c]=1;});
  state.articles.forEach(function(a){ if(a.category && a.category!=="—") set[a.category]=1; });
  return Object.keys(set).sort(function(a,b){return a.localeCompare(b,"pt-BR");});
}
function viewArticles(v){
  v.innerHTML=
    '<div class="toolbar">'+
      '<input type="search" id="fq" placeholder="Pesquisar artigos…" aria-label="Pesquisar">'+
      '<select id="fcat" aria-label="Categoria"><option value="">Todas as categorias</option>'+allCategories().map(function(c){return '<option>'+esc(c)+'</option>';}).join("")+'</select>'+
      '<select id="fstatus" aria-label="Status"><option value="">Todos os status</option><option value="published">Publicados</option><option value="draft">Rascunhos</option><option value="review">Em revisão</option></select>'+
      '<select id="fsort" aria-label="Ordenar"><option value="updated">Mais recentes</option><option value="title">Título (A-Z)</option></select>'+
      '<button class="btn" id="newArt2">+ Adicionar novo</button>'+
    '</div>'+
    '<div class="panel" style="padding:0;overflow-x:auto"><table><thead><tr>'+
      '<th class="hide-mobile"></th><th>Título</th><th class="hide-mobile">Categoria</th><th>Status</th><th class="hide-mobile">Atualizado</th><th></th>'+
    '</tr></thead><tbody id="artBody"></tbody></table></div>';
  $("#newArt2").addEventListener("click",function(){openEditor(null);});
  ["fq","fcat","fstatus","fsort"].forEach(function(id){$("#"+id).addEventListener("input",renderArtRows);});
  renderArtRows();
}
function renderArtRows(){
  artFilters.q=($("#fq")||{}).value||""; artFilters.cat=($("#fcat")||{}).value||"";
  artFilters.status=($("#fstatus")||{}).value||""; artFilters.sort=($("#fsort")||{}).value||"updated";
  var q=artFilters.q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
  var rows=state.articles.filter(function(a){
    if(q && (a.title+" "+a.slug).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").indexOf(q)<0) return false;
    if(artFilters.cat && a.category!==artFilters.cat) return false;
    if(artFilters.status && a.status!==artFilters.status) return false;
    return true;
  });
  rows.sort(function(a,b){
    if(artFilters.sort==="title") return a.title.localeCompare(b.title,"pt-BR");
    return (b.updated||"").localeCompare(a.updated||"");
  });
  var tb=$("#artBody"); if(!tb) return; tb.innerHTML="";
  if(!rows.length){ tb.innerHTML='<tr><td colspan="6"><p class="empty">'+(state.articles.length?"Nenhum artigo encontrado.":"Carregando artigos…")+'</p></td></tr>'; return; }
  rows.forEach(function(a){
    var tr=el("tr");
    tr.innerHTML=
      '<td class="hide-mobile">'+(a.cover?'<img class="thumb" src="'+esc(absUrl(a.cover))+'" alt="" loading="lazy">':'<div class="thumb"></div>')+'</td>'+
      '<td><strong style="color:var(--txt)">'+esc(a.title)+'</strong><br><span style="color:var(--dim);font-size:.78rem">'+esc(a.slug)+(a.live?'':' · só neste navegador')+'</span></td>'+
      '<td class="hide-mobile">'+esc(a.category)+'</td>'+
      '<td>'+statusBadge(a.status)+'</td>'+
      '<td class="hide-mobile">'+fmtDay(a.updated)+'</td>'+
      '<td class="row-actions"></td>';
    var cell=$(".row-actions",tr);
    var btn=el("button",{class:"btn ghost sm","aria-label":"Ações de "+a.title},"⋯");
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
  var items=[["Editar",function(){openEditor(a);}]];
  if(a.live) items.push(["Ver no site",function(){window.open(SITE+"/artigos/"+a.file,"_blank");}]);
  items.push(["Duplicar",function(){openEditor(a,true);}]);
  if(a.live) items.push(["Tirar do ar…",function(){confirmUnpublish(a);},"del"]);
  else items.push(["Apagar rascunho",function(){deleteLocalDraft(a);},"del"]);
  items.forEach(function(it){
    var b=el("button",it[2]?{class:it[2]}:null,esc(it[0])); b.addEventListener("click",function(e){e.stopPropagation();m.remove();it[1]();}); m.appendChild(b);
  });
  cell.appendChild(m);
  setTimeout(function(){document.addEventListener("click",function h(){m.remove();document.removeEventListener("click",h);});},0);
}
function deleteLocalDraft(a){
  if(!confirm("Apagar o rascunho “"+a.title+"” deste navegador?")) return;
  var index=lsJSON("rb_index",{}); delete index[a.file]; lsSet("rb_index",JSON.stringify(index));
  lsDel("rb_draft_"+a.slug);
  state.articles=state.articles.filter(function(x){return x!==a;});
  renderArtRows(); toast("Rascunho apagado.","ok");
}

/* Tirar do ar: apaga o arquivo e remove o artigo da lista, do sitemap e do feed (1 commit) */
function confirmUnpublish(a){
  var url="/artigos/"+a.file;
  ghReadText("index.html").catch(function(){return null;}).then(function(home){
    var onHome = home && home.indexOf('href="'+url+'"')>=0;
    openModal('<h3>Tirar o artigo do ar?</h3>'+
      '<p style="color:var(--body);margin:10px 0 12px">“'+esc(a.title)+'” deixa de existir em <strong style="color:var(--txt)">redebolha.com.br'+esc(url)+'</strong> e sai da lista de artigos, do sitemap e do feed.</p>'+
      (onHome?'<div class="msg warn">Atenção: a <strong>página inicial</strong> tem link para este artigo. Troque o destaque em “Página Inicial” para não deixar um link quebrado.</div>':'')+
      '<p style="color:var(--dim);font-size:.85rem;margin-bottom:18px">Dá para recuperar depois pelo histórico do repositório no GitHub.</p>'+
      '<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button class="btn ghost" id="cD">Cancelar</button><button class="btn danger" id="okD">Sim, tirar do ar</button></div>',
      function(m){
        $("#cD",m).onclick=closeModal;
        $("#okD",m).onclick=function(){
          var b=this; b.disabled=true; b.textContent="Removendo…";
          ghCommitEdit(["artigos/index.html","sitemap.xml","feed.xml"],function(f){
            var ch=[{path:"artigos/"+a.file, remove:true}];
            if(f["artigos/index.html"]!=null){ var n=removeCard(f["artigos/index.html"],a.slug); if(n!==f["artigos/index.html"]) ch.push({path:"artigos/index.html",content:n}); }
            if(f["sitemap.xml"]!=null){ var s=removeSitemap(f["sitemap.xml"],SITE+url); if(s!==f["sitemap.xml"]) ch.push({path:"sitemap.xml",content:s}); }
            if(f["feed.xml"]!=null){ var x=removeFeedItem(f["feed.xml"],SITE+url); if(x!==f["feed.xml"]) ch.push({path:"feed.xml",content:x}); }
            return ch;
          },"Tira do ar o artigo: "+a.title+" (via Painel Rede Bolha)").then(function(){
            logActivity("unpublish","Tirou do ar “"+a.title+"”");
            var cache=lsJSON("rb_meta",{}); delete cache[a.file]; lsSet("rb_meta",JSON.stringify(cache));
            state.articles=state.articles.filter(function(x){return x!==a;});
            closeModal(); renderArtRows(); toast("Artigo retirado do site. Em 1–2 minutos some do ar.","ok");
          }).catch(function(e){ toast("Falha ao tirar do ar: "+e.message,"err"); b.disabled=false; b.textContent="Sim, tirar do ar"; });
        };
      });
  });
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
var edState={blocks:[],selBlock:null,dirty:false,saveTimer:null};

function blankArticle(){
  return { title:"", eyebrow:"", sub:"", author:defaultAuthor(), slug:"", status:"draft", desc:"", category:state.categories[0]||"", tags:[], file:null, live:false, published:null, tema:"", ogImage:"", ogDesc:"", descOrig:"" };
}
function openEditor(article,asCopy){
  var d=blankArticle();
  if(article){
    d.title=article.title; d.eyebrow=article.category!=="—"?article.category:""; d.author=article.author;
    d.category=article.category!=="—"?article.category:d.category; d.status=asCopy?"draft":article.status;
    if(!asCopy){ d.slug=article.slug; d.file=article.file; d.live=!!article.live; }
  }
  state.editing=d;
  edState.blocks=[]; edState.selBlock=null; edState.dirty=false;
  var app=$("#app");
  app.innerHTML=editorShell(d);
  window.scrollTo(0,0);
  bindEditor(d);
  var finish=function(){
    if(asCopy){
      d.title="Cópia de "+d.title; d.slug=""; d.file=null; d.live=false; d.published=null; d._slugTouched=false;
      $("#edTitle").value=d.title; $("#sSlug").value=""; $("#sSlug").readOnly=false;
    }
    if(!edState.blocks.length) addBlock("para","",true);
    syncMeta(d,true);
    if(!asCopy) restoreLocal(d);
  };
  if(article && article.live){
    var box=$("#blocks"); box.innerHTML='<p class="empty" style="padding:30px">Carregando o artigo…</p>';
    ghContent("artigos/"+article.file).then(function(c){
      box.innerHTML="";
      parseArticleIntoEditor(b64decode(c.content),d);
      finish();
    }).catch(function(e){ box.innerHTML=""; toast("Não foi possível abrir o artigo: "+e.message,"err"); finish(); });
  } else {
    if(article && !article.live){ var dr=lsJSON("rb_draft_"+article.slug,null); if(dr){ applyDraft(d,dr); } }
    finish();
  }
}
function editorShell(d){
  var locked=d.live;
  return ''+
  '<div class="editor-top">'+
    '<button class="btn ghost sm" id="edBack">← Voltar</button>'+
    '<button class="btn ghost sm" id="edSave" title="Fica guardado só neste navegador">Salvar rascunho</button>'+
    '<button class="btn ghost sm" id="edPreview">Pré-visualizar</button>'+
    '<button class="btn ghost sm" id="edReview">Enviar p/ revisão</button>'+
    '<button class="btn sm" id="edPublish">'+(d.live?"Atualizar no site":"Publicar")+'</button>'+
    '<span class="save-status" id="saveStatus">'+(d.live?"Publicado no site":"Não salvo")+'</span>'+
  '</div>'+
  '<div class="editor-wrap">'+
    '<div class="editor-canvas">'+
      '<input class="ti eyebrow-in" id="edEyebrow" placeholder="CHAPÉU / CATEGORIA EDITORIAL" value="'+esc(d.eyebrow)+'" aria-label="Chapéu">'+
      '<input class="ti" id="edTitle" placeholder="Título principal do artigo" value="'+esc(d.title)+'" aria-label="Título">'+
      '<input class="ti sub-in" id="edSub" placeholder="Subtítulo ou linha fina (opcional)" value="'+esc(d.sub)+'" aria-label="Subtítulo">'+
      '<p class="byline" style="color:var(--dim);border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:20px">Por <span id="edBy">'+esc(d.author)+'</span> · <span id="edRT">1 min</span> de leitura</p>'+
      '<div class="fmt-toolbar" id="fmtBar" role="toolbar" aria-label="Formatação">'+
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
      '<div class="field"><label for="sStatus">Status</label><select id="sStatus">'+
        ['draft:Rascunho','review:Aguardando revisão','published:Publicado'].map(function(o){var p=o.split(":");return '<option value="'+p[0]+'"'+(d.status===p[0]?' selected':'')+'>'+p[1]+'</option>';}).join("")+
      '</select><small>Rascunhos ficam guardados só neste navegador. O site só muda quando você clica em Publicar.</small></div>'+
      '<h4>Autor</h4>'+
      '<div class="field"><input id="sAuthor" value="'+esc(d.author)+'" aria-label="Autor"></div>'+
      '<h4>Categoria e tags</h4>'+
      '<div class="field"><label for="sCat">Categoria</label><select id="sCat"></select></div>'+
      '<div class="field"><label for="sTagInput">Tags (Enter para adicionar)</label><input id="sTagInput" placeholder="ex.: solidão"><div class="chips" id="sTags"></div></div>'+
      '<h4>Endereço (URL)</h4>'+
      '<div class="field"><input id="sSlug" placeholder="endereco-do-artigo" value="'+esc(d.slug)+'"'+(locked?' readonly':'')+' aria-label="Endereço"><small>redebolha.com.br/artigos/<span id="slugPrev">'+esc(d.slug||"...")+'</span>.html'+(locked?'<br>O endereço de um artigo publicado não muda, para não quebrar links.':'')+'</small></div>'+
      '<h4>Resumo / meta descrição</h4>'+
      '<div class="field"><textarea id="sDesc" rows="3" placeholder="Resumo para busca e redes sociais" aria-label="Resumo">'+esc(d.desc)+'</textarea><small id="descCount"></small></div>'+
      '<h4>SEO — prévia</h4>'+
      '<div class="seo-preview"><div class="g-title" id="seoT"></div><div class="g-url">redebolha.com.br › artigos › <span id="seoU"></span></div><div class="g-desc" id="seoD"></div></div>'+
      '<h4>Verificação de acessibilidade</h4>'+
      '<div id="a11y"></div>'+
    '</aside>'+
  '</div>';
}
function fillCategorySelect(d){
  var cats=allCategories(); if(d.category && cats.indexOf(d.category)<0) cats.unshift(d.category);
  $("#sCat").innerHTML=cats.map(function(c){return '<option'+(d.category===c?' selected':'')+'>'+esc(c)+'</option>';}).join("");
}

/* ---- Bindings do editor ---- */
function bindEditor(d){
  fillCategorySelect(d);
  $("#edBack").onclick=function(){ go("articles"); };
  $("#edSave").onclick=function(){ saveDraft(d,false); };
  $("#edPreview").onclick=function(){ openPreview(d); };
  $("#edReview").onclick=function(){ $("#sStatus").value="review"; d.status="review"; saveDraft(d,false); toast("Marcado como aguardando revisão.","ok"); };
  $("#edPublish").onclick=function(){ publishArticle(d); };
  $("#addBlockBtn").onclick=function(){ toggleBlockMenu(); };
  $all("#fmtBar button").forEach(function(b){ b.addEventListener("mousedown",function(e){e.preventDefault();}); b.onclick=function(){ var c=b.getAttribute("data-cmd"); if(c==="createLink"){var u=prompt("Endereço do link (URL):");if(u)document.execCommand(c,false,u);}else document.execCommand(c,false,null); markDirty(); }; });
  var upd=function(){ syncMeta(d); };
  ["edEyebrow","edTitle","edSub"].forEach(function(id){$("#"+id).addEventListener("input",function(){ if(id==="edTitle" && !d.live && !d._slugTouched){ $("#sSlug").value=slugify($("#edTitle").value); } upd(); });});
  $("#sAuthor").addEventListener("input",function(){$("#edBy").textContent=$("#sAuthor").value;upd();});
  $("#sSlug").addEventListener("input",function(){d._slugTouched=true;upd();});
  $("#sDesc").addEventListener("input",upd);
  $("#sCat").addEventListener("change",upd);
  $("#sStatus").addEventListener("change",function(){ d.status=$("#sStatus").value; markDirty(); });
  $("#sTagInput").addEventListener("keydown",function(e){ if(e.key==="Enter"){e.preventDefault();addTag(this.value.trim());this.value="";} });
  d.tags.forEach(addTagChip);
  edState.saveTimer=setInterval(function(){ if(edState.dirty && state.editing===d) saveDraft(d,true); },8000);
}
function markDirty(){ edState.dirty=true; var s=$("#saveStatus"); if(s){s.textContent="Alterações não salvas…";s.classList.remove("saved");} persistLocal(); }
function syncMeta(d,silent){
  if(!$("#edTitle")) return;
  d.title=$("#edTitle").value; d.eyebrow=$("#edEyebrow").value; d.sub=$("#edSub").value;
  d.author=$("#sAuthor").value;
  if(!d.live){ d.slug=slugify($("#sSlug").value); if($("#sSlug").value!==d.slug) $("#sSlug").value=d.slug; }
  d.desc=$("#sDesc").value; d.category=$("#sCat").value;
  $("#slugPrev").textContent=d.slug||"..."; $("#seoT").textContent=(d.title||"Título do artigo")+" | Adm. Romário Cruz";
  $("#seoU").textContent=(d.slug||"...")+".html"; $("#seoD").textContent=d.desc||"A meta descrição aparecerá aqui.";
  var n=(d.desc||"").length; $("#descCount").textContent=n+" caracteres"+(n&&n<50?" — recomendado 50 a 160":(n>160?" — o Google corta depois de ~160":""));
  updateWordCount(); runA11y(d);
  if(!silent) markDirty();
}
function addTag(t){ if(!t)return; var d=state.editing; if(d.tags.indexOf(t)>=0)return; d.tags.push(t); addTagChip(t); if(state.tags.indexOf(t)<0){state.tags.push(t);lsSet("rb_tags",JSON.stringify(state.tags));} markDirty(); }
function addTagChip(t){ var chip=el("span",{class:"chip"},esc(t)+' '); var x=el("button",{"aria-label":"Remover tag "+t},"×"); x.onclick=function(){var d=state.editing;d.tags=d.tags.filter(function(g){return g!==t;});chip.remove();markDirty();}; chip.appendChild(x); $("#sTags").appendChild(chip); }

/* ---- Blocos ---- */
function toggleBlockMenu(){
  var m=$("#blockMenu");
  if(m.innerHTML){m.innerHTML="";return;}
  var wrap=el("div",{class:"block-menu"});
  BLOCK_TYPES.forEach(function(bt){ var b=el("button",null,'<span class="ico">'+bt[2]+'</span>'+esc(bt[1])); b.onclick=function(){addBlock(bt[0]);m.innerHTML="";}; wrap.appendChild(b); });
  m.appendChild(wrap);
}
function newId(){ return "b"+Date.now().toString(36)+Math.floor(Math.random()*1e6).toString(36); }
function addBlock(type,initial,silent){
  var block={id:newId(),type:type,html:initial||"",data:{}};
  edState.blocks.push(block);
  renderBlock(block);
  if(!silent){ markDirty(); var ed=$("#"+block.id+" [contenteditable], #"+block.id+" input, #"+block.id+" textarea"); if(ed) ed.focus(); }
}
function renderBlock(block){
  var host=$("#blocks");
  var wrap=el("div",{class:"block",id:block.id,"data-type":block.type});
  var ctrls=el("div",{class:"block-ctrls"});
  [["↑","Subir",function(){moveBlock(block,-1);}],["↓","Descer",function(){moveBlock(block,1);}],["⧉","Duplicar",function(){dupBlock(block);}],["✕","Excluir bloco",function(){delBlock(block);}]].forEach(function(c){var b=el("button",{title:c[1],"aria-label":c[1]},c[0]);b.onclick=function(e){e.stopPropagation();c[2]();};ctrls.appendChild(b);});
  wrap.appendChild(ctrls);
  wrap.appendChild(blockBody(block));
  host.appendChild(wrap);
  wrap.addEventListener("click",function(){$all(".block.sel").forEach(function(x){x.classList.remove("sel");});wrap.classList.add("sel");edState.selBlock=block;});
}
var INPUT_CSS="background:var(--card);border:1px solid var(--line);border-radius:8px;padding:9px 10px;color:var(--txt)";
function blockBody(block){
  var t=block.type, d=block.data||{}, e;
  if(t==="para"){ e=el("div",{class:"editable block-para",contenteditable:"true","data-ph":"Escreva um parágrafo…"},block.html); }
  else if(t==="h2"){ e=el("div",{class:"editable block-h2",contenteditable:"true","data-ph":"Intertítulo"},block.html); }
  else if(t==="quote"){ e=el("div",{class:"editable block-quote",contenteditable:"true","data-ph":"Citação em destaque"},block.html); }
  else if(t==="ul"||t==="ol"){ e=el(t,{class:"editable block-para",contenteditable:"true"},block.html||"<li>Item da lista</li>"); }
  else if(t==="divider"){ e=el("hr",{style:"border:none;border-top:1px solid var(--line2);margin:10px 0"}); }
  else if(t==="image"){
    e=el("div");
    e.innerHTML='<div class="imgprev" style="border:1px dashed var(--line2);border-radius:8px;padding:'+(d.url?'0':'24px')+';text-align:center;color:var(--dim)">'+(d.url?'<img src="'+esc(absUrl(d.url))+'" alt="" style="border-radius:8px;display:block;width:100%">':'Cole a URL da imagem')+'</div>'+
      '<input class="iurl" placeholder="https://redebolha.com.br/imagem.jpg" value="'+esc(d.url||"")+'" style="width:100%;margin-top:8px;'+INPUT_CSS+'">'+
      '<input class="cap" placeholder="Legenda / crédito (opcional)" value="'+esc(d.cap||"")+'" style="width:100%;margin-top:6px;'+INPUT_CSS+';font-size:.85rem">';
    var url=$(".iurl",e), prev=$(".imgprev",e);
    url.addEventListener("input",function(){ prev.style.padding=url.value?"0":"24px"; prev.innerHTML=url.value?'<img src="'+esc(absUrl(url.value))+'" alt="" style="border-radius:8px;display:block;width:100%">':'Cole a URL da imagem'; });
  }
  else if(t==="cta"){
    e=el("div",{style:"border:1px solid var(--line);background:var(--bg2);border-radius:12px;padding:22px"});
    e.innerHTML='<input class="ctaeb" placeholder="Chapéu da chamada" value="'+esc(d.eyebrow||"Rede Bolha")+'" style="'+INPUT_CSS+';margin-bottom:10px;font-size:.8rem">'+
      '<div class="ctatitle" contenteditable="true" data-ph="Título da chamada" style="font-family:Cormorant Garamond,serif;font-size:1.4rem;color:var(--txt);margin-bottom:8px;outline:none">'+(d.title!=null?d.title:"")+'</div>'+
      '<div class="ctatext" contenteditable="true" data-ph="Texto que convida o leitor à ação." style="margin-bottom:12px;outline:none">'+(d.text!=null?d.text:"")+'</div>'+
      '<input class="btnlbl" placeholder="Texto do botão" value="'+esc(d.lbl!=null?d.lbl:"Quero saber mais")+'" style="'+INPUT_CSS+';margin:0 6px 6px 0"><input class="btnurl" placeholder="URL do botão" value="'+esc(d.url!=null?d.url:"/livros/")+'" style="'+INPUT_CSS+'">';
  }
  else if(t==="button"){ e=el("div"); e.innerHTML='<input class="btnlbl" placeholder="Texto do botão" value="'+esc(d.lbl!=null?d.lbl:"Clique aqui")+'" style="'+INPUT_CSS+';margin:0 6px 6px 0"><input class="btnurl" placeholder="URL" value="'+esc(d.url!=null?d.url:"")+'" style="'+INPUT_CSS+'">'; }
  else if(t==="box"){ e=el("div",{class:"editable",contenteditable:"true","data-ph":"Box informativo: um destaque complementar ao texto.",style:"border:1px solid var(--line);border-left:3px solid var(--gold);background:var(--bg2);border-radius:8px;padding:16px"},block.html); }
  else if(t==="video"){ e=el("div"); e.innerHTML='<input class="vsrc" placeholder="Link do YouTube, Vimeo ou MP4" value="'+esc(d.src||"")+'" style="width:100%;'+INPUT_CSS+'"><div style="margin-top:8px;color:var(--dim);font-size:.85rem">O vídeo será incorporado de forma responsiva.</div>'; }
  else if(t==="embed"){ e=el("textarea",{class:"esrc",placeholder:"Cole o código de incorporação (YouTube, Vimeo ou Spotify)",rows:"4",style:"width:100%;"+INPUT_CSS}); e.value=d.src||""; }
  else if(t==="html"){ e=el("div"); e.innerHTML='<span class="block-tag">Bloco preservado do artigo original (HTML)</span><textarea class="block-html" spellcheck="false"></textarea>'; $("textarea",e).value=block.html||""; }
  else { e=el("div",{class:"editable",contenteditable:"true"},block.html); }
  e.addEventListener("input",function(){ collectBlock(block,e); },true);
  return e;
}
function collectBlock(block,e){
  var t=block.type, d=block.data=block.data||{};
  if(t==="para"||t==="h2"||t==="quote"||t==="box"||t==="ul"||t==="ol"){ block.html=e.innerHTML; }
  else if(t==="image"){ d.url=$(".iurl",e).value.trim(); d.cap=$(".cap",e).value; }
  else if(t==="cta"){ d.eyebrow=$(".ctaeb",e).value; d.title=$(".ctatitle",e).innerHTML; d.text=$(".ctatext",e).innerHTML; d.lbl=$(".btnlbl",e).value; d.url=$(".btnurl",e).value; }
  else if(t==="button"){ d.lbl=$(".btnlbl",e).value; d.url=$(".btnurl",e).value; }
  else if(t==="video"){ d.src=$(".vsrc",e).value.trim(); }
  else if(t==="embed"){ d.src=e.value; }
  else if(t==="html"){ block.html=$("textarea",e).value; }
  updateWordCount(); if(state.editing) runA11y(state.editing); markDirty();
}
function moveBlock(block,dir){ var i=edState.blocks.indexOf(block),j=i+dir; if(j<0||j>=edState.blocks.length)return; edState.blocks.splice(i,1);edState.blocks.splice(j,0,block); rerenderBlocks(); markDirty(); }
function dupBlock(block){ var c=JSON.parse(JSON.stringify(block)); c.id=newId(); var i=edState.blocks.indexOf(block); edState.blocks.splice(i+1,0,c); rerenderBlocks(); markDirty(); }
function delBlock(block){ edState.blocks=edState.blocks.filter(function(b){return b!==block;}); rerenderBlocks(); markDirty(); }
function rerenderBlocks(){ $("#blocks").innerHTML=""; edState.blocks.forEach(renderBlock); updateWordCount(); }
function articleText(){ return stripTags(blocksToHTML().replace(/></g,"> <")); }
function updateWordCount(){ if(!$("#wc"))return; var txt=articleText(); var w=txt.trim().split(/\s+/).filter(Boolean).length; $("#wc").textContent=w+" palavras · "+txt.length+" caracteres"; $("#edRT").textContent=readingTime(txt)+" min"; }

/* ---- Rascunho local (um por artigo) ---- */
function draftKey(d){ return "rb_draft_"+(d.slug||"_novo"); }
function persistLocal(){
  try{ var d=state.editing; if(!d)return;
    lsSet(draftKey(d),JSON.stringify({d:{title:d.title,eyebrow:d.eyebrow,sub:d.sub,author:d.author,slug:d.slug,desc:d.desc,category:d.category,tags:d.tags,status:d.status},blocks:edState.blocks,at:nowISO()}));
  }catch(e){}
}
function applyDraft(d,r){
  ["title","eyebrow","sub","author","desc","category","status"].forEach(function(k){ if(r.d[k]!=null) d[k]=r.d[k]; });
  d.tags=r.d.tags||[]; edState.blocks=r.blocks||[];
  $("#edTitle").value=d.title; $("#edEyebrow").value=d.eyebrow; $("#edSub").value=d.sub||""; $("#sAuthor").value=d.author; $("#edBy").textContent=d.author;
  $("#sDesc").value=d.desc; $("#sStatus").value=d.status; fillCategorySelect(d);
  $("#sTags").innerHTML=""; d.tags.forEach(addTagChip);
  rerenderBlocks();
}
function restoreLocal(d){
  try{
    var r=lsJSON(draftKey(d),null);
    if(!r || !r.blocks || !r.blocks.length) return;
    if(!d.live && d.slug) return; // rascunho local ja foi carregado
    var when=fmtDate(r.at);
    if(confirm("Encontramos uma versão não publicada deste artigo, salva neste navegador em "+when+". Deseja recuperá-la?")){ applyDraft(d,r); syncMeta(d); }
  }catch(e){}
}

/* ---- Acessibilidade ---- */
function runA11y(d){
  var box=$("#a11y"); if(!box)return; var items=[];
  items.push(["Título principal preenchido", !!(d.title&&d.title.length>3)]);
  items.push(["Meta descrição com 50+ caracteres", !!(d.desc&&d.desc.length>=50)]);
  var imgs=edState.blocks.filter(function(b){return b.type==="image"&&b.data&&b.data.url;});
  items.push(["Imagens com legenda/descrição", imgs.every(function(b){return b.data.cap;})]);
  items.push(["Endereço (URL) definido", !!d.slug]);
  items.push(["Intertítulos para organizar o texto", edState.blocks.length<6 || edState.blocks.some(function(b){return b.type==="h2";})]);
  box.innerHTML=items.map(function(it){return '<div class="a11y-item '+(it[1]?"ok":"warn")+'">'+(it[1]?"✓":"!")+' '+esc(it[0])+'</div>';}).join("");
}

/* ---- GERACAO DO HTML (mesmo padrao dos artigos atuais do site) ---- */
function blocksToHTML(){
  return edState.blocks.map(function(b){
    var t=b.type,d=b.data||{};
    if(t==="para") return (b.html||"").replace(/<br\s*\/?>$/,"").trim()?"<p>"+b.html.replace(/<br\s*\/?>$/,"")+"</p>":"";
    if(t==="h2") return stripTags(b.html).trim()?"<h2>"+b.html+"</h2>":"";
    if(t==="quote") return stripTags(b.html).trim()?"<blockquote>"+b.html+"</blockquote>":"";
    if(t==="ul") return "<ul>"+(b.html||"")+"</ul>";
    if(t==="ol") return "<ol>"+(b.html||"")+"</ol>";
    if(t==="box") return '<div class="box" style="border:1px solid rgba(255,223,0,.18);border-left:3px solid #FFDF00;background:#08142D;border-radius:8px;padding:16px;margin:22px 0">'+(b.html||"")+"</div>";
    if(t==="divider") return '<hr style="border:none;border-top:1px solid rgba(255,223,0,.18);margin:32px 0">';
    if(t==="image"){ if(!d.url)return ""; return '<figure style="margin:26px 0"><img class="hero-img" src="'+esc(d.url)+'" alt="'+esc(d.cap||"")+'" loading="lazy">'+(d.cap?'<figcaption style="color:#93A0B8;font-size:.85rem;margin-top:6px">'+esc(d.cap)+"</figcaption>":"")+"</figure>"; }
    if(t==="button"){ return d.url?'<p><a class="btn" href="'+esc(d.url)+'">'+esc(d.lbl||"Saiba mais")+"</a></p>":""; }
    if(t==="cta"){ return '<div class="cta">\n<p class="eyebrow">'+esc(d.eyebrow||"Rede Bolha")+'</p>\n<h3>'+esc(stripTags(d.title||""))+"</h3>\n<p>"+(d.text||"")+'</p>\n<a class="btn" href="'+esc(d.url||"/livros/")+'">'+esc(d.lbl||"Saiba mais")+"</a>\n</div>"; }
    if(t==="video"){ return videoEmbed(d.src||""); }
    if(t==="embed"){ return d.src?sanitizeEmbed(d.src):""; }
    if(t==="html"){ return b.html||""; }
    return "";
  }).filter(Boolean).join("\n\n");
}
function videoEmbed(src){
  if(!src)return "";
  var yt=src.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  if(yt) return '<div style="position:relative;padding-bottom:56.25%;height:0;margin:24px 0"><iframe src="https://www.youtube.com/embed/'+yt[1]+'" style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:8px" allowfullscreen loading="lazy" title="Vídeo"></iframe></div>';
  var vm=src.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if(vm) return '<div style="position:relative;padding-bottom:56.25%;height:0;margin:24px 0"><iframe src="https://player.vimeo.com/video/'+vm[1]+'" style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:8px" allowfullscreen loading="lazy" title="Vídeo"></iframe></div>';
  if(/\.mp4($|\?)/.test(src)) return '<video controls preload="none" style="width:100%;border-radius:8px;margin:24px 0"><source src="'+esc(src)+'" type="video/mp4"></video>';
  return "";
}
function sanitizeEmbed(code){
  var ok=/^<iframe[^>]+src="https:\/\/(www\.)?(youtube\.com|player\.vimeo\.com|open\.spotify\.com)\/[^"]*"[^>]*>\s*<\/iframe>$/.test(code.trim());
  return ok? code.trim() : '<p style="color:#93A0B8">[Incorporação bloqueada por segurança]</p>';
}
function firstImage(){ var b=edState.blocks.filter(function(x){return x.type==="image"&&x.data&&x.data.url;})[0]; return b?b.data.url:null; }

function buildArticleHTML(d){
  var title=d.title||"Sem título";
  var desc=d.desc||"";
  var ogDesc=(d.ogDesc && d.desc===d.descOrig)?d.ogDesc:desc;
  var url=SITE+"/artigos/"+d.slug+".html";
  var pub=d.published||nowISO();
  var cover=absUrl(d.ogImage||firstImage()||"");
  var art={"@type":"Article","headline":title,"description":desc,"author":{"@type":"Person","name":d.author,"url":SITE+"/sobre-o-autor.html"},"publisher":{"@type":"Organization","name":"Rede Bolha","url":SITE+"/","logo":{"@type":"ImageObject","url":SITE+"/icon-512.png"}},"mainEntityOfPage":{"@type":"WebPage","@id":url},"datePublished":pub,"dateModified":nowISO(),"inLanguage":"pt-BR","url":url};
  if(cover) art.image=cover;
  if(d.tags && d.tags.length) art.keywords=d.tags.join(", ");
  var jsonld={"@context":"https://schema.org","@graph":[art,
    {"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Início","item":SITE+"/"},{"@type":"ListItem","position":2,"name":"Artigos","item":SITE+"/artigos/"},{"@type":"ListItem","position":3,"name":title,"item":url}]}
  ]};
  var body=blocksToHTML();
  var year=new Date().getFullYear();
  return '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n'+
    '  <!-- Google tag (gtag.js) --><script async src="https://www.googletagmanager.com/gtag/js?id='+GA_ID+'"></'+'script><script>window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag(\'js\', new Date());gtag(\'config\', \''+GA_ID+'\');</'+'script>\n'+
    '  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+ADS_CLIENT+'" crossorigin="anonymous"></'+'script>\n'+
    '<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'+
    '<title>'+esc(title)+' | Adm. Romário Cruz</title>\n'+
    '<meta name="description" content="'+esc(desc)+'">\n'+
    '<link rel="canonical" href="'+url+'">\n'+
    '<meta property="og:type" content="article">\n'+
    '<meta property="og:title" content="'+esc(title)+'">\n'+
    '<meta property="og:description" content="'+esc(ogDesc)+'">\n'+
    '<meta property="og:url" content="'+url+'">\n'+
    (cover?'<meta property="og:image" content="'+esc(cover)+'">\n':'')+
    '<link rel="stylesheet" href="blog.css">\n'+
    '<script type="application/ld+json">\n'+JSON.stringify(jsonld,null,2)+'\n</'+'script>\n'+
    '<link rel="stylesheet" href="/css/brasil.css">\n'+
    '</head>\n<body'+(d.tema?' data-tema="'+esc(d.tema)+'"':'')+'>\n'+
    '<header class="topbar"><div class="wrap">\n<a class="brand" href="/"><b>Rede</b> Bolha</a>\n'+
    '<nav class="topnav"><a href="/financas/">Homem e Dinheiro</a> <a href="/masculinidade/">Masculinidade</a> <a href="/economia/">Economia</a> <a href="/ferramentas/">Ferramentas</a> <a href="/artigos/" aria-current="page">Artigos</a> <a href="/sobre-o-autor.html">Sobre</a> <a class="rb-entrar" href="/a-carta/">A Carta</a></nav>\n'+
    '</div></header>\n'+
    '<main class="wrap">\n<article>\n'+
    (d.eyebrow?'<p class="eyebrow">'+esc(d.eyebrow)+'</p>\n':'')+
    '<h1>'+esc(title)+'</h1>\n'+
    (d.sub?'<p class="lead">'+esc(d.sub)+'</p>\n':'')+
    '<p class="byline">Por '+esc(d.author)+' · Leitura de '+readingTime(stripTags(body))+' minutos</p>\n\n'+
    body+'\n\n'+
    '<p class="sign">— '+esc(d.author)+'</p>\n'+
    '<p class="back"><a href="/artigos/">← Voltar para todos os artigos</a></p>\n'+
    '</article>\n</main>\n'+
    '<footer class="foot"><div class="wrap">© '+year+' Adm. Romário Cruz · Eldorado do Sul, RS · <a href="/">redebolha.com.br</a></div><p class="rb-assina-expediente" style="margin:1rem auto 0;max-width:60ch;font-size:.78rem;line-height:1.6;opacity:.7;text-align:center">Conteúdo apurado e editado por <b>Adm. Romário Cruz</b>, jornalista registrado — MTb 0021682/RS. &middot; <a href="/expediente/">Expediente e política editorial</a></p>\n'+
    '</footer>\n'+
    '<script src="/js/patrocinio.js" defer></'+'script>\n'+
    '<script src="/js/newsletter.js" defer></'+'script>\n'+
    '</body>\n</html>\n';
}

/* ---- Lista /artigos/, sitemap e feed ---- */
function cardHTML(d){
  return '<div class="post">\n<span class="tag">'+esc(d.eyebrow||d.category||"Artigo")+'</span>\n<h2><a href="/artigos/'+d.slug+'.html">'+esc(d.title)+'</a></h2>\n<p>'+esc(d.desc)+'</p>\n<a class="more" href="/artigos/'+d.slug+'.html">Ler artigo →</a>\n</div>';
}
function findCard(html,slug){
  var href='href="/artigos/'+slug+'.html"', i=html.indexOf(href); if(i<0) return null;
  var s=html.lastIndexOf('<div class="post">',i); var e=html.indexOf('</div>',i);
  if(s<0||e<0) return null; return {start:s,end:e+6};
}
function upsertCard(html,d,isNew){
  var c=findCard(html,d.slug);
  if(c){
    // troca so o que mudou, para nao apagar o resumo escrito a mao na lista
    var card=html.slice(c.start,c.end);
    if((d.eyebrow||"")!==(d.eyebrowOrig||"")) card=card.replace(/<span class="tag">[\s\S]*?<\/span>/,function(){return '<span class="tag">'+esc(d.eyebrow||d.category||"Artigo")+'</span>';});
    if(d.title!==d.titleOrig) card=card.replace(/(<h2><a [^>]*>)[\s\S]*?(<\/a><\/h2>)/,function(_,a,b){return a+esc(d.title)+b;});
    if(d.desc!==d.descOrig) card=card.replace(/<p>[\s\S]*?<\/p>/,function(){return '<p>'+esc(d.desc)+'</p>';});
    return html.slice(0,c.start)+card+html.slice(c.end);
  }
  if(!isNew) return html;
  var first=html.indexOf('<div class="post">');
  if(first<0) first=html.indexOf('</main>');
  if(first<0) return html;
  return html.slice(0,first)+cardHTML(d)+"\n\n"+html.slice(first);
}
function removeCard(html,slug){
  var c=findCard(html,slug); if(!c) return html;
  return html.slice(0,c.start)+html.slice(c.end).replace(/^\s*\n/,"");
}
function upsertSitemap(xml,url){
  var loc="<loc>"+url+"</loc>", i=xml.indexOf(loc), today=todayISO();
  if(i>=0){
    var end=xml.indexOf("</url>",i); var seg=xml.slice(i,end);
    var seg2=/<lastmod>[^<]*<\/lastmod>/.test(seg)?seg.replace(/<lastmod>[^<]*<\/lastmod>/,"<lastmod>"+today+"</lastmod>"):seg;
    return xml.slice(0,i)+seg2+xml.slice(end);
  }
  var block="    <url>\n        "+loc+"\n        <lastmod>"+today+"</lastmod>\n        <changefreq>weekly</changefreq>\n        <priority>0.9</priority>\n    </url>\n";
  var j=xml.lastIndexOf("</urlset>"); if(j<0) return xml;
  return xml.slice(0,j)+block+xml.slice(j);
}
function removeSitemap(xml,url){
  var i=xml.indexOf("<loc>"+url+"</loc>"); if(i<0) return xml;
  var s=xml.lastIndexOf("<url>",i), e=xml.indexOf("</url>",i); if(s<0||e<0) return xml;
  var ls=xml.lastIndexOf("\n",s)+1; var le=xml.indexOf("\n",e); le = le<0 ? e+6 : le+1;
  return xml.slice(0,ls)+xml.slice(le);
}
function upsertFeed(xml,d,url,isNew){
  if(xml.indexOf("<link>"+url+"</link>")>=0 || !isNew) return xml;
  var item="    <item>\n      <title>"+esc(d.title)+"</title>\n      <link>"+url+"</link>\n      <guid isPermaLink=\"true\">"+url+"</guid>\n      <description>"+esc(d.desc)+"</description>\n      <category>"+esc(d.eyebrow||d.category||"Artigos")+"</category>\n      <dc:creator>"+esc(d.author)+"</dc:creator>\n      <pubDate>"+rfc822(d.published)+"</pubDate>\n    </item>\n";
  var k=xml.indexOf("</image>"); var at;
  if(k>=0){ at=xml.indexOf("\n",k)+1; } else { at=xml.indexOf("<item>"); if(at>=0) at=xml.lastIndexOf("\n",at)+1; }
  if(at<=0) return xml;
  xml=xml.slice(0,at)+item+xml.slice(at);
  return xml.replace(/<lastBuildDate>[^<]*<\/lastBuildDate>/,"<lastBuildDate>"+rfc822()+"</lastBuildDate>");
}
function removeFeedItem(xml,url){
  var i=xml.indexOf("<link>"+url+"</link>"); if(i<0) return xml;
  var s=xml.lastIndexOf("<item>",i), e=xml.indexOf("</item>",i); if(s<0||e<0) return xml;
  var ls=xml.lastIndexOf("\n",s)+1; var le=xml.indexOf("\n",e); le = le<0 ? e+7 : le+1;
  return xml.slice(0,ls)+xml.slice(le);
}

/* ---- Prévia responsiva ---- */
function openPreview(d){
  syncMeta(d,true);
  var html=buildArticleHTML(d)
    .replace(/<!-- Google tag[^\n]*\n/,"")
    .replace(/<script async src="https:\/\/pagead2[^\n]*\n/,"")
    .replace("<head>",'<head>\n<base href="'+SITE+'/artigos/">');
  openModal('<button class="close" id="pvX" aria-label="Fechar">×</button><h3 class="serif">Pré-visualização</h3>'+
    '<div class="dev-tabs"><button data-w="100%" class="active">Computador</button><button data-w="768px">Tablet</button><button data-w="390px">Celular</button></div>'+
    '<div style="display:flex;justify-content:center"><iframe class="preview-frame" id="pvFrame" title="Pré-visualização do artigo"></iframe></div>',
    function(m){
      $("#pvX",m).onclick=closeModal;
      var frame=$("#pvFrame",m);
      frame.srcdoc=html;
      $all(".dev-tabs button",m).forEach(function(b){b.onclick=function(){$all(".dev-tabs button",m).forEach(function(x){x.classList.remove("active");});b.classList.add("active");frame.style.width=b.getAttribute("data-w");};});
    },true);
}

/* ---- Salvar rascunho (so neste navegador; nao mexe no site) ---- */
function saveDraft(d,auto){
  syncMeta(d,true);
  if(!d.slug){ if(!auto) toast("Defina um endereço (URL) antes de salvar.","err"); persistLocal(); return; }
  d.file=d.slug+".html"; d.updated=nowISO();
  var existing=state.articles.filter(function(a){return a.file===d.file;})[0];
  var st=d.status==="published"?"draft":d.status;
  if(existing){ existing.title=d.title;existing.author=d.author;existing.category=d.category;existing.status=st;existing.updated=d.updated;existing.cover=firstImage()||existing.cover; }
  else { state.articles.push({file:d.file,sha:null,path:"artigos/"+d.file,slug:d.slug,live:false,title:d.title,author:d.author,category:d.category,status:st,published:null,updated:d.updated,cover:firstImage()}); }
  saveIndex();
  lsDel("rb_draft__novo"); persistLocal();
  var s=$("#saveStatus"); if(s){s.textContent="Rascunho salvo neste navegador ✓";s.classList.add("saved");}
  edState.dirty=false;
  if(!auto){ logActivity("save","Rascunho salvo: “"+d.title+"”"); toast("Rascunho salvo neste navegador. O site só muda quando você publicar.","ok"); }
}

/* ---- Publicar (UM commit: artigo + lista + sitemap + feed) ---- */
function publishArticle(d){
  syncMeta(d,true);
  if(!d.title.trim()){ toast("Informe o título do artigo.","err"); return; }
  if(!d.slug){ toast("Informe o endereço (URL) do artigo.","err"); return; }
  if(!blocksToHTML().trim()){ toast("O artigo está sem texto.","err"); return; }
  var warnings=[];
  if(!d.desc||d.desc.length<50) warnings.push("A meta descrição está curta (recomendado 50+ caracteres).");
  var imgsNoCap=edState.blocks.filter(function(b){return b.type==="image"&&b.data&&b.data.url&&!b.data.cap;}).length;
  if(imgsNoCap) warnings.push(imgsNoCap+" imagem(ns) sem legenda/descrição.");
  if(!d.live && state.articles.some(function(a){return a.live && a.slug===d.slug;})) warnings.push("Já existe um artigo publicado com este endereço — ele será substituído.");
  openModal('<button class="close" id="cX" aria-label="Fechar">×</button><h3 class="serif">'+(d.live?"Atualizar artigo no site":"Publicar artigo")+'</h3>'+
    '<p style="color:var(--body);margin:8px 0 14px">Isto grava <strong style="color:var(--txt)">artigos/'+esc(d.slug)+'.html</strong> no site'+(d.live?'':' e coloca o artigo na lista de artigos, no sitemap e no feed')+'.</p>'+
    (warnings.length?'<div class="msg warn">Recomendações (não impedem a publicação):<ul style="margin:6px 0 0 18px">'+warnings.map(function(w){return "<li>"+esc(w)+"</li>";}).join("")+'</ul></div>':'')+
    '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap"><button class="btn ghost" id="cCancel">Cancelar</button><button class="btn" id="cGo">'+(d.live?"Atualizar agora":"Publicar agora")+'</button></div>',
    function(m){
      $("#cX",m).onclick=closeModal; $("#cCancel",m).onclick=closeModal;
      $("#cGo",m).onclick=function(){ doPublish(d); };
    });
}
function doPublish(d){
  var btn=$("#cGo"); if(btn){btn.disabled=true;btn.textContent="Publicando…";}
  var file="artigos/"+d.slug+".html", url=SITE+"/artigos/"+d.slug+".html";
  var wasNew=false;
  ghCommitEdit([file,"artigos/index.html","sitemap.xml","feed.xml"],function(f){
    wasNew = f[file]==null;
    if(!wasNew && !d.published){ try{ var old=extractMeta(f[file]); d.published=old.published||null; }catch(e){} }
    if(!d.published) d.published=nowISO();
    var html=buildArticleHTML(d);
    var ch=[{path:file,content:html}];
    // na lista /artigos/, artigo existente so muda se titulo, chapeu ou resumo mudaram
    var cardChanged = wasNew || d.title!==d.titleOrig || d.desc!==d.descOrig || (d.eyebrow||"")!==(d.eyebrowOrig||"");
    if(cardChanged && f["artigos/index.html"]!=null){ var n=upsertCard(f["artigos/index.html"],d,wasNew); if(n!==f["artigos/index.html"]) ch.push({path:"artigos/index.html",content:n}); }
    if(f["sitemap.xml"]!=null){ var s=upsertSitemap(f["sitemap.xml"],url); if(s!==f["sitemap.xml"]) ch.push({path:"sitemap.xml",content:s}); }
    if(f["feed.xml"]!=null){ var x=upsertFeed(f["feed.xml"],d,url,wasNew); if(x!==f["feed.xml"]) ch.push({path:"feed.xml",content:x}); }
    return ch;
  },(d.live?"Atualiza artigo: ":"Publica artigo: ")+d.title+" (via Painel Rede Bolha)").then(function(){
    logActivity("publish",(wasNew?"Publicou":"Atualizou")+" “"+d.title+"”");
    d.status="published"; d.live=true; d.file=d.slug+".html";
    var meta={title:d.title,eyebrow:d.eyebrow,desc:d.desc,cover:absUrl(d.ogImage||firstImage()||""),author:d.author,published:d.published,modified:nowISO(),sha:"?"};
    var cache=lsJSON("rb_meta",{}); cache[d.file]=meta; lsSet("rb_meta",JSON.stringify(cache));
    var a=state.articles.filter(function(x){return x.file===d.file;})[0];
    if(!a){ a={file:d.file,path:file,slug:d.slug}; state.articles.push(a); }
    a.live=true; a.status="published"; a.title=d.title; a.author=d.author; a.category=d.eyebrow||d.category; a.updated=meta.modified; a.published=d.published; a.cover=meta.cover;
    saveIndex();
    lsDel(draftKey(d)); lsDel("rb_draft__novo");
    edState.dirty=false;
    closeModal();
    showPublished(d,wasNew);
  }).catch(function(e){ toast("Falha ao publicar: "+e.message,"err"); if(btn){btn.disabled=false;btn.textContent="Tentar de novo";} });
}
function showPublished(d,wasNew){
  var link=SITE+"/artigos/"+d.slug+".html";
  openModal('<h3 class="serif">✓ '+(wasNew?"Publicado":"Atualizado")+' com sucesso!</h3>'+
    '<p style="color:var(--body);margin:10px 0 14px">O GitHub Pages leva de 1 a 2 minutos para colocar no ar.'+(wasNew?' O artigo já entrou na lista de artigos, no sitemap e no feed.':'')+'</p>'+
    '<div class="field"><input readonly value="'+esc(link)+'" id="pubLink" aria-label="Endereço do artigo"></div>'+
    '<div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn" href="'+link+'" target="_blank" rel="noopener">Abrir artigo</a><button class="btn ghost" id="copyLink">Copiar endereço</button><a class="btn ghost" href="https://wa.me/?text='+encodeURIComponent(d.title+" "+link)+'" target="_blank" rel="noopener">WhatsApp</a><button class="btn ghost" id="pubDone">Concluir</button></div>',
    function(m){
      $("#copyLink",m).onclick=function(){ try{ navigator.clipboard.writeText(link); toast("Endereço copiado.","ok"); }catch(e){ $("#pubLink",m).select(); } };
      $("#pubDone",m).onclick=function(){ closeModal(); leaveEditor(); go("articles"); };
    });
}

/* ---- Abrir artigo publicado no editor (sem perder nada) ---- */
function parseArticleIntoEditor(html,d){
  try{
    var doc=new DOMParser().parseFromString(html,"text/html");
    var art=doc.querySelector("article");
    var meta=extractMeta(html);
    d.title=meta.title||d.title; d.titleOrig=d.title; d.desc=meta.desc; d.descOrig=meta.desc; d.published=meta.published||null;
    var ogd=doc.querySelector('meta[property="og:description"]'); d.ogDesc=ogd?ogd.getAttribute("content")||"":"";
    var ogi=doc.querySelector('meta[property="og:image"]'); d.ogImage=ogi?ogi.getAttribute("content")||"":"";
    d.tema=doc.body?(doc.body.getAttribute("data-tema")||""):"";
    if(meta.author) d.author=meta.author;
    edState.blocks=[];
    var seenEyebrow=false;
    if(art){ Array.prototype.forEach.call(art.children,function(node){
      var tag=node.tagName.toLowerCase(), cls=node.getAttribute("class")||"", plain=node.attributes.length===0;
      if(tag==="h1") return;
      if(tag==="p" && cls==="eyebrow" && !seenEyebrow){ seenEyebrow=true; d.eyebrow=node.textContent.trim(); d.eyebrowOrig=d.eyebrow; return; }
      if(tag==="p" && cls==="byline") return;
      if(tag==="p" && cls==="lead"){ d.sub=node.textContent.trim(); return; }
      if(tag==="p" && (cls==="sign"||cls==="back")) return;
      var push=function(type,h,data){ edState.blocks.push({id:newId(),type:type,html:h||"",data:data||{}}); };
      if(tag==="p" && plain) push("para",node.innerHTML.trim());
      else if(tag==="h2" && plain) push("h2",node.innerHTML.trim());
      else if(tag==="blockquote" && plain) push("quote",node.innerHTML.trim());
      else if((tag==="ul"||tag==="ol") && plain) push(tag,node.innerHTML.trim());
      else if(tag==="hr") push("divider");
      else if(tag==="div" && cls==="box") push("box",node.innerHTML.trim());
      else if(tag==="figure" && node.querySelectorAll("img").length===1 && node.children.length<=2 && (node.children.length===1 || node.querySelector("figcaption"))){
        var img=node.querySelector("img"); push("image","",{url:img.getAttribute("src")||"",cap:(node.querySelector("figcaption")||{}).textContent||img.getAttribute("alt")||""});
      }
      else push("html",node.outerHTML);
    }); }
    $("#edTitle").value=d.title; $("#edEyebrow").value=d.eyebrow; $("#edSub").value=d.sub||""; $("#sDesc").value=d.desc;
    $("#sAuthor").value=d.author; $("#edBy").textContent=d.author;
    if(d.eyebrow){ d.category=d.eyebrow; fillCategorySelect(d); }
    rerenderBlocks();
  }catch(e){ toast("Aviso ao abrir: "+e.message,"err"); }
}

/* ===================================================================
   MODAIS
   =================================================================== */
var modalKeyHandler=null;
function openModal(inner,after,wide){
  closeModal();
  var bg=el("div",{class:"modal-bg"});
  var m=el("div",{class:"modal"+(wide?" wide":""),role:"dialog","aria-modal":"true"},inner);
  bg.appendChild(m); $("#modals").appendChild(bg);
  bg.addEventListener("click",function(e){if(e.target===bg)closeModal();});
  modalKeyHandler=function(e){ if(e.key==="Escape") closeModal(); };
  document.addEventListener("keydown",modalKeyHandler);
  if(after)after(m);
  var f=$("button, input, a",m); if(f) try{ f.focus(); }catch(e){}
}
function closeModal(){ var b=$("#modals"); if(b)b.innerHTML=""; if(modalKeyHandler){ document.removeEventListener("keydown",modalKeyHandler); modalKeyHandler=null; } }

/* ===================================================================
   CATEGORIAS
   =================================================================== */
function viewCategories(v){
  v.innerHTML='<div class="toolbar"><input type="search" id="cq" placeholder="Buscar categoria…" aria-label="Buscar categoria"><button class="btn" id="addCat">+ Nova categoria</button></div>'+
    '<p class="muted">As categorias aparecem como “chapéu” no topo de cada artigo e na lista de artigos do site.</p>'+
    '<div class="panel" style="padding:0;overflow-x:auto"><table><thead><tr><th>Nome</th><th>Artigos</th><th></th></tr></thead><tbody id="catBody"></tbody></table></div>';
  $("#addCat").onclick=function(){ var n=prompt("Nome da nova categoria:"); if(!n)return; n=n.trim(); if(allCategories().map(function(c){return c.toLowerCase();}).indexOf(n.toLowerCase())>=0){toast("Categoria já existe.","err");return;} state.categories.push(n); lsSet("rb_cats",JSON.stringify(state.categories)); renderCats(); toast("Categoria criada.","ok"); };
  $("#cq").oninput=renderCats; renderCats();
}
function renderCats(){
  var q=(($("#cq")||{}).value||"").toLowerCase();
  var tb=$("#catBody"); if(!tb) return; tb.innerHTML="";
  allCategories().filter(function(c){return c.toLowerCase().indexOf(q)>=0;}).forEach(function(c){
    var count=state.articles.filter(function(a){return a.category===c;}).length;
    var custom=state.categories.indexOf(c)>=0;
    var tr=el("tr"); tr.innerHTML='<td style="color:var(--txt)">'+esc(c)+'</td><td>'+count+'</td><td style="text-align:right"></td>';
    var td=tr.lastChild;
    if(custom && !count){ var x=el("button",{class:"btn danger sm"},"Excluir"); x.onclick=function(){if(confirm("Excluir a categoria “"+c+"”?")){state.categories=state.categories.filter(function(g){return g!==c;});lsSet("rb_cats",JSON.stringify(state.categories));renderCats();}}; td.appendChild(x); }
    else if(count){ var f=el("button",{class:"btn ghost sm"},"Ver artigos"); f.onclick=function(){ go("articles"); var s=$("#fcat"); if(s){ s.value=c; renderArtRows(); } }; td.appendChild(f); }
    tb.appendChild(tr);
  });
}

/* ===================================================================
   TAGS
   =================================================================== */
function viewTags(v){
  v.innerHTML='<div class="panel"><h3>Tags</h3><p class="muted">As tags entram nos dados para o Google (palavras-chave) dos artigos publicados pelo painel.</p><div class="chips" id="tagChips"></div><div class="field" style="margin-top:16px"><input id="newTag" placeholder="Nova tag + Enter" aria-label="Nova tag"></div></div>';
  var render=function(){ var c=$("#tagChips"); c.innerHTML=""; if(!state.tags.length)c.innerHTML='<span class="muted">Nenhuma tag ainda.</span>'; state.tags.forEach(function(t){var chip=el("span",{class:"chip"},esc(t)+" ");var x=el("button",{"aria-label":"Remover tag "+t},"×");x.onclick=function(){state.tags=state.tags.filter(function(g){return g!==t;});lsSet("rb_tags",JSON.stringify(state.tags));render();};chip.appendChild(x);c.appendChild(chip);}); };
  $("#newTag").onkeydown=function(e){if(e.key==="Enter"){var t=this.value.trim();if(t&&state.tags.indexOf(t)<0){state.tags.push(t);lsSet("rb_tags",JSON.stringify(state.tags));}this.value="";render();}};
  render();
}

/* ===================================================================
   BIBLIOTECA DE MIDIA (lista imagens do repositorio)
   =================================================================== */

   function viewMedia(v){
        v.innerHTML='<div class="toolbar"><input type="search" id="mq" placeholder="Buscar mídia…"><span style="color:var(--dim);font-size:.85rem">Fotos da galeria (/fotos) — clique para ajustar o enquadramento, ou no × para excluir</span><label class="btn ghost sm" style="margin-left:auto;cursor:pointer">Enviar fotos<input type="file" id="mUpload" accept="image/*" multiple style="display:none"></label></div><div id="mediaGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px"></div>';
        var grid=$("#mediaGrid"); grid.innerHTML='<p class="empty">Carregando…</p>';
        function loadGrid(){
               grid.innerHTML='<p class="empty">Carregando…</p>';
               Promise.all([ghListDir("fotos"),ghContent("fotos/index.html")]).then(function(res){
                        var items=res[0], fd=res[1];
                        var html=b64decode(fd.content);
                        var imgs=items.filter(function(f){return /\.(jpe?g|png|gif|webp)$/i.test(f.name);});
                        grid.innerHTML="";
                        if(!imgs.length){grid.innerHTML='<p class="empty">Nenhuma foto em /fotos.</p>';return;}
                        imgs.sort(function(a,b){return a.name.localeCompare(b.name);});
                        imgs.forEach(function(f){
                                   var re=new RegExp("/fotos/"+f.name.replace(/\./g,"\\.")+'"[^>]*?object-position:([^;]+);');
                                   var m=re.exec(html);
                                   var pos=m?m[1].trim():"top";
                                   var card=el("div",{class:"panel",style:"padding:8px;position:relative"});
                                   var delBtn=el("button",{"aria-label":"Excluir "+f.name,title:"Excluir foto",style:"position:absolute;top:6px;right:6px;z-index:2;width:26px;height:26px;border-radius:50%;background:rgba(5,14,34,.72);color:#fff;border:1px solid rgba(255,255,255,.3);font-size:15px;line-height:1;cursor:pointer"},"×");
                                   delBtn.onclick=function(e){e.stopPropagation();confirmDeletePhoto(f.name,f.sha);};
                                   var img=el("img",{src:SITE+"/fotos/"+f.name,alt:f.name,style:"width:100%;aspect-ratio:1/1;object-fit:cover;object-position:"+pos+";border-radius:6px;cursor:pointer"});
                                   img.onclick=function(){openCropEditor(f.name,pos,f.sha);};
                                   var label=el("div",{style:"font-size:.72rem;color:var(--dim);margin-top:6px;word-break:break-all"},esc(f.name));
                                   card.appendChild(delBtn); card.appendChild(img); card.appendChild(label);
                                   grid.appendChild(card);
                        });
               }).catch(function(e){grid.innerHTML='<p class="empty">Erro: '+esc(e.message)+'</p>';});
        }
        loadGrid();
        function deletePhoto(filename,sha){
               return ghContent("fotos/index.html").then(function(fd){
                        var html=b64decode(fd.content);
                        var re=new RegExp('\\n?<img\\b[^>]*\\bsrc="/fotos/'+reEsc(filename)+'"[^>]*>');
                        if(!re.test(html))return null;
                        var newHtml=html.replace(re,"");
                        return ghPut("fotos/index.html",newHtml,"Remove foto "+filename+" da galeria (via Painel Rede Bolha)",fd.sha);
               }).then(function(){
                        return ghDelete("fotos/"+filename,"Exclui foto "+filename+" (via Painel Rede Bolha)",sha);
               });
        }
        function confirmDeletePhoto(filename,sha){
               openModal('<h3>Excluir foto definitivamente?</h3><p style="color:var(--body);margin:10px 0 18px">"'+esc(filename)+'" será removida do repositório e some do site assim que a alteração for publicada. Diferente de "Cancelar", esta ação não fica só no navegador — é possível reverter depois pelo histórico do GitHub, mas não por aqui.</p>'+
                        '<div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn ghost" id="cMD">Cancelar</button><button class="btn danger" id="okMD">Sim, excluir</button></div>',
                        function(m){
                                   $("#cMD",m).onclick=closeModal;
                                   $("#okMD",m).onclick=function(){
                                                var btn=$("#okMD",m); btn.disabled=true; btn.textContent="Excluindo…";
                                                deletePhoto(filename,sha).then(function(){
                                                               toast("Foto excluída.","ok");
                                                               closeModal();
                                                               loadGrid();
                                                }).catch(function(e){
                                                               toast("Falha ao excluir: "+e.message,"err");
                                                               btn.disabled=false; btn.textContent="Sim, excluir";
                                                });
                                   };
                        });
        }
        $("#mq").oninput=function(){
               var q=this.value.toLowerCase();
               $all("#mediaGrid .panel").forEach(function(c){c.style.display=c.textContent.toLowerCase().indexOf(q)>-1?"":"none";});
        };
        $("#mUpload").onchange=function(e){
               var files=Array.prototype.slice.call(e.target.files||[]);
               if(!files.length)return;
               uploadPhotos(files);
               e.target.value="";
        };
        function openCropEditor(filename,currentPos,sha){
               var py=50;
               var mPos=/center\s+(\d+)%/.exec(currentPos||"");
               if(mPos)py=parseInt(mPos[1],10);
               else if((currentPos||"").trim()==="top")py=0;
               var inner='<h3 style="margin-top:0">Ajustar enquadramento</h3><p style="color:var(--dim);font-size:.85rem;margin-top:-8px">'+esc(filename)+'</p><div style="display:flex;justify-content:center;margin:14px 0"><img id="cropPreview" src="'+SITE+'/fotos/'+filename+'" style="width:280px;height:280px;object-fit:cover;object-position:center '+py+'%;border-radius:8px;background:#000"></div><label style="font-size:.8rem;color:var(--dim)">Posição vertical (rosto e livro visíveis)</label><input type="range" id="cropRange" min="0" max="100" value="'+py+'" style="width:100%"><div style="text-align:center;font-size:.8rem;color:var(--dim);margin-top:4px" id="cropVal">'+py+'%</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button class="btn danger" id="cropDelete" style="margin-right:auto;white-space:nowrap">Excluir foto</button><button class="btn ghost" id="cropCancel">Cancelar</button><button class="btn" id="cropSave">Salvar</button></div>';
               openModal(inner,function(m){
                        var range=$("#cropRange",m),preview=$("#cropPreview",m),val=$("#cropVal",m);
                        range.oninput=function(){preview.style.objectPosition="center "+range.value+"%";val.textContent=range.value+"%";};
                        $("#cropCancel",m).onclick=closeModal;
                        $("#cropDelete",m).onclick=function(){closeModal();confirmDeletePhoto(filename,sha);};
                        $("#cropSave",m).onclick=function(){
                                   var btn=$("#cropSave",m); btn.disabled=true; btn.textContent="Salvando…";
                                   var newPos="center "+range.value+"%";
                                   ghContent("fotos/index.html").then(function(fd){
                                                var html=b64decode(fd.content);
                                                var re=new RegExp('(/fotos/'+filename.replace(/\./g,"\\.")+'"[^>]*?object-position:)[^;]+(;)');
                                                if(!re.test(html))throw new Error("Não encontrei a foto no arquivo.");
                                                var newHtml=html.replace(re,"$1"+newPos+"$2");
                                                return ghPut("fotos/index.html",newHtml,"Ajusta enquadramento de "+filename+" (via Painel Rede Bolha)",fd.sha);
                                   }).then(function(){
                                                toast("Enquadramento atualizado.","ok");
                                                closeModal();
                                                loadGrid();
                                   }).catch(function(e){
                                                toast("Falha ao salvar: "+e.message,"err");
                                                btn.disabled=false; btn.textContent="Salvar";
                                   });
                        };
               });
        }
        function uploadPhotos(files){
               toast("Enviando "+files.length+" foto(s)…","");
               var chain=Promise.resolve();
               files.forEach(function(file){
                        chain=chain.then(function(){
                                   return new Promise(function(resolve,reject){
                                                var reader=new FileReader();
                                                reader.onload=function(){
                                                               var base64=String(reader.result).split(",")[1];
                                                               var filename=file.name.replace(/[^a-zA-Z0-9._-]/g,"-");
                                                               gh("/repos/"+REPO.owner+"/"+REPO.name+"/contents/fotos/"+filename,{method:"PUT",body:{message:"Adiciona foto "+filename+" (via Painel Rede Bolha)",content:base64,branch:REPO.branch}}).then(function(){
                                                                                return ghContent("fotos/index.html");
                                                               }).then(function(fd){
                                                                                var html=b64decode(fd.content);
                                                                                var marker="\n</div>\n</article>";
                                                                                if(html.indexOf(marker)===-1)throw new Error("Não encontrei o final da galeria.");
                                                                                var img='\n<img src="/fotos/'+filename+'" alt="Adm. Romário Cruz com leitor segurando o livro Homem, Você Não É Ridículo" loading="lazy" decoding="async" style="width:100%;aspect-ratio:1/1;object-fit:cover;object-position:center 35%;border-radius:4px;display:block;">';
                                                                                var newHtml=html.replace(marker,img+marker);
                                                                                return ghPut("fotos/index.html",newHtml,"Adiciona foto "+filename+" à galeria (via Painel Rede Bolha)",fd.sha);
                                                               }).then(resolve).catch(reject);
                                                };
                                                reader.onerror=function(){reject(new Error("Falha ao ler arquivo."));};
                                                reader.readAsDataURL(file);
                                   });
                        });
               });
               chain.then(function(){
                        toast("Fotos enviadas. Clique em cada uma para ajustar o enquadramento.","ok");
                        loadGrid();
               }).catch(function(e){
                        toast("Falha no envio: "+e.message,"err");
                        loadGrid();
               });
        }
   }

/* ==================================================================
   PAGINA INICIAL — CAPA
   Edita o que a home mostra hoje: a tira de noticias (logo abaixo do
   menu), a "Noticia em destaque" e o "Artigo em destaque".
   Grava so esses trechos da index.html; o resto da pagina nao e tocado.
   ================================================================== */
var TIRA_RE=/<a class="tira-ferramenta tira-noticia"[\s\S]*?<\/a>/;
var ARROW_SVG='<svg fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>';

function parseTira(html){
  var m=TIRA_RE.exec(html); if(!m) return null;
  var doc=new DOMParser().parseFromString(m[0],"text/html"); var a=doc.querySelector("a"); if(!a) return null;
  var selo=a.querySelector(".tira-selo"), txt=a.querySelector(".tira-txt"), b=txt?txt.querySelector("b"):null;
  var rest=""; if(txt){ var c=txt.cloneNode(true); var bb=c.querySelector("b"); if(bb) bb.remove(); rest=c.textContent.trim(); }
  return { link:a.getAttribute("href")||"", selo:selo?selo.textContent.trim():"Notícias Rede Bolha", bold:b?b.textContent.trim():"", rest:rest };
}
function buildTira(t){
  return '<a class="tira-ferramenta tira-noticia" href="'+esc(t.link)+'" data-rb="noticia">\n'+
    '  <span class="tira-selo"><i aria-hidden="true"></i>'+esc(t.selo||"Notícias Rede Bolha")+'</span>\n'+
    '  <span class="tira-txt"><b>'+escMid(t.bold)+'</b>'+(t.rest?' '+escMid(t.rest):'')+'</span>\n'+
    '  <span class="tira-seta">→</span>\n'+
    '</a>';
}
function findDestaques(html){
  var out=[], re=/<section class="sec rb-destaque" aria-label="([^"]*)">/g, m;
  while((m=re.exec(html))){
    var start=m.index, end=html.indexOf("</section>",start); if(end<0) break; end+=10;
    out.push({label:m[1], start:start, end:end, html:html.slice(start,end)});
  }
  return out;
}
function parseDestaque(sec){
  var doc=new DOMParser().parseFromString(sec.html,"text/html");
  var q=function(s){return doc.querySelector(s);};
  var img=q(".rb-destaque-img"), link=q(".rb-destaque-img-link"), btn=q(".rb-destaque-card a.btn");
  var btnLabel=""; if(btn){ var c=btn.cloneNode(true); $all("svg",c).forEach(function(s){s.remove();}); btnLabel=c.textContent.trim(); }
  return {
    label:sec.label, hasRule:!!q(".rule"),
    eyebrow:(q(".eyebrow")||{}).textContent||sec.label,
    link:(btn&&btn.getAttribute("href"))||(link&&link.getAttribute("href"))||"",
    img:img?img.getAttribute("src")||"":"", w:img?img.getAttribute("width")||"":"", h:img?img.getAttribute("height")||"":"",
    alt:img?img.getAttribute("alt")||"":"",
    tag:((q(".rb-destaque-tag")||{}).textContent||"").trim(),
    titulo:((q(".rb-destaque-titulo")||{}).textContent||"").trim(),
    texto:(q(".rb-destaque-texto")||{innerHTML:""}).innerHTML.trim(),
    assinatura:((q(".rb-destaque-assinatura")||{}).textContent||"").trim(),
    btn:btnLabel||"Ler a matéria completa"
  };
}
function escMid(x){ return esc(x).replace(/·/g,"&middot;"); }
function buildDestaque(d){
  return '<section class="sec rb-destaque" aria-label="'+esc(d.label)+'">\n'+
    '  <div class="wrap">\n'+
    (d.hasRule?'    <div class="rule"></div>\n':'')+
    '    <p class="eyebrow">'+escMid(d.eyebrow)+'</p>\n'+
    '    <div class="rb-destaque-card">\n'+
    (d.img?'      <a class="rb-destaque-img-link" href="'+esc(d.link)+'"><img class="rb-destaque-img" src="'+esc(d.img)+'"'+(d.w&&d.h?' width="'+esc(d.w)+'" height="'+esc(d.h)+'"':'')+' alt="'+esc(d.alt)+'" loading="lazy"></a>\n':'')+
    (d.tag?'      <span class="rb-destaque-tag">'+escMid(d.tag)+'</span>\n':'')+
    '      <h2 class="rb-destaque-titulo">'+escMid(d.titulo)+'</h2>\n'+
    (d.texto?'      <p class="rb-destaque-texto">'+cleanInline(d.texto)+'</p>\n':'')+
    (d.assinatura?'      <p class="rb-destaque-assinatura">'+escMid(d.assinatura)+'</p>\n':'')+
    '      <a class="btn btn--lg" href="'+esc(d.link)+'">'+esc(d.btn||"Ler mais")+'\n        '+ARROW_SVG+'\n      </a>\n'+
    '    </div>\n'+
    '  </div>\n'+
    '</section>';
}
/* texto do destaque: aceita so negrito, italico e link */
function cleanInline(h){
  var box=document.createElement("div"); box.innerHTML=h;
  var walk=function(n){
    Array.prototype.slice.call(n.childNodes).forEach(function(c){
      if(c.nodeType===1){
        var t=c.tagName.toLowerCase();
        if(["strong","b","em","i","a","br"].indexOf(t)<0){ walk(c); while(c.firstChild) n.insertBefore(c.firstChild,c); c.remove(); return; }
        Array.prototype.slice.call(c.attributes).forEach(function(at){ if(!(t==="a" && at.name==="href")) c.removeAttribute(at.name); });
        if(t==="a" && /^\s*javascript:/i.test(c.getAttribute("href")||"")) c.removeAttribute("href");
        walk(c);
      } else if(c.nodeType!==3){ c.remove(); }
    });
  };
  walk(box); return box.innerHTML;
}

var capaState={sources:null};
function viewHome(v){
  v.innerHTML='<p class="muted">Aqui você troca o que aparece na <a href="'+SITE+'/" target="_blank" rel="noopener">página inicial</a>: a tira de notícias logo abaixo do menu e os blocos de destaque. Ao salvar, a capa é atualizada em 1 a 2 minutos.</p><div id="capaBox"><p class="empty">Carregando a capa…</p></div>';
  var box=$("#capaBox");
  Promise.all([ghReadText("index.html"),loadCapaSources()]).then(function(r){
    var html=r[0]; if(html==null) throw new Error("index.html não encontrada.");
    var tira=parseTira(html), dests=findDestaques(html).map(parseDestaque);
    if(!tira && !dests.length){ box.innerHTML='<div class="panel"><p class="empty">Não encontrei a tira de notícias nem os blocos de destaque na página inicial. A estrutura da capa mudou — me peça para ajustar o painel.</p></div>'; return; }
    box.innerHTML="";
    if(tira) box.appendChild(tiraForm(tira));
    dests.forEach(function(d,i){ box.appendChild(destaqueForm(d,i)); });
  }).catch(function(e){ box.innerHTML='<div class="panel"><p class="empty">Erro ao carregar a capa: '+esc(e.message)+'</p></div>'; });
}
function loadCapaSources(){
  if(capaState.sources) return Promise.resolve(capaState.sources);
  var dirs=[["noticias","Notícias"],["economia","Economia"],["artigos","Artigos"]];
  return Promise.all(dirs.map(function(d){ return ghListDir(d[0]).catch(function(){return [];}); })).then(function(lists){
    var out=[];
    lists.forEach(function(items,i){ (items||[]).forEach(function(f){ if(f.type==="file" && /\.html$/.test(f.name) && f.name!=="index.html") out.push({path:dirs[i][0]+"/"+f.name, group:dirs[i][1]}); }); });
    capaState.sources=out; return out;
  });
}
function sourceSelect(id){
  var groups={}; (capaState.sources||[]).forEach(function(s){ (groups[s.group]=groups[s.group]||[]).push(s); });
  var meta=lsJSON("rb_meta",{});
  return '<div class="field full"><label for="'+id+'">Preencher a partir de uma matéria do site</label><select id="'+id+'"><option value="">— escolha para preencher os campos automaticamente —</option>'+
    Object.keys(groups).map(function(g){ return '<optgroup label="'+esc(g)+'">'+groups[g].map(function(s){ var n=s.path.split("/").pop(); var t=(g==="Artigos"&&meta[n]&&meta[n].title)||n.replace(/\.html$/,"").replace(/-/g," "); return '<option value="'+esc(s.path)+'">'+esc(t)+'</option>'; }).join("")+'</optgroup>'; }).join("")+
    '</select><small>Os campos são preenchidos com título, resumo e imagem da matéria. Revise antes de salvar.</small></div>';
}
function readSource(path){
  return ghReadText(path).then(function(html){
    var doc=new DOMParser().parseFromString(html||"","text/html");
    var og=function(p){ var x=doc.querySelector('meta[property="'+p+'"]'); return x?x.getAttribute("content")||"":""; };
    var h1=doc.querySelector("article h1")||doc.querySelector("h1");
    var title=(h1&&h1.textContent.trim())||og("og:title");
    var md=doc.querySelector('meta[name="description"]');
    var img=og("og:image"), alt=og("og:image:alt");
    var capa=doc.querySelector(".figura-capa img")||doc.querySelector("article img");
    if(capa){ img=capa.getAttribute("src")||img; alt=capa.getAttribute("alt")||alt; }
    if(img && !/^https?:/.test(img) && img.charAt(0)!=="/"){ img="/"+path.replace(/[^\/]+$/,"")+img; }
    var eb=doc.querySelector("article .eyebrow")||doc.querySelector(".eyebrow")||doc.querySelector(".chapeu");
    var date=""; $all('script[type="application/ld+json"]',doc).forEach(function(s){ try{ var j=JSON.parse(s.textContent); (j["@graph"]||[j]).forEach(function(n){ if(n && /Article/.test(n["@type"]||"") && n.datePublished && !date) date=n.datePublished; }); }catch(e){} });
    return { link:"/"+path, title:title, desc:md?md.getAttribute("content")||"":"", img:sitePath(img), alt:alt||"", eyebrow:eb?eb.textContent.trim():"", date:date };
  });
}
function longDate(iso){ try{ return new Intl.DateTimeFormat("pt-BR",{day:"numeric",month:"long",year:"numeric",timeZone:TZ}).format(new Date(iso)); }catch(e){ return ""; } }
function capaField(id,label,val,opts){
  opts=opts||{};
  return '<div class="field'+(opts.full?' full':'')+'"><label for="'+id+'">'+esc(label)+'</label>'+
    (opts.area?'<textarea id="'+id+'" rows="'+(opts.rows||3)+'">'+esc(val)+'</textarea>':'<input id="'+id+'" value="'+esc(val)+'"'+(opts.ph?' placeholder="'+esc(opts.ph)+'"':'')+'>')+
    (opts.hint?'<small>'+opts.hint+'</small>':'')+'</div>';
}
function tiraForm(t){
  var p=el("div",{class:"panel"});
  p.innerHTML='<h3>Tira de notícias <small>a faixa logo abaixo do menu da capa</small></h3>'+
    '<div class="capa-grid">'+
      sourceSelect("tSrc")+
      capaField("tBold","Destaque em negrito",t.bold,{full:true,ph:"Ex.: O Sul fecha com Flávio:"})+
      capaField("tRest","Complemento",t.rest,{full:true})+
      capaField("tLink","Link",t.link,{full:true,hint:'Endereço da matéria, ex.: <code>/noticias/minha-materia.html</code>'})+
    '</div>'+
    '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" id="tSave">Salvar tira</button><a class="btn ghost" id="tOpen" href="'+esc(absUrl(t.link))+'" target="_blank" rel="noopener">Abrir link</a></div>';
  $("#tSrc",p).onchange=function(){
    var path=this.value; if(!path) return; var sel=this; sel.disabled=true;
    readSource(path).then(function(s){
      var parts=(s.title||"").split(/:\s+/);
      $("#tBold",p).value=parts.length>1?parts[0]+":":s.title; $("#tRest",p).value=parts.length>1?parts.slice(1).join(": "):"";
      $("#tLink",p).value=s.link; $("#tOpen",p).href=absUrl(s.link);
    }).catch(function(e){ toast("Não consegui ler a matéria: "+e.message,"err"); }).then(function(){ sel.disabled=false; });
  };
  $("#tLink",p).oninput=function(){ $("#tOpen",p).href=absUrl(this.value); };
  $("#tSave",p).onclick=function(){
    var nt={selo:t.selo, bold:$("#tBold",p).value.trim(), rest:$("#tRest",p).value.trim(), link:$("#tLink",p).value.trim()};
    if(!nt.bold||!nt.link){ toast("Preencha o destaque e o link da tira.","err"); return; }
    var b=this; b.disabled=true; b.textContent="Salvando…";
    ghCommitEdit(["index.html"],function(f){
      var h=f["index.html"]; if(h==null || !TIRA_RE.test(h)) throw new Error("A tira de notícias não está mais na página inicial.");
      var n=h.replace(TIRA_RE,function(){ return buildTira(nt); });
      return n===h?[]:[{path:"index.html",content:n}];
    },"Capa: tira de notícias — "+nt.bold+" (via Painel Rede Bolha)").then(function(r){
      t.bold=nt.bold; t.rest=nt.rest; t.link=nt.link;
      logActivity("capa","Atualizou a tira de notícias da capa");
      toast(r&&r.nothing?"Nada mudou na tira.":"Tira salva. A capa atualiza em 1–2 minutos.","ok");
    }).catch(function(e){ toast("Erro ao salvar: "+e.message,"err"); }).then(function(){ b.disabled=false; b.textContent="Salvar tira"; });
  };
  return p;
}
function destaqueForm(d,i){
  var p=el("div",{class:"panel"}), k="d"+i;
  p.innerHTML='<h3>'+esc(d.label)+' <small>bloco da página inicial</small></h3>'+
    '<div class="capa-grid">'+
      sourceSelect(k+"Src")+
      '<div class="full"><img class="capa-thumb" id="'+k+'Thumb" alt="" '+(d.img?'src="'+esc(absUrl(d.img))+'"':'style="display:none"')+'></div>'+
      capaField(k+"Tit","Título",d.titulo,{full:true})+
      capaField(k+"Txt","Texto",d.texto,{full:true,area:true,rows:4,hint:'Pode usar <code>&lt;strong&gt;negrito&lt;/strong&gt;</code> e <code>&lt;em&gt;itálico&lt;/em&gt;</code>.'})+
      capaField(k+"Tag","Etiqueta (acima do título)",d.tag,{ph:"Ex.: Opinião · 14 de outubro de 2026"})+
      capaField(k+"Ass","Assinatura",d.assinatura,{ph:"Por Adm. Romário Cruz"})+
      capaField(k+"Lnk","Link da matéria",d.link,{hint:'Ex.: <code>/noticias/minha-materia.html</code>'})+
      capaField(k+"Btn","Texto do botão",d.btn)+
      capaField(k+"Img","Imagem (endereço)",d.img,{hint:'Deixe vazio para o bloco sem imagem.'})+
      capaField(k+"Alt","Descrição da imagem (acessibilidade)",d.alt)+
    '</div>'+
    '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" id="'+k+'Save">Salvar “'+esc(d.label)+'”</button><a class="btn ghost" id="'+k+'Open" href="'+esc(absUrl(d.link))+'" target="_blank" rel="noopener">Abrir matéria</a></div>';
  var f=function(s){ return $("#"+k+s,p); };
  var dims={img:d.img,w:d.w,h:d.h};
  var showImg=function(src){ var th=f("Thumb"); if(src){ th.src=absUrl(src); th.style.display=""; } else { th.removeAttribute("src"); th.style.display="none"; } };
  var measure=function(src){
    if(!src){ dims={img:"",w:"",h:""}; return Promise.resolve(); }
    if(src===dims.img) return Promise.resolve();
    return new Promise(function(res){ var im=new Image(); im.onload=function(){ dims={img:src,w:String(im.naturalWidth),h:String(im.naturalHeight)}; res(); }; im.onerror=function(){ dims={img:src,w:"",h:""}; res(); }; im.src=absUrl(src); });
  };
  f("Img").addEventListener("change",function(){ showImg(this.value.trim()); });
  f("Lnk").addEventListener("input",function(){ f("Open").href=absUrl(this.value); });
  f("Src").onchange=function(){
    var path=this.value; if(!path) return; var sel=this; sel.disabled=true;
    readSource(path).then(function(s){
      f("Tit").value=s.title||""; f("Txt").value=(s.desc||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); f("Lnk").value=s.link; f("Open").href=absUrl(s.link);
      if(s.img){ f("Img").value=s.img; showImg(s.img); }
      f("Alt").value=s.alt||"";
      var group=path.split("/")[0];
      f("Tag").value=group==="artigos"?(s.eyebrow||d.tag):[s.eyebrow||(group==="economia"?"Economia":"Notícias"),s.date?longDate(s.date):""].filter(Boolean).join(" · ");
      f("Btn").value=group==="artigos"?"Ler o artigo completo":"Ler a matéria completa";
    }).catch(function(e){ toast("Não consegui ler a matéria: "+e.message,"err"); }).then(function(){ sel.disabled=false; });
  };
  f("Save").onclick=function(){
    var nd={label:d.label,hasRule:d.hasRule,eyebrow:d.eyebrow,
      titulo:f("Tit").value.trim(), texto:f("Txt").value.trim(), tag:f("Tag").value.trim(), assinatura:f("Ass").value.trim(),
      link:f("Lnk").value.trim(), btn:f("Btn").value.trim(), img:f("Img").value.trim(), alt:f("Alt").value.trim()};
    if(!nd.titulo||!nd.link){ toast("Preencha o título e o link do destaque.","err"); return; }
    if(nd.img && !nd.alt){ toast("Escreva a descrição da imagem (acessibilidade).","err"); return; }
    var b=this; b.disabled=true; b.textContent="Salvando…";
    measure(nd.img).then(function(){
      nd.w=dims.w; nd.h=dims.h;
      return ghCommitEdit(["index.html"],function(fl){
        var h=fl["index.html"]; if(h==null) throw new Error("index.html não encontrada.");
        var sec=findDestaques(h).filter(function(s){return s.label===d.label;})[0];
        if(!sec) throw new Error("O bloco “"+d.label+"” não está mais na página inicial.");
        var built=buildDestaque(nd); if(built===sec.html) return [];
        var pre=h.slice(0,sec.start), post=h.slice(sec.end);
        var cm=/<!-- NOTICIA EM DESTAQUE[^>]*-->\s*$/.exec(pre);
        if(cm) pre=pre.slice(0,cm.index)+"<!-- NOTICIA EM DESTAQUE — "+nd.titulo.replace(/--/g,"-").split(":")[0]+" ("+fmtDay(nowISO())+") -->\n";
        var n=pre+built+post;
        return n===h?[]:[{path:"index.html",content:n}];
      },"Capa: "+d.label.toLowerCase()+" — "+nd.titulo+" (via Painel Rede Bolha)");
    }).then(function(r){
      d.img=nd.img; d.w=nd.w; d.h=nd.h;
      logActivity("capa","Atualizou “"+d.label+"” na capa");
      toast(r&&r.nothing?"Nada mudou neste bloco.":"“"+d.label+"” salvo. A capa atualiza em 1–2 minutos.","ok");
    }).catch(function(e){ toast("Erro ao salvar: "+e.message,"err"); }).then(function(){ b.disabled=false; b.textContent="Salvar “"+d.label+"”"; });
  };
  return p;
}

/* ===================================================================
   PAGINAS (paginas e secoes do site)
   =================================================================== */
var HIDDEN_DIRS={admin:1,css:1,js:1,img:1,".github":1};
function viewPages(v){
  v.innerHTML='<div class="panel"><h3>Seções do site</h3><div id="secList" class="row-list"><p class="empty">Carregando…</p></div></div>'+
    '<div class="panel"><h3>Páginas avulsas</h3><div id="pagesList" class="row-list"></div></div>';
  ghListDir("").then(function(items){
    var dirs=items.filter(function(f){return f.type==="dir" && !HIDDEN_DIRS[f.name];});
    var pages=items.filter(function(f){return f.type==="file"&&/\.html$/.test(f.name)&&!/^google[0-9a-f]+\.html$/.test(f.name);});
    var sl=$("#secList"); sl.innerHTML="";
    dirs.forEach(function(f){ sl.appendChild(el("div",{class:"a11y-item"},'<span>'+esc(f.name)+'/</span><a style="margin-left:auto" href="'+SITE+'/'+encPath(f.name)+'/" target="_blank" rel="noopener">Abrir ↗</a>')); });
    var pl=$("#pagesList"); pl.innerHTML="";
    pages.forEach(function(f){ pl.appendChild(el("div",{class:"a11y-item"},'<span>'+esc(f.name)+'</span><a style="margin-left:auto" href="'+SITE+'/'+(f.name==="index.html"?"":encPath(f.name))+'" target="_blank" rel="noopener">Abrir ↗</a>')); });
  }).catch(function(e){ $("#secList").innerHTML='<p class="empty">'+esc(e.message)+'</p>'; });
}

/* ===================================================================
   USUARIOS / PERFIS
   =================================================================== */
function viewUsers(v){
  v.innerHTML='<div class="panel"><h3>Quem pode usar o painel</h3>'+
    '<p style="color:var(--body);margin-bottom:14px">O acesso é feito por um token pessoal do GitHub. Quem tem token com permissão de escrita no repositório <code>'+esc(REPO.owner+"/"+REPO.name)+'</code> consegue publicar.</p>'+
    '<div class="a11y-item"><span>Conectado agora como</span><strong style="margin-left:auto;color:var(--gold)">'+esc(state.ghUser||"—")+'</strong></div>'+
    '<p style="color:var(--dim);font-size:.85rem;margin-top:14px">Para dar acesso a outra pessoa, convide-a como colaboradora do repositório em github.com (Settings → Collaborators). Cada pessoa usa o próprio token. Por segurança, contas não são criadas pelo painel.</p></div>';
}

/* ===================================================================
   RELATORIOS
   =================================================================== */
function viewReports(v){
  var live=state.articles.filter(function(a){return a.live;});
  var last30=live.filter(function(a){ return a.published && (Date.now()-new Date(a.published).getTime())<30*86400000; }).length;
  var byCat={}; live.forEach(function(a){ byCat[a.category]=(byCat[a.category]||0)+1; });
  v.innerHTML='<div class="cards">'+statCard(live.length,"Artigos no site")+statCard(last30,"Publicados em 30 dias")+statCard(Object.keys(byCat).length,"Categorias em uso")+statCard(state.articles.length-live.length,"Rascunhos locais")+'</div>'+
    '<div class="panel"><h3>Artigos por data de publicação</h3><div id="repRecent" class="row-list"></div></div>'+
    '<div class="panel"><h3>Visitas e ganhos</h3><p style="color:var(--body);margin-bottom:14px">O site já tem Google Analytics (<code>'+GA_ID+'</code>) e AdSense instalados. Os números de visitas, origem dos leitores e ganhos ficam lá.</p>'+
    '<div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn ghost sm" href="https://analytics.google.com/" target="_blank" rel="noopener">Abrir Google Analytics</a><a class="btn ghost sm" href="https://search.google.com/search-console" target="_blank" rel="noopener">Search Console</a><a class="btn ghost sm" href="https://adsense.google.com/" target="_blank" rel="noopener">AdSense</a></div></div>';
  var r=$("#repRecent");
  live.slice().sort(function(a,b){return (b.published||"").localeCompare(a.published||"");}).forEach(function(a){ r.appendChild(el("div",{class:"a11y-item"},'<span>'+esc(a.title)+'</span><span style="margin-left:auto;color:var(--dim)">'+fmtDay(a.published)+'</span>')); });
  if(!live.length)r.innerHTML='<p class="empty">Carregando…</p>';
}

/* ===================================================================
   CONFIGURACOES
   =================================================================== */
function viewSettings(v){
  var s=settings();
  v.innerHTML='<div class="panel"><h3>Preferências do painel</h3>'+
    '<div class="field"><label for="setAuthor">Autor padrão dos novos artigos</label><input id="setAuthor" value="'+esc(s.author||"Adm. Romário Cruz")+'"></div>'+
    '<button class="btn" id="saveSet">Salvar</button></div>'+
    '<div class="panel"><h3>Onde o site mora</h3>'+
    '<div class="a11y-item"><span>Repositório</span><a style="margin-left:auto" href="https://github.com/'+REPO.owner+'/'+REPO.name+'" target="_blank" rel="noopener">'+esc(REPO.owner+"/"+REPO.name)+' ↗</a></div>'+
    '<div class="a11y-item"><span>Ramo publicado</span><code style="margin-left:auto">'+esc(REPO.branch)+'</code></div>'+
    '<div class="a11y-item"><span>Fuso horário</span><span style="margin-left:auto">America/Sao_Paulo (Porto Alegre)</span></div>'+
    '<div class="a11y-item"><span>Histórico de alterações</span><a style="margin-left:auto" href="https://github.com/'+REPO.owner+'/'+REPO.name+'/commits/'+REPO.branch+'" target="_blank" rel="noopener">Ver commits ↗</a></div>'+
    '<button class="btn ghost sm" id="clearCache" style="margin-top:14px">Recarregar dados dos artigos</button></div>';
  $("#saveSet").onclick=function(){ var s2=settings(); s2.author=$("#setAuthor").value.trim()||"Adm. Romário Cruz"; lsSet("rb_settings",JSON.stringify(s2)); toast("Preferências salvas.","ok"); };
  $("#clearCache").onclick=function(){ lsDel("rb_meta"); capaState.sources=null; toast("Recarregando artigos…",""); loadArticles().then(function(){ toast("Dados dos artigos atualizados.","ok"); }); };
}

/* ===================================================================
   SEGURANCA
   =================================================================== */
function viewSecurity(v){
  var logs=lsJSON("rb_logs",[]);
  v.innerHTML='<div class="panel"><h3>Segurança</h3>'+
    '<div id="tokInfo"><div class="a11y-item">Verificando o token…</div></div>'+
    '<div class="a11y-item ok">✓ Conexão HTTPS ativa</div>'+
    '<div class="a11y-item ok">✓ Token guardado apenas neste navegador (nunca enviado a terceiros)</div>'+
    '<div class="a11y-item ok">✓ Bloqueio de 1 minuto após 5 tentativas incorretas de acesso</div>'+
    '<div class="a11y-item ok">✓ Painel fora dos buscadores (noindex + robots.txt)</div>'+
    '<div class="a11y-item warn">! Mantenha a verificação em duas etapas ativa na sua conta do GitHub</div>'+
    '<button class="btn danger sm" id="clearTok" style="margin-top:14px">Esquecer token deste dispositivo</button>'+
    '</div>'+
    '<div class="panel"><h3>Registro de atividades <small>deste navegador</small></h3><div id="logList" class="row-list"></div></div>';
  $("#clearTok").onclick=function(){ if(!confirm("Remover o token deste dispositivo? Você vai precisar colá-lo de novo para entrar.")) return; logout(); };
  fetch(API+"/user",{headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+state.token},cache:"no-store"}).then(function(r){
    var exp=r.headers.get("github-authentication-token-expiration"), scopes=r.headers.get("x-oauth-scopes");
    var html="";
    if(exp){ var dt=new Date(exp.replace(" UTC","Z").replace(" ","T")); var days=Math.round((dt-Date.now())/86400000); html+='<div class="a11y-item '+(days<15?"warn":"ok")+'">'+(days<15?"!":"✓")+' Token válido até '+esc(fmtDay(isNaN(dt)?exp:dt.toISOString()))+(days<15?' — gere um novo antes de vencer':'')+'</div>'; }
    else html+='<div class="a11y-item warn">! Este token não tem data de validade. Recomendado: gerar um token “fine-grained” com validade (ex.: 90 dias) e só a permissão “Contents: Read and write” neste repositório.</div>';
    if(scopes){ var broad=/\b(admin|delete_repo|workflow|user)\b/.test(scopes) || scopes.split(",").length>2; html+='<div class="a11y-item '+(broad?"warn":"ok")+'">'+(broad?"!":"✓")+' Permissões do token: '+esc(scopes)+(broad?' — mais do que o painel precisa':'')+'</div>'; }
    $("#tokInfo").innerHTML=html;
  }).catch(function(){ $("#tokInfo").innerHTML=""; });
  var ll=$("#logList");
  if(!logs.length)ll.innerHTML='<p class="empty">Sem registros ainda.</p>';
  logs.slice(0,40).forEach(function(l){ ll.appendChild(el("div",{class:"a11y-item"},'<span>'+esc(l.who)+' — '+esc(l.detail)+'</span><span style="margin-left:auto;color:var(--dim)">'+fmtDate(l.at)+'</span>')); });
}

/* ===================================================================
   AJUDA
   =================================================================== */
function viewHelp(v){
  v.innerHTML='<div class="panel"><h3>Publicar um artigo</h3>'+
    '<ol style="line-height:2;padding-left:20px;color:var(--body)">'+
    '<li>Clique em <strong style="color:var(--txt)">Criar novo artigo</strong> na Visão Geral.</li>'+
    '<li>Escreva o <strong style="color:var(--txt)">chapéu</strong>, o <strong style="color:var(--txt)">título</strong> e, se quiser, o subtítulo.</li>'+
    '<li>Use <strong style="color:var(--txt)">+ Adicionar bloco</strong> para parágrafos, intertítulos, imagens, citações, vídeos e chamadas.</li>'+
    '<li>No painel lateral, preencha <strong style="color:var(--txt)">categoria, endereço (URL) e resumo</strong>.</li>'+
    '<li>Confira a <strong style="color:var(--txt)">pré-visualização</strong> no computador, tablet e celular.</li>'+
    '<li>Clique em <strong style="color:var(--txt)">Publicar</strong>. O artigo entra no ar e já aparece na lista de artigos, no sitemap e no feed.</li>'+
    '</ol>'+
    '<p style="color:var(--dim);margin-top:14px">O texto é guardado automaticamente neste navegador enquanto você escreve. Rascunhos não vão para o site até você publicar.</p></div>'+
    '<div class="panel"><h3>Trocar os destaques da capa</h3><p style="color:var(--body)">Em <a href="#home">Página Inicial</a>, escolha uma matéria na lista para preencher os campos sozinhos, revise e clique em Salvar. A capa atualiza em 1 a 2 minutos.</p></div>'+
    '<div class="panel"><h3>Tirar um artigo do ar</h3><p style="color:var(--body)">Em Artigos, clique em <strong style="color:var(--txt)">⋯ → Tirar do ar</strong>. O arquivo sai do site, da lista, do sitemap e do feed. Dá para recuperar pelo histórico do GitHub.</p></div>';
}

/* ===================================================================
   ACESSIBILIDADE RS — guia de lugares acessiveis (/acessibilidade-rs/)
   Le e grava acessibilidade-rs/dados.json. As regras de classificacao
   vem de /acessibilidade-rs/regras.js (window.ARS), as mesmas da pagina.
   =================================================================== */
var ARS_FILE="acessibilidade-rs/dados.json";
var ARS_MAP="acessibilidade-rs/mapa-rs.json";
var ars={ dados:null, mun:null, munByName:{}, tab:"lugares", editingId:null, q:"" };

function arsNorm(s){ return String(s==null?"":s).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim(); }
function arsParse(txt){ var d; try{ d=JSON.parse(txt||"{}"); }catch(e){ d={}; } if(!Array.isArray(d.locais)) d.locais=[]; if(!d.municipios||typeof d.municipios!=="object") d.municipios={}; return d; }
function arsMunName(cod){ return ars.mun&&ars.mun[cod]?ars.mun[cod].n:"—"; }
function arsReg(cod){ return ars.mun&&ars.mun[cod]?ars.mun[cod].r:null; }
function arsMunCod(name){ return ars.munByName[arsNorm(name)]||null; }
function arsCat(k){ var c=window.ARS.CATS.filter(function(x){return x[0]===k;})[0]; return c?c[1]:"—"; }
function arsNivel(p){ return window.ARS.avaliar(p.recursos||[]).nivel; }
function arsNivBadge(n){ var N=window.ARS.NIV[n]; return '<span class="ars-niv n'+n+'">'+esc(N.curto)+(n>0?' '+N.stars:'')+'</span>'; }
function arsFadBadge(f){ return f&&window.ARS.FAD[f]?'<span class="ars-fad">Selo FADERS '+esc(window.ARS.FAD[f])+'</span>':''; }

function viewAcessibilidade(v){
  if(!window.ARS){ v.innerHTML='<div class="panel"><p class="empty">Não encontrei o arquivo de regras (/acessibilidade-rs/regras.js). Recarregue a página.</p></div>'; return; }
  v.innerHTML='<p class="muted">Lugares do guia <a href="'+SITE+'/acessibilidade-rs/" target="_blank" rel="noopener">redebolha.com.br/acessibilidade-rs</a>. Cada vez que você salva, o site é atualizado em 1 a 2 minutos.</p>'+
    '<div class="cards" id="arsStats" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))"></div>'+
    '<div class="ars-tabs" role="tablist" aria-label="Seções da Acessibilidade RS">'+
      '<button class="btn ghost sm" role="tab" data-arst="lugares">Lugares</button>'+
      '<button class="btn ghost sm" role="tab" data-arst="pedido">Importar pedido</button>'+
      '<button class="btn ghost sm" role="tab" data-arst="faders">Selo FADERS</button>'+
      '<button class="btn ghost sm" role="tab" data-arst="resumo">Resumo</button>'+
    '</div><div id="arsBody"><div class="panel"><p class="empty">Carregando o guia…</p></div></div>';
  $all("[data-arst]",v).forEach(function(b){ b.addEventListener("click",function(){ ars.tab=b.getAttribute("data-arst"); arsRender(); }); });
  var needMap = ars.mun ? Promise.resolve(null) : ghReadText(ARS_MAP);
  Promise.all([ghReadText(ARS_FILE), needMap]).then(function(r){
    ars.dados=arsParse(r[0]);
    if(r[1]){ var m=JSON.parse(r[1]); ars.mun=m.mun; ars.munByName={}; Object.keys(m.mun).forEach(function(c){ ars.munByName[arsNorm(m.mun[c].n)]=c; }); }
    if(!$("#arsMunList")){ var dl=el("datalist",{id:"arsMunList"}); dl.innerHTML=Object.keys(ars.mun).map(function(c){return ars.mun[c].n;}).sort(function(a,b){return a.localeCompare(b,"pt-BR");}).map(function(n){return '<option value="'+esc(n)+'"></option>';}).join(""); document.body.appendChild(dl); }
    arsRender();
  }).catch(function(e){ $("#arsBody").innerHTML='<div class="panel"><p class="empty">Erro ao carregar o guia: '+esc(e.message)+'</p></div>'; });
}

function arsRender(){
  if(!$("#arsBody")||!ars.dados) return;
  $all("[data-arst]").forEach(function(b){ var on=b.getAttribute("data-arst")===ars.tab; b.classList.toggle("on",on); b.setAttribute("aria-selected",on?"true":"false"); });
  var L=ars.dados.locais, c={3:0,2:0,1:0,0:0}, f=0;
  L.forEach(function(p){ c[arsNivel(p)]++; if(p.faders) f++; });
  $("#arsStats").innerHTML=statCard(L.length,"Lugares no guia")+statCard(c[3],"Plena")+statCard(c[2],"Boa")+statCard(c[1],"Básica")+statCard(f,"Com Selo FADERS");
  ({lugares:arsLugares,pedido:arsPedido,faders:arsFaders,resumo:arsResumo}[ars.tab])($("#arsBody"));
}

/* Grava: le a versao mais nova do arquivo, aplica a mudanca e faz um commit */
function arsCommit(mutate,message){
  var novo=null;
  return ghCommitEdit([ARS_FILE],function(files){
    var d=arsParse(files[ARS_FILE]); mutate(d); d.atualizadoEm=nowISO(); novo=d;
    return [{ path: ARS_FILE, content: JSON.stringify(d,null,1)+"\n" }];
  },message+" (via Painel Rede Bolha)").then(function(){ if(novo) ars.dados=novo; return novo; });
}

/* ---------- Lugares ---------- */
function arsRecBoxes(){
  var A=window.ARS;
  function box(r){ return '<label><input type="checkbox" id="ars-r-'+r[0]+'" value="'+r[0]+'"> '+esc(r[1])+'</label>'; }
  return A.DIMS.map(function(d){ return '<fieldset class="ars-fs"><legend>'+esc(d.nome)+' <small>· '+esc(d.longo)+'</small></legend><div class="ars-checks">'+d.recs.map(box).join("")+'</div></fieldset>'; }).join("")+
    '<fieldset class="ars-fs"><legend>Para todos</legend><div class="ars-checks">'+A.GERAIS.map(box).join("")+'</div></fieldset>';
}
function arsField(id,label,input,full,small){ return '<div class="field'+(full?' full':'')+'"><label for="'+id+'">'+label+'</label>'+input+(small?'<small>'+small+'</small>':'')+'</div>'; }
function arsLugares(box){
  var A=window.ARS;
  var catOpts='<option value="">Escolha</option>'+A.CATS.map(function(c){return '<option value="'+c[0]+'">'+esc(c[1])+'</option>';}).join("");
  var fadOpts='<option value="">Não possui</option>'+Object.keys(A.FAD).map(function(k){return '<option value="'+k+'">'+esc(A.FAD[k])+'</option>';}).join("");
  box.innerHTML=
    '<form class="panel" id="arsForm" novalidate>'+
      '<h3 id="arsFormTitle">Incluir lugar</h3>'+
      '<div class="ars-grid">'+
        arsField("ars-nome","Nome *",'<input id="ars-nome" required>',true)+
        arsField("ars-cat","Tipo de lugar *",'<select id="ars-cat">'+catOpts+'</select>')+
        arsField("ars-mun","Cidade *",'<input id="ars-mun" list="arsMunList" autocomplete="off">')+
        arsField("ars-end","Endereço",'<input id="ars-end">',true)+
        arsField("ars-lat","Latitude",'<input id="ars-lat" inputmode="decimal" placeholder="-29.1678">',false,"Sem coordenadas, o ponto aparece no centro da cidade.")+
        arsField("ars-lon","Longitude",'<input id="ars-lon" inputmode="decimal" placeholder="-51.1794">')+
        arsField("ars-tel","Contato do estabelecimento",'<input id="ars-tel">')+
        arsField("ars-site","Site",'<input id="ars-site" type="url" placeholder="https://">')+
      '</div>'+
      arsRecBoxes()+
      '<div class="ars-calc" id="arsCalc" aria-live="polite"></div>'+
      '<div class="ars-grid">'+
        arsField("ars-ver","Quem conferiu",'<select id="ars-ver"><option value="nao">Informado pelo estabelecimento</option><option value="sim">Conferido pela equipe</option></select>')+
        arsField("ars-fad","Selo Estadual FADERS",'<select id="ars-fad">'+fadOpts+'</select>')+
        arsField("ars-fano","Ano do selo estadual",'<input id="ars-fano" inputmode="numeric">')+
        arsField("ars-fonte","Fonte (link)",'<input id="ars-fonte" type="url" placeholder="https://">')+
        arsField("ars-obs","Observação (aparece no site)",'<textarea id="ars-obs" rows="3"></textarea>',true)+
      '</div>'+
      '<div id="arsMsg"></div>'+
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="submit" id="arsSave">Salvar e publicar</button><button class="btn ghost" type="button" id="arsCancel" hidden>Cancelar edição</button></div>'+
    '</form>'+
    '<div class="panel"><h3>Lugares publicados <small>'+ars.dados.locais.length+'</small></h3>'+
      '<div class="toolbar"><input type="search" id="arsQ" placeholder="Filtrar por nome ou cidade" aria-label="Filtrar lugares" value="'+esc(ars.q)+'"></div>'+
      '<div class="ars-rows" id="arsRows"></div></div>';
  $("#arsForm").addEventListener("change",arsCalc);
  $("#arsForm").addEventListener("submit",function(e){ e.preventDefault(); arsSave(); });
  $("#arsCancel").addEventListener("click",function(){ ars.editingId=null; arsRender(); });
  $("#arsQ").addEventListener("input",function(){ ars.q=this.value; arsRows(); });
  if(ars.editingId){ var p=ars.dados.locais.filter(function(x){return x.id===ars.editingId;})[0]; if(p) arsFill(p); else ars.editingId=null; }
  if(ars.pendente){ arsFill(ars.pendente,true); ars.pendente=null; }
  arsCalc(); arsRows();
}
function arsRows(){
  var q=arsNorm(ars.q);
  var list=ars.dados.locais.filter(function(p){ return !q || arsNorm(p.nome+" "+arsMunName(p.mun)).indexOf(q)>=0; }).sort(function(a,b){ return String(a.nome).localeCompare(String(b.nome),"pt-BR"); });
  var box=$("#arsRows");
  if(!list.length){ box.innerHTML='<p class="empty" style="padding:24px">Nenhum lugar. Use o formulário acima para incluir o primeiro.</p>'; return; }
  box.innerHTML=list.map(function(p){ return '<div class="ars-row"><div class="pn"><b>'+esc(p.nome)+'</b><span>'+esc(arsCat(p.categoria))+' · '+esc(arsMunName(p.mun))+(p.verificado?' · conferido':'')+'</span></div>'+arsNivBadge(arsNivel(p))+arsFadBadge(p.faders)+
    '<button class="btn ghost sm" data-ars-edit="'+esc(p.id)+'">Editar</button><button class="btn danger sm" data-ars-del="'+esc(p.id)+'">Excluir</button></div>'; }).join("");
  $all("[data-ars-edit]",box).forEach(function(b){ b.addEventListener("click",function(){ ars.editingId=b.getAttribute("data-ars-edit"); arsRender(); $("#arsForm").scrollIntoView({behavior:"smooth"}); }); });
  $all("[data-ars-del]",box).forEach(function(b){ b.addEventListener("click",function(){
    var id=b.getAttribute("data-ars-del"), p=ars.dados.locais.filter(function(x){return x.id===id;})[0]; if(!p) return;
    if(!confirm("Tirar do guia: "+p.nome+"?")) return;
    b.disabled=true;
    arsCommit(function(d){ d.locais=d.locais.filter(function(x){return x.id!==id;}); },"Acessibilidade RS: remove "+p.nome).then(function(){
      toast("Lugar removido. O site atualiza em 1 a 2 minutos.","ok"); logActivity("acessibilidade","Removeu "+p.nome); if(ars.editingId===id) ars.editingId=null; arsRender();
    }).catch(function(e){ b.disabled=false; toast(e.message,"err"); });
  }); });
}
function arsCalc(){
  var A=window.ARS, recs=Object.keys(A.REC).filter(function(k){ var c=$("#ars-r-"+k); return c&&c.checked; });
  var av=A.avaliar(recs), SV={2:"atende",1:"parcial",0:"sem informação"};
  var box=$("#arsCalc"); if(!box) return;
  box.innerHTML='<b style="color:var(--txt)">Nível calculado:</b> '+arsNivBadge(av.nivel)+' <span>'+A.DIMS.map(function(d){return esc(d.nome)+": "+SV[av.v[d.k]];}).join(" · ")+'</span>';
}
function arsFill(p,fromImport){
  $("#arsFormTitle").textContent=fromImport?"Incluir lugar (pedido importado)":"Editar lugar";
  $("#arsCancel").hidden=false;
  $("#ars-nome").value=p.nome||""; $("#ars-cat").value=p.categoria||""; $("#ars-mun").value=p.mun?arsMunName(p.mun):(p.cidade||"");
  $("#ars-end").value=p.endereco||""; $("#ars-lat").value=p.lat==null?"":p.lat; $("#ars-lon").value=p.lon==null?"":p.lon;
  $("#ars-tel").value=p.contato||""; $("#ars-site").value=p.site||""; $("#ars-ver").value=p.verificado?"sim":"nao";
  $("#ars-fad").value=p.faders||""; $("#ars-fano").value=p.fadersAno||""; $("#ars-fonte").value=p.fonte||""; $("#ars-obs").value=p.obs||"";
  Object.keys(window.ARS.REC).forEach(function(k){ var c=$("#ars-r-"+k); if(c) c.checked=(p.recursos||[]).indexOf(k)>=0; });
  if(p.responsavel) $("#arsMsg").innerHTML='<div class="msg warn">Pedido de <b>'+esc(p.responsavel)+'</b>'+(p.email?' ('+esc(p.email)+')':'')+'. Esses dados de contato não são publicados no site.</div>';
  arsCalc();
}
function arsSave(){
  var A=window.ARS, msg=$("#arsMsg"); msg.innerHTML="";
  var latS=$("#ars-lat").value.trim().replace(",","."), lonS=$("#ars-lon").value.trim().replace(",",".");
  var rec={ nome:$("#ars-nome").value.trim(), categoria:$("#ars-cat").value, mun:arsMunCod($("#ars-mun").value), endereco:$("#ars-end").value.trim(),
    contato:$("#ars-tel").value.trim(), site:$("#ars-site").value.trim(), recursos:Object.keys(A.REC).filter(function(k){ var c=$("#ars-r-"+k); return c&&c.checked; }),
    verificado:$("#ars-ver").value==="sim", faders:$("#ars-fad").value, fadersAno:$("#ars-fano").value?Number($("#ars-fano").value):null,
    fonte:$("#ars-fonte").value.trim(), obs:$("#ars-obs").value.trim(), lat:null, lon:null };
  var miss=[]; if(!rec.nome) miss.push("nome"); if(!rec.categoria) miss.push("tipo de lugar"); if(!rec.mun) miss.push("cidade (escolha um nome da lista)");
  if(latS||lonS){ var la=Number(latS), lo=Number(lonS); if(!(la<=-27&&la>=-34&&lo>=-58&&lo<=-49)) miss.push("coordenadas dentro do RS (latitude entre -27 e -34, longitude entre -49 e -58)"); else { rec.lat=la; rec.lon=lo; } }
  if(miss.length){ msg.innerHTML='<div class="msg err">Confira: '+esc(miss.join(", "))+'.</div>'; return; }
  var editing=ars.editingId, now=nowISO();
  if(!editing){ var base=slugify(rec.nome+"-"+arsMunName(rec.mun))||"lugar", id=base, n=2; while(ars.dados.locais.some(function(x){return x.id===id;})) id=base+"-"+(n++); rec.id=id; } else rec.id=editing;
  var btn=$("#arsSave"); btn.disabled=true; btn.textContent="Publicando…";
  arsCommit(function(d){
    var i=-1; d.locais.forEach(function(x,j){ if(x.id===rec.id) i=j; });
    rec.atualizadoEm=now;
    if(i>=0){ rec.criadoEm=d.locais[i].criadoEm||now; d.locais[i]=rec; } else { rec.criadoEm=now; d.locais.push(rec); }
  },(editing?"Acessibilidade RS: atualiza ":"Acessibilidade RS: inclui ")+rec.nome).then(function(){
    toast((editing?"Lugar atualizado":"Lugar publicado")+". O site atualiza em 1 a 2 minutos.","ok");
    logActivity("acessibilidade",(editing?"Atualizou ":"Incluiu ")+rec.nome);
    ars.editingId=null; arsRender();
  }).catch(function(e){ btn.disabled=false; btn.textContent="Salvar e publicar"; msg.innerHTML='<div class="msg err">'+esc(e.message)+'</div>'; });
}

/* ---------- Importar pedido (mensagem do formulário do site) ---------- */
function arsPedido(box){
  box.innerHTML='<div class="panel"><h3>Importar pedido de cadastro</h3>'+
    '<p class="muted">Os pedidos feitos em “Cadastre seu negócio” chegam no e-mail do Formspree ou no WhatsApp. Cole a mensagem inteira aqui para preencher o formulário. Nada é publicado antes de você conferir e salvar.</p>'+
    '<div class="field"><label for="arsImp">Mensagem recebida</label><textarea id="arsImp" rows="12"></textarea></div>'+
    '<div id="arsImpMsg"></div><button class="btn" id="arsImpGo">Preencher formulário</button></div>';
  $("#arsImpGo").addEventListener("click",function(){
    var A=window.ARS, map={};
    $("#arsImp").value.split(/\r?\n/).forEach(function(l){ var i=l.indexOf(":"); if(i<1) return; var k=arsNorm(l.slice(0,i)).replace(/^[-*•\s]+/,""), v=l.slice(i+1).trim(); if(!v) return; (map[k]=map[k]||[]).push(v); });
    function get(){ for(var i=0;i<arguments.length;i++){ if(map[arguments[i]]) return map[arguments[i]][0]; } return ""; }
    var nome=get("estabelecimento");
    if(!nome){ $("#arsImpMsg").innerHTML='<div class="msg err">Não encontrei a linha “Estabelecimento: …”. Cole a mensagem completa do pedido.</div>'; return; }
    var tipo=arsNorm(get("tipo de lugar","tipo_lugar")), cat=A.CATS.filter(function(c){ return arsNorm(c[1])===tipo; })[0];
    var recs=[];
    Object.keys(map).forEach(function(k){
      if(k!=="recurso" && k.indexOf("recurso_")!==0) return;
      map[k].forEach(function(v){ var key=k.indexOf("recurso_")===0?k.slice(8):null;
        if(key&&A.REC[key]){ if(recs.indexOf(key)<0) recs.push(key); return; }
        Object.keys(A.REC).forEach(function(r){ if(arsNorm(A.REC[r])===arsNorm(v)&&recs.indexOf(r)<0) recs.push(r); });
      });
    });
    var cidade=get("cidade");
    ars.pendente={ nome:nome, categoria:cat?cat[0]:"", mun:arsMunCod(cidade), cidade:cidade, endereco:get("endereco"), contato:get("telefone"), site:get("site"),
      recursos:recs, verificado:false, obs:get("observacoes"), responsavel:get("responsavel","nome"), email:get("e-mail","email") };
    ars.editingId=null; ars.tab="lugares"; arsRender();
    $("#arsForm").scrollIntoView({behavior:"smooth"});
    toast("Formulário preenchido. Confira e publique.","ok");
  });
}

/* ---------- Selo FADERS: municipios ---------- */
function arsFaders(box){
  var A=window.ARS, M=ars.dados.municipios;
  var stOpts=Object.keys(A.MST).map(function(k){return '<option value="'+k+'">'+esc(A.MST[k])+'</option>';}).join("");
  var cods=Object.keys(M).sort(function(a,b){ return arsMunName(a).localeCompare(arsMunName(b),"pt-BR"); });
  box.innerHTML='<form class="panel" id="arsMunForm" novalidate><h3>Município no Selo Estadual (FADERS)</h3>'+
    '<p class="muted">Situação dos municípios no programa oficial do Estado. Aparece na página “Como avaliamos” e na ficha de cada cidade.</p>'+
    '<div class="ars-grid">'+
      arsField("arsm-mun","Município *",'<input id="arsm-mun" list="arsMunList" autocomplete="off">')+
      arsField("arsm-st","Situação",'<select id="arsm-st">'+stOpts+'</select>')+
      arsField("arsm-data","Data da adesão",'<input id="arsm-data" placeholder="2025-10-15">')+
      arsField("arsm-fonte","Fonte (link)",'<input id="arsm-fonte" type="url" placeholder="https://">')+
      arsField("arsm-obs","Observação",'<textarea id="arsm-obs" rows="2"></textarea>',true)+
    '</div><div id="arsmMsg"></div><button class="btn" type="submit">Salvar município</button></form>'+
    '<div class="panel"><h3>Municípios informados <small>'+cods.length+'</small></h3>'+(cods.length?'<div style="overflow-x:auto"><table><thead><tr><th>Município</th><th>Situação</th><th>Data</th><th></th></tr></thead><tbody>'+
      cods.map(function(c){ var i=M[c]; return '<tr><td>'+esc(arsMunName(c))+'</td><td>'+esc(A.MST[i.status]||i.status)+'</td><td>'+esc(i.data||"—")+'</td><td style="white-space:nowrap"><button class="btn ghost sm" data-arsm-edit="'+c+'">Editar</button> <button class="btn danger sm" data-arsm-del="'+c+'">Remover</button></td></tr>'; }).join("")+
      '</tbody></table></div>':'<p class="empty">Nenhum município informado.</p>')+'</div>';
  $("#arsMunForm").addEventListener("submit",function(e){
    e.preventDefault();
    var cod=arsMunCod($("#arsm-mun").value);
    if(!cod){ $("#arsmMsg").innerHTML='<div class="msg err">Escolha um município da lista.</div>'; return; }
    var item={ status:$("#arsm-st").value, data:$("#arsm-data").value.trim(), fonte:$("#arsm-fonte").value.trim(), obs:$("#arsm-obs").value.trim(), atualizadoEm:nowISO() };
    arsCommit(function(d){ d.municipios[cod]=item; },"Acessibilidade RS: selo estadual em "+arsMunName(cod)).then(function(){ toast(arsMunName(cod)+" salvo.","ok"); arsRender(); })
      .catch(function(er){ $("#arsmMsg").innerHTML='<div class="msg err">'+esc(er.message)+'</div>'; });
  });
  $all("[data-arsm-edit]",box).forEach(function(b){ b.addEventListener("click",function(){ var c=b.getAttribute("data-arsm-edit"), i=M[c]||{}; $("#arsm-mun").value=arsMunName(c); $("#arsm-st").value=i.status||"adesao"; $("#arsm-data").value=i.data||""; $("#arsm-fonte").value=i.fonte||""; $("#arsm-obs").value=i.obs||""; $("#arsm-mun").focus(); }); });
  $all("[data-arsm-del]",box).forEach(function(b){ b.addEventListener("click",function(){
    var c=b.getAttribute("data-arsm-del"); if(!confirm("Remover "+arsMunName(c)+" da lista do selo estadual?")) return;
    arsCommit(function(d){ delete d.municipios[c]; },"Acessibilidade RS: remove "+arsMunName(c)+" do selo estadual").then(function(){ toast("Município removido.","ok"); arsRender(); }).catch(function(er){ toast(er.message,"err"); });
  }); });
}

/* ---------- Resumo por regiao ---------- */
function arsResumo(box){
  var A=window.ARS, tot={3:0,2:0,1:0,0:0,f:0,t:0};
  var rows=A.REG_ORDER.map(function(r){
    var l=ars.dados.locais.filter(function(p){return arsReg(p.mun)===r;}), c={3:0,2:0,1:0,0:0}, f=0;
    l.forEach(function(p){ c[arsNivel(p)]++; if(p.faders) f++; });
    [3,2,1,0].forEach(function(n){ tot[n]+=c[n]; }); tot.f+=f; tot.t+=l.length;
    return '<tr><td>'+esc(A.REGIOES[r].nome)+'</td><td>'+c[3]+'</td><td>'+c[2]+'</td><td>'+c[1]+'</td><td>'+c[0]+'</td><td>'+f+'</td><td><b>'+l.length+'</b></td></tr>';
  }).join("");
  box.innerHTML='<div class="panel"><h3>Resumo por região</h3><div style="overflow-x:auto"><table><thead><tr><th>Região</th><th>Plena</th><th>Boa</th><th>Básica</th><th>Em análise</th><th>Selo FADERS</th><th>Total</th></tr></thead><tbody>'+rows+
    '<tr><td><b>Total</b></td><td><b>'+tot[3]+'</b></td><td><b>'+tot[2]+'</b></td><td><b>'+tot[1]+'</b></td><td><b>'+tot[0]+'</b></td><td><b>'+tot.f+'</b></td><td><b>'+tot.t+'</b></td></tr></tbody></table></div>'+
    '<p class="muted" style="margin-top:14px">Última atualização do guia: '+esc(fmtDate(ars.dados.atualizadoEm))+'</p></div>';
}

/* ===================================================================
   BOOTSTRAP
   =================================================================== */
document.addEventListener("DOMContentLoaded",function(){
  initLogin();
  var tok=null; try{ tok=sessionStorage.getItem("rb_token"); }catch(e){}
  tok=tok||lsGet("rb_token",null);
  if(tok){
    state.token=tok;
    $("#loginBtn").disabled=true; $("#loginBtn").textContent="Entrando…";
    gh("/user").then(function(u){ state.ghUser=u.login; state.user=lsGet("rb_email","")||u.login; enterApp(); })
      .catch(function(e){
        state.token=null; $("#loginBtn").disabled=false; $("#loginBtn").textContent="Entrar com segurança";
        if(e.status===401){ lsDel("rb_token"); try{ sessionStorage.removeItem("rb_token"); }catch(x){} showLoginMsg("Seu token expirou ou foi revogado. Gere um novo e cole abaixo.","err"); }
        else showLoginMsg("Não foi possível conectar ao GitHub: "+e.message,"err");
      });
  }
});
window.addEventListener("beforeunload",function(e){ if(edState.dirty){ e.preventDefault(); e.returnValue=""; } });

window.__RB={state:state,go:go};
})();
