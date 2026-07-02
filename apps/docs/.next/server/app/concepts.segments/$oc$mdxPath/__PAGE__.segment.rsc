1:"$Sreact.fragment"
2:I[12157,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"TOCProvider"]
3:I[1674,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"Sidebar"]
4:I[51845,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"ClientWrapper"]
6:I[92484,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"HeadingAnchor"]
14:I[93529,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],""]
15:I[35073,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"OutletBoundary"]
16:"$Sreact.suspense"
5:T6c3,---
title: Concepts
---

# Concepts

Telekinesis separates **what the UI is** from **what the camera does**. Your app
is marked up once with frames; everything cinematic lives in a timesheet a human
or AI authors and a recorder performs.

## One component, two lives

`<TelekineticFrame>` checks `isDemoMode()`:

- **User mode** (real visitors) → renders `<>{children}</>`. Zero DOM, zero cost.
- **Demo mode** (`navigator.webdriver`, `?demo`, a forced flag, or Studio mode)
  → renders a measurable wrapper carrying `data-telekinesis-id` and registers
  itself in a global store.

Detection returns `false` during SSR so server and first client render match (no
hydration mismatch); the component upgrades in a layout effect.

## The registry

Every mounted frame lives in a vanilla Zustand store keyed by `id`, holding the
real `HTMLElement`. The engine resolves `frameId → element → rect` on demand, so
zoom/highlight/cursor targeting is always correct after layout — even under a
zoom transform.

## Two ways to drive the same effects

| Mode | Visuals | Real interaction | Used by |
| --- | --- | --- | --- |
| `self` | yes | yes (dispatches clicks, types) | live preview, Studio, `Play live` |
| `external` | yes | no — Playwright performs it | recording |

## The overlay layer

The cursor, ripples and spotlight mount as a child of `<html>` (a sibling of
`<body>`). Zoom transforms `<body>`; living outside it keeps the cursor and
spotlight rock-steady in viewport space.

## The Studio bridge

In Studio mode, `<TelekinesisStage>` also mirrors the runtime over `postMessage`
so the [Studio](/studio) editor — which embeds your app in an iframe — can list
frames, read rects and play effects across origins.0:{"rsc":["$","$1","c",{"children":[["$","div",null,{"className":"x:mx-auto x:flex x:max-w-(--nextra-content-width)","children":["$","$L2",null,{"value":[{"value":"One component, two lives","id":"one-component-two-lives","depth":2},{"value":"The registry","id":"the-registry","depth":2},{"value":"Two ways to drive the same effects","id":"two-ways-to-drive-the-same-effects","depth":2},{"value":"The overlay layer","id":"the-overlay-layer","depth":2},{"value":"The Studio bridge","id":"the-studio-bridge","depth":2}],"children":[["$","$L3",null,{}],["$","$L4",null,{"metadata":{"title":"Concepts","filePath":"src/content/concepts.mdx"},"sourceCode":"$5","children":[["$","div",null,{"id":"nextra-skip-nav"}],["$","main",null,{"data-pagefind-body":true,"children":[["$","h1",null,{"className":"x:tracking-tight x:text-slate-900 x:dark:text-slate-100 x:font-bold x:mt-2 x:text-4xl","children":["Concepts","$undefined"]}],"\n",["$","p",null,{"className":"x:not-first:mt-[1.25em] x:leading-7","children":["Telekinesis separates ",["$","strong",null,{"children":"what the UI is"}]," from ",["$","strong",null,{"children":"what the camera does"}],". Your app\nis marked up once with frames; everything cinematic lives in a timesheet a human\nor AI authors and a recorder performs."]}],"\n",["$","h2",null,{"id":"one-component-two-lives","className":"x:tracking-tight x:text-slate-900 x:dark:text-slate-100 x:font-semibold x:target:animate-[fade-in_1.5s] x:mt-10 x:border-b x:pb-1 x:text-3xl nextra-border","children":["One component, two lives",["$","$L6",null,{"id":"one-component-two-lives"}]]}],"\n",["$","p",null,{"className":"x:not-first:mt-[1.25em] x:leading-7","children":[["$","code",null,{"className":"nextra-code","dir":"ltr","children":"<TelekineticFrame>"}]," checks ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"isDemoMode()"}],":"]}],"\n",["$","ul",null,{"className":"x:[:is(ol,ul)_&]:my-[.75em] x:not-first:mt-[1.25em] x:list-disc x:ms-[1.5em]","children":["\n",["$","li",null,{"className":"x:my-[.5em]","children":["$L7"," (real visitors) → renders ","$L8",". Zero DOM, zero cost."]}],"\n","$L9","\n"]}],"\n","$La","\n","$Lb","\n","$Lc","\n","$Ld","\n","$Le","\n","$Lf","\n","$L10","\n","$L11","\n","$L12"]}]]}]]}]}],null,"$L13"]}],"isPartial":false,"staleTime":300,"varyParams":null,"buildId":"zYaB9JnGaEWhozf8TwV7f"}
7:["$","strong",null,{"children":"User mode"}]
8:["$","code",null,{"className":"nextra-code","dir":"ltr","children":"<>{children}</>"}]
9:["$","li",null,{"className":"x:my-[.5em]","children":[["$","strong",null,{"children":"Demo mode"}]," (",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"navigator.webdriver"}],", ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"?demo"}],", a forced flag, or Studio mode)\n→ renders a measurable wrapper carrying ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"data-telekinesis-id"}]," and registers\nitself in a global store."]}]
a:["$","p",null,{"className":"x:not-first:mt-[1.25em] x:leading-7","children":["Detection returns ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"false"}]," during SSR so server and first client render match (no\nhydration mismatch); the component upgrades in a layout effect."]}]
b:["$","h2",null,{"id":"the-registry","className":"x:tracking-tight x:text-slate-900 x:dark:text-slate-100 x:font-semibold x:target:animate-[fade-in_1.5s] x:mt-10 x:border-b x:pb-1 x:text-3xl nextra-border","children":["The registry",["$","$L6",null,{"id":"the-registry"}]]}]
c:["$","p",null,{"className":"x:not-first:mt-[1.25em] x:leading-7","children":["Every mounted frame lives in a vanilla Zustand store keyed by ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"id"}],", holding the\nreal ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"HTMLElement"}],". The engine resolves ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"frameId → element → rect"}]," on demand, so\nzoom/highlight/cursor targeting is always correct after layout — even under a\nzoom transform."]}]
d:["$","h2",null,{"id":"two-ways-to-drive-the-same-effects","className":"x:tracking-tight x:text-slate-900 x:dark:text-slate-100 x:font-semibold x:target:animate-[fade-in_1.5s] x:mt-10 x:border-b x:pb-1 x:text-3xl nextra-border","children":["Two ways to drive the same effects",["$","$L6",null,{"id":"two-ways-to-drive-the-same-effects"}]]}]
e:["$","table",null,{"className":"x:block x:overflow-x-auto nextra-scrollbar x:not-first:mt-[1.25em] x:p-0","children":[["$","thead",null,{"children":["$","tr",null,{"children":[["$","th",null,{"children":"Mode","className":"x:m-0 x:border x:border-gray-300 x:px-4 x:py-2 x:font-semibold x:dark:border-gray-600"}],["$","th",null,{"children":"Visuals","className":"x:m-0 x:border x:border-gray-300 x:px-4 x:py-2 x:font-semibold x:dark:border-gray-600"}],["$","th",null,{"children":"Real interaction","className":"x:m-0 x:border x:border-gray-300 x:px-4 x:py-2 x:font-semibold x:dark:border-gray-600"}],["$","th",null,{"children":"Used by","className":"x:m-0 x:border x:border-gray-300 x:px-4 x:py-2 x:font-semibold x:dark:border-gray-600"}]],"className":"x:m-0 x:border-t x:border-gray-300 x:p-0 x:dark:border-gray-600 x:even:bg-gray-100 x:even:dark:bg-gray-600/20"}]}],["$","tbody",null,{"children":[["$","tr",null,{"children":[["$","td",null,{"children":["$","code",null,{"className":"nextra-code","dir":"ltr","children":"self"}],"className":"x:m-0 x:border x:border-gray-300 x:px-4 x:py-2 x:dark:border-gray-600"}],["$","td",null,{"children":"yes","className":"x:m-0 x:border x:border-gray-300 x:px-4 x:py-2 x:dark:border-gray-600"}],["$","td",null,{"children":"yes (dispatches clicks, types)","className":"x:m-0 x:border x:border-gray-300 x:px-4 x:py-2 x:dark:border-gray-600"}],["$","td",null,{"children":["live preview, Studio, ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"Play live"}]],"className":"x:m-0 x:border x:border-gray-300 x:px-4 x:py-2 x:dark:border-gray-600"}]],"className":"x:m-0 x:border-t x:border-gray-300 x:p-0 x:dark:border-gray-600 x:even:bg-gray-100 x:even:dark:bg-gray-600/20"}],["$","tr",null,{"children":[["$","td",null,{"children":["$","code",null,{"className":"nextra-code","dir":"ltr","children":"external"}],"className":"x:m-0 x:border x:border-gray-300 x:px-4 x:py-2 x:dark:border-gray-600"}],["$","td",null,{"children":"yes","className":"x:m-0 x:border x:border-gray-300 x:px-4 x:py-2 x:dark:border-gray-600"}],["$","td",null,{"children":"no — Playwright performs it","className":"x:m-0 x:border x:border-gray-300 x:px-4 x:py-2 x:dark:border-gray-600"}],["$","td",null,{"children":"recording","className":"x:m-0 x:border x:border-gray-300 x:px-4 x:py-2 x:dark:border-gray-600"}]],"className":"x:m-0 x:border-t x:border-gray-300 x:p-0 x:dark:border-gray-600 x:even:bg-gray-100 x:even:dark:bg-gray-600/20"}]]}]]}]
f:["$","h2",null,{"id":"the-overlay-layer","className":"x:tracking-tight x:text-slate-900 x:dark:text-slate-100 x:font-semibold x:target:animate-[fade-in_1.5s] x:mt-10 x:border-b x:pb-1 x:text-3xl nextra-border","children":["The overlay layer",["$","$L6",null,{"id":"the-overlay-layer"}]]}]
10:["$","p",null,{"className":"x:not-first:mt-[1.25em] x:leading-7","children":["The cursor, ripples and spotlight mount as a child of ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"<html>"}]," (a sibling of\n",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"<body>"}],"). Zoom transforms ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"<body>"}],"; living outside it keeps the cursor and\nspotlight rock-steady in viewport space."]}]
11:["$","h2",null,{"id":"the-studio-bridge","className":"x:tracking-tight x:text-slate-900 x:dark:text-slate-100 x:font-semibold x:target:animate-[fade-in_1.5s] x:mt-10 x:border-b x:pb-1 x:text-3xl nextra-border","children":["The Studio bridge",["$","$L6",null,{"id":"the-studio-bridge"}]]}]
12:["$","p",null,{"className":"x:not-first:mt-[1.25em] x:leading-7","children":["In Studio mode, ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"<TelekinesisStage>"}]," also mirrors the runtime over ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"postMessage"}],"\nso the ",["$","$L14",null,{"href":"/studio","className":"x:focus-visible:nextra-focus x:text-primary-600 x:underline x:hover:no-underline x:decoration-from-font x:[text-underline-position:from-font]","children":"Studio"}]," editor — which embeds your app in an iframe — can list\nframes, read rects and play effects across origins."]}]
13:["$","$L15",null,{"children":["$","$16",null,{"name":"Next.MetadataOutlet","children":"$@17"}]}]
17:null
