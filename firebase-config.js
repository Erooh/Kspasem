// Firebase-ը օգտագործվում է միայն առցանց հնարավորությունների համար
// (Պրեմիում, զույգի համաժամեցում, գովազդ, ադմինի հաղորդագրություն)։
// SDK-ն բեռնվում է միայն այն ժամանակ, երբ ինտերնետ կա։ Առանց ինտերնետի db-ն
// մնում է null, և հավելվածի մնացած ամբողջ աշխատանքը (հաշվիչ, նվաճումներ,
// ծանուցումներ, հիշողություններ) շարունակվում է օֆլայն։
var db = null;
var firebaseConfig = {
  apiKey: "AIzaSyClxSMI4lLtIqzz16T0AeWupdbozWgclm4",
  authDomain: "kspasem-d9ac4.firebaseapp.com",
  projectId: "kspasem-d9ac4",
  storageBucket: "kspasem-d9ac4.firebasestorage.app",
  messagingSenderId: "155526170729",
  appId: "1:155526170729:web:b7ccc32320da0a6213baf8"
};

window.__kspDbReady = (function(){
  var BASE = 'https://www.gstatic.com/firebasejs/10.13.2/';
  function load(file){
    return new Promise(function(resolve, reject){
      var s = document.createElement('script');
      var t = setTimeout(function(){ reject(new Error('timeout')); }, 3000);
      s.src = BASE + file;
      s.onload = function(){ clearTimeout(t); resolve(); };
      s.onerror = function(){ clearTimeout(t); reject(new Error('offline')); };
      document.head.appendChild(s);
    });
  }
  if(navigator.onLine === false) return Promise.resolve(null);
  return load('firebase-app-compat.js')
    .then(function(){ return load('firebase-firestore-compat.js'); })
    .then(function(){
      if(!firebase.apps || !firebase.apps.length){ firebase.initializeApp(firebaseConfig); }
      db = firebase.firestore();
      return db;
    })
    .catch(function(){ db = null; return null; });
})();
