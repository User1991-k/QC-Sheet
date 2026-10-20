/* QC Survey v285 — native calendar and clock controls, stable local values, no helper rows. */
(function(){'use strict';var timer=0;
function ar(){try{return window.QCI18N&&QCI18N.getLanguage()==='ar'}catch(e){return document.documentElement.dir==='rtl'}}
function T(en,aa){return ar()?aa:en}
function localDate(){var d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+day}
function localTime(){var d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
function openPicker(el){try{if(typeof el.showPicker==='function'){el.showPicker();return}}catch(e){}try{el.focus();el.click()}catch(e){}}
function enhance(el){if(!el)return;var type=el.type;if(type!=='date'&&type!=='time')return;el.dataset.qdtEnhanced='1';el.classList.add('qdt-enhanced');if(type==='time'){el.step='60';el.title=T('Choose time from the native clock or type HH:MM','اختر الوقت من الساعة أو اكتب HH:MM')}else el.title=T('Choose a date from the native calendar','اختر التاريخ من التقويم');if(!el.dataset.qdtPickerWired){el.dataset.qdtPickerWired='1';el.addEventListener('click',function(){openPicker(el)})}}
function scan(){document.querySelectorAll('.qdt-tools').forEach(function(x){x.remove()});document.querySelectorAll('input[type="date"],input[type="time"]').forEach(enhance)}
function relabel(){document.querySelectorAll('input.qdt-enhanced').forEach(function(el){el.title=el.type==='date'?T('Choose a date from the native calendar','اختر التاريخ من التقويم'):T('Choose time from the native clock or type HH:MM','اختر الوقت من الساعة أو اكتب HH:MM')})}
function boot(){scan();if(window.MutationObserver)new MutationObserver(function(){clearTimeout(timer);timer=setTimeout(scan,80)}).observe(document.body,{childList:true,subtree:true});window.addEventListener('qc:language',relabel);window.__qcSmartDateTime={scan:scan,today:localDate,now:localTime,open:openPicker}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
