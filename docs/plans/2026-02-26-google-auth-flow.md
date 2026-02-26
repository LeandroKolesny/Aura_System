# Google Auth Flow — Login vs Register Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separar o fluxo de login e cadastro com Google: login apenas autentica usuários existentes; cadastro cria admin + dispara onboarding para criar empresa.

**Architecture:**
- Novo param `mode=login|register` no OAuth Google (além do `calendar` já existente)
- Novo endpoint `POST /api/auth/google/setup-company` para o admin criar a empresa durante o onboarding
- Onboarding ganha "step 0" detectado quando `currentCompany === null`

**Tech Stack:** Next.js 15 (backend), React + BrowserRouter (frontend), Prisma, AppContext pattern

---

## Context

### Arquivos principais
- `aura-backend/src/app/api/auth/google/callback/route.ts` — onde login/register diferem
- `aura-backend/src/app/api/auth/google/route.ts` — inicia o fluxo OAuth (passa mode no state)
- `services/api.ts` — `authApi.googleSignIn(mode, returnTo)`
- `context/AppContext.tsx` — `loginWithToken`, `setUser`, `setCompanies`
- `pages/Login.tsx` — dois botões do Google (login e cadastro)
- `pages/GoogleAuthCallback.tsx` — lê `token` + `newAccount` da URL
- `App.tsx` — `PrivateLayout` redireciona para onboarding
- `pages/Onboarding.tsx` — adicionar step 0 (criar empresa)

### Token storage
O token JWT está em `localStorage.setItem('aura_token', token)`. Para refresh após criar empresa, chamar `loginWithToken(localStorage.getItem('aura_token')!)`.

### currentCompany derivation
`currentCompany = companies.find(c => c.id === user.companyId) || null`
Se `user.companyId` for null, `currentCompany` é null.

---

## Task 1: Backend — Endpoint `POST /api/auth/google/setup-company`

**Files:**
- Create: `aura-backend/src/app/api/auth/google/setup-company/route.ts`

**Step 1: Create the route file**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { slugify } from '@/lib/utils';

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (authUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Apenas admins podem criar empresa' }, { status: 403 });
  }
  if (authUser.companyId) {
    return NextResponse.json({ error: 'Usuário já tem uma empresa' }, { status: 409 });
  }

  const { companyName, state, phone } = await request.json();
  if (!companyName || typeof companyName !== 'string' || companyName.trim().length < 2) {
    return NextResponse.json({ error: 'Nome da empresa inválido' }, { status: 400 });
  }

  // Gerar slug único (mesma lógica do register route)
  const baseSlug = slugify(companyName.trim());
  let finalSlug = baseSlug;
  let existingCompany = await prisma.company.findUnique({ where: { slug: finalSlug } });
  if (existingCompany) {
    if (state) {
      const stateSlug = `${baseSlug}-${state.toUpperCase()}`;
      const existingWithState = await prisma.company.findUnique({ where: { slug: stateSlug } });
      if (!existingWithState) {
        finalSlug = stateSlug;
        existingCompany = null;
      }
    }
    if (existingCompany) {
      let counter = 1;
      while (existingCompany) {
        counter++;
        finalSlug = `${baseSlug}-${counter}`;
        existingCompany = await prisma.company.findUnique({ where: { slug: finalSlug } });
      }
    }
  }

  const trialExpiresAt = new Date();
  trialExpiresAt.setDate(trialExpiresAt.getDate() + 15);

  const company = await prisma.company.create({
    data: {
      name: companyName.trim(),
      slug: finalSlug,
      state: state?.toUpperCase(),
      plan: 'FREE',
      subscriptionStatus: 'TRIAL',
      subscriptionExpiresAt: trialExpiresAt,
      onboardingCompleted: false,
      paymentMethods: ['money', 'pix', 'credit_card', 'debit_card'],
      businessHours: {
        monday:    { isOpen: true,  start: '08:00', end: '18:00' },
        tuesday:   { isOpen: true,  start: '08:00', end: '18:00' },
        wednesday: { isOpen: true,  start: '08:00', end: '18:00' },
        thursday:  { isOpen: true,  start: '08:00', end: '18:00' },
        friday:    { isOpen: true,  start: '08:00', end: '18:00' },
        saturday:  { isOpen: true,  start: '09:00', end: '13:00' },
        sunday:    { isOpen: false, start: '00:00', end: '00:00' },
      },
    },
  });

  await prisma.user.update({
    where: { id: authUser.id },
    data: { companyId: company.id },
  });

  // Update phone on user if provided
  if (phone) {
    await prisma.user.update({
      where: { id: authUser.id },
      data: { phone },
    });
  }

  return NextResponse.json({ success: true, company }, { status: 201 });
}
```

**Step 2: Verify build passes**
```bash
cd aura-backend && npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**
```bash
git add aura-backend/src/app/api/auth/google/setup-company/route.ts
git commit -m "feat: add POST /api/auth/google/setup-company endpoint"
```

---

## Task 2: Backend — Separar `login` vs `register` no callback Google

**Files:**
- Modify: `aura-backend/src/app/api/auth/google/callback/route.ts`

**Current behavior:** mode `signin` → find-or-create PATIENT user.

**New behavior:**
- mode `login` (e `signin` como alias): find only, fail with `google_no_account` se não existir
- mode `register`: create ADMIN (no company), redirect with `newAccount=true`

**Step 1: Replace the SIGNIN MODE block (lines ~71-115)**

Locate the comment `// SIGNIN MODE: find or create user` and replace the entire block:

```typescript
    // LOGIN MODE: only authenticate existing users
    if (state.mode === 'login' || state.mode === 'signin') {
      const user = await prisma.user.findFirst({
        where: { OR: [{ googleId: userInfo.sub }, { email: userInfo.email }] },
        include: { company: true },
      });

      if (!user) {
        return NextResponse.redirect(`${FRONTEND_URL}/login?error=google_no_account`);
      }

      // Link googleId if not already linked
      if (!user.googleId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { googleId: userInfo.sub, avatar: userInfo.picture ?? undefined },
        });
      }

      if (!user.isActive) {
        return NextResponse.redirect(`${FRONTEND_URL}/login?error=account_disabled`);
      }

      const token = generateSessionToken(user.id);
      const response = NextResponse.redirect(
        `${FRONTEND_URL}/auth/google-callback?token=${token}&returnTo=${encodeURIComponent(state.returnTo || '/')}`
      );
      response.cookies.set('aura_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
      return response;
    }

    // REGISTER MODE: create new ADMIN user (no company yet)
    if (state.mode === 'register') {
      const existing = await prisma.user.findFirst({
        where: { OR: [{ googleId: userInfo.sub }, { email: userInfo.email }] },
      });

      if (existing) {
        return NextResponse.redirect(`${FRONTEND_URL}/login?error=google_already_registered`);
      }

      const tempPassword = await bcrypt.hash(randomBytes(16).toString('hex'), 10);
      const newUser = await prisma.user.create({
        data: {
          email: userInfo.email,
          name: userInfo.name,
          password: tempPassword,
          googleId: userInfo.sub,
          avatar: userInfo.picture ?? undefined,
          role: 'ADMIN',
          isActive: true,
          // companyId intentionally null — admin will create company in onboarding
        },
        include: { company: true },
      });

      const token = generateSessionToken(newUser.id);
      const response = NextResponse.redirect(
        `${FRONTEND_URL}/auth/google-callback?token=${token}&newAccount=true`
      );
      response.cookies.set('aura_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
      return response;
    }

    // Unknown mode fallback
    return NextResponse.redirect(`${FRONTEND_URL}/login?error=invalid_mode`);
```

Also remove the old block that starts with `// SIGNIN MODE: find or create user` and ends before the catch.

**Step 2: Verify types**
```bash
cd aura-backend && npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**
```bash
git add aura-backend/src/app/api/auth/google/callback/route.ts
git commit -m "feat: split Google OAuth into login vs register modes"
```

---

## Task 3: Frontend — `services/api.ts` — tipos e novo método

**Files:**
- Modify: `services/api.ts`

**Step 1: Update googleSignIn type** (line ~97)

Change:
```typescript
async googleSignIn(mode: 'signin' | 'calendar' = 'signin', returnTo = '/') {
```
To:
```typescript
async googleSignIn(mode: 'login' | 'register' | 'calendar' = 'login', returnTo = '/') {
```

**Step 2: Add `googleSetupCompany` method** after `googleSignIn`:

```typescript
async googleSetupCompany(data: { companyName: string; state?: string; phone?: string }) {
  return fetchApi('/api/auth/google/setup-company', {
    method: 'POST',
    body: JSON.stringify(data),
  });
},
```

**Step 3: Commit**
```bash
git add services/api.ts
git commit -m "feat: update googleSignIn types + add googleSetupCompany"
```

---

## Task 4: Frontend — `context/AppContext.tsx` — `setupGoogleCompany`

**Files:**
- Modify: `context/AppContext.tsx`

**Step 1: Add to the context interface** (find the interface block ~line 32-70):

```typescript
setupGoogleCompany: (companyName: string, state?: string, phone?: string) => Promise<{ success: boolean; error?: string }>;
```

**Step 2: Add the function implementation** (near `registerCompany`, around line 918):

```typescript
const setupGoogleCompany = async (companyName: string, state?: string, phone?: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await authApi.googleSetupCompany({ companyName, state, phone });
    if (!result.success) {
      return { success: false, error: result.error || 'Erro ao criar empresa' };
    }
    // Refresh session to load new companyId
    const token = localStorage.getItem('aura_token');
    if (token) {
      await loginWithToken(token);
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Erro de conexão. Tente novamente.' };
  }
};
```

**Step 3: Expose in context value** (find the large object returned by the provider, ~line 1929):

Add `setupGoogleCompany,` to the returned context object.

**Step 4: Verify TypeScript**
```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 5: Commit**
```bash
git add context/AppContext.tsx
git commit -m "feat: add setupGoogleCompany to AppContext"
```

---

## Task 5: Frontend — `pages/Login.tsx`

**Files:**
- Modify: `pages/Login.tsx`

**Step 1: Initialize `isRegistering` from URL param**

After `const [searchParams] = useSearchParams();` add:
```typescript
const tabParam = searchParams.get('tab');
```

Change:
```typescript
const [isRegistering, setIsRegistering] = useState(false);
```
To:
```typescript
const [isRegistering, setIsRegistering] = useState(tabParam === 'register');
```

**Step 2: Add new error messages** in `googleErrorMessages`:

```typescript
google_no_account: 'Nenhuma conta encontrada com este Google. Cadastre-se primeiro.',
google_already_registered: 'Este Google já tem uma conta. Faça login na aba de acesso.',
```

**Step 3: Change login tab Google button** (the one in `/* FORMULÁRIO DE LOGIN */`):

Change `onClick` and text:
```tsx
onClick={() => authApi.googleSignIn('login', '/')}
// text: "Entrar com Google"
```

**Step 4: Change register tab Google button** (the one in `/* FORMULÁRIO DE CADASTRO */`):

Change `onClick` and text:
```tsx
onClick={() => authApi.googleSignIn('register', '/')}
// text: "Cadastrar com Google"
```

**Step 5: Commit**
```bash
git add pages/Login.tsx
git commit -m "feat: split Google buttons (login vs register) in Login.tsx"
```

---

## Task 6: Frontend — `pages/GoogleAuthCallback.tsx`

**Files:**
- Modify: `pages/GoogleAuthCallback.tsx`

**Step 1: Read `newAccount` param and navigate to onboarding when set**

Current:
```typescript
loginWithToken(token).then((ok: boolean) => {
  if (ok) {
    navigate(decodeURIComponent(returnTo));
  } else {
    navigate('/login?error=invalid_token');
  }
});
```

Replace with:
```typescript
const newAccount = searchParams.get('newAccount');

loginWithToken(token).then((ok: boolean) => {
  if (ok) {
    if (newAccount === 'true') {
      navigate('/onboarding');
    } else {
      navigate(decodeURIComponent(returnTo));
    }
  } else {
    navigate('/login?error=invalid_token');
  }
});
```

**Step 2: Commit**
```bash
git add pages/GoogleAuthCallback.tsx
git commit -m "feat: redirect new Google accounts to onboarding"
```

---

## Task 7: Frontend — `App.tsx`

**Files:**
- Modify: `App.tsx`

**Step 1: Update the onboarding redirect in `PrivateLayout`**

Find:
```typescript
if (user.role === UserRole.ADMIN && currentCompany && currentCompany.onboardingCompleted === false) {
  return <Navigate to="/onboarding" replace />;
}
```

Replace with:
```typescript
if (user.role === UserRole.ADMIN && !currentCompany) {
  return <Navigate to="/onboarding" replace />;
}
if (user.role === UserRole.ADMIN && currentCompany && currentCompany.onboardingCompleted === false) {
  return <Navigate to="/onboarding" replace />;
}
```

**Step 2: Commit**
```bash
git add App.tsx
git commit -m "feat: redirect ADMIN without company to onboarding"
```

---

## Task 8: Frontend — `pages/Onboarding.tsx`

**Files:**
- Modify: `pages/Onboarding.tsx`

**Step 1: Add `setupGoogleCompany` from context and step 0 state**

At the top of the component, add `setupGoogleCompany` to the destructure:
```typescript
const { addProcedure, updateCompany, currentCompany, completeOnboarding, setupGoogleCompany } = useApp();
```

Add state for step 0:
```typescript
const needsCompany = !currentCompany;
const [step, setStep] = useState(needsCompany ? 0 : 1);

// Step 0 state
const [setupCompanyName, setSetupCompanyName] = useState('');
const [setupState, setSetupState] = useState('');
const [setupPhone, setSetupPhone] = useState('');
const [setupLoading, setSetupLoading] = useState(false);
const [setupError, setSetupError] = useState('');
const [awaitingCompany, setAwaitingCompany] = useState(false);
```

**Step 2: Add useEffect to advance from step 0 to 1 when company is ready**

After the state declarations, add:
```typescript
useEffect(() => {
  if (awaitingCompany && currentCompany) {
    setAwaitingCompany(false);
    setStep(1);
  }
}, [currentCompany, awaitingCompany]);
```

**Step 3: Add step 0 handler**

After the existing handlers, add:
```typescript
const handleCreateCompany = async () => {
  if (!setupCompanyName.trim()) {
    setSetupError('Nome da clínica é obrigatório.');
    return;
  }
  setSetupLoading(true);
  setSetupError('');
  const result = await setupGoogleCompany(setupCompanyName.trim(), setupState || undefined, setupPhone || undefined);
  if (!result.success) {
    setSetupError(result.error || 'Erro ao criar empresa. Tente novamente.');
    setSetupLoading(false);
    return;
  }
  setAwaitingCompany(true);
  setSetupLoading(false);
};
```

**Step 4: Add step 0 render block**

In the JSX, before `{step === 1 && (`, add:
```tsx
{step === 0 && (
  <div className="space-y-5">
    <div className="text-center mb-6">
      <h2 className="text-xl font-bold text-slate-800">Bem-vindo(a) ao Aura!</h2>
      <p className="text-slate-500 text-sm mt-1">Primeiro, nos conte sobre sua clínica.</p>
    </div>

    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nome da Clínica *</label>
      <input
        type="text"
        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm"
        placeholder="Ex: Studio Bella Estética"
        value={setupCompanyName}
        onChange={(e) => setSetupCompanyName(e.target.value)}
      />
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Estado</label>
        <select
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm"
          value={setupState}
          onChange={(e) => setSetupState(e.target.value)}
        >
          <option value="">Selecione</option>
          {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
            <option key={uf} value={uf}>{uf}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Celular</label>
        <input
          type="tel"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm"
          placeholder="(99) 99999-9999"
          value={setupPhone}
          onChange={(e) => setSetupPhone(e.target.value)}
        />
      </div>
    </div>

    {setupError && (
      <p className="text-red-600 text-sm">{setupError}</p>
    )}

    <button
      onClick={handleCreateCompany}
      disabled={setupLoading}
      className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
    >
      {setupLoading ? 'Criando...' : 'Continuar'}
      {!setupLoading && <ChevronRight className="w-4 h-4" />}
    </button>
  </div>
)}
```

**Step 5: Update the steps indicator** to show 4 steps (0-3) when `needsCompany`, or 3 steps (1-3) otherwise. The simplest fix: change the step indicator to map over `[1,2,3]` if `!needsCompany`, or `[0,1,2,3]` if `needsCompany`. Actually to keep it simple, just keep the 3-dot indicator but hide it on step 0, or adapt the condition:

The steps indicator currently shows:
```tsx
{[1, 2, 3].map((i) => (
  <div key={i} className={`h-1 w-12 rounded-full transition-colors ${step >= i ? 'bg-primary-600' : 'bg-slate-200'}`}></div>
))}
```

Change to only show when `step > 0`:
```tsx
{step > 0 && [1, 2, 3].map((i) => (
  <div key={i} className={`h-1 w-12 rounded-full transition-colors ${step >= i ? 'bg-primary-600' : 'bg-slate-200'}`}></div>
))}
```

**Step 6: Commit**
```bash
git add pages/Onboarding.tsx
git commit -m "feat: add step 0 to Onboarding for Google-registered admins"
```

---

## Final Deploy

```bash
# Deploy frontend
cd /c/Aura_System && git push origin master && vercel --prod --yes

# Deploy backend
cd /c/Aura_System/aura-backend && vercel --prod --yes
```
