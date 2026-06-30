# Vercel 部署指南
## 前置准备
1. 一个 [GitHub](https://github.com) 账号
2. 一个 [Vercel](https://vercel.com) 账号（用 GitHub 登录）
3. Supabase 项目已创建（已有的就不需要动）
---
## 第一步：推送代码到 GitHub
```bash
# 在项目目录下执行
git init
git add .
git commit -m "初始化 FitCoach AI"
# 在 GitHub 上创建仓库后，关联并推送
git remote add origin https://github.com/Wang-jeff2797/fitness-ai-coach.git
git push -u origin main
```
---
## 第二步：在 Vercel 导入项目
1. 打开 [vercel.com](https://vercel.com) → **Add New → Project**
2. 选择刚推送的 `fitness-ai-coach` 仓库
3. **Framework Preset** 会自动识别为 `Next.js`
4. 在 **Environment Variables** 中添加以下变量（**必须在 Deploy 前添加，否则构建会失败**）：
| 变量名 | 值 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://nlbuvrsecasrafcliufy.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_0Y9U4zBqipwclXpjMA9ABQ_ahIPdXTH` |
| `SUPABASE_SERVICE_ROLE_KEY` | 你的 `service_role key`（在 Supabase → Settings → API → service_role 找到） |
| `DEEPSEEK_API_KEY` | 你的 DeepSeek API Key |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` |
| `DEEPSEEK_MODEL` | `deepseek-chat` |
> **⚠️ 重要**：`NEXT_PUBLIC_` 开头的变量必须在构建时可用，如果部署后修改了它们，需要在 Vercel 项目 → **Deployments** → 点击最顶部部署右侧的 **...** → **Redeploy** 重新构建。
5. 点击 **Deploy**，等待部署完成（约 2 分钟）
6. 部署完成后 Vercel 会给一个域名，例如：`fitness-ai-coach.vercel.app`（取决于你 Vercel 上的项目名称）
---
## 第三步：配置 Supabase Redirect URLs
**这一步最重要，不然密码找回、邮箱验证等功能会失效。**
1. 打开 [Supabase Dashboard → Authentication → Settings](https://supabase.com/dashboard/project/nlbuvrsecasrafcliufy/auth/settings)
2. 找到 **Redirect URLs** 配置框
3. 添加以下 URL（每个一行）：
```
http://localhost:3000/auth/callback
http://localhost:3000/**
https://fitness-ai-coach-kfnekdq0r-pks2.vercel.app/auth/callback
https://fitness-ai-coach-kfnekdq0r-pks2.vercel.app/**
```
> 如果你想绑定自己的域名（比如 `fit.jeff.dev`），也加上：
> `https://你的域名/auth/callback`
> `https://你的域名/**`
4. 点击 **Save**
---
## 第四步：在手机上使用
### 方式 A：浏览器直接访问
打开手机 Safari/Chrome，输入 `https://fitness-ai-coach.vercel.app`
### 方式 B：添加到主屏幕（PWA）
1. 在 Safari 中打开上述地址
2. 点击底部 **分享按钮**（方框+箭头）
3. 向下滑动，点 **添加到主屏幕**
4. 命名后点击 **添加**
5. 桌面上会出现 FitCoach 图标，点开就像原生 App
---
## 常见问题
### 找回密码流程正常吗？
完全正常。完整流程如下：
1. 用户在登录页点击「忘记密码」→ 输入邮箱 → 点击发送
2. Supabase 发送一封密码重置邮件到该邮箱
3. 用户打开邮件，点击重置链接（例如 `https://你的域名/auth/callback?code=xxx&type=recovery`）
4. 系统自动验证身份，跳转到 **设置新密码页** `/auth/reset-password`
5. 用户输入新密码并提交 → 重置完成 → 自动跳回首页
### 绑定邮箱流程怎么用？
匿名用户使用后发现需要换设备同步数据时：
1. 首页右上角点击 **「绑定邮箱」** 按钮
2. 输入邮箱和密码（注册新账号，或登录已有账号）
3. 绑定后，该匿名账号的数据就永久关联到该邮箱
4. 换设备后直接用邮箱登录即可看到所有数据
> 建议：一开始就注册邮箱账号，避免匿名数据丢失。
### 匿名体验在手机上能用吗？
可以。匿名用户的 session 存在浏览器 Cookie 中，换设备就没了。
**建议：一上来就注册邮箱账号**，这样换个手机登录就能同步。
### 想用自己的域名？
1. 在 Vercel 项目 → **Settings → Domains** 添加你的域名
2. 按提示配置 DNS
3. 在 Supabase Redirect URLs 中添加 `https://你的域名/**`