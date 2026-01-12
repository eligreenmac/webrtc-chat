# 🚀 Deploy לGlitch - מדריך שלב אחר שלב

## מה זה Glitch?
- 🆓 **חינם לחלוטין**
- ⚡ Deploy מיידי
- 🔒 HTTPS אוטומטי
- 🌐 URL ציבורי
- 💻 עורך קוד מובנה

---

## 📋 שלב 1: הרשמה ל-Glitch

1. **גש ל:** https://glitch.com
2. **לחץ על:** "Sign up" 
3. **בחר אחד:**
   - Sign in with GitHub (מומלץ)
   - Sign in with Facebook
   - Sign in with Email

---

## 🆕 שלב 2: יצירת פרויקט חדש

1. **לחץ על:** "New Project" (בפינה הימנית העליונה)
2. **בחר:** "glitch-hello-node" (פרויקט Node.js בסיסי)
3. **המתן** עד שהפרויקט נוצר (~5 שניות)

---

## 🗂️ שלב 3: העלאת הקבצים שלך

### אופציה א: גרור ושחרר (Drag & Drop)

1. **פתח את התיקייה:** `c:\Bubble\webrtc_chat\server\`
2. **בפרויקט Glitch:**
   - **מחק** את הקבצים הישנים (server.js, package.json)
   - **גרור** את הקבצים שלך מהתיקייה:
     - `server.js` ✅
     - `package.json` ✅

3. **צור תיקייה חדשה:**
   - לחץ על "New File"
   - הקלד: `public/index.html`
   - העתק את התוכן מ-`c:\Bubble\webrtc_chat\client\index.html`

### אופציה ב: העתקה ידנית

1. **server.js:**
   - לחץ על הקובץ בGlitch
   - מחק את התוכן
   - פתח `c:\Bubble\webrtc_chat\server\server.js` במחשב
   - העתק הכל (Ctrl+A, Ctrl+C)
   - הדבק בGlitch (Ctrl+V)

2. **package.json:**
   - אותו תהליך עם `package.json`

3. **index.html:**
   - צור קובץ חדש בשם `public/index.html`
   - העתק תוכן מ-`client/index.html`

---

## ⚙️ שלב 4: התאמות לGlitch

### עדכן את `server.js`:

מצא את השורה:
```javascript
app.use(express.static(path.join(__dirname, '../client')));
```

**שנה ל:**
```javascript
app.use(express.static('public'));
```

---

## 🔧 שלב 5: בדיקה

1. **Glitch יבנה אוטומטית** את הפרויקט
2. **חפש למעלה:** כפתור "Preview" או "Show"
3. **לחץ על:** "Preview in a new window"
4. **בדוק שהדף עובד!**

---

## 🌐 שלב 6: קבלת ה-URL הציבורי

1. **לחץ על:** "Share" (למעלה)
2. **העתק את ה-URL:**
   ```
   https://your-project-name.glitch.me
   ```

3. **שתף!** כל מי שיש לו URL יכול להצטרף!

---

## 📱 שלב 7: בדיקה ב-iPhone

1. **פתח Safari ב-iPhone**
2. **גש ל-URL:**
   ```
   https://your-project-name.glitch.me
   ```

3. **הזן שם משתמש והצטרף!** 🎉

---

## 🎨 שלב 8 (אופציונלי): שינוי שם הפרויקט

1. **לחץ על שם הפרויקט** למעלה משמאל
2. **הקלד שם חדש** (למשל: `my-webrtc-chat`)
3. **ה-URL ישתנה ל:**
   ```
   https://my-webrtc-chat.glitch.me
   ```

---

## ✅ בדיקת תקינות

### הפרויקט עובד אם:
- ✅ אתה רואה את מסך ההצטרפות
- ✅ אפשר להזין שם משתמש
- ✅ הסטטוס משתנה ל"מחובר" (נקודה ירוקה)
- ✅ אפשר לשלוח הודעות

### אם משהו לא עובד:
1. **לחץ על:** "Logs" (למטה)
2. **חפש שגיאות** בקונסול
3. **בדוק ש:**
   - `package.json` תקין
   - `server.js` תקין
   - `public/index.html` קיים

---

## 🐛 פתרון בעיות נפוצות

### "Cannot find module..."
**פתרון:** 
1. לחץ על "Terminal" (למטה)
2. הרץ: `npm install`
3. המתן עד שזה נגמר

### "Port already in use"
**פתרון:** לא רלוונטי ב-Glitch - זה מטופל אוטומטית

### "Server crashed"
**פתרון:**
1. בדוק Logs
2. תקן שגיאות במקור
3. Glitch יעשה restart אוטומטי

### הדף לא נטען
**פתרון:**
1. בדוק ש-`public/index.html` קיים
2. בדוק את הנתיב ב-`server.js`
3. נסה Refresh

---

## 💡 טיפים

### שמירה אוטומטית
✅ Glitch שומר אוטומטית - אין צורך ב-Ctrl+S

### עריכה בזמן אמת
✅ שינויים נכנסים לתוקף מיד (hot reload)

### שיתוף עם אחרים
✅ "Share" → "Invite" - אפשר להוסיף collaborators

### גישה לקוד
✅ "Tools" → "Git, Import, and Export" - אפשר לייצא ל-GitHub

### מגבלות החינם
- ⏰ הפרויקט ישן אחרי 5 דקות ללא פעילות
- 🔄 מתעורר אוטומטית כשמישהו נכנס
- 💾 אחסון מוגבל (200MB)

---

## 🎉 זהו! הפרויקט שלך ב-Live!

**אתה יכול:**
- 📱 לשתף ב-WhatsApp/SMS
- 🌍 לשלוח לחברים
- 💼 להשתמש בפגישות
- 🎮 לשחק איתו

**ה-URL שלך:**
```
https://your-project-name.glitch.me
```

---

## 📚 משאבים נוספים

- [Glitch Help](https://help.glitch.com/)
- [Glitch Community](https://glitch.com/@glitch)
- [WebRTC Docs](https://webrtc.org/)

---

**צריך עזרה?** פשוט תגיד! 😊
