# منصة إدارة الفيديوهات

تطبيق React + Vite عربي باتجاه RTL لإدارة وعرض الفيديوهات باستخدام Supabase للمصادقة وقاعدة البيانات والتخزين.

## التشغيل المحلي

1. ثبت الحزم:

```powershell
npm install
```

2. أنشئ ملف البيئة:

```powershell
Copy-Item .env.example .env.local
```

3. ضع قيم Supabase داخل `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

4. شغل التطبيق:

```powershell
npm run dev
```

افتح `http://localhost:3000`.

## إعداد Supabase

1. أنشئ مشروعًا جديدًا في Supabase.
2. افتح SQL Editor وشغل الملف `database/schema.sql` كاملًا.
3. من Project Settings ثم API انسخ:
   - Project URL إلى `VITE_SUPABASE_URL`
   - anon public key إلى `VITE_SUPABASE_ANON_KEY`
4. من Authentication تأكد أن Email/Password مفعّل.
5. سجّل حسابك من صفحة التسجيل داخل التطبيق.

الملف `database/schema.sql` ينشئ الجداول المطلوبة `users`, `videos`, `comments`, `likes`، ويضيف buckets للتخزين باسم `videos` و `thumbnails`، ويضبط قواعد RLS وسياسات التخزين. جدول `videos` يحتوي الحقل `video_type` بقيمتي `long` و `short`، والقيمة الافتراضية هي `long`.

إذا كان لديك مشروع Supabase قائم قبل إضافة نوع الفيديو، شغّل migration:

```sql
-- database/migrations/20260516_add_video_type.sql
```

هذا التعديل يضيف `video_type` ويجعل الفيديوهات القديمة `long` تلقائيًا.

## جعل حسابك مديرًا

بعد تسجيل حسابك، شغل هذا الأمر في Supabase SQL Editor مع تغيير البريد:

```sql
update public.users
set role = 'admin'
where email = 'your-email@example.com';
```

بعدها سجّل الخروج ثم ادخل مرة أخرى حتى تظهر لوحة التحكم.

## النشر على Vercel

1. ارفع المشروع إلى GitHub أو GitLab.
2. أنشئ Project جديدًا في Vercel واختر المستودع.
3. أضف متغيرات البيئة نفسها:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. اترك Build Command كالتالي:

```powershell
npm run build
```

5. اجعل Output Directory هو `dist` إذا لم يضبطه Vercel تلقائيًا.
6. انشر المشروع. ملف `vercel.json` يعالج إعادة توجيه مسارات React إلى `index.html`. لا تستخدم Service Role Key في Vercel أو في الواجهة الأمامية.

## الملفات الرئيسية

- `src/App.tsx`: تعريف المسارات العامة للتطبيق.
- `src/pages/HomePage.tsx`: الصفحة الرئيسية وأحدث الفيديوهات.
- `src/pages/RegisterPage.tsx`: تسجيل حساب جديد.
- `src/pages/LoginPage.tsx`: تسجيل الدخول.
- `src/pages/VideoDetailsPage.tsx`: تشغيل الفيديو والإعجابات والتعليقات.
- `src/pages/AdminPage.tsx`: لوحة تحكم المدير للرفع والتعديل والحذف.
- `src/pages/AccountPage.tsx`: صفحة حساب المستخدم.
- `src/pages/LegalPage.tsx`: سياسة الخصوصية وشروط الاستخدام.
- `src/components/*`: مكونات المصادقة، الترويسة، بطاقات الفيديو ورسائل الحالة.
- `src/lib/*`: عميل Supabase والأنواع والمساعدات.
- `database/schema.sql`: الجداول، الفهارس، RLS، وسياسات التخزين.
