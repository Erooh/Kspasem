// Firebase (same project as the admin panel). The app still works offline:
// if the SDK can't load, db stays null and every online feature is skipped.
var db = null;
var messaging = null;
var FCM_VAPID_KEY = '';
var firebaseConfig = {
  apiKey: "AIzaSyClxSMI4lLtIqzz16T0AeWupdbozWgclm4",
  authDomain: "kspasem-d9ac4.firebaseapp.com",
  projectId: "kspasem-d9ac4",
  storageBucket: "kspasem-d9ac4.firebasestorage.app",
  messagingSenderId: "155526170729",
  appId: "1:155526170729:web:b7ccc32320da0a6213baf8"
};

try{
  if(typeof firebase !== 'undefined' && firebase.firestore){
    if(!firebase.apps || !firebase.apps.length){ firebase.initializeApp(firebaseConfig); }
    db = firebase.firestore();
  }
}catch(err){ db = null; }

function registerPushNotifications(){ return; }
