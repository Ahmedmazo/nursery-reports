// عدّل البيانات دي بس (هتلاقيها في إعدادات مشروعك على Firebase)
const firebaseConfig = {
  apiKey: "ضع-هنا-apiKey",
  authDomain: "ضع-هنا-authDomain",
  projectId: "ضع-هنا-projectId",
  storageBucket: "ضع-هنا-storageBucket",
  messagingSenderId: "ضع-هنا-messagingSenderId",
  appId: "ضع-هنا-appId"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
