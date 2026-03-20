import functions from "firebase-functions";
import admin from "firebase-admin";

admin.initializeApp();

export const helloWorld = functions.https.onRequest((req, res) => {
  res.json({ message: "Firebase backend working 🚀" });
});