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
  lombalgie:{tag:'Type of MSD',title:'Low back pain',img:'images/tms_lombalgie.jpeg',desc:"A lower-back problem affecting the lumbar vertebrae, the discs and the muscles. It's the most common musculoskeletal disorder in the workplace.",risk:['Handling heavy loads','Repeated bending and twisting of the trunk','Prolonged leaning or sitting postures','Whole-body vibration'],prev:['Bend your knees, keep your back straight','Keep the load close to your body','Don’t twist your trunk while lifting',"Use a mechanical aid or ask for help"]},
  tendinite:{tag:'Type of MSD',title:'Tendinitis',img:'images/tms_tendinite.jpeg',desc:"Inflammation of a tendon, most often in the shoulder, elbow or wrist. It shows up when the tendon is overworked without enough recovery.",risk:['Repetitive movements','Intense or prolonged effort','Frequent gripping and clamping','Tool vibration'],prev:['Alternate your tasks and movements','Take micro-breaks',"Warm up before effort","Adjust the tool and the working height"]},
  bursite:{tag:'Type of MSD',title:'Bursitis',img:'images/tms_bursite.jpeg',desc:"Inflammation of the bursae, the small cushions that absorb shock in the joints. Common in the knees and shoulders.",risk:['Prolonged kneeling','Repeated pressure and rubbing','Direct impacts or pressure','Working with arms raised'],prev:['Wear knee pads','Vary your postures regularly','Avoid prolonged pressure','Set up a support under your knees']},
  carpien:{tag:'Type of MSD',title:'Carpal tunnel',img:'images/tms_carpien.jpeg',desc:"Compression of the median nerve in the wrist. Causes numbness, tingling and loss of strength in the hand.",risk:['Repetitive wrist movements','High gripping force','Wrist bent for a long time','Tool vibration'],prev:['Keep your wrist in a neutral position','Use ergonomic tools','Reduce your gripping force','Take breaks and stretches']},
  dos:{tag:'At-risk area',title:'Back and lower back',img:'images/zone_dos.jpeg',desc:"The lower back takes most of the handling effort. It's the area most affected by MSDs underground.",risk:['Handling heavy loads','Bending the trunk','Twisting under load','Whole-body vibration'],prev:['Bend your knees, not your back','Keep the load close to your body','Pivot with your feet, not your trunk','Mechanical aids when possible']},
  epaules:{tag:'At-risk area',title:'Shoulders',img:'images/zone_epaules.jpeg',desc:"Your shoulders are under strain any time you work with your arms raised or handle loads up high.",risk:['Working with arms raised','Vibration','Loads up high','Repeated movements above the shoulders'],prev:['Work at chest height','Bring the work closer to you','Alternate your arms and tasks','Use supports or platforms']},
  cou:{tag:'At-risk area',title:'Neck',img:'images/zone_cou.jpeg',desc:"The neck suffers from static postures and the weight of the gear carried on your head.",risk:['Prolonged static postures',"Head leaning forward",'Weight of the helmet and lamp','Lack of movement'],prev:["Keep your head in line",'Do gentle neck rotations',"Adjust the lighting and your position",'Move regularly']},
  poignets:{tag:'At-risk area',title:'Wrists and hands',img:'images/zone_poignets.jpeg',desc:"Wrists and hands are exposed to vibrating tools and to repeated gripping and clamping movements.",risk:['Vibrating tools','Repeated gripping and clamping','High clamping force','Wrist bent or deviated under load'],prev:['Wrists in a neutral position','Suitable, anti-vibration tools','Reduce your gripping force','Breaks and stretches']},
  coudes:{tag:'At-risk area',title:'Elbows',img:'images/zone_coudes.jpeg',desc:"Elbows get put to the test by repeated movements and the force applied in twisting.",risk:['Repeated movements','Twisting force','Bending and straightening effort','Prolonged pressure on the elbow'],prev:['Alternate your tasks and movements','Reduce your twisting force','Take regular breaks','Warm up your forearms']},
  genoux:{tag:'At-risk area',title:'Knees',img:'images/zone_genoux.jpeg',desc:"Knees take the brunt of crouching, kneeling and the unstable ground underground.",risk:['Crouching','Kneeling','Uneven, unstable ground','Moving over rough terrain'],prev:['Wear knee pads','Vary your supports and postures','Stand back up regularly','Secure and stabilize the ground']}
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
  document.querySelectorAll('h3.sub-h').forEach(function(h){ITEMS.push({k:'Topic',label:h.textContent.replace(/\s+/g,' ').replace(/:.*clique.*$/i,'').trim(),sub:'',go:'#'+h.id});});
  Object.keys(MODAL_DATA).forEach(function(key){var d=MODAL_DATA[key];ITEMS.push({k:'Card',label:d.title,sub:d.tag,modal:key,kw:(d.desc+' '+d.risk.join(' ')+' '+d.prev.join(' '))});});
  ITEMS.push({k:'Section',label:'MSD prevention quiz',sub:'#quiz',go:'#quiz',kw:'quiz test questions knowledge evaluation'});
  ITEMS.push({k:'Page',label:'Guided training: quiz and certificate',sub:'formation.html',go:'formation.html',kw:'quiz certificate attestation guided training score'});
  var filtered=[],active=0;
  function norm(s){return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');}
  function render(q){q=norm((q||'').trim());filtered=ITEMS.filter(function(it){return !q||norm(it.label).indexOf(q)>-1||norm(it.kw).indexOf(q)>-1;});active=0;
    if(!filtered.length){list.innerHTML='<div class="cmdk-empty">No results. Try "back", "sleep", "knees"…</div>';return;}
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
      lbl.textContent='Mobile version';
    }else{
      vp.setAttribute('content',MOBILE);
      lbl.textContent='Desktop version';
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
  biomecanique: { nom: "Biomechanical factors", couleur: "#1b6e96", clair: "#2e8fc0" },
  individuel: { nom: "Individual factors", couleur: "#d97a16", clair: "#f09430" },
  environnement: { nom: "Environmental factors", couleur: "#5a9421", clair: "#74b62e" }
};

const DETAILS = {
  /* ----- Les trois familles ----- */
  "biomecanique": {
    categorie: "Main family", titre: "Biomechanical factors", icone: "💪", couleur: "#1b6e96",
    description: "These are the physical demands tied directly to the task: the force you put in, how often you move, the positions you work in and the weight you handle. The more intense, frequent or drawn-out these demands are, the more your muscles, tendons and joints get pushed past their ability to recover.",
    exemples: [
      "Force: pushing, pulling or lifting with effort.",
      "Repetition: doing the same movement hundreds of times a shift.",
      "Postures: working with your back hunched, your wrists bent or your neck tilted.",
      "Loads: handling heavy objects or ones that are hard to grip.",
      "Twisting: turning your trunk or wrists under load."
    ],
    prevention: [
      "Cut the weight of loads or use mechanical aids.",
      "Mix up your movements and switch between tasks.",
      "Set up your workstation to keep neutral postures.",
      "Get trained in proper work techniques."
    ],
    zones: ["epaules", "haut-dos", "bas-dos", "coudes", "poignets-mains"],
    voirAussi: ["manutention", "mouvements-repetes", "combinaison"]
  },
  "individuel": {
    categorie: "Main family", titre: "Individual factors", icone: "🧍", couleur: "#d97a16",
    description: "Everyone reacts differently to the same demands. Your fitness level, built-up fatigue, sleep quality, a pain you already have or how much experience you've got all affect how well your body can take a hit and recover.",
    exemples: [
      "Fatigue: a tired body protects itself less and compensates poorly.",
      "Sleep: poor sleep slows down how your tissues repair.",
      "Physical condition: weak muscle endurance makes you more vulnerable.",
      "Pain you already have: an injury that healed badly weakens the area.",
      "Experience: a new worker is less skilled at the efficient movements."
    ],
    prevention: [
      "Report any lasting pain early.",
      "Get good sleep and look after your overall health.",
      "Allow a break-in period for new workers.",
      "Match the workload to what each person can handle."
    ],
    zones: [],
    voirAussi: ["recuperation", "fatigue", "combinaison"]
  },
  "environnement": {
    categorie: "Main family", titre: "Environmental factors", icone: "🌡️", couleur: "#5a9421",
    description: "The physical setting where you do the task can ramp up every other demand: poorly suited tools, vibration, cold, a cramped space or unstable ground all force your body to work harder for the same result.",
    exemples: [
      "Tools: a poorly maintained or wrong-sized tool takes more force.",
      "Vibration: it wears out the tissues in your hands, arms and back.",
      "Temperature: cold stiffens your muscles, heat wears you out.",
      "Work space: a tight space forces awkward postures.",
      "Unstable ground: it throws you off balance and adds to the effort of staying steady."
    ],
    prevention: [
      "Pick and maintain ergonomic tools.",
      "Clear out and organize your work space.",
      "Match your clothing and breaks to the temperature.",
      "Keep floors clean, level and clear."
    ],
    zones: ["poignets-mains", "bas-dos", "genoux"],
    voirAussi: ["froid", "outils-vibrants", "combinaison"]
  },

  /* ----- Situations à risque : famille biomécanique ----- */
  "manutention": {
    categorie: "Biomechanical sub-factor", titre: "Material handling", icone: "📦", couleur: "#2e8fc0", famille: "biomecanique",
    description: "Lifting, carrying, pushing or pulling loads puts a heavy strain on your back, shoulders and arms. The risk goes up with the weight, how far the load is from your body, how often you do it and the posture you're in.",
    exemples: [
      "Lifting a box off the floor with a rounded back.",
      "Carrying a load away from your body, arms out.",
      "Stacking bags above shoulder height.",
      "Pulling a heavy cart over a long distance."
    ],
    prevention: [
      "Use mechanical aids (pallet jack, hand truck, lift assist).",
      "Keep the load close to your body and bend your knees.",
      "Split up loads that are too heavy.",
      "Work in pairs for bulky objects."
    ],
    zones: ["bas-dos", "epaules", "poignets-mains"],
    voirAussi: ["charges", "efforts", "torsion"]
  },
  "bras-leves": {
    categorie: "Risk situation · biomechanical family", titre: "Working with arms raised", icone: "🙆", couleur: "#2e8fc0", famille: "biomecanique",
    description: "Working with your hands above your shoulders keeps the shoulder muscles and tendons under constant tension and cuts down their blood supply. It's one of the main causes of rotator cuff tendinitis.",
    exemples: [
      "Screwing or painting overhead.",
      "Storing items on high shelves.",
      "Pulling cables above your head.",
      "Installing panels or ducts up high."
    ],
    prevention: [
      "Use a platform or step stool to work at shoulder height.",
      "Keep arms-raised tasks short and switch them up.",
      "Use tool extensions when you can.",
      "Set up your gear within reach before you go up."
    ],
    zones: ["epaules", "cou"],
    voirAussi: ["hauteur-travail", "postures"]
  },
  "mouvements-repetes": {
    categorie: "Risk situation · biomechanical family", titre: "Fast non-stop movements", icone: "⏱️", couleur: "#2e8fc0", famille: "biomecanique",
    description: "Repeating the same movement without a break stops your tissues from recovering between efforts. Even a light effort becomes harmful when you do it thousands of times: it's the build-up that injures you.",
    exemples: [
      "Scanning items at the till all day.",
      "Assembling the same parts on an assembly line.",
      "Cutting or boning at a steady pace.",
      "Clicking and typing non-stop."
    ],
    prevention: [
      "Rotate tasks among coworkers.",
      "Build in regular micro-breaks.",
      "Automate or mechanize the most repetitive movements.",
      "Change how you do the movement when you can."
    ],
    zones: ["poignets-mains", "coudes", "epaules"],
    voirAussi: ["recuperation", "prise-serree"]
  },
  "posture-statique": {
    categorie: "Risk situation · biomechanical family", titre: "Static posture", icone: "🪑", couleur: "#2e8fc0", famille: "biomecanique",
    description: "Staying in the same position for a long time, sitting or standing, keeps your muscles tensed up and slows your blood flow. Holding still for a long stretch tires you out as much as effort does: your body needs movement to keep the blood flowing.",
    exemples: [
      "Sitting in front of a screen for hours without moving.",
      "Standing still at a control station.",
      "Holding your arms in the same position to grip a part.",
      "Driving for long hours without a break."
    ],
    prevention: [
      "Get up, walk and stretch regularly.",
      "Switch between sitting and standing.",
      "Adjust your workstation (chair, screen, work surface) to your build.",
      "Schedule active breaks into your day."
    ],
    zones: ["cou", "haut-dos", "bas-dos"],
    voirAussi: ["postures", "espace-travail"]
  },
  "prise-serree": {
    categorie: "Risk situation · biomechanical family", titre: "Tight grip", icone: "✊", couleur: "#2e8fc0", famille: "biomecanique",
    description: "Gripping a tool or object hard, especially with your fingertips (pinch grip), puts a heavy strain on the tendons in your hand and forearm. The risk goes up if you hold the grip a long time, repeat it, or combine it with vibration or cold.",
    exemples: [
      "Holding a power screwdriver tightly all day.",
      "Cutting with scissors or pliers over and over.",
      "Gripping smooth or slippery parts with your fingertips.",
      "Carrying containers by a handle that's too thin."
    ],
    prevention: [
      "Pick tools with handles that fit your hand.",
      "Go for a full-hand grip instead of a pinch.",
      "Maintain your tools to cut the force needed.",
      "Wear well-fitted gloves that don't make you grip harder."
    ],
    zones: ["poignets-mains", "coudes"],
    voirAussi: ["outils", "froid", "outils-vibrants"]
  },
  "travail-genoux": {
    categorie: "Risk situation · biomechanical family", titre: "Kneeling", icone: "🧎", couleur: "#2e8fc0", famille: "biomecanique",
    description: "Kneeling or crouching presses directly on the structures of your knee and bends the joint to the extreme. Held or repeated, this position leads to bursitis, meniscus damage and chronic pain.",
    exemples: [
      "Laying flooring or tile.",
      "Doing mechanical work down at floor level.",
      "Gardening or weeding on your knees.",
      "Working under low equipment."
    ],
    prevention: [
      "Wear knee pads or use a padded mat.",
      "Use a small bench or low seat when you can.",
      "Raise the work up instead of going down to it.",
      "Get up and move your legs often."
    ],
    zones: ["genoux", "bas-dos"],
    voirAussi: ["espace-travail", "sol-inegal"]
  },

  /* ----- Situation à risque : famille individuelle ----- */
  "recuperation": {
    categorie: "Individual sub-factor", titre: "Recovery", icone: "😴", couleur: "#f09430", famille: "individuel",
    description: "Your tissues repair during breaks and rest. Without enough recovery time (breaks too far apart, overtime, poor sleep), the micro-injuries pile up faster than they heal and an MSD sets in.",
    exemples: [
      "Working back-to-back shifts with no day off.",
      "Skipping your breaks to finish faster.",
      "A set pace that gives you no breather between cycles.",
      "Combining physical work with not enough sleep."
    ],
    prevention: [
      "Take the breaks you're given and make them real breaks.",
      "Alternate demanding tasks with lighter ones.",
      "Cut down on repeated overtime.",
      "Protect enough regular sleep."
    ],
    zones: [],
    voirAussi: ["fatigue", "sommeil", "mouvements-repetes"]
  },

  /* ----- Situations à risque : famille environnement ----- */
  "outils-vibrants": {
    categorie: "Environmental sub-factor", titre: "Vibration", icone: "📳", couleur: "#74b62e", famille: "environnement",
    description: "Vibration passed into your hands and arms gradually damages the nerves, blood vessels and joints. Over the long run, it can cause hand-arm vibration syndrome (white finger, numbness, loss of dexterity).",
    exemples: [
      "Using a jackhammer or a plate compactor.",
      "Grinding or sanding for long stretches.",
      "Working with a chainsaw or a brush cutter.",
      "Bolting with impact wrenches over and over."
    ],
    prevention: [
      "Pick anti-vibration tools and keep them well maintained.",
      "Limit your daily exposure time and switch between tasks.",
      "Wear anti-vibration gloves.",
      "Don't grip the tool tighter than you have to."
    ],
    zones: ["poignets-mains", "coudes", "epaules"],
    voirAussi: ["outils", "froid", "prise-serree"]
  },
  "hauteur-travail": {
    categorie: "Risk situation · environmental family", titre: "Work level", icone: "↕️", couleur: "#74b62e", famille: "environnement",
    description: "A work surface that's too low forces you to bend over, one that's too high forces you to lift your shoulders. Either way, your body compensates with awkward postures it holds all day long.",
    exemples: [
      "A workbench so low it makes you hunch your back.",
      "A counter so high it forces you to raise your shoulders.",
      "Working at the bottom of a deep bin or tank.",
      "A screen set too low or too high for your eyes."
    ],
    prevention: [
      "Set the work surface height to the task and the person.",
      "Use lift tables or adjustable supports.",
      "Tilt or raise up deep containers.",
      "Position the work between your hips and your shoulders."
    ],
    zones: ["haut-dos", "bas-dos", "epaules", "cou"],
    voirAussi: ["postures", "bras-leves", "espace-travail"]
  },
  "froid": {
    categorie: "Risk situation · environmental family", titre: "Cold and damp", icone: "❄️", couleur: "#74b62e", famille: "environnement",
    description: "Cold stiffens your muscles and tendons, dulls the feeling and dexterity in your hands, and pushes you to grip harder. Dampness, which is everywhere underground, makes it worse: cold, wet tissues get stiffer and more prone to injury. Cold also ramps up every other factor, especially vibration and repeated movements.",
    exemples: [
      "Working in a cold room or a refrigerated warehouse.",
      "Handling frozen goods with bare or barely protected hands.",
      "Working outside in winter with metal tools.",
      "Cold drafts at a fixed workstation.",
      "A mine drift that's cold and damp non-stop."
    ],
    prevention: [
      "Wear clothing and gloves suited to the cold.",
      "Plan warm-up breaks in a heated room.",
      "Warm up before demanding tasks.",
      "Insulate tool handles and block off drafts.",
      "Stay dry: waterproof clothing and a change of clothes."
    ],
    zones: ["poignets-mains"],
    voirAussi: ["temperature", "prise-serree", "outil-percussion", "outils-vibrants"]
  },

  /* ----- Sous-facteurs biomécaniques ----- */
  "efforts": {
    categorie: "Biomechanical sub-factor", titre: "Effort", icone: "🏋️", couleur: "#2e8fc0", famille: "biomecanique",
    description: "Straining to push, pull, lift or grip puts a lot of tension on your muscles and tendons. The risk goes up when the effort is intense, drawn-out, repeated or done in a bad posture.",
    exemples: [
      "Pushing a heavy or poorly greased cart.",
      "Loosening a seized fitting with a wrench.",
      "Pulling a pallet over rough ground.",
      "Cutting hard material with a dull tool."
    ],
    prevention: [
      "Mechanize the most intense efforts.",
      "Maintain your equipment to cut down on resistance.",
      "Get into the right position before you strain.",
      "Ask for help with the heavy one-off efforts."
    ],
    zones: ["epaules", "haut-dos", "bas-dos", "coudes"],
    voirAussi: ["manutention", "charges", "prise-serree"]
  },
  "postures": {
    categorie: "Biomechanical sub-factor", titre: "Posture", icone: "🧘", couleur: "#2e8fc0", famille: "biomecanique",
    description: "A posture is awkward when a joint moves away from its neutral position: rounded back, bent neck, cocked wrists, arms held out. Held or repeated, it overloads the structures that hold the joint steady.",
    exemples: [
      "Working with your back leaning forward.",
      "Keeping your neck bent toward a screen or a part.",
      "Bending your wrists to reach a control.",
      "Reaching for objects set too far away or too low."
    ],
    prevention: [
      "Bring the work closer to your body.",
      "Adjust the height and tilt of your workstation.",
      "Keep your joints close to neutral.",
      "Change position often."
    ],
    zones: ["cou", "haut-dos", "bas-dos", "poignets-mains"],
    voirAussi: ["posture-statique", "hauteur-travail"]
  },
  "charges": {
    categorie: "Risk situation · biomechanical family", titre: "Box away from the body", icone: "📦", couleur: "#2e8fc0", famille: "biomecanique",
    description: "The farther a load is held or carried from your trunk, the more the real effort blows up: held at arm's length, 10 kg loads your lower back like several dozen kilos. The distance between the load and your body is often more dangerous than the weight itself.",
    exemples: [
      "Grabbing a box at the back of a pallet or a deep bin.",
      "Carrying an object at arm's length to see where you're walking.",
      "Setting a load down over an obstacle or a counter.",
      "Handling a bulky object you can't keep close to your body."
    ],
    prevention: [
      "Bring the load close to your trunk before you lift.",
      "Slide or turn the load toward you instead of reaching out.",
      "Get as close as you can: open the bin, clear the obstacles.",
      "Reorganize storage so you can grab heavy loads close to your body."
    ],
    zones: ["bas-dos", "epaules", "poignets-mains"],
    voirAussi: ["manutention", "efforts", "torsion"]
  },
  "torsion": {
    categorie: "Biomechanical sub-factor", titre: "Twisting", icone: "🌀", couleur: "#2e8fc0", famille: "biomecanique",
    description: "Turning your trunk or your wrists during an effort piles compression and shear onto the discs and tendons. It's one of the riskiest movements for your lower back, especially with a load in your hands.",
    exemples: [
      "Twisting your trunk while holding a load instead of moving your feet.",
      "Transferring from one bin to another by turning your upper body.",
      "Screwing by hand over and over.",
      "Reaching for an object behind you without moving."
    ],
    prevention: [
      "Pivot with your feet, never with your trunk under load.",
      "Place bins and equipment right in front of you.",
      "Reorganize the workstation to avoid having to twist.",
      "Use right-angle drive tools."
    ],
    zones: ["bas-dos", "poignets-mains"],
    voirAussi: ["manutention", "postures"]
  },

  /* ----- Sous-facteurs individuels ----- */
  "fatigue": {
    categorie: "Individual sub-factor", titre: "Fatigue", icone: "🥱", couleur: "#f09430", famille: "individuel",
    description: "Fatigue cuts your strength, alertness and coordination. Your movements get less precise, your body compensates with bad postures, and the warning signs slip by unnoticed.",
    exemples: [
      "End of a shift, when everything feels heavier.",
      "A peak period with a long stretch of overload.",
      "Working two physical jobs at once.",
      "A long drive before and after work."
    ],
    prevention: [
      "Take real breaks before you're worn out.",
      "Alternate demanding tasks with lighter ones.",
      "Match your pace to the length of the shift.",
      "Listen to what your body's telling you, and speak up."
    ],
    zones: [],
    voirAussi: ["sommeil", "recuperation"]
  },
  "sommeil": {
    categorie: "Individual sub-factor", titre: "Sleep", icone: "🌙", couleur: "#f09430", famille: "individuel",
    description: "Your muscles and tendons repair themselves while you sleep. A chronic sleep debt cranks up how much pain you feel, slows your recovery and leaves your tissues weaker against the next day's demands.",
    exemples: [
      "Rotating schedules that throw off your body clock.",
      "Night work with a cut-short day's sleep.",
      "Insomnia tied to stress.",
      "Screens late at night that push back when you fall asleep."
    ],
    prevention: [
      "Aim for 7 to 9 hours of regular sleep.",
      "Keep your schedule as steady as you can.",
      "Set up a dark, quiet place to sleep.",
      "Cut back on screens and stimulants late in the evening."
    ],
    zones: [],
    voirAussi: ["fatigue", "recuperation"]
  },
  "condition-physique": {
    categorie: "Individual sub-factor", titre: "Physical capacity", icone: "🏃", couleur: "#f09430", famille: "individuel",
    description: "Muscle endurance, strength and flexibility set the gap between what the task demands and what your body can give. The thinner that gap, the sooner fatigue and micro-injuries show up.",
    exemples: [
      "Going back to work after a long layoff.",
      "A sedentary lifestyle paired with physical work.",
      "A task whose demands top out what you can do that day.",
      "No warm-up before a big effort."
    ],
    prevention: [
      "Get regular physical activity.",
      "Warm up before demanding tasks.",
      "Ease back in gradually after time off.",
      "Match the task to the person, not the other way around."
    ],
    zones: [],
    voirAussi: ["experience", "fatigue"]
  },
  "douleur-presente": {
    categorie: "Individual sub-factor", titre: "Pain you already have", icone: "🤕", couleur: "#f09430", famille: "individuel",
    description: "Pain that hangs on is a warning sign: the tissues are already overloaded. Keeping at it the same way turns a discomfort you could reverse into a settled-in injury that takes a lot longer to heal.",
    exemples: [
      "An ache that no longer clears up between shifts.",
      "Throbbing that wakes you up at night.",
      "Marked stiffness when you get up in the morning.",
      "Numbness or tingling in your fingers."
    ],
    prevention: [
      "Report the pain early, before it gets worse.",
      "Adjust the task or the pace for a while.",
      "See a health professional.",
      "Keep track of how it changes instead of gritting your teeth."
    ],
    zones: [],
    voirAussi: ["fatigue", "agir-tot"]
  },
  "experience": {
    categorie: "Individual sub-factor", titre: "Experience", icone: "🎓", couleur: "#f09430", famille: "individuel",
    description: "Experience brings efficient movements: pacing your effort, getting into the right spot, seeing things coming. A new worker burns more energy for the same result and knows fewer of the workstation's traps.",
    exemples: [
      "The first months at a new workstation.",
      "Temp or seasonal staff.",
      "Coming back after a long absence.",
      "A change of tool or work method."
    ],
    prevention: [
      "Welcome and mentor new workers.",
      "Train people in efficient work techniques.",
      "Ramp up the pace gradually.",
      "Encourage questions and the room to make mistakes."
    ],
    zones: [],
    voirAussi: ["condition-physique"]
  },

  /* ----- Sous-facteurs environnement ----- */
  "outils": {
    categorie: "Environmental sub-factor", titre: "Tools", icone: "🛠️", couleur: "#74b62e", famille: "environnement",
    description: "A poorly suited or poorly maintained tool forces you to put in more force and get into bad positions. The right tool, sharpened and the right size, literally cuts the strain on your body in half.",
    exemples: [
      "A handle too big or too small for your hand.",
      "A heavy tool held at arm's length for long minutes.",
      "A dull blade or bit that makes you bear down.",
      "Ill-fitting gloves that make you lose your grip."
    ],
    prevention: [
      "Pick ergonomic tools suited to the task and the hand.",
      "Sharpen and maintain them regularly.",
      "Hang or counterbalance heavy tools.",
      "Try tools out before you buy them."
    ],
    zones: ["poignets-mains", "coudes", "epaules"],
    voirAussi: ["outils-vibrants", "prise-serree"]
  },
  "temperature": {
    categorie: "Environmental sub-factor", titre: "Temperature", icone: "🌡️", couleur: "#74b62e", famille: "environnement",
    description: "Cold stiffens your tissues and dulls your dexterity; heat wears you out, dehydrates you and speeds up muscle fatigue. Either way, your body spends energy regulating itself instead of recovering.",
    exemples: [
      "Cold room, refrigerated warehouse.",
      "Bakehouse, foundry, overheated kitchen.",
      "Outdoor work in the dead of summer or winter.",
      "Constant drafts at a fixed workstation."
    ],
    prevention: [
      "Match your work clothing to the temperature.",
      "Plan breaks in a heated room.",
      "Drink water regularly in the heat.",
      "Acclimatize gradually to the extremes."
    ],
    zones: ["poignets-mains"],
    voirAussi: ["froid"]
  },
  "espace-travail": {
    categorie: "Environmental sub-factor", titre: "Space", icone: "📐", couleur: "#74b62e", famille: "environnement",
    description: "A tight or cluttered space forces your body to twist, crouch or work at arm's length. How the workstation is laid out directly sets which postures are possible, and so the risk.",
    exemples: [
      "Working under a machine or in a cramped technical room.",
      "A cluttered counter that pushes the work away from your body.",
      "A space too narrow to pivot with a load.",
      "Working in a vehicle or a cab."
    ],
    prevention: [
      "Clear and organize the space before you start.",
      "Prep the job to cut down the time in an awkward position.",
      "Rethink the layout of cluttered workstations.",
      "Keep the gear you use often within reach."
    ],
    zones: ["cou", "haut-dos", "bas-dos", "genoux"],
    voirAussi: ["postures", "hauteur-travail", "passage-etroit", "travail-genoux"]
  },
  "sol-inegal": {
    categorie: "Environmental sub-factor", titre: "Unstable ground", icone: "⛰️", couleur: "#74b62e", famille: "environnement",
    description: "Ground that's unstable, slippery or cluttered makes your muscles work non-stop to keep your balance. Carrying a load over uneven ground multiplies the effort of staying steady and the risk of a wrong move.",
    exemples: [
      "A worksite with rubble, mud or trenches.",
      "A dock or ramp with drop-offs.",
      "The slippery floor of a kitchen or a shop.",
      "Steps and thresholds crossed over and over with loads."
    ],
    prevention: [
      "Maintain and clear the walkways.",
      "Wear suitable, slip-resistant footwear.",
      "Light the walkways properly.",
      "Plan the safest routes for carrying things."
    ],
    zones: ["chevilles-pieds", "genoux", "bas-dos"],
    voirAussi: ["environnement", "passage-etroit", "surface-appui"]
  },

  "compression": {
    categorie: "Biomechanical sub-factor", titre: "Compression", icone: "⬇️", couleur: "#2e8fc0", famille: "biomecanique",
    description: "When a part of your body presses long or hard against a hard surface, the tissues caught between the bone and the surface get crushed: circulation drops, nerves and bursae get irritated. A quiet strain, but one that adds up fast.",
    exemples: [
      "Resting on your knees to work on the floor.",
      "Forearms set on the edge of a workbench or a machine.",
      "A tool handle that always presses the same spot on your palm.",
      "A tool or part pressed against your thigh or shoulder to hold it steady."
    ],
    prevention: [
      "Pad the pressure points (knee pads, sleeves, mats).",
      "Round off or pad the edges of work surfaces.",
      "Pick wide handles that spread out the pressure.",
      "Change your resting position regularly."
    ],
    zones: ["genoux", "coudes", "poignets-mains"],
    voirAussi: ["travail-genoux", "prise-serree", "surface-appui"]
  },
  "antecedents": {
    categorie: "Individual sub-factor", titre: "Medical history", icone: "📋", couleur: "#f09430", famille: "individuel",
    description: "A past injury, an earlier MSD or a health condition (arthritis, diabetes, hernia…) leave the tissues weaker. The area that's already been hit takes the same strains less well and gets hurt again more easily.",
    exemples: [
      "An old sprain or fracture that didn't rehab well.",
      "Tendinitis or low-back pain you've had before.",
      "A condition that weakens nerves or joints (diabetes, arthritis).",
      "Coming back to work after a long absence for an injury."
    ],
    prevention: [
      "Tell the health service about any relevant history.",
      "Adapt the workstation or the task to the weakened area.",
      "Plan a gradual return after an injury.",
      "Watch for the first signs of a flare-up and report them."
    ],
    zones: [],
    voirAussi: ["douleur-presente", "condition-physique", "agir-tot"]
  },
  "surface-appui": {
    categorie: "Environmental sub-factor", titre: "Support surface", icone: "🔲", couleur: "#74b62e", famille: "environnement",
    description: "The quality of the surface you stand on, kneel on or lean against changes everything: hard ground tires your legs and back, a sharp edge compresses your tissues, an unstable surface keeps you working to stay balanced.",
    exemples: [
      "Standing for hours on concrete.",
      "Kneeling on rock or a metal floor.",
      "Leaning against structures with sharp edges.",
      "Working from a narrow or unstable foothold (ladder, ledge)."
    ],
    prevention: [
      "Use anti-fatigue mats at fixed standing stations.",
      "Plan for knee pads or cushions for floor-level work.",
      "Pad or round off the contact edges.",
      "Make sure your footing is stable and wide enough before you work."
    ],
    zones: ["chevilles-pieds", "genoux", "bas-dos"],
    voirAussi: ["sol-inegal", "compression", "travail-genoux"]
  },
  "outil-percussion": {
    categorie: "Risk situation · environmental family", titre: "Impact tool", icone: "🔨", couleur: "#74b62e", famille: "environnement",
    description: "Jackhammers, rotary hammers, impact wrenches: these tools combine repeated shocks, strong vibration and a tight grip to control them. Your hands, elbows and shoulders take every impact, hundreds of times a minute.",
    exemples: [
      "Breaking concrete or rock with a jackhammer.",
      "Drilling with a rotary or percussion drill.",
      "Bolting with an impact wrench all shift long.",
      "Using a chipping hammer or a pneumatic nailer non-stop."
    ],
    prevention: [
      "Pick anti-vibration tools and keep them well maintained.",
      "Let the weight of the tool do the work instead of bearing down hard.",
      "Switch between tasks and limit your daily exposure time.",
      "Wear anti-vibration gloves and keep your hands warm."
    ],
    zones: ["poignets-mains", "coudes", "epaules"],
    voirAussi: ["outils-vibrants", "prise-serree", "froid"]
  },
  "passage-etroit": {
    categorie: "Risk situation · environmental family", titre: "Narrow passage", icone: "🚧", couleur: "#74b62e", famille: "environnement",
    description: "Moving or working in a narrow passage forces your body to twist, pull in your shoulders, duck your head or carry loads off to the side. Every move becomes an awkward posture, the kind you get in drifts, technical rooms and the spaces between machines.",
    exemples: [
      "Squeezing between two pieces of equipment with gear in your hands.",
      "Moving through a low drift or a service tunnel.",
      "Passing a load over or around an obstacle.",
      "Working in a cluttered technical room."
    ],
    prevention: [
      "Clear and widen the main walkways.",
      "Plan your route before you carry a load.",
      "Split up or reposition the load so you can face the obstacle as you pass.",
      "Reorganize storage to free up the access points you use often."
    ],
    zones: ["bas-dos", "epaules", "cou"],
    voirAussi: ["espace-travail", "sol-inegal", "postures"]
  },

  /* ----- Messages clés ----- */
  "combinaison": {
    categorie: "Key message", titre: "How the factors combine", icone: "⚠️", couleur: "#d6111e",
    description: "Risk factors don't add up: they multiply. A repeated movement is bearable; the same movement repeated with force, in the cold, by someone who's tired, becomes dangerous. That's why effective prevention works on several levers at once, not just one.",
    exemples: [
      "Repetition + force: the most common pair in upper-limb MSDs.",
      "Vibration + cold + tight grip: the classic recipe for white finger.",
      "Awkward posture + long duration: the quiet strain that creeps in.",
      "Fatigue + high pace: your protective movements disappear."
    ],
    prevention: [
      "Assess the workstation as a whole, not factor by factor.",
      "Tackle the combinations you've spotted first.",
      "Combine technical, organizational and human solutions.",
      "Involve the workers: they know the real combinations on the ground."
    ],
    zones: [],
    voirAussi: ["biomecanique", "individuel", "environnement"]
  },
  "agir-tot": {
    categorie: "Worth remembering", titre: "Acting early changes everything", icone: "💡", couleur: "#d6111e",
    description: "An MSD sets in by stages: discomfort at the end of the day, then pain during work, then pain that hangs on at rest. In the early stages, it's all reversible with simple adjustments. Once it's settled in, an MSD can take months to heal, if it heals.",
    exemples: [
      "Stage 1: local discomfort or fatigue at the end of the day, gone after rest.",
      "Stage 2: pain that shows up during work and hangs on into the evening.",
      "Stage 3: constant pain, even at rest or at night.",
      "Stage 4: limited movement at work and at home."
    ],
    prevention: [
      "Take the first signals seriously (discomfort, stiffness, tingling).",
      "Talk about it early: coworker, supervisor, health and safety committee.",
      "Adjust the workstation or the pace quickly.",
      "See someone before the pain settles in."
    ],
    zones: [],
    voirAussi: ["douleur-presente", "combinaison"]
  }
};

/* Zones du corps */
const ZONES = {
  "cou": {
    img: "images/zone_cou.jpeg",
    nom: "Neck", icone: "🧣",
    tms: ["Neck pain (cervicalgia)", "Neck strain", "Cervicogenic headaches"],
    description: "Your neck holds up your head (4 to 5 kg) all day long. When you lean forward, that effort multiplies: at 45 degrees of flexion, your neck muscles are holding back the equivalent of more than 20 kg.",
    facteurs: ["posture-statique", "postures", "bras-leves", "espace-travail"],
    conseils: [
      "Set your screen or task at eye level.",
      "Loosen up your neck with short, regular movements.",
      "Don't wedge the phone between your ear and your shoulder."
    ]
  },
  "epaules": {
    img: "images/zone_epaules.jpeg",
    nom: "Shoulders", icone: "💪",
    tms: ["Rotator cuff tendinitis", "Bursitis", "Frozen shoulder (adhesive capsulitis)"],
    description: "The shoulder is the most mobile joint in your body, and the least stable. Working with your arms raised or held away from your body cuts the blood flow to the tendons and wears them out before their time.",
    facteurs: ["bras-leves", "manutention", "mouvements-repetes", "outils"],
    conseils: [
      "Work with your elbows close to your body.",
      "Lower your work surface below shoulder level.",
      "Switch up tasks that have you working with your arms up high."
    ]
  },
  "haut-dos": {
    img: "images/zone_dos.jpeg",
    nom: "Upper back", icone: "🦴",
    tms: ["Upper-back pain", "Tension between the shoulder blades"],
    description: "Your upper back takes the hit from bent-over postures and from working with your arms reaching forward. Tension between the shoulder blades is the classic sign of a poorly adjusted workstation or a prolonged static posture.",
    facteurs: ["posture-statique", "hauteur-travail", "postures"],
    conseils: [
      "Adjust the height of your work surface.",
      "Open up your shoulders and change your posture regularly.",
      "Bring the task closer so you're not working with your arms stretched out."
    ]
  },
  "bas-dos": {
    img: "images/zone_dos.jpeg",
    nom: "Lower back", icone: "🦴",
    tms: ["Low-back pain", "Herniated disc", "Sciatica"],
    description: "This is the area most affected by MSDs. The lumbar discs take on enormous pressure when you bend and twist under a load: lifting 25 kg with a rounded back can put several hundred kilos of pressure on the discs.",
    facteurs: ["manutention", "charges", "torsion", "passage-etroit", "sol-inegal"],
    conseils: [
      "Bend your knees and keep the load close to your body.",
      "Pivot with your feet instead of twisting your torso.",
      "Use the mechanical aids that are available to you."
    ]
  },
  "coudes": {
    img: "images/zone_coudes.jpeg",
    nom: "Elbows", icone: "🦾",
    tms: ["Epicondylitis (tennis elbow)", "Golfer's elbow (medial epicondylitis)"],
    description: "The tendons in your elbow connect to the forearm muscles that close your hand. Gripping, screwing and turning over and over inflames them: that's the well-known tennis elbow, common in plenty of jobs that have nothing to do with tennis.",
    facteurs: ["prise-serree", "mouvements-repetes", "outil-percussion", "outils-vibrants"],
    conseils: [
      "Cut down on grip force by using better tools.",
      "Avoid repeated wrist rotations while under strain.",
      "Take breaks before you feel that burning sensation."
    ]
  },
  "poignets-mains": {
    img: "images/zone_poignets.jpeg",
    nom: "Wrists / hands", icone: "✋",
    tms: ["Carpal tunnel syndrome", "De Quervain's tendinitis", "White finger syndrome (vibration white finger)"],
    description: "Dozens of tendons and the median nerve run through your wrist, a narrow tunnel. Repeated movements, pinch grips, vibration and cold add up there faster than anywhere else.",
    facteurs: ["prise-serree", "mouvements-repetes", "outils-vibrants", "outil-percussion", "froid"],
    conseils: [
      "Keep your wrist lined up with your forearm.",
      "Switch hands and switch up the type of grip.",
      "Report tingling and nighttime numbness early."
    ]
  },
  "genoux": {
    img: "images/zone_genoux.jpeg",
    nom: "Knees", icone: "🦵",
    tms: ["Knee bursitis", "Meniscus tear", "Patellofemoral syndrome"],
    description: "Your knee isn't meant to be used as a resting point. Kneeling work compresses the bursa in front of your kneecap, and repeated deep squats wear down the menisci.",
    facteurs: ["travail-genoux", "compression", "sol-inegal", "posture-statique"],
    conseils: [
      "Wear knee pads suited to your job.",
      "Use a mat, a low bench or a rolling shop stool.",
      "Stand up and straighten your legs often."
    ]
  },
  "chevilles-pieds": {
    nom: "Ankles / feet", icone: "🦶",
    tms: ["Achilles tendinitis", "Plantar fasciitis", "Repeated sprains"],
    description: "Standing for long stretches on a hard floor tires out the arch of your foot and your Achilles tendon. An uneven or slippery floor adds missteps and sprains to the mix.",
    facteurs: ["sol-inegal", "posture-statique"],
    conseils: [
      "Wear cushioned work boots that are right for the job.",
      "Use an anti-fatigue mat at fixed standing workstations.",
      "Keep walkways flat and clear."
    ]
  }
};

/* Simulateur */
const SIM_ITEMS = [
  { cle: "s-efforts", libelle: "Heavy exertion (pushing, pulling, forcing)", poids: 3, cat: "bio", conseil: "Cut down the effort with mechanical aids and proper tools." },
  { cle: "s-repetition", libelle: "Repeated movements at a fast pace", poids: 3, cat: "bio", conseil: "Set up task rotation and micro-breaks." },
  { cle: "s-postures", libelle: "Awkward postures (bent back, bent wrists…)", poids: 2, cat: "bio", conseil: "Set up the workstation to keep your joints in a neutral position." },
  { cle: "s-charges", libelle: "Heavy or awkward loads to grip (rods, hoses, equipment)", poids: 3, cat: "bio", conseil: "Break loads into smaller parts and use material-handling aids." },
  { cle: "s-bras", libelle: "Working with your arms above your shoulders", poids: 2, cat: "bio", conseil: "Lower the work or use a platform to work below shoulder height." },
  { cle: "s-genoux", libelle: "Working on your knees, squatting or bent over (forced positions)", poids: 2, cat: "bio", conseil: "Knee pads, a low bench, and stand up regularly to move your legs." },
  { cle: "s-fatigue", libelle: "Frequent fatigue or not enough sleep", poids: 2, cat: "ind", conseil: "Protect your sleep and take real recovery breaks." },
  { cle: "s-quarts", libelle: "Long shifts: alertness drops near the end of the shift", poids: 2, cat: "ind", conseil: "Keep the demanding tasks for the start of the shift and take real breaks." },
  { cle: "s-douleur", libelle: "Pain already present (discomfort, stiffness, tingling)", poids: 3, cat: "ind", conseil: "Report pain early and adjust the task without waiting." },
  { cle: "s-experience", libelle: "Little experience on the job", poids: 1, cat: "ind", conseil: "Provide mentoring, hands-on training and a gradual ramp-up in pace." },
  { cle: "s-condition", libelle: "Limited physical condition or return after time off", poids: 1, cat: "ind", conseil: "Ease back in gradually and adjust the workload." },
  { cle: "s-pauses", libelle: "Breaks often cut short or skipped", poids: 2, cat: "ind", conseil: "Plan breaks as required steps of the job." },
  { cle: "s-froid", libelle: "Cold, drafts or excessive heat", poids: 1, cat: "env", conseil: "Dress for it and plan breaks in a temperate area." },
  { cle: "s-vibrations", libelle: "Vibrating tools used regularly", poids: 2, cat: "env", conseil: "Choose anti-vibration tools and limit how long you're exposed." },
  { cle: "s-espace", libelle: "Cramped or cluttered work space", poids: 1, cat: "env", conseil: "Clear out and reorganize the work space." },
  { cle: "s-sol", libelle: "Uneven, slippery or cluttered floor", poids: 1, cat: "env", conseil: "Maintain the floors and wear proper footwear." },
  { cle: "s-outils", libelle: "Poorly suited or poorly maintained tools", poids: 2, cat: "env", conseil: "Choose ergonomic tools and maintain them regularly." }
];
const SIM_CATS = { bio: "Task demands (biomechanical)", ind: "The person (individual)", env: "The workstation and surroundings (environmental)" };

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
  const tp = $("#texte-prog"); if (tp) tp.textContent = n + " / " + total + " explored";
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
  if (n === 1) toast("First card explored! Keep going: " + (ORDRE_PRINCIPAL.length - 1) + " to go.", "🚀");
  else if (n === 7) toast("More than half the diagram explored!", "⭐");
  else if (n === ORDRE_PRINCIPAL.length) {
    toast("Nice! You've explored the whole diagram. Ready for the guided training?", "🏆");
    lancerConfettis();
  }
}

const btnRaz = $("#btn-raz-progression");
if (btnRaz) btnRaz.addEventListener("click", () => {
  visites = new Set();
  ecrireStockage("tms-visites", []);
  majProgression();
  toast("Progress reset.", "↺");
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
  sectionListe(corps, "Prevention tips", d.prevention, "prevention");
  if (d.zones && d.zones.length) {
    sectionPuces(corps, "Body areas affected",
      d.zones.map(z => ({ cle: z, label: (ZONES[z] ? ZONES[z].icone + " " + ZONES[z].nom : z) })),
      z => ouvrirZone(z, dernierDeclencheur));
  }
  if (d.voirAussi && d.voirAussi.length) {
    sectionPuces(corps, "See also",
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
  sectionListe(corps, "Common MSDs in this area", z.tms, "exemples");
  sectionPuces(corps, "Contributing factors",
    z.facteurs.filter(f => DETAILS[f]).map(f => ({ cle: f, label: DETAILS[f].icone + " " + DETAILS[f].titre })),
    f => ouvrirDetails(f, dernierDeclencheur));
  sectionListe(corps, "Good habits", z.conseils, "prevention");

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

if (window.ResizeObserver) new ResizeObserver(dessinerLiaisons).observe(scene);
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
Object.keys(ZONES).forEach(c => INDEX_RECHERCHE.push({ type: "zone", cle: c, titre: ZONES[c].nom, icone: ZONES[c].icone, cat: "Body area" }));

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
  test.src = "images/zones_corps_en.jpg";
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
  if (!coches.length) { txt = "Check off the factors on the left"; coul = "#999"; }
  else if (pct < 25) { txt = "Low risk: stay alert"; coul = "#6fc24a"; }
  else if (pct < 50) { txt = "Moderate risk: adjustments are needed"; coul = "#e3c54a"; }
  else if (pct < 75) { txt = "High risk: act quickly"; coul = "#f08a2e"; }
  else { txt = "Very high risk: top priority"; coul = "#e8404a"; }
  niveau.textContent = txt;
  niveau.style.color = coul;
  $("#score-valeur").style.color = coul;

  const combo = $("#sim-combo");
  if (cats.size >= 2 && coches.length) {
    combo.textContent = "⚠️ Factors present in " + cats.size + " families: the combination multiplies the risk (score increased by " + Math.round((mult - 1) * 100) + " %).";
  } else if (coches.length) {
    combo.textContent = "Factors from a single family: the risk climbs as soon as several families combine.";
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
    toast("Video finished! Keep going with the Sleep, Physical condition and Recovery cards just below.", "🎬");
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
    ["No effort","No effort at all."],
    ["Extremely easy","Barely noticeable."],
    ["Very easy","Very light effort."],
    ["Easy","Light effort."],
    ["Moderate effort","Comfortable but noticeable effort."],
    ["Medium","Sustained effort, breathing more noticeable."],
    ["A bit hard","Demanding effort."],
    ["Hard","Tough effort, heavy breathing."],
    ["Very hard","Very tough effort."],
    ["Extremely hard","Extremely difficult effort."],
    ["Maximal","Maximal effort, right at the limit of what I can do."]
  ];
  var BORG_COUL=["#2e9c4f","#43a047","#66bb6a","#9ccc65","#f9d423","#ffb300","#fb8c00","#f4661e","#ef4423","#e02d2d","#c01717"];
  var BORG_SEL=-1;
  function borgZone(v){
    if(v<=3)return["Zone you can sustain for a long time","rgba(16,185,129,.15)","#34d399"];
    if(v<=6)return["Watch the duration and plan breaks","rgba(245,158,11,.15)","#f59e0b"];
    return["High risk: ease off the effort or recover","rgba(226,58,60,.16)","#ef5a5c"];
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
    "You can keep up this pace for as long as you need.",
    "Effort barely felt: no fatigue issues.",
    "Very light effort: comfortable over time.",
    "Light effort: still easily sustainable.",
    "Moderate effort: start watching the duration and planning breaks.",
    "Sustained effort: switch up tasks and take regular micro-breaks.",
    "Demanding effort: fatigue is setting in, space out the efforts.",
    "Tough effort: ease off the load or recover before continuing.",
    "Very tough effort: avoid repeating it, the injury risk is rising.",
    "Almost maximal: don't hold this level, recover.",
    "Maximal effort: unsustainable, stop and recover right away."
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
    if(bat>=100)st.textContent="Rested muscle: full capacity.";
    else if(bat>55)st.textContent="The effort is drawing on your energy reserves.";
    else if(bat>25)st.textContent="Resources are dropping, waste products are building up.";
    else if(bat>0)st.textContent="Reserves almost empty: fatigue is setting in.";
    else st.textContent="Muscle fatigue has set in: the injury risk climbs.";
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
        ?"<strong>Adaptation.</strong> With enough rest, the tissues repair the micro-tears and come back stronger: muscle strength and tendon resistance increase."
        :"<strong>Chronic degeneration.</strong> Without enough rest, the micro-tears build up faster than they heal: inflammation persists and the tissues break down.";
    }
  }
  if(mo){mo.addEventListener("click",function(){setMicro(true);});mn.addEventListener("click",function(){setMicro(false);});setMicro(true);}

  /* ---- Sommeil : surcouche de détails ---- */
  var SLEEP={
    tissus:{t:"Tissue repair",h:"<p>It's mostly during <strong>deep sleep</strong> that your body repairs itself: blood flow to the muscles increases and the tissues you worked during your shift (muscles, tendons, joints) rebuild.</p><ul><li>The micro-injuries that build up during the day get repaired at night.</li><li>Without enough deep sleep, the repair stays incomplete: you start your shift again with tissues that are still weakened.</li><li>Night after night, this repair shortfall opens the door to MSDs.</li></ul>"},
    hormones:{t:"Recovery hormones",h:"<p>Deep sleep triggers a spike of <strong>growth hormone</strong>, the one that repairs muscles and tendons. At the same time, cortisol (the stress hormone) comes back down.</p><ul><li>Less sleep = less growth hormone = repair in slow motion.</li><li>Cortisol that stays high keeps inflammation going and slows down recovery.</li></ul>"},
    douleur:{t:"Pain management",h:"<p>Sleeping well <strong>lowers your sensitivity to pain</strong>. The other way around, after a bad night, the same discomfort feels more intense.</p><ul><li>Lack of sleep amplifies pain signals in the brain.</li><li>More pain = compensating movements = more risk of MSDs.</li><li>Sleeping well is part of treating discomfort, just like rest is.</li></ul>"},
    vigilance:{t:"Alertness",h:"<p>During sleep, the brain <strong>consolidates memory and focus</strong>. When you're rested, you stay alert: you spot hazards and keep your movements precise.</p><ul><li>Alertness protects you from wrong movements and accidents.</li><li>Focus lets you keep good work techniques for the whole shift.</li></ul>"},
    dette:{t:"Why 7 to 9 hours?",h:"<p>That's the recommended target for an adult, per 24 hours. Below that, fatigue <strong>builds up like a debt</strong>: every missed hour adds up, night after night.</p><ul><li>A single sleep-in won't pay back a week of short nights.</li><li>You pay off the debt gradually: full, regular nights of sleep over several days.</li><li>Regularity counts as much as duration: going to bed and getting up at set times helps your body recover.</li></ul>"},
    signes:{t:"When you're short on sleep",h:"<p>The signs to watch for, in yourself or a coworker:</p><ul><li><strong>Slower reaction time</strong>: you brake, dodge or catch yourself less quickly.</li><li><strong>Reduced focus and judgment</strong>: careless mistakes, bad decisions.</li><li><strong>Pain feels stronger</strong>: the same effort hurts more.</li><li><strong>Incomplete muscle recovery</strong>: stiffness and fatigue right from the start of the shift.</li><li><strong>More wrong movements and accidents</strong>: fatigue multiplies the risks.</li></ul><p style='margin-top:.8rem'>If this sounds like you, protect your next sleep and adjust your pace: that's prevention, not laziness.</p>"},
    alcool:{t:"Fatigue impairs you like alcohol",h:"<p>Staying awake <strong>17 to 19 hours straight</strong> impairs your alertness as much as a blood alcohol level of <strong>0.05</strong>: slowed reflexes, impaired judgment, possible micro-sleeps.</p><ul><li>Nobody would work with alcohol in their blood, yet extreme fatigue has the same effect.</li><li>After being awake a long time, risky tasks (driving, operating machines) call for an alertness your body no longer has.</li><li>The only real solution is sleep: coffee just masks the fatigue for a while.</li></ul>"},
    quarts:{t:"Tips before a shift",h:"<p>Your body naturally doesn't like sleeping during the day. These habits help you recover better between shifts:</p><ul><li><strong>Fixed routine</strong>: same wind-down ritual before sleep, even if it's the morning.</li><li><strong>Strategic nap</strong>: a short 20 to 30 minute nap before a night shift.</li><li><strong>Light when you wake up</strong>: get bright light to boost your alertness again.</li></ul>"},
    checklist:{t:"Sleeping well: the checklist",h:"<div class='sl-cols'><div><p class='sl-h ok'>Do</p><ul class='sl-check'><li>Aim for 7 to 9 h of sleep per 24 h, at regular times</li><li>Keep the room cool, dark and quiet (blackout curtains, earplugs, mask)</li><li>Cut off screens 30 to 60 min before sleep</li><li>Move during the day, not right before sleep</li><li>Light meal before sleep</li><li>Protect your sleep: let those around you know, turn off notifications</li></ul></div><div><p class='sl-h no'>Avoid</p><ul class='sl-check no'><li>Coffee within 6 h of your planned sleep (or at the end of your shift)</li><li>Alcohol to fall asleep: it breaks up deep sleep</li><li>Heavy meals right before sleep</li></ul></div></div>"}
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
    sta:{mode:"Static",sub:"Sustained contraction",
      img1:["images/sd_compression.jpg","Blockage and compression of blood flow: the vessel is squeezed by the contraction"],
      img2:["images/sd_tubes_statique.jpg","Test tubes: the need for blood is high but blood flow is reduced"],
      li:["The muscle stays contracted.","Blood flow is squeezed.","Fatigue sets in faster.","The risk of pain goes up."]},
    dyn:{mode:"Dynamic",sub:"Contraction / release",
      img1:["images/sd_circulation.jpg","Blood flowing in and out: circulation alternates with the contraction"],
      img2:["images/sd_tubes_dynamique.jpg","Test tubes: the need for blood and the blood flow stay balanced"],
      li:["The muscle alternates between contraction and release.","Blood circulates better.","Fatigue sets in more slowly.","The effort is easier to keep up."]}
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
    {q:"What is a musculoskeletal disorder (MSD)?",
     o:["A sudden, one-time injury, like a fracture","Damage to the muscles, tendons, nerves or joints that develops mostly through wear","A contagious disease specific to mines","A purely psychological disorder linked to stress"],
     a:1,f:"An MSD affects the muscles, tendons, nerves, ligaments or joints. It's rarely caused by a single accident: it builds up gradually when the load exceeds your capacity to recover."},
    {q:"In what order does the pain of an MSD develop if you don't act?",
     o:["Lesion, then pain, then discomfort","Pain, then discomfort, then healing","Discomfort, then pain, then lesion","It all hits at once, with no stages"],
     a:2,f:"The same damage goes from simple discomfort (acute phase) to stubborn pain, then to a lasting lesion. The longer you wait, the longer recovery takes: that's why you need to act as soon as the discomfort shows up."},
    {q:"When should you act to keep an MSD from setting in?",
     o:["As soon as the first discomfort appears","Only when the pain keeps you from working","When the lesion is confirmed by a doctor","When a coworker notices it"],
     a:0,f:"The window to act is the discomfort stage. At this stage the damage is still reversible: acting early (recovery, adjustments) keeps the micro-injuries from building up toward pain and then a lesion."},
    {q:"An MSD usually has…",
     o:["A single specific cause","Several factors that combine and multiply","Always an environmental cause","A purely genetic cause"],
     a:1,f:"Effort, posture, repetition, fatigue and environment add up. Ticking off several families of factors at once drives the risk up faster, because the factors multiply with one another."},
    {q:"Why is static muscle work (a sustained contraction) more tiring?",
     o:["Because it makes you sweat more","Because the contracted muscle squeezes its own blood vessels and gets less blood","Because it takes more focus","It's no more tiring than dynamic work"],
     a:1,f:"When the muscle stays contracted, it squeezes its own blood vessels: blood flows poorly, less oxygen and fewer nutrients get through, and fatigue sets in faster. Even 2 % of your maximum strength is enough to cut down the blood supply."},
    {q:"What is the rating of perceived exertion (Borg scale) for?",
     o:["To measure the exact weight of a load","To put a number on the effort you feel, from 0 to 10","To gauge the temperature of the workplace","To rate your sleep quality"],
     a:1,f:"The same force feels like a different effort from one person to the next. The scale (0 = no effort, 10 = maximum effort) helps you catch fatigue before it sets in."},
    {q:"How many hours of sleep per 24 h are recommended to recover well?",
     o:["3 to 4 h","5 to 6 h","7 to 9 h","10 to 12 h"],
     a:2,f:"The target is 7 to 9 h per 24 h, at regular times. You can't make up for fatigue with a single sleep-in: it builds up like a debt."},
    {q:"Staying awake 17 to 19 hours straight affects your alertness…",
     o:["Not at all, coffee makes up for it","As much as a blood alcohol level of 0,05","Only in older people","Only at night"],
     a:1,f:"Extreme fatigue degrades your reflexes and judgment as much as a blood alcohol level of 0,05. Coffee only masks the fatigue: the only real solution is sleep."},
    {q:"What's the right technique for lifting a load?",
     o:["Rounded back, straight legs, load far from your body","Bend your knees, keep your back natural and the load close to your body","Twist your torso to go faster","Lift with a quick jerk to get it over with"],
     a:1,f:"Load close to your body, back in a natural position, you bend your knees and pivot with your feet rather than twisting your torso. Asking for a mechanical aid isn't a weakness."},
    {q:"What should you do about discomfort that keeps coming back at work?",
     o:["Ignore it, it's normal","Hide it so you don't look weak","Report it early to your supervisor or the health and safety committee","Wait until it becomes chronic"],
     a:2,f:"Discomfort that keeps coming back is information to share quickly. Caught early, an MSD is easier to treat, the workstation can be adjusted, and your report also protects your coworkers."}
  ];
  var idx=0,score=0,answered=false;
  var stageEl=stage,progTxt=document.getElementById("qProgTxt"),progBar=document.getElementById("qProgBar"),
      scoreLive=document.getElementById("qScoreLive"),resultEl=document.getElementById("qResult");
  function render(){
    answered=false;
    var Q=QUESTIONS[idx];
    progTxt.textContent="Question "+(idx+1)+" / "+QUESTIONS.length;
    progBar.style.width=((idx+1)/QUESTIONS.length*100)+"%";
    scoreLive.textContent=score+(score>1?" correct answers":" correct answer");
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
    scoreLive.textContent=score+(score>1?" correct answers":" correct answer");
    var fb=document.getElementById("qFb");
    fb.className="quiz-fb "+(bon?"ok":"bad");fb.hidden=false;
    fb.innerHTML="<div class='qf-k'>"+(bon?"✓ Correct answer":"✕ Not quite")+"</div>"+Q.f+
      "<div><button type='button' class='quiz-next' id='qNext'>"+(idx<QUESTIONS.length-1?"Next question &rarr;":"See my result &rarr;")+"</button></div>";
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
    if(score>=9)msg="Excellent! You've got the habits that protect your body day to day.";
    else if(score>=7)msg="Good work. A few things to review, but you've got the essentials.";
    else if(score>=5)msg="Not bad. Go back over the key sections to lock in the good habits.";
    else msg="It's a start. Read through the sections on this page again: acting early changes everything.";
    progTxt.textContent="Quiz finished";progBar.style.width="100%";
    scoreLive.textContent=score+" / "+n;
    resultEl.hidden=false;
    resultEl.innerHTML="<div class='qr-score "+(win?"win":"")+"'>"+score+" / "+n+"</div>"+
      "<div class='qr-sub'>"+pct+" % correct answers</div>"+
      "<p class='qr-msg'>"+msg+"</p>"+
      "<div style='display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap'>"+
      "<button type='button' class='quiz-next' id='qRestart'>↺ Restart the quiz</button>"+
      "<a class='btn ghost' href='#comprendre'>Review the concepts &uarr;</a></div>";
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
  function show(){ if(off()||!deferred) return; place(); box.classList.add("visible"); clearTimeout(hideT); hideT=setTimeout(hide,15000); }
  function hide(){ box.classList.remove("visible"); clearTimeout(hideT); }
  function maybeShow(){ if(shown||off()||!deferred||!heroOut) return; shown=true; show(); } /* jamais sur l'accueil (hero) : on attend d'avoir defile au-dela, puis une seule fois */
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; maybeShow(); });
  go.addEventListener("click", function () { if(!deferred){ hide(); return; } deferred.prompt(); deferred.userChoice.then(function () { deferred = null; hide(); }); });
  x.addEventListener("click", function () { hide(); try { localStorage.setItem("tms_pwa","off"); } catch(e){} });
  window.addEventListener("appinstalled", function () { hide(); try { localStorage.setItem("tms_pwa","off"); } catch(e){} });
  var hero=document.querySelector(".hero");                          /* le bandeau ne s'affiche que hors de la vue d'accueil */
  if(hero&&"IntersectionObserver" in window){ new IntersectionObserver(function(es){ heroOut=!es[0].isIntersecting; if(heroOut)maybeShow(); else hide(); },{threshold:0}).observe(hero); }
  else { heroOut=true; }
})();
