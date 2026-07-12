import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyD2OAnajHgwL1o8hSkyeYEgtsghb4c-LuQ',
  authDomain: 'hobo-experience.firebaseapp.com',
  projectId: 'hobo-experience',
  storageBucket: 'hobo-experience.firebasestorage.app',
  messagingSenderId: '889986791706',
  appId: '1:889986791706:web:31de08321ba62eb816d4a3',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const updates = [
  { id: 'EMP003', name: 'Jeet Singh', newRole: 'Attendent' },
  { id: 'EMP004', name: 'Gaurav Kumar', newRole: 'Attendent' },
];

for (const u of updates) {
  const ref = doc(db, 'users', u.id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    console.log(`❌ ${u.id} (${u.name}) — document not found`);
    continue;
  }
  const before = snap.data().Jobrole;
  await updateDoc(ref, { Jobrole: u.newRole });
  console.log(`✅ ${u.id} (${u.name}) — Jobrole: "${before}" → "${u.newRole}"`);
}

console.log('\nDone.');
process.exit(0);
