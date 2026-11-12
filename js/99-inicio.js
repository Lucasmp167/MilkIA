/* instalação dos ganchos e partida */
if(typeof window!="undefined"&&window.addEventListener){window.addEventListener("pagehide",flushAll);window.addEventListener("beforeunload",e=>{if(SV.pend||DRP||SV.ok===false){e.preventDefault();e.returnValue=""}});if(document.addEventListener){document.addEventListener("visibilitychange",()=>{if(document.visibilityState=="hidden")flushAll()});document.addEventListener("input",drSoon);document.addEventListener("change",drSoon)}}
initData();drRestore();uiRestore();

render();
