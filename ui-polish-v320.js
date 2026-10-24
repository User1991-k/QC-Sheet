/* QC Survey v304 — global field help, numbered sections, table options, and Settings shortcuts. */
(function(){
  'use strict';
  var D=document,timer=0,openPanel=null;
  function ar(){return D.documentElement.dir==='rtl'}
  function T(en,aa){return ar()?aa:en}

  function wrapHelp(button){
    if(!button||button.dataset.qcInlineHelp)return;
    var host=button.closest('.qca-help-host');
    var field=host&&host.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea');
    if(!host||!field)return;
    if(field.matches('input[type=file],input[type=color]')){
      var outer=D.createElement('span');
      outer.className='qca-field-inline '+(field.type==='file'?'qca-file-help-line':'qca-compact-help-line');
      host.parentNode.insertBefore(outer,host);outer.appendChild(host);outer.appendChild(button);
      button.dataset.qcInlineHelp='1';return;
    }
    var target=field.closest('.qc-unit-shell')||field;
    if(target.closest('.qca-field-inline')){
      target.closest('.qca-field-inline').appendChild(button);button.dataset.qcInlineHelp='1';return;
    }
    var line=D.createElement('span');line.className='qca-field-inline';
    target.parentNode.insertBefore(line,target);line.appendChild(target);line.appendChild(button);
    button.dataset.qcInlineHelp='1';
  }

  function closeMenus(except){
    D.querySelectorAll('.qc-table-menu-panel').forEach(function(p){
      if(p!==except){p.hidden=true;var h=p.closest('.qc-table-menu-host'),b=h&&h.querySelector('.qc-table-menu-trigger');if(b)b.setAttribute('aria-expanded','false')}
    });
    if(!except)openPanel=null;
  }
  function place(panel,trigger){
    var r=trigger.getBoundingClientRect(),w=Math.min(360,innerWidth-20);
    panel.style.width=w+'px';
    var left=Math.max(10,Math.min(innerWidth-w-10,r.right-w)),top=r.bottom+6;
    panel.hidden=false;
    var h=panel.offsetHeight;
    if(top+h>innerHeight-10)top=Math.max(10,r.top-h-6);
    panel.style.left=left+'px';panel.style.top=top+'px';
  }
  function headingFor(table){
    var n=table.parentElement;
    var sel=':scope > .card-hd,:scope > .dpr-section-head,:scope > .gpr-card-head,:scope > .dfp-head,:scope > .df-report-head,:scope > .qc-fold-head,:scope > header,:scope > h2,:scope > h3';
    for(var i=0;n&&n!==D.body&&i<9;i++,n=n.parentElement){
      var h=n.querySelector(sel);if(h)return h;
      if(n.matches('.sp-panel')){h=n.querySelector('.sp-head h2');if(h)return h}
    }
    return null;
  }
  function setupMenu(head){
    var setup=head.closest('[data-setup]');
    if(!setup)return null;
    return setup.querySelector(':scope > .card-hd .ts-setup-head-actions > .qc-table-menu-host');
  }
  function organizeBar(bar){
    if(!bar||bar.dataset.qcMenuReady)return;
    var parent=bar.parentElement;
    var table=bar.nextElementSibling&&bar.nextElementSibling.matches('table')?bar.nextElementSibling:
      parent.querySelector('table')||parent.closest('.df-data-wrap,.spa-table,.dpr-table-wrap,.table-wrap,.table-container');
    if(!table)return;
    var head=headingFor(table);if(!head)return;head.classList.add('qc-title-with-options');
    bar.dataset.qcMenuReady='1';bar.classList.add('qc-table-tools-contained');
    var existing=setupMenu(head)||head.querySelector(':scope > .qc-table-menu-host');
    if(existing){
      var existingPanel=existing.querySelector('.qc-table-menu-panel');
      if(existingPanel){bar.setAttribute('aria-label',T('Additional table options','خيارات جدول إضافية'));existingPanel.appendChild(bar);return}
    }
    var host=D.createElement('span');host.className='qc-table-menu-host';host.setAttribute('data-qc-i18n-skip','');
    var trigger=D.createElement('button');trigger.type='button';trigger.className='qc-table-menu-trigger';trigger.setAttribute('aria-expanded','false');
    trigger.setAttribute('aria-label',T('Table options','خيارات الجدول'));trigger.innerHTML='<span aria-hidden="true">⚙</span> '+T('Options','خيارات')+' <i aria-hidden="true">▾</i>';
    var panel=D.createElement('section');panel.className='qc-table-menu-panel';panel.hidden=true;panel.setAttribute('data-qc-i18n-skip','');
    panel.innerHTML='<header><b>'+T('Table options','خيارات الجدول')+'</b><button type="button" aria-label="'+T('Close','إغلاق')+'">×</button></header>';
    panel.appendChild(bar);host.appendChild(trigger);host.appendChild(panel);
    var setup=head.closest('[data-setup]'),actions=setup&&setup.querySelector(':scope > .card-hd .ts-setup-head-actions');
    if(actions){
      host.classList.add('qc-setup-options');
      var remove=actions.querySelector('.remove-setup');actions.insertBefore(host,remove||null);
    }else{
      var collapse=head.querySelector(':scope > .qc-collapse-btn');if(collapse)head.insertBefore(host,collapse);else head.appendChild(host);
    }
    trigger.onclick=function(e){
      e.preventDefault();e.stopPropagation();var opening=panel.hidden;closeMenus(opening?panel:null);
      if(opening){place(panel,trigger);trigger.setAttribute('aria-expanded','true');openPanel=panel}
      else{panel.hidden=true;trigger.setAttribute('aria-expanded','false');openPanel=null}
    };
    panel.querySelector('header button').onclick=function(e){e.stopPropagation();closeMenus()};
    panel.onclick=function(e){e.stopPropagation()};
  }
  function organizeWorkspaceBar(bar){
    if(!bar||bar.dataset.qcMenuReady)return;
    var table=bar.nextElementSibling&&bar.nextElementSibling.matches('table')?bar.nextElementSibling:null;
    if(!table)return;
    var head=headingFor(table);if(!head)return;
    var host=setupMenu(head)||head.querySelector(':scope > .qc-table-menu-host');
    if(!host)return;
    var panel=host.querySelector('.qc-table-menu-panel');if(!panel)return;
    bar.dataset.qcMenuReady='1';bar.classList.add('qwu-table-tools-contained');
    var tableNo=panel.querySelectorAll('.qwu-table-tools').length+1;
    bar.dataset.qcTableLabel=T('Table editing '+tableNo,'تعديل الجدول '+tableNo);
    bar.setAttribute('aria-label',T('Columns, fill, paste, navigation and history','الأعمدة والتعبئة واللصق والتنقل والسجل'));
    panel.appendChild(bar);
  }

  function refreshWorkspaceLabels(){
    D.querySelectorAll('.qc-table-menu-host').forEach(function(host){var trigger=host.querySelector('.qc-table-menu-trigger'),title=host.querySelector('.qc-table-menu-panel>header b');if(trigger){trigger.setAttribute('aria-label',T('Table options','خيارات الجدول'));trigger.innerHTML='<span aria-hidden="true">⚙</span> '+T('Options','خيارات')+' <i aria-hidden="true">▾</i>'}if(title)title.textContent=T('Table options','خيارات الجدول')});
    D.querySelectorAll('.qc-table-menu-panel').forEach(function(panel){
      panel.querySelectorAll('.qwu-table-tools').forEach(function(bar,index){
        bar.dataset.qcTableLabel=T('Table editing '+(index+1),'تعديل الجدول '+(index+1));
        var labels={columns:T('Columns','الأعمدة'),fill:T('Fill down','تعبئة للأسفل'),paste:T('Paste Excel','لصق Excel'),history:T('History','السجل')};
        Object.keys(labels).forEach(function(key){var b=bar.querySelector('[data-a="'+key+'"]');if(b)b.textContent=labels[key]});
      });
    });
  }

  function ensureTopSmartTools(){
    var theme=D.getElementById('btn-theme-toggle'),settings=D.getElementById('btn-settings-hub');
    if(!theme||!settings||theme.parentElement!==settings.parentElement)return;
    var parent=theme.parentElement,dictate=D.getElementById('qc-top-dictate'),undo=D.getElementById('qc-top-undo');
    if(!dictate){dictate=D.createElement('button');dictate.type='button';dictate.id='qc-top-dictate';dictate.className='tool-btn qc-top-action qc-top-smart';parent.insertBefore(dictate,theme)}
    if(!undo){undo=D.createElement('button');undo.type='button';undo.id='qc-top-undo';undo.className='tool-btn qc-top-action qc-top-smart qc-top-undo';parent.insertBefore(undo,theme)}
    dictate.setAttribute('aria-label',T('Dictate','إملاء'));dictate.title=T('Dictate into the current page','الإملاء في الصفحة الحالية');dictate.innerHTML='<span class="tool-icon" aria-hidden="true">🎙</span><span class="tool-label">'+T('Dictate','إملاء')+'</span>';
    undo.setAttribute('aria-label',T('Undo latest OCR or dictation application','تراجع عن آخر تطبيق OCR أو إملاء'));undo.title=T('Undo latest smart application','تراجع عن آخر تطبيق ذكي');undo.innerHTML='<span class="tool-icon" aria-hidden="true">↶</span><span class="tool-label">'+T('Undo','تراجع')+'</span>';
    dictate.onclick=function(){var b=D.querySelector('#sep-global-tools [data-sep-voice]');if(b)b.click()};
    undo.onclick=function(){var b=D.querySelector('#sep-global-tools [data-sep-undo]');if(b)b.click()};
  }

  function numberSections(){
    D.querySelectorAll('#view-dpr .dpr-section-head>h2').forEach(function(h,index){
      if(h.querySelector(':scope > .qc-section-number'))return;
      var text=h.textContent.trim(),m=text.match(/^(\d{1,2})\s*[·.\-:]?\s*(.*)$/);
      var num=m?m[1]:String(index+1).padStart(2,'0'),title=m?m[2]:text;if(!title)return;
      h.textContent='';var n=D.createElement('span');n.className='qc-section-number';n.textContent=num;
      h.appendChild(n);h.appendChild(D.createTextNode(title));h.dataset.qcNumbered='1';
    });
  }

  function duplicateButton(b){
    if(!b||b.closest('#settings-hub-modal,[data-qc-no-duplicate-move]'))return false;
    if(b.matches('[data-tspi-copy],#gn-base-dup,#btn-duplicate-project-info,.duplicate-setup,[data-duplicate],[data-action="duplicate"],[data-pro-action="duplicate"],[data-mm-cp-duplicate],[data-act="dup"]'))return true;
    var text=(b.textContent+' '+(b.title||'')+' '+(b.getAttribute('aria-label')||'')).replace(/\s+/g,' ').trim();
    return /\bduplicate\b|تكرار/.test(text.toLowerCase());
  }
  function markDuplicateButtons(){
    D.querySelectorAll('button:not(.qc-duplicate-original)').forEach(function(b){if(duplicateButton(b)){b.classList.add('qc-duplicate-original');b.setAttribute('data-qc-moved-to-settings','1')}});
  }
  function currentPage(){return D.querySelector('.page:not(.hidden)')||D.querySelector('main.page')}
  function duplicateLabel(b,index){
    var text=(b.textContent||b.title||b.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim();
    text=text.replace(/^[⧉⊕＋+\s]+/,'');if(!text)text=T('Duplicate item ','تكرار العنصر ')+(index+1);
    return text;
  }
  function closeSettings(){var m=D.getElementById('settings-hub-modal');if(m)m.classList.add('hidden')}
  function runHidden(button){closeSettings();setTimeout(function(){if(button&&button.isConnected)button.click()},100)}
  function injectGlobalSettings(){
    var body=D.getElementById('settings-hub-body');if(!body)return;
    markDuplicateButtons();
    var card=body.querySelector('.qc-global-interface-settings');
    if(!card){
      card=D.createElement('section');card.className='qc-global-interface-settings card';card.setAttribute('data-qc-i18n-skip','');
      body.insertBefore(card,body.firstChild);
    }
    card.innerHTML='<h3>⚙ '+T('Global interface tools','أدوات الواجهة العامة')+'</h3>'+ 
      '<p>'+T('Smart tools and duplication are kept here to leave every report page clean.','تم وضع الأدوات الذكية والتكرار هنا حتى تبقى واجهة كل الصفحات مرتبة.')+'</p>'+ 
      '<div class="qc-settings-tool-grid">'+
      '<button type="button" data-qc-settings-action="qc">✦ <span>'+T('Smart QC','QC الذكي')+'</span></button>'+ 
      '<button type="button" data-qc-settings-action="ocr">▣ <span>'+T('Smart OCR','OCR الذكي')+'</span></button></div>'+ 
      '<div class="qc-settings-duplicate"><b>'+T('Duplicate on current page','التكرار في الصفحة الحالية')+'</b><div data-qc-duplicate-list></div></div>';
    var qc=card.querySelector('[data-qc-settings-action="qc"]'),ocr=card.querySelector('[data-qc-settings-action="ocr"]');
    qc.onclick=function(){runHidden(D.querySelector('#sep-global-tools [data-sqp]'))};
    ocr.onclick=function(){runHidden(D.querySelector('#sep-global-tools [data-sep-ocr]'))};
    qc.disabled=!D.querySelector('#sep-global-tools [data-sqp]');ocr.disabled=!D.querySelector('#sep-global-tools [data-sep-ocr]');
    var page=currentPage(),list=card.querySelector('[data-qc-duplicate-list]');
    var originals=page?[].slice.call(page.querySelectorAll('.qc-duplicate-original')):[];
    if(!originals.length){list.innerHTML='<small>'+T('No duplication action is available on this page.','لا يوجد إجراء تكرار في هذه الصفحة.')+'</small>'}
    else originals.forEach(function(original,index){
      var b=D.createElement('button');b.type='button';b.className='qc-settings-duplicate-btn';b.textContent='⧉ '+duplicateLabel(original,index);b.onclick=function(){runHidden(original)};list.appendChild(b);
    });
  }

  function scan(){
    D.querySelectorAll('.qc-table-menu-host').forEach(function(h){if(!h.querySelector('.qc-table-probar,.qwu-table-tools'))h.remove()});
    numberSections();markDuplicateButtons();ensureTopSmartTools();
    D.querySelectorAll('.qca-field-help:not([data-qc-inline-help])').forEach(wrapHelp);
    D.querySelectorAll('.qc-table-probar:not([data-qc-menu-ready])').forEach(organizeBar);
    D.querySelectorAll('.qwu-table-tools:not([data-qc-menu-ready])').forEach(organizeWorkspaceBar);
    refreshWorkspaceLabels();
  }
  function schedule(){if(timer)return;timer=setTimeout(function(){timer=0;scan()},40)}

  D.addEventListener('pointerdown',function(e){if(openPanel&&!e.target.closest('.qc-table-menu-host'))closeMenus()});
  D.addEventListener('keydown',function(e){if(e.key==='Escape')closeMenus()});
  function languageRefresh(){[100,450,1200,2200].forEach(function(ms){setTimeout(scan,ms)});[500,1800].forEach(function(ms){setTimeout(injectGlobalSettings,ms)});[700,1700].forEach(function(ms){setTimeout(function(){if(window.__qcWorkspaceUI&&__qcWorkspaceUI.scan)__qcWorkspaceUI.scan();setTimeout(scan,160)},ms)})}
  D.addEventListener('qc:language',languageRefresh);window.addEventListener('qc:language',languageRefresh);
  D.addEventListener('click',function(e){schedule();if(e.target.closest&&e.target.closest('#btn-settings-hub')){setTimeout(injectGlobalSettings,80);setTimeout(injectGlobalSettings,350)}},true);
  window.addEventListener('resize',function(){closeMenus()});
  window.addEventListener('scroll',function(){if(openPanel)closeMenus()},true);
  new MutationObserver(function(records){
    var hasNewField=records.some(function(r){return Array.prototype.some.call(r.addedNodes,function(n){return n.nodeType===1&&(n.matches&&n.matches('input,select,textarea')||n.querySelector&&n.querySelector('input,select,textarea'))})});
    if(hasNewField&&window.QCFieldCoach&&QCFieldCoach.scan)setTimeout(QCFieldCoach.scan,0);schedule();
  }).observe(D.documentElement,{childList:true,subtree:true});
  if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',scan);else scan();
  window.QCUIPolish={scan:scan,closeMenus:closeMenus,settings:injectGlobalSettings,version:'304.0'};
})();
