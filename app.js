document.documentElement.classList.remove('no-js');
var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var SMALL = window.matchMedia('(max-width:980px)').matches; // mobile : on allege le hero (perf scroll)

// ===== scroll progress (rAF, GPU scaleX) =====
var prog=document.getElementById('prog'),ticking=false;
function updateProg(){var h=document.documentElement;var max=h.scrollHeight-h.clientHeight;var p=max>0?h.scrollTop/max:0;prog.style.transform='scaleX('+p+')';ticking=false;}
function onScroll(){if(!ticking){ticking=true;requestAnimationFrame(updateProg);}}
window.addEventListener('scroll',onScroll,{passive:true});
window.addEventListener('resize',onScroll,{passive:true});updateProg();

// ===== reveal on scroll (with fallbacks) =====
if(!('IntersectionObserver' in window) || RM){
  document.querySelectorAll('.reveal').forEach(function(el){el.classList.add('in');});
}else{
  var revIO=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){var el=e.target;var sibs=el.parentNode?Array.prototype.indexOf.call(el.parentNode.children,el):0;el.style.transitionDelay=(Math.min(sibs,6)*0.06)+'s';el.classList.add('in');revIO.unobserve(el);}});},{threshold:.12,rootMargin:'0px 0px -10% 0px'});
  document.querySelectorAll('.reveal').forEach(function(el){revIO.observe(el);});
}
// safety: never leave content hidden
setTimeout(function(){document.querySelectorAll('.reveal:not(.in)').forEach(function(el){el.classList.add('in');});},3000);
// ===== titres : sections repliables + UNE SEULE LIGNE (police auto-reduite si trop long) + (desktop) grossissement lie au scroll =====
(function(){
  var titles=[].slice.call(document.querySelectorAll('section:not(.hero) h2.title.reveal'));
  var subs=[].slice.call(document.querySelectorAll('section:not(.hero) h3.sub-h.reveal'));
  var viewOK=!!(window.CSS&&CSS.supports&&CSS.supports('animation-timeline','view()'));
  // repli : chevron + bascule au clic/clavier sur le titre (mise en place unique)
  titles.forEach(function(t){
    var sec=t.closest('section');if(!sec)return;
    var tog=document.createElement('span');tog.className='sec-toggle';tog.setAttribute('aria-hidden','true');
    tog.innerHTML='<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
    t.appendChild(tog);
    t.setAttribute('role','button');t.setAttribute('tabindex','0');t.setAttribute('aria-expanded','true');
    function toggle(){var c=sec.classList.toggle('collapsed');t.setAttribute('aria-expanded',c?'false':'true');if(!c)sec.querySelectorAll('.reveal:not(.in)').forEach(function(el){el.classList.add('in');});}
    t.addEventListener('click',toggle);
    t.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}});
  });
  // force chaque titre sur UNE ligne : reduit la police si le texte deborde la colonne
  function fit(t){
    t.style.whiteSpace='nowrap';t.style.fontSize='';
    var a=t.style.animation;t.style.animation='none';void t.offsetWidth;
    var avail=t.clientWidth,nat=t.scrollWidth;
    if(nat>avail+1){
      var fs=parseFloat(getComputedStyle(t).fontSize),target=fs*avail/nat*0.99;
      if(target>=24){t.style.fontSize=target.toFixed(1)+'px';}        // tient sur 1 ligne a une taille >= 24px
      else{t.style.whiteSpace='normal';t.style.fontSize='24px';}      // trop long : 2 lignes a 24px (plancher lisible) plutot que minuscule
    }
    t.style.animation=a;
  }
  // sous-titres : meme principe que fit() mais (a) le h3.sub-h est en FLEX avec une barre ::before
  // -> on mesure le TEXTE via Range (le scrollWidth est fausse par le retrecissement flex) et on
  // retranche barre+gap ; (b) plancher plus bas (~17px) car leur taille de base est deja petite ;
  // (c) RE-MESURE apres reduction : l'espacement (em) et un eventuel enfant en rem ne suivent pas
  // lineairement la taille, donc on verifie la largeur reelle et on corrige. Pas de neutralisation
  // d'animation : tmsSubIn ne fait que translater, ce qui ne change pas la largeur mesuree.
  function fitSub(t){
    if(t.clientWidth<=0)return;                                     // section repliee/masquee : on garde le dernier ajustement
    t.style.whiteSpace='nowrap';t.style.fontSize='';void t.offsetWidth;
    var cs=getComputedStyle(t);
    var over=(parseFloat(cs.columnGap||cs.gap)||0)+(parseFloat(getComputedStyle(t,'::before').width)||0);
    var avail=t.clientWidth-over;
    function txtW(){var r=document.createRange();r.selectNodeContents(t);return r.getBoundingClientRect().width;}
    var w=txtW();
    if(w>0&&avail>0&&w>avail+1){
      var fs=parseFloat(cs.fontSize),target=fs*avail/w*0.98;
      if(target<17){t.style.whiteSpace='normal';t.style.fontSize='17px';return;}  // trop long : 2 lignes a 17px
      t.style.fontSize=target.toFixed(1)+'px';
      var w2=txtW();                                                // largeur reelle a la nouvelle taille
      if(w2>avail){var t2=target*avail/w2*0.98;if(t2>=17){t.style.fontSize=t2.toFixed(1)+'px';}else{t.style.whiteSpace='normal';t.style.fontSize='17px';}}
    }
  }
  function setup(){
    var mobile=window.innerWidth<=980;
    titles.forEach(function(t){
      fit(t);                                                 // une seule ligne (toujours, mobile + desktop)
      if(viewOK&&!mobile){                                    // desktop : grossissement lie au scroll (centrage --tx, echelle --s plafonnee)
        t.style.animation='none';void t.offsetWidth;
        var C=t.clientWidth,r=document.createRange();r.selectNodeContents(t);var tw=r.getBoundingClientRect().width;t.style.animation='';
        if(C&&tw){var s=Math.min(1.5,(C*0.97)/tw);if(s<1)s=1;var tx=(C-s*tw)/2;if(tx<0)tx=0;t.style.setProperty('--s',s.toFixed(3));t.style.setProperty('--tx',Math.round(tx)+'px');}
      }else{t.style.removeProperty('--s');t.style.removeProperty('--tx');}
    });
    subs.forEach(fitSub);                                       // sous-titres sur une seule ligne (mobile + desktop)
  }
  setup();
  if(document.fonts&&document.fonts.ready){document.fonts.ready.then(setup);}  // re-mesure quand la police est chargee (sinon mesure avec la police de repli, plus large = sur-reduction)
  // rendu paresseux des sections (mobile) : on l'active SEULEMENT si on peut re-mesurer les titres au (re)rendu de chaque section
  if('oncontentvisibilityautostatechange' in HTMLElement.prototype){
    document.documentElement.classList.add('cv');
    [].forEach.call(document.querySelectorAll('section:not(.hero)'),function(sec){
      sec.addEventListener('contentvisibilityautostatechange',function(e){
        if(e.skipped)return;                                  // section masquee (loin de l'ecran) : rien a faire
        requestAnimationFrame(function(){var t=sec.querySelector('h2.title.reveal');if(t)fit(t);[].forEach.call(sec.querySelectorAll('h3.sub-h.reveal'),fitSub);});
      });
    });
  }
  var rt;window.addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(setup,200);},{passive:true});
})();

// ===== hero parallax =====
(function(){var hero=document.querySelector('.hero');if(!hero||RM||SMALL)return;var mine=hero.querySelector('.hero-mine'),bg=hero.querySelector('.hero-bg'),tk=false;
function frame(){var y=window.scrollY;if(y<window.innerHeight){if(mine)mine.style.transform='translate3d(0,'+(y*0.14)+'px,0)';if(bg)bg.style.transform='translate3d(0,'+(y*0.08)+'px,0)';}tk=false;}
window.addEventListener('scroll',function(){if(!tk){tk=true;requestAnimationFrame(frame);}},{passive:true});frame();})();

// ===== NIVEAU 7 : tunnel de mine en shader WebGL =====
(function(){
  if(RM||SMALL)return;
  var hero=document.querySelector('.hero');if(!hero)return;
  var canvas=hero.querySelector('.hero-gl');if(!canvas)return;
  var gl=canvas.getContext('webgl',{antialias:false,alpha:false,powerPreference:'low-power'})||canvas.getContext('experimental-webgl');
  if(!gl)return;
  var VS='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var FS=[
  'precision mediump float;',
  'uniform vec2 R;uniform float T;uniform vec2 M;uniform float S;',
  'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
  'void main(){',
  '  vec2 uv=(gl_FragCoord.xy-.5*R)/R.y;',
  '  uv+=M*.07;',
  // section de galerie : voûte ronde en haut, plancher plat en bas
  '  float rr=length(uv*vec2(1.,1.08));',
  '  if(uv.y<0.)rr=max(rr,-uv.y*2.6);',
  '  rr=max(rr,.05);',
  '  float z=.42/rr+T*.26+S*1.4;',
  '  float a=atan(uv.x,uv.y);',
  // parois
  '  float shade=.5+.5*cos(a*2.);',
  '  vec3 wall=mix(vec3(.040,.055,.085),vec3(.075,.095,.135),shade);',
  // cintres de soutènement, 1 sur 4 rouge sécurité (discrets)
  '  float beam=smoothstep(.08,.0,abs(fract(z)-.5)-.42);',
  '  float hz=step(.75,fract(floor(z)*.25));',
  '  vec3 beamCol=mix(vec3(.16,.20,.27),vec3(.42,.13,.14),hz);',
  '  vec3 col=wall;',
  '  col=mix(col,beamCol,beam*.7);',
  // halo de lampe frontale + lueur rouge marque (atténués)
  '  col+=vec3(1.,.66,.36)*exp(-rr*9.5)*.3;',
  '  col+=vec3(.7,.18,.18)*exp(-rr*3.4)*.07;',
  // brouillard de profondeur + vignette + grain
  '  col*=mix(.14,1.,smoothstep(.05,.95,rr));',
  '  col*=1.-.5*dot(uv,uv);',
  '  col+=(h21(gl_FragCoord.xy+fract(T))-.5)*.02;',
  '  gl_FragColor=vec4(col,1.);',
  '}'].join('\n');
  function sh(type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){return null;}return s;}
  var vs=sh(gl.VERTEX_SHADER,VS),fs=sh(gl.FRAGMENT_SHADER,FS);if(!vs||!fs)return;
  var pr=gl.createProgram();gl.attachShader(pr,vs);gl.attachShader(pr,fs);gl.linkProgram(pr);
  if(!gl.getProgramParameter(pr,gl.LINK_STATUS))return;
  gl.useProgram(pr);
  var buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  var loc=gl.getAttribLocation(pr,'a');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  var uR=gl.getUniformLocation(pr,'R'),uT=gl.getUniformLocation(pr,'T'),uM=gl.getUniformLocation(pr,'M'),uS=gl.getUniformLocation(pr,'S');
  var mx=0,my=0,tmx=0,tmy=0,visible=true,raf=null,t0=performance.now();
  function resize(){var dpr=Math.min(window.devicePixelRatio||1,1.5);if(canvas.clientWidth<700)dpr=Math.min(dpr,1.25);var w=Math.max(1,Math.floor(canvas.clientWidth*dpr)),h=Math.max(1,Math.floor(canvas.clientHeight*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}}
  window.addEventListener('resize',resize,{passive:true});resize();
  window.addEventListener('pointermove',function(e){tmx=(e.clientX/window.innerWidth-.5)*2;tmy=(e.clientY/window.innerHeight-.5)*2;},{passive:true});
  function frame(now){
    raf=null;
    if(!visible||document.hidden)return;
    mx+=(tmx-mx)*.05;my+=(tmy-my)*.05;
    gl.uniform2f(uR,canvas.width,canvas.height);
    gl.uniform1f(uT,(now-t0)/1000);
    gl.uniform2f(uM,mx,-my);
    gl.uniform1f(uS,Math.min(window.scrollY/Math.max(1,window.innerHeight),1.5));
    gl.drawArrays(gl.TRIANGLES,0,3);
    raf=requestAnimationFrame(frame);
  }
  function play(){if(!raf&&visible&&!document.hidden)raf=requestAnimationFrame(frame);}
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(es){es.forEach(function(e){visible=e.isIntersecting;play();});},{threshold:0}).observe(hero);
  }
  document.addEventListener('visibilitychange',play);
  hero.classList.add('gl-on');
  play();
})();

// ===== scroll-cue fade + bouton retour en haut =====
(function(){var cue=document.querySelector('.scroll-cue'),top=document.getElementById('toTop');
window.addEventListener('scroll',function(){
  if(cue)cue.classList.toggle('hide',window.scrollY>window.innerHeight*0.35);
  if(top)top.classList.toggle('show',window.scrollY>window.innerHeight*1.5);
},{passive:true});
if(top)top.addEventListener('click',function(){window.scrollTo({top:0,behavior:RM?'auto':'smooth'});});})();

// ===== image indisponible (fallback global) =====
document.addEventListener('error',function(e){var t=e.target;if(t&&t.tagName==='IMG'&&t.getAttribute('src')){var w=t.closest('.media,.info,.mimg,.foot');if(w)w.classList.add('img-missing');}},true);
document.addEventListener('load',function(e){var t=e.target;if(t&&t.tagName==='IMG'){var w=t.closest('.img-missing');if(w)w.classList.remove('img-missing');}},true);
// fiabilité : charger les vignettes sans délai + rattraper un échec déjà survenu (1 nouvelle tentative anti-cache)
document.querySelectorAll('.imgcard img').forEach(function(i){i.loading='eager';});
window.addEventListener('load',function(){document.querySelectorAll('.media img,.info img,.mimg img').forEach(function(i){var s=i.getAttribute('src');if(i.complete&&i.naturalWidth===0&&s&&!/[?&]r=/.test(s)){i.setAttribute('src',s.split('#')[0]+(s.indexOf('?')>-1?'&':'?')+'r='+Date.now());}});});

// ===== scrollspy (TOC) + sliding indicator + aria-current =====
var links=Array.from(document.querySelectorAll('.toc-link'));
var byId={};links.forEach(function(l){var id=(l.hash||'').slice(1);if(id)byId[id]=l;});  // l.hash gère les href "#ancre" ET "page.html#ancre" (decoupage en parties)
var ind=document.getElementById('tocInd');
function moveInd(el){if(!ind||!el||window.innerWidth<=980)return;ind.style.opacity='1';ind.style.height=el.offsetHeight+'px';ind.style.transform='translateY('+el.offsetTop+'px)';}
var targets=Object.keys(byId).map(function(id){return document.getElementById(id);}).filter(Boolean);
// --- pastille de chapitre flottante + section active (spotlight) au changement de section majeure ---
var secflag=document.getElementById('secflag'),sfNum=document.getElementById('sfNum'),sfLbl=document.getElementById('sfLbl');
var curSec=null,flagT=null;
function hideFlag(){if(secflag)secflag.classList.remove('show');}
function showFlag(sec){
  if(!secflag)return;
  var eb=sec.querySelector('.eyebrow'),h2=sec.querySelector('h2.title');
  if(!eb||!h2){hideFlag();return;} // pas de repere sur le hero
  var m=eb.textContent.match(/\d+/);
  sfNum.textContent=m?m[0]:'';
  sfLbl.textContent=h2.textContent.trim();
  if(window.innerWidth<=980){var tb=document.querySelector('.toc');secflag.style.top=(tb?tb.getBoundingClientRect().bottom+8:16)+'px';}
  else{secflag.style.top='';}
  secflag.classList.add('show');
  if(flagT)clearTimeout(flagT);
  flagT=setTimeout(hideFlag,2000);
}
function enterSection(target){
  var sec=target.closest&&target.closest('section');
  if(sec&&sec!==curSec){
    if(curSec)curSec.classList.remove('sec-active');
    sec.classList.add('sec-active');
    curSec=sec;
    showFlag(sec);
  }
}
if('IntersectionObserver' in window){
  var spyIO=new IntersectionObserver(function(es){
    es.forEach(function(e){if(e.isIntersecting){var id=e.target.id;if(byId[id]){links.forEach(function(l){l.classList.remove('active','justactive');l.removeAttribute('aria-current');});byId[id].classList.add('active','justactive');byId[id].setAttribute('aria-current','true');moveInd(byId[id]);var act=byId[id];if(act.scrollIntoView&&window.innerWidth<=980){act.scrollIntoView({block:'nearest',inline:'center',behavior:'auto'});}enterSection(e.target);}}});
  },{rootMargin:'-30% 0px -55% 0px',threshold:0});
  targets.forEach(function(t){spyIO.observe(t);});
}
window.addEventListener('resize',function(){var a=document.querySelector('.toc-link.active');if(a)moveInd(a);});
// en-tete mobile auto-masquant : se cache au scroll vers le bas, reapparait au scroll vers le haut (passif + rAF, zero cout)
(function(){var toc=document.querySelector('.toc');if(!toc)return;var last=0,ticking=false;function upd(){var y=window.scrollY||document.documentElement.scrollTop||0;if(window.innerWidth>980){toc.classList.remove('toc-hidden');last=y;ticking=false;return;}if(y>last&&y>240)toc.classList.add('toc-hidden');else if(y<last-4)toc.classList.remove('toc-hidden');last=y<0?0:y;ticking=false;}window.addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(upd);}},{passive:true});})();
// bascule FR/EN : memoriser la langue choisie au clic (ex-script inline du <head>)
document.querySelectorAll('.langswitch a').forEach(function(a){a.addEventListener('click',function(){try{localStorage.setItem('tms_lang',a.getAttribute('lang'));}catch(e){}});});
// FR/EN (.langswitch) ET sélecteur Base/Formation (.switch) : ne restent pas affichés -> visibles près du sommet (y<=140), se masquent ensemble au scroll vers le bas, reviennent au scroll vers le haut (passif + rAF, desktop ET mobile)
(function(){var ls=document.querySelector('.langswitch'),sw=document.querySelector('.switch');if(!ls&&!sw)return;var last=0,ticking=false;function set(h){if(ls)ls.classList.toggle('ls-hidden',h);if(sw)sw.classList.toggle('chr-hidden',h);}function upd(){var y=window.scrollY||document.documentElement.scrollTop||0;if(y<=140)set(false);else if(y>last+2)set(true);else if(y<last-6)set(false);last=y<0?0:y;ticking=false;}upd();window.addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(upd);}},{passive:true});})();

// ===== anchor focus for keyboard =====
document.querySelectorAll('a[href^="#"]').forEach(function(a){a.addEventListener('click',function(){var t=document.getElementById(a.getAttribute('href').slice(1));if(t){t.setAttribute('tabindex','-1');setTimeout(function(){t.focus({preventScroll:true});},RM?0:450);}});});

// ===== animated counters =====
function animStat(el){
  var raw=el.getAttribute('data-final')||el.textContent.trim();el.setAttribute('data-final',raw);
  if(raw.indexOf('/')>-1)return;
  var m=raw.match(/\d[\d  ]*(?:,\d+)?/);if(!m)return;
  var num=m[0],pre=raw.slice(0,m.index),post=raw.slice(m.index+num.length),dec=num.indexOf(',')>-1;
  var val=parseFloat(num.replace(/[  ]/g,'').replace(',','.'));if(isNaN(val))return;
  function fmt(v){return dec?v.toFixed(1).replace('.',','):Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ');}
  if(RM){el.textContent=pre+fmt(val)+post;return;}
  var t0=null;el.textContent=pre+fmt(0)+post;
  function step(ts){if(!t0)t0=ts;var p=Math.min((ts-t0)/1100,1);el.textContent=pre+fmt(val*p)+post;if(p<1)requestAnimationFrame(step);}requestAnimationFrame(step);
}
if('IntersectionObserver' in window){
  var statIO=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){animStat(e.target);statIO.unobserve(e.target);}});},{threshold:.6});
  document.querySelectorAll('.stat .v[data-count]').forEach(function(el){statIO.observe(el);});
}else{document.querySelectorAll('.stat .v[data-count]').forEach(animStat);}

// ===== scroll lock (no jump, iOS-safe) =====
var _sy=0;
function lockScroll(){_sy=window.scrollY;document.body.style.position='fixed';document.body.style.top=(-_sy)+'px';document.body.style.left='0';document.body.style.right='0';document.body.style.width='100%';}
function unlockScroll(){document.body.style.position='';document.body.style.top='';document.body.style.left='';document.body.style.right='';document.body.style.width='';window.scrollTo(0,_sy);}

// ===== focus trap helper =====
var lastFocus=null;
function trap(container,e){if(e.key!=='Tab')return;var f=container.querySelectorAll('button,[href],[tabindex]:not([tabindex="-1"])');if(!f.length)return;var first=f[0],last=f[f.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
var layer=document.querySelector('.layout');
function bgInert(on){if(layer){if(on)layer.setAttribute('inert','');else layer.removeAttribute('inert');}}

// ===== modal (in-page detail) =====
var MODAL_DATA={
  lombalgie:{tag:'Type de TMS',title:'Lombalgie',img:'images/tms_lombalgie.jpeg',desc:"Atteinte du bas du dos touchant les vertèbres lombaires, les disques et les muscles. C'est le trouble musculosquelettique le plus répandu en milieu de travail.",risk:['Manutention de charges lourdes','Flexions et torsions répétées du tronc','Postures penchées ou assises prolongées','Vibrations transmises au corps entier'],prev:['Plier les genoux, garder le dos droit','Garder la charge près du corps','Ne pas tourner le tronc en soulevant',"Utiliser une aide mécanique ou demander de l'aide"]},
  tendinite:{tag:'Type de TMS',title:'Tendinite',img:'images/tms_tendinite.jpeg',desc:"Inflammation d'un tendon, le plus souvent à l'épaule, au coude ou au poignet. Apparaît quand le tendon est trop sollicité sans récupération suffisante.",risk:['Mouvements répétitifs','Efforts intenses ou prolongés','Prises et serrages fréquents','Vibrations des outils'],prev:['Alterner les tâches et les gestes','Prendre des micro-pauses',"S'échauffer avant l'effort","Adapter l'outil et la hauteur de travail"]},
  bursite:{tag:'Type de TMS',title:'Bursite',img:'images/tms_bursite.jpeg',desc:"Inflammation des bourses séreuses, ces petits coussinets qui amortissent les articulations. Fréquente aux genoux et aux épaules.",risk:['Position à genoux prolongée','Appuis et frottements répétés','Chocs ou pressions directes','Travail bras levés'],prev:['Porter des genouillères','Varier les postures régulièrement','Éviter les appuis prolongés','Aménager un support sous les genoux']},
  carpien:{tag:'Type de TMS',title:'Canal carpien',img:'images/tms_carpien.jpeg',desc:"Compression du nerf médian dans le poignet. Provoque engourdissements, fourmillements et perte de force dans la main.",risk:['Mouvements répétitifs du poignet','Force de préhension élevée','Poignet plié longtemps','Vibrations des outils'],prev:['Garder le poignet en position neutre','Utiliser des outils ergonomiques','Réduire la force de serrage','Faire des pauses et des étirements']},
  dos:{tag:'Zone à risque',title:'Dos et bas du dos',img:'images/zone_dos.jpeg',desc:"Le bas du dos encaisse la majorité des efforts de manutention. C'est la zone la plus touchée par les TMS sous terre.",risk:['Manutention de charges lourdes','Flexions du tronc','Torsions en charge','Vibrations transmises au corps entier'],prev:['Plier les genoux, pas le dos','Garder la charge près du corps','Pivoter avec les pieds, pas le tronc','Aides mécaniques quand possible']},
  epaules:{tag:'Zone à risque',title:'Épaules',img:'images/zone_epaules.jpeg',desc:"Les épaules sont sollicitées dès que l'on travaille les bras levés ou que l'on manipule des charges en hauteur.",risk:['Travail bras levés','Vibrations','Charges en hauteur','Gestes répétés au-dessus des épaules'],prev:['Travailler à hauteur de poitrine','Rapprocher le travail de soi','Alterner les bras et les tâches','Utiliser des supports ou plateformes']},
  cou:{tag:'Zone à risque',title:'Cou et nuque',img:'images/zone_cou.jpeg',desc:"Le cou et la nuque souffrent des postures statiques et du poids de l'équipement porté sur la tête.",risk:['Postures statiques prolongées',"Tête penchée vers l'avant",'Poids du casque et de la lampe','Manque de mouvement'],prev:["Garder la tête dans l'axe",'Faire des rotations douces du cou',"Ajuster l'éclairage et la position",'Bouger régulièrement']},
  poignets:{tag:'Zone à risque',title:'Poignets et mains',img:'images/zone_poignets.jpeg',desc:"Poignets et mains sont exposés aux outils vibrants et aux gestes de prise et de serrage répétés.",risk:['Outils vibrants','Prises et serrages répétés','Force de serrage élevée','Poignet plié ou dévié sous effort'],prev:['Poignets en position neutre','Outils adaptés et anti-vibrations','Réduire la force de prise','Pauses et étirements']},
  coudes:{tag:'Zone à risque',title:'Coudes',img:'images/zone_coudes.jpeg',desc:"Les coudes sont mis à l'épreuve par les mouvements répétés et la force exercée en torsion.",risk:['Mouvements répétés','Force en torsion','Efforts en flexion-extension','Appuis prolongés sur le coude'],prev:['Alterner les tâches et les gestes','Réduire la force en torsion','Faire des pauses régulières','Échauffer les avant-bras']},
  genoux:{tag:'Zone à risque',title:'Genoux',img:'images/zone_genoux.jpeg',desc:"Les genoux subissent les positions accroupies, le travail à genoux et l'instabilité du sol en mine.",risk:['Position accroupie','Travail à genoux','Sol inégal et instable','Déplacements sur terrain difficile'],prev:['Porter des genouillères','Varier les appuis et postures','Se relever régulièrement','Sécuriser et stabiliser le sol']}
};
var modal=document.getElementById('modal');
var mImg=document.getElementById('mImg'),mTag=document.getElementById('mTag'),mTitle=document.getElementById('mTitle'),mDesc=document.getElementById('mDesc'),mRisk=document.getElementById('mRisk'),mPrev=document.getElementById('mPrev');
var modalInner=modal.querySelector('.modal');
function openModal(k){var d=MODAL_DATA[k];if(!d)return;lastFocus=document.activeElement;modalInner.classList.remove('no-img');mImg.onload=function(){modalInner.classList.remove('no-img');};mImg.onerror=function(){modalInner.classList.add('no-img');};mImg.src=d.img;mImg.alt=d.title;mTag.textContent=d.tag;mTitle.textContent=d.title;mDesc.textContent=d.desc;mRisk.innerHTML=d.risk.map(function(x){return '<li>'+x+'</li>';}).join('');mPrev.innerHTML=d.prev.map(function(x){return '<li>'+x+'</li>';}).join('');lockScroll();bgInert(true);modal.classList.add('open');document.getElementById('mclose').focus();}
function closeModal(){if(!modal.classList.contains('open'))return;modal.classList.remove('open');bgInert(false);unlockScroll();if(lastFocus)lastFocus.focus();}
document.querySelectorAll('[data-modal]').forEach(function(el){el.addEventListener('click',function(){openModal(el.dataset.modal);});el.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openModal(el.dataset.modal);}});});
document.getElementById('mclose').addEventListener('click',closeModal);
modal.addEventListener('click',function(e){if(e.target===modal)closeModal();});
modal.querySelector('.modal').addEventListener('keydown',function(e){trap(this,e);});

// ===== lightbox =====
var lb=document.getElementById('lb'),lbImg=document.getElementById('lbImg');
function openLB(s,a){lastFocus=document.activeElement;lbImg.src=s;lbImg.alt=a||'';lockScroll();bgInert(true);lb.classList.add('open');document.getElementById('lbclose').focus();}
function closeLB(){if(!lb.classList.contains('open'))return;lb.classList.remove('open');bgInert(false);unlockScroll();if(lastFocus)lastFocus.focus();}
document.querySelectorAll('.info[data-img]').forEach(function(el){
  el.addEventListener('click',function(){openLB(el.dataset.img,el.querySelector('img')?el.querySelector('img').alt:'');});
  el.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openLB(el.dataset.img,el.querySelector('img')?el.querySelector('img').alt:'');}});
});
document.getElementById('lbclose').addEventListener('click',closeLB);
lb.addEventListener('click',function(e){if(e.target===lb)closeLB();});
lb.addEventListener('keydown',function(e){trap(lb,e);});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){closeModal();closeLB();}});

// ===== cartes facteurs dépliables =====
document.querySelectorAll('.faccard').forEach(function(c){
  c.addEventListener('click',function(){var open=c.classList.toggle('open');c.setAttribute('aria-expanded',open?'true':'false');});
});

// ===== recherche (palette, raccourcis / et Ctrl+K) =====
(function(){
  var cmdk=document.getElementById('cmdk'),input=document.getElementById('cmdkInput'),list=document.getElementById('cmdkList'),openBtn=document.getElementById('searchOpen');
  if(!cmdk||!openBtn)return;
  document.querySelectorAll('h3.sub-h').forEach(function(h,i){if(!h.id)h.id='sujet-'+i;});
  var ITEMS=[];
  document.querySelectorAll('.toc-link').forEach(function(l){if(!l.hash)return;ITEMS.push({k:'Section',label:l.textContent.trim(),sub:'',go:l.getAttribute('href')});});
  document.querySelectorAll('h3.sub-h').forEach(function(h){ITEMS.push({k:'Sujet',label:h.textContent.replace(/\s+/g,' ').replace(/:.*clique.*$/i,'').trim(),sub:'',go:'#'+h.id});});
  Object.keys(MODAL_DATA).forEach(function(key){var d=MODAL_DATA[key];ITEMS.push({k:'Fiche',label:d.title,sub:d.tag,modal:key,kw:(d.desc+' '+d.risk.join(' ')+' '+d.prev.join(' '))});});
  ITEMS.push({k:'Section',label:'Quiz prévention TMS',sub:'#quiz',go:'#quiz',kw:'quiz test questions connaissances évaluation'});
  ITEMS.push({k:'Page',label:'Formation guidée : quiz et attestation',sub:'formation.html',go:'formation.html',kw:'quiz attestation certificat formation guidée score'});
  var filtered=[],active=0;
  function norm(s){return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');}
  function render(q){q=norm((q||'').trim());filtered=ITEMS.filter(function(it){return !q||norm(it.label).indexOf(q)>-1||norm(it.kw).indexOf(q)>-1;});active=0;
    if(!filtered.length){list.innerHTML='<div class="cmdk-empty">Aucun résultat. Essaie « dos », « sommeil », « genoux »…</div>';return;}
    list.innerHTML=filtered.map(function(it,i){return '<div class="cmdk-item'+(i===0?' active':'')+'" data-i="'+i+'" role="option" aria-selected="'+(i===0)+'"><span class="ci-k">'+it.k+'</span><span>'+it.label+'</span>'+(it.sub?'<span class="ci-sub">'+it.sub+'</span>':'')+'</div>';}).join('');
    Array.prototype.forEach.call(list.children,function(el){el.addEventListener('click',function(){pick(+el.dataset.i);});});}
  function upd(){Array.prototype.forEach.call(list.children,function(el,i){el.classList.toggle('active',i===active);el.setAttribute('aria-selected',i===active);});var a=list.children[active];if(a&&a.scrollIntoView)a.scrollIntoView({block:'nearest'});}
  function openK(){lastFocus=document.activeElement;lockScroll();bgInert(true);cmdk.classList.add('open');input.value='';render('');setTimeout(function(){input.focus();},40);}
  function closeK(){if(!cmdk.classList.contains('open'))return;cmdk.classList.remove('open');bgInert(false);unlockScroll();if(lastFocus)lastFocus.focus();}
  function pick(i){var it=filtered[i];if(!it)return;closeK();
    if(it.modal){openModal(it.modal);return;}
    if(it.go&&it.go.charAt(0)!=='#'){window.location.href=it.go;return;}
    var t=document.querySelector(it.go);if(t){t.scrollIntoView({behavior:RM?'auto':'smooth'});t.setAttribute('tabindex','-1');setTimeout(function(){t.focus({preventScroll:true});},RM?0:450);}}
  openBtn.addEventListener('click',openK);
  input.addEventListener('input',function(){render(input.value);});
  input.addEventListener('keydown',function(e){if(e.key==='Escape'){closeK();}else if(e.key==='ArrowDown'){e.preventDefault();active=Math.min(active+1,filtered.length-1);upd();}else if(e.key==='ArrowUp'){e.preventDefault();active=Math.max(active-1,0);upd();}else if(e.key==='Enter'){pick(active);}});
  cmdk.addEventListener('click',function(e){if(e.target===cmdk)closeK();});
  cmdk.addEventListener('keydown',function(e){trap(cmdk,e);});
  document.addEventListener('keydown',function(e){
    var tg=e.target,typing=tg&&(/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)||tg.isContentEditable);
    if((e.ctrlKey||e.metaKey)&&(e.key==='k'||e.key==='K')){e.preventDefault();openK();return;}
    if(e.key==='/'&&!typing){e.preventDefault();openK();return;}
    if(e.key==='Escape')closeK();
  });
})();

// ===== basculer version mobile / version ordinateur =====
(function(){
  var btn=document.getElementById('viewToggle');if(!btn)return;
  var vp=document.querySelector('meta[name="viewport"]');if(!vp)return;
  var MOBILE=vp.getAttribute('content');
  var lbl=document.getElementById('viewToggleLbl');
  // afficher dès que la mise en page mobile est visible (fenêtre étroite, zoom ou téléphone)
  if(!window.matchMedia('(max-width:980px)').matches)return;
  btn.hidden=false;
  function mode(){try{return localStorage.getItem('tms_view')||'mobile';}catch(e){return 'mobile';}}
  function apply(m){
    if(m==='desktop'){
      var sc=Math.max(.25,Math.min(1,screen.width/1100));
      vp.setAttribute('content','width=1100, initial-scale='+sc.toFixed(3));
      lbl.textContent='Version mobile';
    }else{
      vp.setAttribute('content',MOBILE);
      lbl.textContent='Version ordinateur';
    }
  }
  btn.addEventListener('click',function(){
    var m=mode()==='desktop'?'mobile':'desktop';
    try{localStorage.setItem('tms_view',m);}catch(e){}
    apply(m);
    window.scrollTo(0,window.scrollY); // force un recalcul propre
  });
  apply(mode());
})();

// ===== impression : ouvrir tous les accordéons =====
window.addEventListener('beforeprint',function(){document.querySelectorAll('details.xpand').forEach(function(d){d.dataset.wasOpen=d.open?'1':'';d.open=true;});});
window.addEventListener('afterprint',function(){document.querySelectorAll('details.xpand').forEach(function(d){if(!d.dataset.wasOpen)d.open=false;});});


(function () {

/* ================================================================
   DONNÉES
   ================================================================ */
const FAMILLES = {
  biomecanique: { nom: "Facteurs biomécaniques", couleur: "#1b6e96", clair: "#2e8fc0" },
  individuel: { nom: "Facteurs individuels", couleur: "#d97a16", clair: "#f09430" },
  environnement: { nom: "Facteurs environnementaux", couleur: "#5a9421", clair: "#74b62e" }
};

const DETAILS = {
  /* ----- Les trois familles ----- */
  "biomecanique": {
    categorie: "Grande famille", titre: "Facteurs biomécaniques", icone: "💪", couleur: "#1b6e96",
    description: "Ce sont les contraintes physiques de la tâche, soit la force, la répétition, les postures et les charges, qui sollicitent ton corps au-delà de sa capacité à récupérer.",
    exemples: [
      "Efforts : pousser, tirer ou soulever en forçant.",
      "Répétition : refaire le même geste des centaines de fois par quart.",
      "Postures : travailler le dos courbé, les poignets pliés ou le cou penché."
    ],
    prevention: [
      "Réduis le poids des charges ou utilise des aides mécaniques.",
      "Varie tes gestes et alterne les tâches.",
      "Garde des postures neutres en aménageant ton poste."
    ],
    zones: ["epaules", "haut-dos", "bas-dos", "coudes", "poignets-mains"],
    voirAussi: ["manutention", "mouvements-repetes", "combinaison"]
  },
  "individuel": {
    categorie: "Grande famille", titre: "Facteurs individuels", icone: "🧍", couleur: "#d97a16",
    description: "Ton corps n'encaisse pas les mêmes contraintes selon ta fatigue, ton sommeil, ta forme, une douleur déjà là ou ton expérience.",
    exemples: [
      "Fatigue : un corps fatigué se protège moins bien.",
      "Sommeil : mal dormir ralentit la réparation des tissus.",
      "Douleur déjà présente : une zone mal guérie reste fragile."
    ],
    prevention: [
      "Signale tôt toute douleur qui persiste.",
      "Soigne ton sommeil et ton hygiène de vie.",
      "Prévois une période d'adaptation pour les nouveaux."
    ],
    zones: [],
    voirAussi: ["recuperation", "fatigue", "combinaison"]
  },
  "environnement": {
    categorie: "Grande famille", titre: "Facteurs environnementaux", icone: "🌡️", couleur: "#5a9421",
    description: "Le contexte de travail, soit des outils mal adaptés, des vibrations, le froid, un espace exigu ou un sol instable, force ton corps à travailler plus fort pour le même résultat.",
    exemples: [
      "Outils : un outil mal adapté exige plus de force.",
      "Vibrations : elles fatiguent les mains, les bras et le dos.",
      "Froid : il raidit tes muscles et te fait serrer plus fort."
    ],
    prevention: [
      "Choisis et entretiens des outils ergonomiques.",
      "Dégage et organise ton espace de travail.",
      "Garde les sols propres, plans et stables."
    ],
    zones: ["poignets-mains", "bas-dos", "genoux"],
    voirAussi: ["froid", "outils-vibrants", "combinaison"]
  },

  /* ----- Situations à risque : famille biomécanique ----- */
  "manutention": {
    categorie: "Sous-facteur biomécanique", titre: "Manutention", icone: "📦", couleur: "#2e8fc0", famille: "biomecanique",
    description: "Soulever, transporter, pousser ou tirer des charges sollicite fortement ton dos, tes épaules et tes bras.",
    exemples: [
      "Soulever une charge au sol en arrondissant le dos.",
      "Transporter une charge loin du corps, bras tendus.",
      "Tirer une charge lourde sur une longue distance."
    ],
    prevention: [
      "Utilise une aide mécanique quand c'est possible.",
      "Garde la charge près du corps et plie les genoux.",
      "Travaille à deux pour les objets encombrants."
    ],
    zones: ["bas-dos", "epaules", "poignets-mains"],
    voirAussi: ["charges", "efforts", "torsion"]
  },
  "bras-leves": {
    categorie: "Situation à risque · famille biomécanique", titre: "Travail bras levés", icone: "🙆", couleur: "#2e8fc0", famille: "biomecanique",
    description: "Travailler les mains au-dessus des épaules garde les tendons de ton épaule en tension et les irrigue mal.",
    exemples: [
      "Visser ou boulonner au-dessus de la tête.",
      "Tirer des câbles ou des conduits en hauteur.",
      "Poser des panneaux ou des fixations au plafond."
    ],
    prevention: [
      "Utilise une plateforme pour travailler à hauteur d'épaule.",
      "Limite la durée des tâches bras levés et alterne.",
      "Prépare le matériel à portée de main avant de monter."
    ],
    zones: ["epaules", "cou"],
    voirAussi: ["hauteur-travail", "postures"]
  },
  "mouvements-repetes": {
    categorie: "Situation à risque · famille biomécanique", titre: "Gestes rapides en continu", icone: "⏱️", couleur: "#2e8fc0", famille: "biomecanique",
    description: "Répéter le même geste sans pause empêche tes tissus de récupérer, et c'est l'accumulation qui blesse.",
    exemples: [
      "Assembler les mêmes pièces sans interruption.",
      "Découper ou ébavurer à un rythme soutenu.",
      "Visser la même fixation des centaines de fois par quart."
    ],
    prevention: [
      "Fais une rotation des tâches entre collègues.",
      "Introduis des micro-pauses régulières.",
      "Mécanise les gestes les plus répétitifs quand c'est possible."
    ],
    zones: ["poignets-mains", "coudes", "epaules"],
    voirAussi: ["recuperation", "prise-serree"]
  },
  "posture-statique": {
    categorie: "Situation à risque · famille biomécanique", titre: "Posture statique", icone: "🪑", couleur: "#2e8fc0", famille: "biomecanique",
    description: "Rester longtemps dans la même position, assis ou debout, contracte tes muscles en continu et ralentit ta circulation.",
    exemples: [
      "Travailler debout immobile à un poste de surveillance.",
      "Maintenir les bras dans la même position pour tenir une pièce.",
      "Conduire de longues heures sans pause."
    ],
    prevention: [
      "Lève-toi, marche et étire-toi régulièrement.",
      "Alterne les positions assise et debout.",
      "Planifie des pauses actives dans ton horaire."
    ],
    zones: ["cou", "haut-dos", "bas-dos"],
    voirAussi: ["postures", "espace-travail"]
  },
  "prise-serree": {
    categorie: "Situation à risque · famille biomécanique", titre: "Prise serrée", icone: "✊", couleur: "#2e8fc0", famille: "biomecanique",
    description: "Serrer fort un outil, surtout du bout des doigts, sollicite intensément les tendons de ta main et de ton avant-bras.",
    exemples: [
      "Tenir fermement une visseuse toute la journée.",
      "Couper avec des pinces à répétition.",
      "Saisir des pièces lisses ou glissantes du bout des doigts."
    ],
    prevention: [
      "Choisis des outils avec des poignées adaptées à ta main.",
      "Privilégie la prise pleine main plutôt que la pince.",
      "Porte des gants ajustés qui n'obligent pas à serrer plus."
    ],
    zones: ["poignets-mains", "coudes"],
    voirAussi: ["outils", "froid", "outils-vibrants"]
  },
  "travail-genoux": {
    categorie: "Situation à risque · famille biomécanique", titre: "Appui sur genou", icone: "🧎", couleur: "#2e8fc0", famille: "biomecanique",
    description: "T'agenouiller ou t'accroupir comprime directement ton genou et le plie à l'extrême.",
    exemples: [
      "Travailler au ras du sol pour une réparation.",
      "Intervenir sous un équipement bas.",
      "Rester accroupi longtemps pour ajuster une pièce."
    ],
    prevention: [
      "Porte des genouillères ou pose un tapis rembourré.",
      "Utilise un petit banc ou un siège bas quand c'est possible.",
      "Relève-toi et bouge les jambes fréquemment."
    ],
    zones: ["genoux", "bas-dos"],
    voirAussi: ["espace-travail", "sol-inegal"]
  },

  /* ----- Situation à risque : famille individuelle ----- */
  "recuperation": {
    categorie: "Sous-facteur individuel", titre: "Récupération", icone: "😴", couleur: "#f09430", famille: "individuel",
    description: "Ton corps répare ses tissus pendant les pauses et le repos, et sans assez de récupération, les microlésions s'accumulent plus vite qu'elles ne guérissent.",
    exemples: [
      "Enchaîner les quarts sans journée de repos.",
      "Sauter tes pauses pour finir plus vite.",
      "Cadence imposée qui ne laisse aucun répit entre les cycles."
    ],
    prevention: [
      "Prends de vraies pauses et fais-en de vraies coupures.",
      "Alterne tâches exigeantes et tâches légères.",
      "Limite les heures supplémentaires répétées."
    ],
    zones: [],
    voirAussi: ["fatigue", "sommeil", "mouvements-repetes"]
  },

  /* ----- Situations à risque : famille environnement ----- */
  "outils-vibrants": {
    categorie: "Sous-facteur environnemental", titre: "Vibrations", icone: "📳", couleur: "#74b62e", famille: "environnement",
    description: "Les vibrations d'un outil endommagent peu à peu les nerfs, les vaisseaux et les articulations de tes mains et de tes bras.",
    exemples: [
      "Utiliser un marteau-piqueur ou une perceuse à percussion.",
      "Meuler ou poncer longtemps de suite.",
      "Visser avec une clé à choc à répétition."
    ],
    prevention: [
      "Choisis des outils antivibratiles et bien entretenus.",
      "Limite le temps d'exposition par jour et alterne les tâches.",
      "Porte des gants antivibrations et évite de trop serrer l'outil."
    ],
    zones: ["poignets-mains", "coudes", "epaules"],
    voirAussi: ["outils", "froid", "prise-serree"]
  },
  "hauteur-travail": {
    categorie: "Situation à risque · famille environnement", titre: "Niveau de travail", icone: "↕️", couleur: "#74b62e", famille: "environnement",
    description: "Quand le plan de travail est trop bas ton dos se courbe, et trop haut tes épaules montent, ton corps force pour rien dans les deux cas.",
    exemples: [
      "Travailler sur une surface trop basse qui t'oblige à courber le dos.",
      "Manœuvrer un équipement placé trop haut qui te force à hausser les épaules.",
      "Intervenir au fond d'une excavation ou d'une ouverture profonde."
    ],
    prevention: [
      "Règle la hauteur du travail à la tâche et à ta taille.",
      "Utilise un support réglable ou une plateforme.",
      "Place le travail entre tes hanches et tes épaules."
    ],
    zones: ["haut-dos", "bas-dos", "epaules", "cou"],
    voirAussi: ["postures", "bras-leves", "espace-travail"]
  },
  "froid": {
    categorie: "Situation à risque · famille environnement", titre: "Froid et humidité", icone: "❄️", couleur: "#74b62e", famille: "environnement",
    description: "Le froid raidit tes muscles et tes tendons, réduit la sensibilité de tes mains et te pousse à serrer plus fort, et l'humidité aggrave tout.",
    exemples: [
      "Travailler en galerie froide et humide en continu.",
      "Manipuler du métal froid à mains nues ou mal protégées.",
      "Subir des courants d'air froid à un poste fixe."
    ],
    prevention: [
      "Porte des vêtements et des gants adaptés au froid et reste au sec.",
      "Prends des pauses de réchauffement dans un endroit tempéré.",
      "Échauffe-toi avant l'effort et isole les poignées d'outils."
    ],
    zones: ["poignets-mains"],
    voirAussi: ["temperature", "prise-serree", "outil-percussion", "outils-vibrants"]
  },

  /* ----- Sous-facteurs biomécaniques ----- */
  "efforts": {
    categorie: "Sous-facteur biomécanique", titre: "Effort", icone: "🏋️", couleur: "#2e8fc0", famille: "biomecanique",
    description: "Forcer pour pousser, tirer, soulever ou serrer met tes muscles et tes tendons sous forte tension.",
    exemples: [
      "Pousser un équipement lourd ou mal graissé.",
      "Desserrer un raccord grippé à la clé.",
      "Découper une matière dure avec un outil émoussé."
    ],
    prevention: [
      "Mécanise ou utilise une aide pour les efforts les plus intenses.",
      "Entretiens tes outils pour réduire la résistance.",
      "Demande de l'aide pour les efforts exceptionnels."
    ],
    zones: ["epaules", "haut-dos", "bas-dos", "coudes"],
    voirAussi: ["manutention", "charges", "prise-serree"]
  },
  "postures": {
    categorie: "Sous-facteur biomécanique", titre: "Posture", icone: "🧘", couleur: "#2e8fc0", famille: "biomecanique",
    description: "Une articulation qui s'éloigne de sa position neutre, comme un dos courbé ou un cou fléchi, se surcharge vite.",
    exemples: [
      "Travailler le dos penché vers l'avant.",
      "Garder le cou fléchi vers la pièce.",
      "Atteindre un objet placé trop loin ou trop bas."
    ],
    prevention: [
      "Rapproche le travail de ton corps.",
      "Garde tes articulations proches du neutre.",
      "Change souvent de position."
    ],
    zones: ["cou", "haut-dos", "bas-dos", "poignets-mains"],
    voirAussi: ["posture-statique", "hauteur-travail"]
  },
  "charges": {
    categorie: "Situation à risque · famille biomécanique", titre: "Boîte loin du corps", icone: "📦", couleur: "#2e8fc0", famille: "biomecanique",
    description: "Plus une charge est portée loin de ton tronc, plus l'effort réel sur ton dos explose, bien au-delà du poids réel.",
    exemples: [
      "Saisir une charge au fond d'un espace profond.",
      "Porter un objet à bout de bras pour mieux voir.",
      "Manipuler une pièce volumineuse impossible à coller au corps."
    ],
    prevention: [
      "Rapproche la charge de ton tronc avant de soulever.",
      "Glisse ou pivote la charge vers toi plutôt que de tendre les bras.",
      "Dégage les obstacles pour te placer au plus près."
    ],
    zones: ["bas-dos", "epaules", "poignets-mains"],
    voirAussi: ["manutention", "efforts", "torsion"]
  },
  "torsion": {
    categorie: "Sous-facteur biomécanique", titre: "Torsion", icone: "🌀", couleur: "#2e8fc0", famille: "biomecanique",
    description: "Tourner ton tronc ou tes poignets pendant un effort écrase et cisaille tes disques et tes tendons, surtout charge en main.",
    exemples: [
      "Pivoter le tronc en tenant une charge au lieu de bouger les pieds.",
      "Visser à la main à répétition.",
      "Atteindre un objet derrière toi sans te déplacer."
    ],
    prevention: [
      "Pivote avec tes pieds, jamais avec le tronc en charge.",
      "Place le matériel face à toi.",
      "Utilise des outils à renvoi d'angle."
    ],
    zones: ["bas-dos", "poignets-mains"],
    voirAussi: ["manutention", "postures"]
  },

  /* ----- Sous-facteurs individuels ----- */
  "fatigue": {
    categorie: "Sous-facteur individuel", titre: "Fatigue", icone: "🥱", couleur: "#f09430", famille: "individuel",
    description: "Quand tu es fatigué, ta force, ta vigilance et ta coordination baissent, tes gestes deviennent moins précis et ton corps compense par de mauvaises postures.",
    exemples: [
      "Fin de quart où tout semble plus lourd.",
      "Période de pointe avec surcharge prolongée.",
      "Cumul de deux emplois physiques."
    ],
    prevention: [
      "Prends de vraies pauses avant l'épuisement.",
      "Alterne les tâches exigeantes et légères.",
      "Écoute les signaux de ton corps et dis-le."
    ],
    zones: [],
    voirAussi: ["sommeil", "recuperation"]
  },
  "sommeil": {
    categorie: "Sous-facteur individuel", titre: "Sommeil", icone: "🌙", couleur: "#f09430", famille: "individuel",
    description: "C'est pendant ton sommeil que tes muscles et tes tendons se réparent, et un manque chronique augmente la douleur et fragilise tes tissus.",
    exemples: [
      "Horaires rotatifs qui dérèglent ton horloge interne.",
      "Travail de nuit avec sommeil de jour écourté.",
      "Insomnies liées au stress."
    ],
    prevention: [
      "Vise 7 à 9 heures de sommeil régulier.",
      "Stabilise tes horaires autant que possible.",
      "Limite les écrans et les stimulants en fin de soirée."
    ],
    zones: [],
    voirAussi: ["fatigue", "recuperation"]
  },
  "condition-physique": {
    categorie: "Sous-facteur individuel", titre: "Capacité physique", icone: "🏃", couleur: "#f09430", famille: "individuel",
    description: "Ton endurance, ta force et ta souplesse fixent la marge entre ce que la tâche exige et ce que ton corps peut donner, et plus elle est mince, plus vite la fatigue arrive.",
    exemples: [
      "Reprise du travail après un long arrêt.",
      "Mode de vie sédentaire combiné à un travail physique.",
      "Tâche dont l'exigence dépasse tes capacités du moment."
    ],
    prevention: [
      "Bouge et pratique une activité physique régulière.",
      "Échauffe-toi avant les tâches exigeantes.",
      "Reprends graduellement après une absence."
    ],
    zones: [],
    voirAussi: ["experience", "fatigue"]
  },
  "douleur-presente": {
    categorie: "Sous-facteur individuel", titre: "Douleur présente", icone: "🤕", couleur: "#f09430", famille: "individuel",
    description: "Une douleur qui persiste est un signal d'alarme, car tes tissus sont déjà en surcharge et continuer comme avant transforme la gêne en vraie blessure.",
    exemples: [
      "Courbature qui ne disparaît plus entre les quarts.",
      "Élancements qui te réveillent la nuit.",
      "Engourdissements ou fourmillements dans les doigts."
    ],
    prevention: [
      "Signale ta douleur tôt, sans attendre qu'elle s'aggrave.",
      "Ajuste temporairement ta tâche ou ton rythme.",
      "Consulte un professionnel de la santé."
    ],
    zones: [],
    voirAussi: ["fatigue", "agir-tot"]
  },
  "experience": {
    categorie: "Sous-facteur individuel", titre: "Expérience", icone: "🎓", couleur: "#f09430", famille: "individuel",
    description: "Avec l'expérience viennent les gestes économes, comme doser l'effort, bien te placer et anticiper les pièges du poste.",
    exemples: [
      "Tes premiers mois à un nouveau poste.",
      "Retour après une longue absence.",
      "Changement d'outil ou de méthode de travail."
    ],
    prevention: [
      "Fais-toi parrainer et pose des questions.",
      "Apprends les gestes professionnels économes.",
      "Augmente ta cadence progressivement."
    ],
    zones: [],
    voirAussi: ["condition-physique"]
  },

  /* ----- Sous-facteurs environnement ----- */
  "outils": {
    categorie: "Sous-facteur environnement", titre: "Outils", icone: "🛠️", couleur: "#74b62e", famille: "environnement",
    description: "Un outil mal adapté ou mal entretenu t'oblige à forcer davantage et à prendre de mauvaises positions.",
    exemples: [
      "Poignée trop grosse ou trop petite pour ta main.",
      "Outil lourd tenu à bout de bras de longues minutes.",
      "Lame ou mèche émoussée qui te force à appuyer."
    ],
    prevention: [
      "Choisis des outils adaptés à la tâche et à ta main.",
      "Affûte et entretiens régulièrement.",
      "Suspends ou équilibre les outils lourds."
    ],
    zones: ["poignets-mains", "coudes", "epaules"],
    voirAussi: ["outils-vibrants", "prise-serree"]
  },
  "temperature": {
    categorie: "Sous-facteur environnement", titre: "Température", icone: "🌡️", couleur: "#74b62e", famille: "environnement",
    description: "Le froid raidit tes tissus et réduit ta dextérité, tandis que la chaleur t'épuise et accélère la fatigue de tes muscles.",
    exemples: [
      "Travailler dans une galerie froide et humide.",
      "Forcer dans un secteur surchauffé et mal ventilé.",
      "Subir des courants d'air permanents à un poste fixe."
    ],
    prevention: [
      "Adapte tes vêtements de travail à la température.",
      "Prends des pauses dans un endroit tempéré.",
      "Hydrate-toi souvent à la chaleur et acclimate-toi progressivement."
    ],
    zones: ["poignets-mains"],
    voirAussi: ["froid"]
  },
  "espace-travail": {
    categorie: "Sous-facteur environnement", titre: "Espace", icone: "📐", couleur: "#74b62e", famille: "environnement",
    description: "Un espace restreint ou encombré force ton corps à se tordre, à s'accroupir ou à travailler à bout de bras.",
    exemples: [
      "Intervenir sous une machine ou dans un local technique exigu.",
      "Manquer de place pour pivoter avec une charge.",
      "Travailler coincé dans une cabine ou un recoin étroit."
    ],
    prevention: [
      "Dégage et organise l'espace avant de commencer.",
      "Prépare l'intervention pour limiter le temps en position contraignante.",
      "Garde le matériel fréquent à portée de main."
    ],
    zones: ["cou", "haut-dos", "bas-dos", "genoux"],
    voirAussi: ["postures", "hauteur-travail", "passage-etroit", "travail-genoux"]
  },
  "sol-inegal": {
    categorie: "Sous-facteur environnement", titre: "Sol instable", icone: "⛰️", couleur: "#74b62e", famille: "environnement",
    description: "Un sol instable, glissant ou encombré force tes muscles à travailler sans arrêt pour te tenir en équilibre.",
    exemples: [
      "Marcher sur un sol jonché de débris, de boue ou de roches.",
      "Franchir des dénivelés, des marches ou des seuils avec une charge.",
      "Te déplacer sur une surface glissante ou détrempée."
    ],
    prevention: [
      "Entretiens et dégage les voies de circulation.",
      "Porte des chaussures antidérapantes adaptées.",
      "Éclaire les zones de passage et choisis les trajets les plus sûrs."
    ],
    zones: ["chevilles-pieds", "genoux", "bas-dos"],
    voirAussi: ["environnement", "passage-etroit", "surface-appui"]
  },

  "compression": {
    categorie: "Sous-facteur biomécanique", titre: "Compression", icone: "⬇️", couleur: "#2e8fc0", famille: "biomecanique",
    description: "Une partie de ton corps appuyée longtemps contre une surface dure écrase les tissus, coupe la circulation et irrite les nerfs.",
    exemples: [
      "T'appuyer sur les genoux pour travailler au sol.",
      "Avant-bras posés sur l'arête d'une machine.",
      "Outil ou pièce calé contre la cuisse pour le stabiliser."
    ],
    prevention: [
      "Rembourre les points d'appui avec genouillères, manchons ou tapis.",
      "Capitonne ou arrondis les arêtes des surfaces.",
      "Change régulièrement de position d'appui."
    ],
    zones: ["genoux", "coudes", "poignets-mains"],
    voirAussi: ["travail-genoux", "prise-serree", "surface-appui"]
  },
  "antecedents": {
    categorie: "Sous-facteur individuel", titre: "Antécédents", icone: "📋", couleur: "#f09430", famille: "individuel",
    description: "Une blessure passée ou une condition de santé laisse tes tissus plus fragiles, et la zone déjà touchée encaisse moins bien et se blesse plus facilement.",
    exemples: [
      "Ancienne entorse ou fracture mal rééduquée.",
      "Tendinite ou lombalgie déjà vécue.",
      "Condition qui fragilise les nerfs ou les articulations, comme le diabète ou l'arthrite."
    ],
    prevention: [
      "Informe le service de santé de tes antécédents.",
      "Fais adapter ta tâche à la zone fragilisée.",
      "Surveille les premiers signes de récidive et signale-les."
    ],
    zones: [],
    voirAussi: ["douleur-presente", "condition-physique", "agir-tot"]
  },
  "surface-appui": {
    categorie: "Sous-facteur environnemental", titre: "Surface d'appui", icone: "🔲", couleur: "#74b62e", famille: "environnement",
    description: "La surface sur laquelle tu te tiens, t'agenouilles ou t'appuies change tout pour ton corps, car un sol dur fatigue et une arête vive comprime.",
    exemples: [
      "Rester debout des heures sur du roc ou du béton.",
      "T'agenouiller sur une surface dure ou métallique.",
      "Travailler depuis un appui étroit ou instable."
    ],
    prevention: [
      "Utilise un tapis antifatigue aux postes debout fixes.",
      "Prévois des genouillères ou un coussin pour le travail au sol.",
      "Assure-toi d'appuis stables et assez larges avant de travailler."
    ],
    zones: ["chevilles-pieds", "genoux", "bas-dos"],
    voirAussi: ["sol-inegal", "compression", "travail-genoux"]
  },
  "outil-percussion": {
    categorie: "Situation à risque · famille environnement", titre: "Outil à percussion", icone: "🔨", couleur: "#74b62e", famille: "environnement",
    description: "Les outils à percussion combinent chocs répétés, fortes vibrations et prise serrée, et tes mains, tes coudes et tes épaules encaissent chaque impact.",
    exemples: [
      "Casser du béton ou du roc au marteau-piqueur.",
      "Forer avec un perforateur ou une foreuse à percussion.",
      "Boulonner à la clé à choc tout le quart."
    ],
    prevention: [
      "Choisis des outils antivibratiles et bien entretenus.",
      "Laisse le poids de l'outil travailler plutôt que d'appuyer fort.",
      "Alterne les tâches et porte des gants antivibrations."
    ],
    zones: ["poignets-mains", "coudes", "epaules"],
    voirAussi: ["outils-vibrants", "prise-serree", "froid"]
  },
  "passage-etroit": {
    categorie: "Situation à risque · famille environnement", titre: "Passage étroit", icone: "🚧", couleur: "#74b62e", famille: "environnement",
    description: "Dans un passage étroit, ton corps doit se tordre, rentrer les épaules ou baisser la tête à chaque déplacement.",
    exemples: [
      "Te faufiler entre deux équipements avec du matériel dans les mains.",
      "Circuler dans une galerie basse ou un tunnel de service.",
      "Faire passer une charge par-dessus ou autour d'un obstacle."
    ],
    prevention: [
      "Dégage et élargis les voies de passage prioritaires.",
      "Planifie ton trajet avant de transporter une charge.",
      "Fractionne ou réoriente la charge pour passer face à l'obstacle."
    ],
    zones: ["bas-dos", "epaules", "cou"],
    voirAussi: ["espace-travail", "sol-inegal", "postures"]
  },

  /* ----- Messages clés ----- */
  "combinaison": {
    categorie: "Message clé", titre: "La combinaison des facteurs", icone: "⚠️", couleur: "#d6111e",
    description: "Les facteurs de risque ne s'additionnent pas, ils se multiplient, et un geste répété avec force, dans le froid, quand tu es fatigué, devient vite dangereux.",
    exemples: [
      "Répétition et force : le duo le plus fréquent des TMS du membre supérieur.",
      "Vibrations, froid et prise serrée : le cocktail des doigts blancs.",
      "Fatigue et cadence élevée : tes gestes de protection disparaissent."
    ],
    prevention: [
      "Évalue ton poste dans son ensemble, pas facteur par facteur.",
      "Agis en priorité sur les combinaisons repérées.",
      "Parle des vraies combinaisons du terrain, car tu les connais."
    ],
    zones: [],
    voirAussi: ["biomecanique", "individuel", "environnement"]
  },
  "agir-tot": {
    categorie: "À retenir", titre: "Agir tôt, ça change tout", icone: "💡", couleur: "#d6111e",
    description: "Un TMS s'installe par étapes, et pris tôt tout se corrige facilement, alors qu'installé il peut prendre des mois à guérir, quand il guérit.",
    exemples: [
      "Stade 1 : gêne en fin de journée, qui disparaît au repos.",
      "Stade 2 : douleur pendant le travail qui persiste le soir.",
      "Stade 3 : douleur continue, même au repos ou la nuit."
    ],
    prevention: [
      "Prends au sérieux les premiers signaux : gêne, raideur, fourmillements.",
      "Parles-en tôt à un collègue, un supérieur ou le comité de santé-sécurité.",
      "Ajuste vite ton poste ou ton rythme, et consulte sans attendre."
    ],
    zones: [],
    voirAussi: ["douleur-presente", "combinaison"]
  }
};

/* Zones du corps */
const ZONES = {
  "cou": {
    img: "images/zone_cou.jpeg",
    nom: "Cou / nuque", icone: "🧣",
    tms: ["Cervicalgie", "Tensions de la nuque", "Maux de tête d'origine cervicale"],
    description: "Ton cou porte le poids de ta tête toute la journée, et chaque fois que tu le penches vers l'avant, l'effort sur tes muscles cervicaux explose.",
    facteurs: ["posture-statique", "postures", "bras-leves", "espace-travail"],
    conseils: [
      "Garde la tâche à hauteur des yeux pour éviter de pencher la tête.",
      "Relâche ta nuque par de courts mouvements réguliers.",
      "Garde la tête dans l'axe plutôt que tordue sur le côté."
    ]
  },
  "epaules": {
    img: "images/zone_epaules.jpeg",
    nom: "Épaules", icone: "💪",
    tms: ["Tendinite de la coiffe des rotateurs", "Bursite", "Capsulite"],
    description: "Ton épaule est très mobile mais peu stable, et travailler les bras levés ou loin du corps use vite ses tendons.",
    facteurs: ["bras-leves", "manutention", "mouvements-repetes", "outils"],
    conseils: [
      "Travaille les coudes près du corps.",
      "Garde le plan de travail sous le niveau de tes épaules.",
      "Alterne les tâches qui sollicitent les bras en hauteur."
    ]
  },
  "haut-dos": {
    img: "images/zone_dos.jpeg",
    nom: "Haut du dos", icone: "🦴",
    tms: ["Dorsalgie", "Tensions entre les omoplates"],
    description: "Ton haut du dos encaisse les postures penchées et le travail des bras vers l'avant, et les tensions entre les omoplates en sont le premier signal.",
    facteurs: ["posture-statique", "hauteur-travail", "postures"],
    conseils: [
      "Règle la hauteur du plan de travail.",
      "Ouvre les épaules et varie ta posture régulièrement.",
      "Rapproche la tâche pour ne pas travailler bras tendus."
    ]
  },
  "bas-dos": {
    img: "images/zone_dos.jpeg",
    nom: "Bas du dos", icone: "🦴",
    tms: ["Lombalgie", "Hernie discale", "Sciatalgie"],
    description: "Ton bas du dos est la zone la plus touchée par les TMS, car tes disques encaissent des pressions énormes dès que tu te plies ou te tords en charge.",
    facteurs: ["manutention", "charges", "torsion", "passage-etroit", "sol-inegal"],
    conseils: [
      "Plie les genoux et garde la charge près du corps.",
      "Pivote avec tes pieds plutôt qu'avec le tronc.",
      "Utilise les aides mécaniques disponibles."
    ]
  },
  "coudes": {
    img: "images/zone_coudes.jpeg",
    nom: "Coudes", icone: "🦾",
    tms: ["Épicondylite (tennis elbow)", "Épitrochléite"],
    description: "Tes coudes s'enflamment quand tu serres, visses et tournes à répétition, c'est la fameuse épicondylite.",
    facteurs: ["prise-serree", "mouvements-repetes", "outil-percussion", "outils-vibrants"],
    conseils: [
      "Réduis ta force de serrage avec de meilleurs outils.",
      "Évite les rotations répétées du poignet sous effort.",
      "Fais des pauses avant la sensation de brûlure."
    ]
  },
  "poignets-mains": {
    img: "images/zone_poignets.jpeg",
    nom: "Poignets / mains", icone: "✋",
    tms: ["Syndrome du canal carpien", "Tendinite de De Quervain", "Syndrome des doigts blancs"],
    description: "Tes poignets font passer tendons et nerf dans un tunnel étroit, où gestes répétés, prise en pince, vibrations et froid se combinent vite.",
    facteurs: ["prise-serree", "mouvements-repetes", "outils-vibrants", "outil-percussion", "froid"],
    conseils: [
      "Garde ton poignet aligné avec l'avant-bras.",
      "Alterne les mains et les types de prise.",
      "Signale tôt les fourmillements et engourdissements nocturnes."
    ]
  },
  "genoux": {
    img: "images/zone_genoux.jpeg",
    nom: "Genoux", icone: "🦵",
    tms: ["Bursite du genou", "Lésion du ménisque", "Syndrome fémoro-patellaire"],
    description: "Tes genoux ne sont pas faits pour servir d'appui, et le travail agenouillé ou accroupi répété use leurs structures.",
    facteurs: ["travail-genoux", "compression", "sol-inegal", "posture-statique"],
    conseils: [
      "Porte des genouillères adaptées à ton métier.",
      "Utilise un tapis, un banc bas ou un siège roulant d'atelier.",
      "Relève-toi et déplie tes jambes souvent."
    ]
  },
  "chevilles-pieds": {
    nom: "Chevilles / pieds", icone: "🦶",
    tms: ["Tendinite d'Achille", "Fasciite plantaire", "Entorses à répétition"],
    description: "Tes pieds et ton tendon d'Achille fatiguent debout sur sol dur, et un sol inégal ou glissant ajoute les faux mouvements.",
    facteurs: ["sol-inegal", "posture-statique"],
    conseils: [
      "Porte des chaussures de travail amortissantes et adaptées.",
      "Utilise un tapis antifatigue aux postes debout fixes.",
      "Garde les zones de circulation planes et dégagées."
    ]
  }
};

/* Simulateur */
const SIM_ITEMS = [
  { cle: "s-efforts", libelle: "Efforts importants (pousser, tirer, forcer)", poids: 3, cat: "bio", conseil: "Réduire les efforts avec des aides mécaniques et des outils adaptés." },
  { cle: "s-repetition", libelle: "Gestes répétés à cadence soutenue", poids: 3, cat: "bio", conseil: "Mettre en place la rotation des tâches et des micro-pauses." },
  { cle: "s-postures", libelle: "Postures contraignantes (dos courbé, poignets pliés…)", poids: 2, cat: "bio", conseil: "Aménager le poste de travail pour garder les articulations en position neutre." },
  { cle: "s-charges", libelle: "Charges lourdes ou difficiles à saisir (tiges, boyaux, équipements)", poids: 3, cat: "bio", conseil: "Fractionner les charges et utiliser des équipements d'aide à la manutention." },
  { cle: "s-bras", libelle: "Travail bras au-dessus des épaules", poids: 2, cat: "bio", conseil: "Abaisser le travail ou utiliser une plateforme pour travailler sous hauteur d'épaules." },
  { cle: "s-genoux", libelle: "Travail à genoux, accroupi ou plié (positions imposées)", poids: 2, cat: "bio", conseil: "Genouillères, banc bas, et se relever régulièrement pour bouger les jambes." },
  { cle: "s-fatigue", libelle: "Fatigue fréquente ou sommeil insuffisant", poids: 2, cat: "ind", conseil: "Préserver le sommeil et prendre de vraies pauses de récupération." },
  { cle: "s-quarts", libelle: "Quarts longs : la vigilance baisse en fin de quart", poids: 2, cat: "ind", conseil: "Garder les tâches exigeantes pour le début du quart et faire de vraies coupures." },
  { cle: "s-douleur", libelle: "Douleur déjà présente (gêne, raideur, fourmillements)", poids: 3, cat: "ind", conseil: "Signaler la douleur tôt et adapter la tâche sans attendre." },
  { cle: "s-experience", libelle: "Peu d'expérience au poste de travail", poids: 1, cat: "ind", conseil: "Prévoir parrainage, formation aux gestes et montée en cadence progressive." },
  { cle: "s-condition", libelle: "Condition physique limitée ou reprise après absence", poids: 1, cat: "ind", conseil: "Reprendre graduellement et ajuster la charge de travail." },
  { cle: "s-pauses", libelle: "Pauses souvent écourtées ou sautées", poids: 2, cat: "ind", conseil: "Planifier les pauses comme des étapes obligatoires du travail." },
  { cle: "s-froid", libelle: "Froid, courants d'air ou chaleur excessive", poids: 1, cat: "env", conseil: "Adapter les vêtements et prévoir des pauses en local tempéré." },
  { cle: "s-vibrations", libelle: "Outils vibrants utilisés régulièrement", poids: 2, cat: "env", conseil: "Choisir des outils antivibratiles et limiter la durée d'exposition." },
  { cle: "s-espace", libelle: "Espace de travail restreint ou encombré", poids: 1, cat: "env", conseil: "Dégager et réorganiser l'espace de travail." },
  { cle: "s-sol", libelle: "Sol inégal, glissant ou encombré", poids: 1, cat: "env", conseil: "Entretenir les sols et porter des chaussures adaptées." },
  { cle: "s-outils", libelle: "Outils mal adaptés ou mal entretenus", poids: 2, cat: "env", conseil: "Choisir des outils ergonomiques et les entretenir régulièrement." }
];
const SIM_CATS = { bio: "Contraintes de la tâche (biomécanique)", ind: "La personne (individuel)", env: "Le poste de travail et le milieu (environnement)" };

/* Quiz */
const ORDRE_PRINCIPAL = ["biomecanique", "individuel", "environnement", "bras-leves", "mouvements-repetes", "charges", "travail-genoux", "prise-serree", "froid", "outil-percussion", "passage-etroit", "sol-inegal", "hauteur-travail"];

/* ================================================================
   OUTILS GÉNÉRAUX
   ================================================================ */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

function lireStockage(cle, defaut) {
  try { const v = localStorage.getItem(cle); return v === null ? defaut : JSON.parse(v); }
  catch (e) { return defaut; }
}
function ecrireStockage(cle, valeur) {
  try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch (e) {}
}

function toast(message, icone) {
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = "<span>" + (icone || "✨") + "</span><span></span>";
  t.lastElementChild.textContent = message;
  $("#toasts").appendChild(t);
  setTimeout(() => {
    t.classList.add("sortie");
    setTimeout(() => t.remove(), 350);
  }, 3800);
}

/* Confettis */
function lancerConfettis() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = $("#confettis");
  const ctx = canvas.getContext("2d");
  canvas.width = innerWidth; canvas.height = innerHeight;
  const couleurs = ["#d6111e", "#d9a43a", "#2e8fc0", "#74b62e", "#f09430", "#ffffff"];
  const parts = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * .4,
    vx: (Math.random() - .5) * 3,
    vy: 2.5 + Math.random() * 3.5,
    taille: 5 + Math.random() * 6,
    angle: Math.random() * Math.PI,
    va: (Math.random() - .5) * .25,
    couleur: couleurs[(Math.random() * couleurs.length) | 0]
  }));
  const debut = performance.now();
  (function anime(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.angle += p.va;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.couleur;
      ctx.fillRect(-p.taille / 2, -p.taille / 4, p.taille, p.taille / 2);
      ctx.restore();
    });
    if (t - debut < 3200) requestAnimationFrame(anime);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  })(debut);
}

/* ================================================================
   PROGRESSION D'EXPLORATION
   ================================================================ */
let visites = new Set(lireStockage("tms-visites", []));

function majProgression() {
  const total = ORDRE_PRINCIPAL.length;
  const n = ORDRE_PRINCIPAL.filter(c => visites.has(c)).length;
  const tp = $("#texte-prog"); if (tp) tp.textContent = n + " / " + total + " explorés";
  const circ = 87.96;
  const av = $("#anneau-valeur"); if (av) av.style.strokeDashoffset = circ * (1 - n / total);
  ORDRE_PRINCIPAL.forEach(c => {
    $$("[data-cle='" + c + "']").forEach(el => {
      if ((el.classList.contains("cercle") || el.classList.contains("pastille")) && visites.has(c)) el.classList.add("visite");
      if ((el.classList.contains("cercle") || el.classList.contains("pastille")) && !visites.has(c)) el.classList.remove("visite");
    });
  });
}

function marquerVisite(cle) {
  if (!ORDRE_PRINCIPAL.includes(cle) || visites.has(cle)) return;
  visites.add(cle);
  ecrireStockage("tms-visites", Array.from(visites));
  majProgression();
  const n = ORDRE_PRINCIPAL.filter(c => visites.has(c)).length;
  if (n === 1) toast("Première fiche explorée ! Continuez : " + (ORDRE_PRINCIPAL.length - 1) + " restantes.", "🚀");
  else if (n === 7) toast("Plus de la moitié du schéma exploré !", "⭐");
  else if (n === ORDRE_PRINCIPAL.length) {
    toast("Bravo ! Vous avez exploré tout le schéma. Prêt pour la formation guidée ?", "🏆");
    lancerConfettis();
  }
}

const btnRaz = $("#btn-raz-progression");
if (btnRaz) btnRaz.addEventListener("click", () => {
  visites = new Set();
  ecrireStockage("tms-visites", []);
  majProgression();
  toast("Progression réinitialisée.", "↺");
});

/* ================================================================
   MODALE
   ================================================================ */
const voile = $("#voile");
const modale = $("#modale");
let dernierDeclencheur = null;
let cleCourante = null;
let lectureEnCours = false;

function elem(tag, classe, texte) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

function sectionListe(conteneur, titre, items, classeListe) {
  if (!items || !items.length) return;
  conteneur.appendChild(elem("h3", null, titre));
  const ul = elem("ul", classeListe);
  items.forEach(t => ul.appendChild(elem("li", null, t)));
  conteneur.appendChild(ul);
}

function sectionPuces(conteneur, titre, items, action) {
  if (!items || !items.length) return;
  conteneur.appendChild(elem("h3", null, titre));
  const div = elem("div", "puces");
  items.forEach(it => {
    const b = elem("button", "puce", it.label);
    b.addEventListener("click", () => action(it.cle));
    div.appendChild(b);
  });
  conteneur.appendChild(div);
}

function ouvrirModale(declencheur) {
  dernierDeclencheur = declencheur || document.activeElement;
  voile.classList.add("ouvert");
  $("#fermer").focus();
}

function fermerModale() {
  voile.classList.remove("ouvert");
  arreterLecture();
  cleCourante = null;
  if (dernierDeclencheur && dernierDeclencheur.focus) dernierDeclencheur.focus();
}

function ouvrirDetails(cle, declencheur) {
  const d = DETAILS[cle];
  if (!d) return;
  cleCourante = cle;
  arreterLecture();
  $("#modale-picto").textContent = d.icone;
  $("#modale-categorie").textContent = d.categorie;
  $("#modale-titre").textContent = d.titre;
  modale.style.setProperty("--accent-modale", d.couleur);

  const corps = $("#modale-corps");
  corps.innerHTML = "";
  corps.appendChild(elem("p", "description", d.description));
  sectionListe(corps, "Exemples concrets", d.exemples, "exemples");
  sectionListe(corps, "Pistes de prévention", d.prevention, "prevention");
  if (d.zones && d.zones.length) {
    sectionPuces(corps, "Zones du corps touchées",
      d.zones.map(z => ({ cle: z, label: (ZONES[z] ? ZONES[z].icone + " " + ZONES[z].nom : z) })),
      z => ouvrirZone(z, dernierDeclencheur));
  }
  if (d.voirAussi && d.voirAussi.length) {
    sectionPuces(corps, "Voir aussi",
      d.voirAussi.filter(v => DETAILS[v]).map(v => ({ cle: v, label: DETAILS[v].icone + " " + DETAILS[v].titre })),
      v => ouvrirDetails(v, dernierDeclencheur));
  }

  const idx = ORDRE_PRINCIPAL.indexOf(cle);
  const pied = $("#modale-pied");
  if (idx >= 0) {
    pied.style.display = "flex";
    $("#modale-position").textContent = (idx + 1) + " / " + ORDRE_PRINCIPAL.length + " · fiches principales";
  } else {
    pied.style.display = "none";
  }

  marquerVisite(cle);
  if (!voile.classList.contains("ouvert")) ouvrirModale(declencheur);
  corps.scrollTop = 0;
}

function ouvrirZone(zoneCle, declencheur) {
  const z = ZONES[zoneCle];
  if (!z) return;
  cleCourante = null;
  arreterLecture();
  $("#modale-picto").textContent = z.icone;
  $("#modale-categorie").textContent = "Zone du corps";
  $("#modale-titre").textContent = z.nom;
  modale.style.setProperty("--accent-modale", "#d9a43a");

  const corps = $("#modale-corps");
  corps.innerHTML = "";
  if (z.img) {
    const fig = elem("div", "zone-photo");
    const im = document.createElement("img");
    im.src = z.img; im.alt = "Zone : " + z.nom; im.loading = "lazy";
    fig.appendChild(im);
    corps.appendChild(fig);
  }
  corps.appendChild(elem("p", "description", z.description));
  sectionListe(corps, "TMS fréquents dans cette zone", z.tms, "exemples");
  sectionPuces(corps, "Facteurs en cause",
    z.facteurs.filter(f => DETAILS[f]).map(f => ({ cle: f, label: DETAILS[f].icone + " " + DETAILS[f].titre })),
    f => ouvrirDetails(f, dernierDeclencheur));
  sectionListe(corps, "Bons réflexes", z.conseils, "prevention");

  $("#modale-pied").style.display = "none";
  if (!voile.classList.contains("ouvert")) ouvrirModale(declencheur);
  corps.scrollTop = 0;
}

function naviguer(delta) {
  if (!cleCourante) return;
  const idx = ORDRE_PRINCIPAL.indexOf(cleCourante);
  if (idx < 0) return;
  const suivant = (idx + delta + ORDRE_PRINCIPAL.length) % ORDRE_PRINCIPAL.length;
  ouvrirDetails(ORDRE_PRINCIPAL[suivant], dernierDeclencheur);
}

$("#btn-prec").addEventListener("click", () => naviguer(-1));
$("#btn-suiv").addEventListener("click", () => naviguer(1));
$("#fermer").addEventListener("click", fermerModale);
voile.addEventListener("click", e => { if (e.target === voile) fermerModale(); });

document.addEventListener("keydown", e => {
  if (!voile.classList.contains("ouvert")) return;
  if (e.key === "Escape") fermerModale();
  if (e.key === "ArrowLeft") naviguer(-1);
  if (e.key === "ArrowRight") naviguer(1);
  if (e.key === "Tab") {
    const focusables = Array.from(modale.querySelectorAll("button")).filter(b => b.offsetParent !== null);
    if (!focusables.length) return;
    const premier = focusables[0], dernier = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
  }
});

/* Lecture audio */
function arreterLecture() {
  if (window.speechSynthesis) speechSynthesis.cancel();
  lectureEnCours = false;
  $("#btn-lecture").classList.remove("actif-audio");
}
$("#btn-lecture").addEventListener("click", () => {
  if (!window.speechSynthesis) { toast("La lecture audio n'est pas disponible dans ce navigateur.", "🔇"); return; }
  if (lectureEnCours) { arreterLecture(); return; }
  const titre = $("#modale-titre").textContent;
  const morceaux = [titre];
  $$("#modale-corps p.description, #modale-corps h3, #modale-corps ul li").forEach(el => morceaux.push(el.textContent));
  const u = new SpeechSynthesisUtterance(morceaux.join(". "));
  u.lang = "fr-FR";
  u.rate = 1.02;
  u.onend = arreterLecture;
  lectureEnCours = true;
  $("#btn-lecture").classList.add("actif-audio");
  speechSynthesis.speak(u);
});

$("#btn-imprimer").addEventListener("click", () => {
  document.body.classList.add("impression-fiche");
  window.print();
});
window.addEventListener("afterprint", () => document.body.classList.remove("impression-fiche"));

/* Déclencheurs : tout élément portant data-cle.
   closest() retourne l'élément le plus profond : un clic sur un sous-item
   ouvre sa fiche sans ouvrir aussi celle du cercle parent. */
document.addEventListener("click", e => {
  const cible = e.target.closest("[data-cle]");
  if (!cible || cible.closest("#modale")) return;
  const cle = cible.dataset.cle;
  if (DETAILS[cle]) ouvrirDetails(cle, cible);
});
/* Clavier pour les cercles (div role="button") */
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const cible = e.target.closest("div[role='button'][data-cle]");
  if (!cible) return;
  e.preventDefault();
  if (DETAILS[cible.dataset.cle]) ouvrirDetails(cible.dataset.cle, cible);
});

/* ================================================================
   LIGNES DE LIAISON PASTILLE → FAMILLE
   ================================================================ */
const scene = $("#scene");
const svgLiaisons = $("#svg-liaisons");
const CIBLE_CERCLE = { biomecanique: ".cercle.bio", individuel: ".cercle.ind", environnement: ".cercle.env" };

function dessinerLiaisons() {
  if (!scene || !svgLiaisons) return;   // schéma des facteurs absent (pages sans #scene)
  svgLiaisons.innerHTML = "";
  if (window.matchMedia("(max-width: 900px)").matches) return;
  const r = scene.getBoundingClientRect();
  if (r.width === 0) return;
  svgLiaisons.setAttribute("viewBox", "0 0 " + r.width + " " + r.height);
  $$(".pastille").forEach(p => {
    const fam = p.dataset.famille;
    const cercle = $(CIBLE_CERCLE[fam]);
    if (!cercle) return;
    const rp = p.getBoundingClientRect();
    const rc = cercle.getBoundingClientRect();
    const ligne = document.createElementNS("http://www.w3.org/2000/svg", "line");
    ligne.setAttribute("x1", rp.left - r.left + rp.width / 2);
    ligne.setAttribute("y1", rp.top - r.top + rp.height / 2);
    ligne.setAttribute("x2", rc.left - r.left + rc.width / 2);
    ligne.setAttribute("y2", rc.top - r.top + rc.height / 2);
    ligne.setAttribute("class", "lien lien-" + fam);
    ligne.dataset.pour = p.dataset.cle;
    svgLiaisons.appendChild(ligne);
  });
}

/* Surbrillance de la ligne au survol d'une pastille */
$$(".pastille").forEach(p => {
  const allume = () => {
    const l = svgLiaisons.querySelector("[data-pour='" + p.dataset.cle + "']");
    if (l) l.classList.add("lien-fort");
  };
  const eteint = () => {
    const l = svgLiaisons.querySelector("[data-pour='" + p.dataset.cle + "']");
    if (l) l.classList.remove("lien-fort");
  };
  p.addEventListener("mouseenter", allume);
  p.addEventListener("mouseleave", eteint);
  p.addEventListener("focus", allume);
  p.addEventListener("blur", eteint);
});

/* Survol d'un cercle : ne garder que sa famille */
$$(".cercle").forEach(c => {
  const fam = c.dataset.famille;
  const focus = () => scene.classList.add("focus-" + fam);
  const defocus = () => scene.classList.remove("focus-" + fam);
  c.addEventListener("mouseenter", focus);
  c.addEventListener("mouseleave", defocus);
  c.addEventListener("focus", focus);
  c.addEventListener("blur", defocus);
});

if (window.ResizeObserver && scene) new ResizeObserver(dessinerLiaisons).observe(scene);
window.addEventListener("resize", dessinerLiaisons);
window.addEventListener("load", dessinerLiaisons);
dessinerLiaisons();

/* ================================================================
   INFOBULLE
   ================================================================ */
const infobulle = $("#infobulle");
let surTactile = window.matchMedia("(hover: none)").matches;

document.addEventListener("mouseover", e => {
  if (surTactile) return;
  const cible = e.target.closest("[data-resume]");
  if (!cible) { infobulle.classList.remove("visible"); return; }
  infobulle.textContent = cible.dataset.resume;
  infobulle.classList.add("visible");
});
document.addEventListener("mousemove", e => {
  if (surTactile || !infobulle.classList.contains("visible")) return;
  const x = Math.min(e.clientX + 16, innerWidth - infobulle.offsetWidth - 12);
  const y = Math.min(e.clientY + 18, innerHeight - infobulle.offsetHeight - 12);
  infobulle.style.left = x + "px";
  infobulle.style.top = y + "px";
});
document.addEventListener("mouseout", e => {
  if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest("[data-resume]")) {
    infobulle.classList.remove("visible");
  }
});

/* ================================================================
   RECHERCHE
   ================================================================ */
const champ = $("#champ-recherche");
const resultats = $("#resultats-recherche");

function normaliser(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const INDEX_RECHERCHE = [];
Object.keys(DETAILS).forEach(c => INDEX_RECHERCHE.push({ type: "detail", cle: c, titre: DETAILS[c].titre, icone: DETAILS[c].icone, cat: DETAILS[c].categorie }));
Object.keys(ZONES).forEach(c => INDEX_RECHERCHE.push({ type: "zone", cle: c, titre: ZONES[c].nom, icone: ZONES[c].icone, cat: "Zone du corps" }));

function majRecherche() {
  if (!champ || !resultats) return;
  const q = normaliser(champ.value.trim());
  resultats.innerHTML = "";
  if (q.length < 2) { resultats.classList.remove("ouvert"); return; }
  const trouves = INDEX_RECHERCHE.filter(e => normaliser(e.titre).includes(q) || normaliser(e.cat).includes(q)).slice(0, 8);
  if (!trouves.length) { resultats.classList.remove("ouvert"); return; }
  trouves.forEach(t => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.innerHTML = "<span></span><span></span><span class='cat-resultat'></span>";
    b.children[0].textContent = t.icone;
    b.children[1].textContent = t.titre;
    b.children[2].textContent = t.cat;
    b.addEventListener("click", () => {
      resultats.classList.remove("ouvert");
      champ.value = "";
      if (t.type === "zone") ouvrirZone(t.cle, champ);
      else ouvrirDetails(t.cle, champ);
    });
    li.appendChild(b);
    resultats.appendChild(li);
  });
  resultats.classList.add("ouvert");
}
if (champ) {
  champ.addEventListener("input", majRecherche);
  champ.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      const premier = resultats.querySelector("button");
      if (premier) premier.click();
    }
    if (e.key === "Escape") resultats.classList.remove("ouvert");
  });
  document.addEventListener("click", e => {
    if (!e.target.closest(".recherche")) resultats.classList.remove("ouvert");
  });
}

/* ================================================================
   CARTE DU CORPS
   ================================================================ */
/* Planche photo : affichée si images/zones_corps.jpg existe, sinon silhouette SVG */
(function(){
  const bloc = $("#corpsPhoto");
  if (!bloc) return;
  const test = new Image();
  test.onload = () => {
    $("#corpsPhotoImg").src = test.src;
    bloc.hidden = false;
    const flex = document.querySelector("#corps .corps-flex .corps-svg-bloc");
    if (flex) flex.style.display = "none";
  };
  test.src = "images/zones_corps.jpg";
  function litZone(z, on) {
    bloc.querySelectorAll(".cp-spot[data-zone='" + z + "'], .cp-box[data-zone='" + z + "'], .cp-line[data-zone='" + z + "']")
      .forEach(el => el.classList.toggle("lit", on));
  }
  bloc.querySelectorAll(".cp-spot, .cp-box").forEach(b => {
    b.addEventListener("click", () => ouvrirZone(b.dataset.zone, b));
    b.addEventListener("mouseenter", () => litZone(b.dataset.zone, true));
    b.addEventListener("mouseleave", () => litZone(b.dataset.zone, false));
    b.addEventListener("focus", () => litZone(b.dataset.zone, true));
    b.addEventListener("blur", () => litZone(b.dataset.zone, false));
  });
})();
$$("#corps-svg .zone").forEach(g => {
  const z = g.dataset.zone;
  if (ZONES[z]) g.setAttribute("data-resume", ZONES[z].nom + " · " + ZONES[z].tms.join(", "));
  g.addEventListener("click", () => ouvrirZone(z, g));
  g.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrirZone(z, g); }
  });
});

/* ================================================================
   SIMULATEUR
   ================================================================ */
const formSim = $("#form-sim");
["bio", "ind", "env"].forEach(cat => {
  const bloc = document.createElement("div");
  bloc.className = "sim-cat c-" + cat;
  const h = document.createElement("h3");
  h.textContent = SIM_CATS[cat];
  bloc.appendChild(h);
  SIM_ITEMS.filter(i => i.cat === cat).forEach(item => {
    const label = document.createElement("label");
    label.className = "case";
    label.innerHTML = "<input type='checkbox'><span class='boite'></span><span class='texte'></span><span class='poids'></span>";
    label.querySelector("input").dataset.cle = item.cle;
    label.querySelector(".texte").textContent = item.libelle;
    label.querySelector(".poids").textContent = "+" + item.poids;
    bloc.appendChild(label);
  });
  formSim.appendChild(bloc);
});

const POIDS_MAX = SIM_ITEMS.reduce((s, i) => s + i.poids, 0);

function calculerSim() {
  const coches = SIM_ITEMS.filter(i => formSim.querySelector("[data-cle='" + i.cle + "']").checked);
  const brut = coches.reduce((s, i) => s + i.poids, 0);
  const cats = new Set(coches.map(i => i.cat));
  const mult = cats.size >= 3 ? 1.3 : cats.size === 2 ? 1.15 : 1;
  const pct = Math.min(100, Math.round((brut * mult) / (POIDS_MAX * 1.3) * 100));

  $("#arc-niveau").setAttribute("stroke-dasharray", pct + " 100");
  $("#aiguille").style.transform = "rotate(" + (-90 + pct * 1.8) + "deg)";
  $("#score-valeur").textContent = pct;

  const niveau = $("#score-niveau");
  let txt, coul;
  if (!coches.length) { txt = "Cochez des facteurs ci-contre"; coul = "#999"; }
  else if (pct < 25) { txt = "Risque faible : restez attentif"; coul = "#6fc24a"; }
  else if (pct < 50) { txt = "Risque modéré : des ajustements s'imposent"; coul = "#e3c54a"; }
  else if (pct < 75) { txt = "Risque élevé : agissez rapidement"; coul = "#f08a2e"; }
  else { txt = "Risque très élevé : situation prioritaire"; coul = "#e8404a"; }
  niveau.textContent = txt;
  niveau.style.color = coul;
  $("#score-valeur").style.color = coul;

  const combo = $("#sim-combo");
  if (cats.size >= 2 && coches.length) {
    combo.textContent = "⚠️ Facteurs présents dans " + cats.size + " familles : la combinaison multiplie le risque (score majoré de " + Math.round((mult - 1) * 100) + " %).";
  } else if (coches.length) {
    combo.textContent = "Facteurs d'une seule famille : le risque grimpe dès que plusieurs familles se combinent.";
  } else {
    combo.textContent = "";
  }

  const ul = $("#sim-conseils");
  ul.innerHTML = "";
  coches.sort((a, b) => b.poids - a.poids).slice(0, 4).forEach(i => {
    const li = document.createElement("li");
    li.textContent = i.conseil;
    ul.appendChild(li);
  });
}
formSim.addEventListener("change", calculerSim);
$("#sim-raz").addEventListener("click", () => {
  formSim.querySelectorAll("input").forEach(i => { i.checked = false; });
  calculerSim();
});
calculerSim();

/* ================================================================
   VIDÉO
   ================================================================ */
const lecteurVideo = $("#lecteur-video");
if (lecteurVideo) {
  lecteurVideo.addEventListener("ended", () => {
    toast("Vidéo terminée ! Prolongez avec les fiches Sommeil, Condition physique et Récupération juste en dessous.", "🎬");
  });
  /* Met la vidéo en pause quand une fiche s'ouvre par-dessus */
  new MutationObserver(() => {
    if (voile.classList.contains("ouvert") && !lecteurVideo.paused) lecteurVideo.pause();
  }).observe(voile, { attributes: true, attributeFilter: ["class"] });
}

/* ================================================================
   NAVIGATION, DÉFILEMENT, APPARITIONS
   ================================================================ */


const obsSections = new IntersectionObserver(entrees => {
  entrees.forEach(e => {
    if (e.isIntersecting) {
      $$(".lien-nav").forEach(a => a.classList.toggle("actif", a.dataset.section === e.target.id));
    }
  });
}, { rootMargin: "-35% 0px -55% 0px" });
$$("section.bloc").forEach(s => obsSections.observe(s));

const obsReveal = new IntersectionObserver(entrees => {
  entrees.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add("visible");
      obsReveal.unobserve(e.target);
    }
  });
}, { threshold: .12 });
$$(".ireveal").forEach(el => obsReveal.observe(el));

majProgression();

/* ================================================================
   ÉVALUATION DU POSTE EN SURIMPRESSION
   ================================================================ */
const voileSim = $("#voile-sim");
let declencheurSim = null;
function ouvrirSim(decl) {
  declencheurSim = decl;
  voileSim.classList.add("ouvert");
  document.body.style.overflow = "hidden";
  $("#fermer-sim").focus();
}
function fermerSim() {
  voileSim.classList.remove("ouvert");
  document.body.style.overflow = "";
  if (declencheurSim && declencheurSim.focus) declencheurSim.focus();
}
$$("[data-ouvrir-sim]").forEach(b => b.addEventListener("click", e => { e.preventDefault(); ouvrirSim(b); }));
$("#fermer-sim").addEventListener("click", fermerSim);
voileSim.addEventListener("click", e => { if (e.target === voileSim) fermerSim(); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && voileSim.classList.contains("ouvert") && !voile.classList.contains("ouvert")) fermerSim();
});

})();

(function(){
  var $=function(s){return document.querySelector(s);};
  /* ---- Échelle de Borg ---- */
  var BORG=[
    ["Aucun effort","Pas d'effort."],
    ["Très très facile","À peine perceptible."],
    ["Très facile","Effort très léger."],
    ["Facile","Effort léger."],
    ["Effort modéré","Effort confortable mais notable."],
    ["Moyen","Effort soutenu, respiration plus marquée."],
    ["Un peu dur","Effort exigeant."],
    ["Dur","Effort difficile, respiration forte."],
    ["Très dur","Effort très difficile."],
    ["Très très dur","Effort extrêmement difficile."],
    ["Maximal","Effort maximal, à la limite de mes capacités."]
  ];
  var BORG_COUL=["#2e9c4f","#43a047","#66bb6a","#9ccc65","#f9d423","#ffb300","#fb8c00","#f4661e","#ef4423","#e02d2d","#c01717"];
  var BORG_SEL=-1;
  function borgZone(v){
    if(v<=3)return["Zone soutenable longtemps","rgba(16,185,129,.15)","#34d399"];
    if(v<=6)return["Surveille la durée et prévois des pauses","rgba(245,158,11,.15)","#f59e0b"];
    return["Risque élevé : réduis l'effort ou récupère","rgba(226,58,60,.16)","#ef5a5c"];
  }
  function choisirBorg(v){
    BORG_SEL=v;var c=BORG_COUL[v],z=borgZone(v);
    var w=$("#borgPickWrap"),txt=$("#borgCtaTxt");
    if(w){w.hidden=false;if(txt)txt.hidden=true;
      var n=$("#borgPickN");n.textContent=v;n.style.background=c;n.style.color="#06140d";
      $("#borgPickL").textContent=v+" · "+BORG[v][0];
      var zl=$("#borgPickZ");zl.textContent=z[0];zl.style.color=z[2];
      $("#borgCta").style.borderColor=c;
    }
  }

  /* ---- Échelle de Borg : surcouche ---- */
  var vBorg=$("#voile-borg"),rows=$("#borgRows"),declB=null;
  if(rows){
    for(var i=0;i<=10;i++){(function(n){
      var btn=document.createElement("button");
      btn.className="borg-row";btn.setAttribute("data-n",n);
      btn.innerHTML='<span class="br-n" style="background:'+BORG_COUL[n]+'">'+n+'</span><span class="br-l">'+BORG[n][0]+'</span><span class="br-d">'+BORG[n][1]+'</span>';
      btn.addEventListener("click",function(){ choisirBorg(n); detailBorg(n); majRows(); });
      rows.appendChild(btn);
    })(i);}
  }
  function majRows(){
    document.querySelectorAll(".borg-row").forEach(function(el){el.classList.toggle("on",+el.getAttribute("data-n")===BORG_SEL);});
  }
  var BORG_CONSEIL=[
    "Tu peux soutenir ce rythme aussi longtemps que nécessaire.",
    "Effort à peine ressenti : aucun problème de fatigue.",
    "Effort très léger : confortable sur la durée.",
    "Effort léger : encore largement soutenable.",
    "Effort modéré : commence à surveiller la durée et à prévoir des pauses.",
    "Effort soutenu : alterne les tâches et fais des micro-pauses régulières.",
    "Effort exigeant : la fatigue s'installe, espace les efforts.",
    "Effort difficile : réduis la charge ou récupère avant de continuer.",
    "Effort très difficile : à éviter de répéter, risque de blessure en hausse.",
    "Presque maximal : ne tiens pas ce niveau, récupère.",
    "Effort maximal : intenable, arrête et récupère immédiatement."
  ];
  function detailBorg(n){
    var d=$("#borgDetail"); if(!d) return;
    var c=BORG_COUL[n],z=borgZone(n);
    d.hidden=false;
    var bn=$("#bdN");bn.textContent=n;bn.style.background=c;bn.style.color="#06140d";
    $("#bdL").textContent=BORG[n][0];
    $("#bdE").textContent=BORG[n][1];
    var zl=$("#bdZone");zl.textContent=z[0];zl.style.background=z[1];zl.style.color=z[2];
    $("#bdConseil").textContent=BORG_CONSEIL[n];
  }
  function ouvrirBorg(d){declB=d;majRows();if(BORG_SEL>=0)detailBorg(BORG_SEL);else{var bd=$("#borgDetail");if(bd)bd.hidden=true;}vBorg.classList.add("ouvert");document.body.style.overflow="hidden";$("#fermer-borg").focus();}
  function fermerBorg(){vBorg.classList.remove("ouvert");document.body.style.overflow="";if(declB&&declB.focus)declB.focus();}
  document.querySelectorAll("[data-ouvrir-borg]").forEach(function(b){b.addEventListener("click",function(e){e.preventDefault();ouvrirBorg(b);});});
  if(vBorg){
    $("#fermer-borg").addEventListener("click",fermerBorg);
    vBorg.addEventListener("click",function(e){if(e.target===vBorg)fermerBorg();});
    document.addEventListener("keydown",function(e){if(e.key==="Escape"&&vBorg.classList.contains("ouvert"))fermerBorg();});
  }

  /* ---- Fatigue musculaire : batterie ---- */
  var bat=100,fill=$("#batFill"),st=$("#batState");
  function majBat(){
    fill.style.width=bat+"%";
    fill.style.background=bat>55?"linear-gradient(90deg,#10b981,#3bd17a)":bat>25?"linear-gradient(90deg,#f59e0b,#fbbf24)":"linear-gradient(90deg,#e23a3c,#ef5a5c)";
    $("#mech1").classList.toggle("on",bat<=80);
    $("#mech2").classList.toggle("on",bat<=60);
    $("#mech3").classList.toggle("on",bat<=35);
    if(bat>=100)st.textContent="Muscle reposé : pleine capacité.";
    else if(bat>55)st.textContent="L'effort puise dans les réserves d'énergie.";
    else if(bat>25)st.textContent="Les ressources baissent, les déchets s'accumulent.";
    else if(bat>0)st.textContent="Réserves presque vides : la fatigue s'installe.";
    else st.textContent="Fatigue musculaire installée : le risque de blessure grimpe.";
  }
  var bb=$("#batBtn"),br=$("#batRst");
  if(bb){bb.addEventListener("click",function(){bat=Math.max(0,bat-20);majBat();});
    br.addEventListener("click",function(){bat=100;majBat();});majBat();}

  /* ---- Microlésions : surcouche ---- */
  var vMicro=$("#voile-micro"),declMicro=null;
  function ouvrirMicro(d){declMicro=d;vMicro.classList.add("ouvert");document.body.style.overflow="hidden";$("#fermer-micro").focus();}
  function fermerMicro(){vMicro.classList.remove("ouvert");document.body.style.overflow="";if(declMicro&&declMicro.focus)declMicro.focus();}
  document.querySelectorAll("[data-ouvrir-micro]").forEach(function(b){b.addEventListener("click",function(e){e.preventDefault();ouvrirMicro(b);});});
  if(vMicro){
    $("#fermer-micro").addEventListener("click",fermerMicro);
    vMicro.addEventListener("click",function(e){if(e.target===vMicro)fermerMicro();});
    document.addEventListener("keydown",function(e){if(e.key==="Escape"&&vMicro.classList.contains("ouvert"))fermerMicro();});
  }
  var mo=$("#recOk"),mn=$("#recNo"),mout=$("#microOut");
  function setMicro(ok){
    if(mo)mo.classList.toggle("active",ok);
    if(mn)mn.classList.toggle("active",!ok);
    if(mo)mo.setAttribute("aria-pressed",ok);
    if(mn)mn.setAttribute("aria-pressed",!ok);
    if(mout){
      mout.classList.toggle("ok",ok);mout.classList.toggle("no",!ok);
      mout.innerHTML=ok
        ?"<strong>Adaptation.</strong> Avec assez de repos, les tissus réparent les microlésions et reviennent plus forts : la force musculaire et la résistance des tendons augmentent."
        :"<strong>Dégénérescence chronique.</strong> Sans repos suffisant, les microlésions s'accumulent plus vite qu'elles ne guérissent : l'inflammation persiste et les tissus se détériorent.";
    }
  }
  if(mo){mo.addEventListener("click",function(){setMicro(true);});mn.addEventListener("click",function(){setMicro(false);});setMicro(true);}

  /* ---- Sommeil : surcouche de détails ---- */
  var SLEEP={
    tissus:{t:"Réparation des tissus",h:"<p>C'est surtout pendant le <strong>sommeil profond</strong> que le corps répare : la circulation vers les muscles augmente et les tissus sollicités pendant le quart (muscles, tendons, articulations) se reconstruisent.</p><ul><li>Les microlésions accumulées dans la journée se réparent la nuit.</li><li>Sans assez de sommeil profond, la réparation reste incomplète : tu recommences le quart avec des tissus encore fragilisés.</li><li>Nuit après nuit, ce déficit de réparation ouvre la porte aux TMS.</li></ul>"},
    hormones:{t:"Hormones de récupération",h:"<p>Le sommeil profond déclenche un pic d'<strong>hormone de croissance</strong>, celle qui répare muscles et tendons. En parallèle, le cortisol (hormone du stress) redescend.</p><ul><li>Moins de sommeil = moins d'hormone de croissance = réparation au ralenti.</li><li>Un cortisol qui reste élevé entretient l'inflammation et freine la récupération.</li></ul>"},
    douleur:{t:"Gestion de la douleur",h:"<p>Bien dormir <strong>abaisse la sensibilité à la douleur</strong>. À l'inverse, après une mauvaise nuit, le même inconfort paraît plus intense.</p><ul><li>Le manque de sommeil amplifie les signaux de douleur dans le cerveau.</li><li>Douleur plus forte = gestes de compensation = plus de risque de TMS.</li><li>Bien dormir fait partie du traitement de l'inconfort, au même titre que le repos.</li></ul>"},
    vigilance:{t:"Vigilance",h:"<p>Pendant le sommeil, le cerveau <strong>consolide la mémoire et la concentration</strong>. Reposé, tu restes alerte : tu détectes les dangers et tu gardes des gestes précis.</p><ul><li>La vigilance protège des faux mouvements et des accidents.</li><li>La concentration permet de garder les bonnes techniques de travail toute la durée du quart.</li></ul>"},
    dette:{t:"Pourquoi 7 à 9 heures ?",h:"<p>C'est la cible recommandée pour un adulte, par 24 heures. En dessous, la fatigue <strong>s'accumule comme une dette</strong> : chaque heure manquée s'additionne, nuit après nuit.</p><ul><li>Une seule grasse matinée ne rembourse pas une semaine de nuits courtes.</li><li>La dette se rattrape progressivement : des nuits complètes et régulières pendant plusieurs jours.</li><li>La régularité compte autant que la durée : se coucher et se lever à heures fixes aide le corps à récupérer.</li></ul>"},
    signes:{t:"Quand tu manques de sommeil",h:"<p>Les signes à reconnaître, sur toi ou un collègue :</p><ul><li><strong>Temps de réaction plus lent</strong> : tu freines, tu esquives, tu rattrapes moins vite.</li><li><strong>Concentration et jugement réduits</strong> : erreurs d'inattention, mauvaises décisions.</li><li><strong>Douleur ressentie plus forte</strong> : le même effort fait plus mal.</li><li><strong>Récupération musculaire incomplète</strong> : raideurs et fatigue dès le début du quart.</li><li><strong>Plus de faux mouvements et d'accidents</strong> : la fatigue multiplie les risques.</li></ul><p style='margin-top:.8rem'>Si tu te reconnais, protège ton prochain sommeil et adapte ton rythme : c'est de la prévention, pas de la paresse.</p>"},
    alcool:{t:"La fatigue conduit comme l'alcool",h:"<p>Rester éveillé <strong>17 à 19 heures d'affilée</strong> dégrade la vigilance autant qu'un taux d'alcool de <strong>0,05</strong> : réflexes ralentis, jugement altéré, micro-sommeils possibles.</p><ul><li>Personne ne travaillerait avec de l'alcool dans le sang : la fatigue extrême a pourtant le même effet.</li><li>Après un long éveil, les tâches à risque (conduite, manoeuvres de machines) demandent une vigilance que le corps n'a plus.</li><li>La seule vraie solution est le sommeil : le café ne fait que masquer la fatigue un moment.</li></ul>"},
    quarts:{t:"Conseils avant un quart",h:"<p>Le corps n'aime pas naturellement dormir le jour. Ces réflexes aident à mieux récupérer entre les quarts :</p><ul><li><strong>Routine fixe</strong> : même rituel avant de dormir, même si c'est le matin.</li><li><strong>Sieste stratégique</strong> : une courte sieste de 20 à 30 minutes avant un quart de nuit.</li><li><strong>Lumière au réveil</strong> : s'exposer à la lumière vive pour relancer la vigilance.</li></ul>"},
    checklist:{t:"Bien dormir : la checklist",h:"<div class='sl-cols'><div><p class='sl-h ok'>À faire</p><ul class='sl-check'><li>Vise 7 à 9 h de sommeil par 24 h, à heures régulières</li><li>Chambre fraîche, sombre et silencieuse (rideaux opaques, bouchons, masque)</li><li>Coupe les écrans 30 à 60 min avant de dormir</li><li>Bouge dans la journée, pas juste avant de dormir</li><li>Repas léger avant le sommeil</li><li>Protège ton sommeil : avertis l'entourage, coupe les notifications</li></ul></div><div><p class='sl-h no'>À éviter</p><ul class='sl-check no'><li>Le café dans les 6 h avant le sommeil prévu (ou en fin de quart)</li><li>L'alcool pour t'endormir : il fragmente le sommeil profond</li><li>Les repas lourds juste avant de dormir</li></ul></div></div>"}
  };
  var vSl=$("#voile-sommeil"),declSl=null;
  function ouvrirSl(d,k){
    var m=SLEEP[k];if(!m)return;
    $("#slTitre").textContent=m.t;$("#slBody").innerHTML=m.h;
    declSl=d;vSl.classList.add("ouvert");document.body.style.overflow="hidden";$("#fermer-sommeil").focus();
  }
  function fermerSl(){vSl.classList.remove("ouvert");document.body.style.overflow="";if(declSl&&declSl.focus)declSl.focus();}
  document.querySelectorAll("[data-sleep]").forEach(function(b){b.addEventListener("click",function(e){e.preventDefault();ouvrirSl(b,b.getAttribute("data-sleep"));});});
  if(vSl){
    $("#fermer-sommeil").addEventListener("click",fermerSl);
    vSl.addEventListener("click",function(e){if(e.target===vSl)fermerSl();});
    document.addEventListener("keydown",function(e){if(e.key==="Escape"&&vSl.classList.contains("ouvert"))fermerSl();});
  }

  /* ---- Vidéo : surcouche ---- */
  var vVid=$("#voile-video"),declVid=null;
  function ouvrirVid(d){declVid=d;vVid.classList.add("ouvert");document.body.style.overflow="hidden";$("#fermer-video").focus();}
  function fermerVid(){vVid.classList.remove("ouvert");document.body.style.overflow="";var lv=$("#lecteur-video");if(lv&&!lv.paused)lv.pause();if(declVid&&declVid.focus)declVid.focus();}
  document.querySelectorAll("[data-ouvrir-video]").forEach(function(b){b.addEventListener("click",function(e){e.preventDefault();ouvrirVid(b);});});
  if(vVid){
    $("#fermer-video").addEventListener("click",fermerVid);
    vVid.addEventListener("click",function(e){if(e.target===vVid)fermerVid();});
    document.addEventListener("keydown",function(e){if(e.key==="Escape"&&vVid.classList.contains("ouvert"))fermerVid();});
  }

  /* ---- Bons réflexes : surcouche ---- */
  var vRf=$("#voile-reflexes"),declRf=null;
  function ouvrirRf(d){declRf=d;vRf.classList.add("ouvert");document.body.style.overflow="hidden";$("#fermer-reflexes").focus();}
  function fermerRf(){vRf.classList.remove("ouvert");document.body.style.overflow="";if(declRf&&declRf.focus)declRf.focus();}
  document.querySelectorAll("[data-ouvrir-reflexes]").forEach(function(b){b.addEventListener("click",function(e){e.preventDefault();ouvrirRf(b);});});
  if(vRf){
    $("#fermer-reflexes").addEventListener("click",fermerRf);
    vRf.addEventListener("click",function(e){if(e.target===vRf)fermerRf();});
    document.addEventListener("keydown",function(e){if(e.key==="Escape"&&vRf.classList.contains("ouvert"))fermerRf();});
  }

  /* ---- Bas du dos : surcouche ---- */
  var vAx=$("#voile-assis"),declAx=null;
  function ouvrirAx(d){declAx=d;vAx.classList.add("ouvert");document.body.style.overflow="hidden";$("#fermer-assis").focus();}
  function fermerAx(){vAx.classList.remove("ouvert");document.body.style.overflow="";if(declAx&&declAx.focus)declAx.focus();}
  document.querySelectorAll("[data-ouvrir-assis]").forEach(function(b){b.addEventListener("click",function(e){e.preventDefault();ouvrirAx(b);});});
  if(vAx){
    $("#fermer-assis").addEventListener("click",fermerAx);
    vAx.addEventListener("click",function(e){if(e.target===vAx)fermerAx();});
    document.addEventListener("keydown",function(e){if(e.key==="Escape"&&vAx.classList.contains("ouvert"))fermerAx();});
    vAx.querySelectorAll(".ax-item").forEach(function(b){
      b.addEventListener("click",function(){
        var o=b.classList.toggle("open");b.setAttribute("aria-expanded",o);
        var d=b.nextElementSibling;if(d)d.classList.toggle("open",o);
      });
    });
  }

  /* ---- Statique / dynamique ---- */
  var ss=$("#sdSta"),sd=$("#sdDyn"),sdMod=$("#sdMod");
  var SD={
    sta:{mode:"Statique",sub:"Contraction maintenue",
      img1:["images/sd_compression.jpg","Obstruction et compression du flot sanguin : le vaisseau est écrasé par la contraction"],
      img2:["images/sd_tubes_statique.jpg","Éprouvettes : le besoin de sang est élevé mais le flot sanguin est réduit"],
      li:["Le muscle reste contracté.","Le flot sanguin est comprimé.","La fatigue arrive plus vite.","Le risque de douleur augmente."]},
    dyn:{mode:"Dynamique",sub:"Contraction / relâchement",
      img1:["images/sd_circulation.jpg","Entrée et sortie du sang : la circulation alterne avec la contraction"],
      img2:["images/sd_tubes_dynamique.jpg","Éprouvettes : le besoin de sang et le flot sanguin restent équilibrés"],
      li:["Le muscle alterne contraction et relâchement.","Le sang circule mieux.","La fatigue arrive moins vite.","L'effort est plus facile à soutenir."]}
  };
  function setSD(sta){
    ss.classList.toggle("active",sta);sd.classList.toggle("active",!sta);
    ss.setAttribute("aria-selected",sta);sd.setAttribute("aria-selected",!sta);
    sdMod.classList.toggle("dyn",!sta);
    var m=sta?SD.sta:SD.dyn;
    $("#sdK").textContent=m.mode;
    $("#sdSub").textContent=m.sub;
    [["#sdImg1",m.img1],["#sdImg2",m.img2]].forEach(function(p){
      var img=$(p[0]);
      img.classList.add("swap");
      setTimeout(function(){img.src=p[1][0];img.alt=p[1][1];img.classList.remove("swap");},220);
    });
    $("#sdList").innerHTML=m.li.map(function(t){return "<li>"+t+"</li>";}).join("");
  }
  if(ss){ss.addEventListener("click",function(){setSD(true);});sd.addEventListener("click",function(){setSD(false);});}

  /* ---- Conséquences statique : accordéon ---- */
  document.querySelectorAll(".vxc-btn").forEach(function(b){
    b.addEventListener("click",function(){
      var o=b.getAttribute("aria-expanded")==="true";
      b.setAttribute("aria-expanded",!o);
      var d=b.nextElementSibling;if(d)d.classList.toggle("open",!o);
    });
  });
})();

/* ================================================================
   QUIZ PRÉVENTION TMS
   ================================================================ */
(function(){
  var stage=document.getElementById("qStage");
  if(!stage)return;
  var QUESTIONS=[
    {q:"Qu'est-ce qu'un trouble musculosquelettique (TMS) ?",
     o:["Une blessure soudaine et unique, comme une fracture","Une atteinte des muscles, tendons, nerfs ou articulations qui s'installe surtout par usure","Une maladie contagieuse propre aux mines","Un trouble uniquement psychologique lié au stress"],
     a:1,f:"Un TMS touche les muscles, tendons, nerfs, ligaments ou articulations. Il est rarement dû à un seul accident : il s'installe progressivement quand la charge dépasse la capacité de récupération."},
    {q:"Dans quel ordre la douleur d'un TMS évolue-t-elle si on n'agit pas ?",
     o:["Lésion, puis douleur, puis inconfort","Douleur, puis inconfort, puis guérison","Inconfort, puis douleur, puis lésion","Tout arrive d'un coup, sans étapes"],
     a:2,f:"La même atteinte passe d'un simple inconfort (phase aiguë) à une douleur tenace, puis à une lésion durable. Plus on attend, plus la récupération est longue : c'est pourquoi il faut agir dès l'inconfort."},
    {q:"À quel moment faut-il agir pour éviter qu'un TMS s'installe ?",
     o:["Dès les premiers inconforts","Seulement quand la douleur empêche de travailler","Quand la lésion est confirmée par un médecin","Quand un collègue le remarque"],
     a:0,f:"La fenêtre d'action, c'est le stade inconfort. À ce stade l'atteinte reste réversible : agir tôt (récupération, ajustements) évite que les microlésions s'accumulent vers la douleur puis la lésion."},
    {q:"Un TMS a généralement…",
     o:["Une seule cause précise","Plusieurs facteurs qui se combinent et se multiplient","Toujours une cause environnementale","Une cause purement génétique"],
     a:1,f:"Effort, posture, répétition, fatigue et environnement se cumulent. Cocher plusieurs familles de facteurs à la fois fait grimper le risque plus vite, car les facteurs se multiplient entre eux."},
    {q:"Pourquoi le travail musculaire statique (contraction maintenue) est-il plus fatigant ?",
     o:["Parce qu'il fait transpirer davantage","Parce que le muscle contracté comprime ses vaisseaux et reçoit moins de sang","Parce qu'il demande plus de concentration","Il n'est pas plus fatigant que le travail dynamique"],
     a:1,f:"Quand le muscle reste contracté, il comprime ses propres vaisseaux : le sang circule mal, l'oxygène et les nutriments arrivent moins, et la fatigue arrive plus vite. Même 2 % de la force maximale suffit à réduire l'apport sanguin."},
    {q:"À quoi sert l'échelle de l'effort perçu (échelle de Borg) ?",
     o:["À mesurer le poids exact d'une charge","À mettre un chiffre sur l'effort ressenti, de 0 à 10","À évaluer la température du milieu de travail","À noter la qualité du sommeil"],
     a:1,f:"Une même force représente un effort différent d'une personne à l'autre. L'échelle (0 = aucun effort, 10 = effort maximal) aide à repérer la fatigue avant qu'elle ne s'installe."},
    {q:"Combien d'heures de sommeil par 24 h sont recommandées pour bien récupérer ?",
     o:["3 à 4 h","5 à 6 h","7 à 9 h","10 à 12 h"],
     a:2,f:"La cible est de 7 à 9 h par 24 h, à heures régulières. La fatigue ne se rattrape pas en une seule grasse matinée : elle s'accumule comme une dette."},
    {q:"Rester éveillé 17 à 19 heures d'affilée affecte la vigilance…",
     o:["Pas du tout, le café compense","Autant qu'un taux d'alcool de 0,05","Seulement chez les personnes âgées","Uniquement la nuit"],
     a:1,f:"Une fatigue extrême dégrade les réflexes et le jugement autant qu'un taux d'alcool de 0,05. Le café ne fait que masquer la fatigue : seule la vraie solution est le sommeil."},
    {q:"Quelle est la bonne technique pour soulever une charge ?",
     o:["Dos arrondi, jambes droites, charge loin du corps","Plier les genoux, garder le dos naturel et la charge près du corps","Tourner le tronc pour aller plus vite","Soulever d'un coup sec pour en finir"],
     a:1,f:"Charge près du corps, dos en position naturelle, on plie les genoux et on pivote avec les pieds plutôt qu'en tordant le tronc. Demander une aide mécanique n'est pas une faiblesse."},
    {q:"Que faire face à un inconfort qui revient au travail ?",
     o:["L'ignorer, c'est normal","Le cacher pour ne pas paraître faible","Le signaler tôt à son superviseur ou au comité santé-sécurité","Attendre que ça devienne chronique"],
     a:2,f:"Un inconfort qui revient est une information à partager vite. Pris tôt, un TMS se soigne plus facilement, on peut ajuster le poste, et ton signalement protège aussi tes collègues."}
  ];
  var idx=0,score=0,answered=false;
  var stageEl=stage,progTxt=document.getElementById("qProgTxt"),progBar=document.getElementById("qProgBar"),
      scoreLive=document.getElementById("qScoreLive"),resultEl=document.getElementById("qResult");
  function render(){
    answered=false;
    var Q=QUESTIONS[idx];
    progTxt.textContent="Question "+(idx+1)+" / "+QUESTIONS.length;
    progBar.style.width=((idx+1)/QUESTIONS.length*100)+"%";
    scoreLive.textContent=score+(score>1?" bonnes réponses":" bonne réponse");
    var h="<div class='quiz-q'>"+Q.q+"</div><div class='quiz-opts'>";
    Q.o.forEach(function(opt,i){
      h+="<button type='button' class='quiz-opt' data-i='"+i+"'><span class='qo-mark'>"+String.fromCharCode(65+i)+"</span><span>"+opt+"</span></button>";
    });
    h+="</div><div class='quiz-fb' id='qFb' hidden></div>";
    stageEl.innerHTML=h;
    stageEl.querySelectorAll(".quiz-opt").forEach(function(b){
      b.addEventListener("click",function(){choisir(parseInt(b.dataset.i,10));});
    });
  }
  function choisir(i){
    if(answered)return;answered=true;
    var Q=QUESTIONS[idx],opts=stageEl.querySelectorAll(".quiz-opt");
    var bon=i===Q.a;if(bon)score++;
    opts.forEach(function(b){
      var bi=parseInt(b.dataset.i,10);b.disabled=true;
      if(bi===Q.a)b.classList.add("ok");
      else if(bi===i)b.classList.add("bad");
    });
    scoreLive.textContent=score+(score>1?" bonnes réponses":" bonne réponse");
    var fb=document.getElementById("qFb");
    fb.className="quiz-fb "+(bon?"ok":"bad");fb.hidden=false;
    fb.innerHTML="<div class='qf-k'>"+(bon?"✓ Bonne réponse":"✕ Pas tout à fait")+"</div>"+Q.f+
      "<div><button type='button' class='quiz-next' id='qNext'>"+(idx<QUESTIONS.length-1?"Question suivante &rarr;":"Voir mon résultat &rarr;")+"</button></div>";
    document.getElementById("qNext").addEventListener("click",suivant);
    fb.scrollIntoView({behavior:"smooth",block:"nearest"});
  }
  function suivant(){
    if(idx<QUESTIONS.length-1){idx++;render();stageEl.scrollIntoView({behavior:"smooth",block:"nearest"});}
    else fin();
  }
  function fin(){
    stageEl.hidden=true;
    var n=QUESTIONS.length,pct=Math.round(score/n*100),win=score>=8;
    var msg;
    if(score>=9)msg="Excellent ! Tu maîtrises les réflexes qui protègent ton corps au quotidien.";
    else if(score>=7)msg="Bon travail. Quelques notions à revoir, mais l'essentiel est acquis.";
    else if(score>=5)msg="Pas mal. Reprends les sections clés pour ancrer les bons réflexes.";
    else msg="C'est un début. Relis les sections de la page : agir tôt change tout.";
    progTxt.textContent="Quiz terminé";progBar.style.width="100%";
    scoreLive.textContent=score+" / "+n;
    resultEl.hidden=false;
    resultEl.innerHTML="<div class='qr-score "+(win?"win":"")+"'>"+score+" / "+n+"</div>"+
      "<div class='qr-sub'>"+pct+" % de bonnes réponses</div>"+
      "<p class='qr-msg'>"+msg+"</p>"+
      "<div style='display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap'>"+
      "<button type='button' class='quiz-next' id='qRestart'>↺ Recommencer le quiz</button>"+
      "<a class='btn ghost' href='#comprendre'>Revoir les notions &uarr;</a></div>";
    document.getElementById("qRestart").addEventListener("click",function(){
      idx=0;score=0;resultEl.hidden=true;stageEl.hidden=false;render();
      document.getElementById("quizBox").scrollIntoView({behavior:"smooth",block:"start"});
    });
  }
  render();
})();

/* ================================================================
   APPLICATION HORS LIGNE (PWA)
   ================================================================ */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  });
}
(function () {
  var box = document.getElementById("pwaInstall");
  if (!box) return;
  var go = document.getElementById("pwaGo"), x = document.getElementById("pwaX");
  var deferred = null, hideT = null, heroOut = false, shown = false;
  function off(){ try { return localStorage.getItem("tms_pwa") === "off"; } catch(e){ return false; } }
  function place(){ if(window.innerWidth<=980){ var tb=document.querySelector(".toc"); box.style.top=(tb?Math.round(tb.getBoundingClientRect().bottom)+8:12)+"px"; } else box.style.top="12px"; }
  function show(){ if(off()||!deferred) return; place(); box.classList.add("visible"); clearTimeout(hideT); hideT=setTimeout(hide,15000); } /* ne reste pas affiche : auto-masque apres 15s */
  function hide(){ box.classList.remove("visible"); clearTimeout(hideT); }
  function maybeShow(){ if(shown||off()||!deferred||!heroOut) return; shown=true; show(); } /* jamais sur l'accueil (hero) : on attend d'avoir defile au-dela, puis une seule fois */
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; maybeShow(); });
  go.addEventListener("click", function () { if(!deferred){ hide(); return; } deferred.prompt(); deferred.userChoice.then(function () { deferred = null; hide(); }); });
  x.addEventListener("click", function () { hide(); try { localStorage.setItem("tms_pwa","off"); } catch(e){} }); /* fermer = ne plus reproposer */
  window.addEventListener("appinstalled", function () { hide(); try { localStorage.setItem("tms_pwa","off"); } catch(e){} });
  var hero=document.querySelector(".hero");                          /* le bandeau ne s'affiche que hors de la vue d'accueil */
  if(hero&&"IntersectionObserver" in window){ new IntersectionObserver(function(es){ heroOut=!es[0].isIntersecting; if(heroOut)maybeShow(); else hide(); },{threshold:0}).observe(hero); }
  else { heroOut=true; }
})();
