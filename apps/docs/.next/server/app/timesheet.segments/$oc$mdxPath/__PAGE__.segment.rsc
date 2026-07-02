1:"$Sreact.fragment"
2:I[12157,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"TOCProvider"]
3:I[1674,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"Sidebar"]
4:I[51845,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"ClientWrapper"]
6:I[93529,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],""]
7:I[83302,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"Frame"]
8:I[83302,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"DemoGif"]
10:I[83302,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"Divider"]
11:I[92484,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"HeadingAnchor"]
12:I[30552,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"ToggleWordWrapButton"]
13:I[35073,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"OutletBoundary"]
14:"$Sreact.suspense"
5:T665,---
title: Timesheet
---

# The timesheet

A timesheet is the **score** the recorder performs: recording settings plus an
ordered `timeline` of [effects](/effects). It is a *sequence* — each effect runs
after the previous one, separated by optional `delayBefore` / `delayAfter`.

<Frame id="ts-json" intent="timesheet-json">
  <pre className="tk-code">{`{
  "version": "1.0",
  "url": "http://localhost:4311/?demo",
  "resolution": { "width": 1280, "height": 720 },
  "fps": 30,
  "timeline": [
    { "action": "zoom-in",   "frameId": "hero-cta", "scale": 1.18 },
    { "action": "highlight", "frameId": "hero" },
    { "action": "cursor-move", "destFrameId": "hero-cta" },
    { "action": "click", "frameId": "hero-cta", "soundProfile": "macbook-trackpad" },
    { "action": "zoom-out" }
  ]
}`}</pre>
</Frame>

<DemoGif section="timesheet" caption="The recorder walks this sequence top to bottom." />

<Divider />

## Rules

- `timeline` must have at least one effect.
- `frameId` / `destFrameId` must match a `<Frame id=…>` mounted when the effect runs.
- `drag-and-drop` and `cursor-move` require a destination — enforced by the schema.
- Unknown actions and unknown fields are rejected.

## Validate

```ts
import { parseTimesheet, safeParseTimesheet } from "@telekinesis/schema";

parseTimesheet(json);                // throws ZodError on problems
const r = safeParseTimesheet(json);  // { success, data | error }
```

The CLI and the [Studio](/studio) both validate before recording, and the schema
also powers `layoutTimesheet()` — the helper that projects this sequence onto an
absolute time axis for the visual editor.0:{"rsc":["$","$1","c",{"children":[["$","div",null,{"className":"x:mx-auto x:flex x:max-w-(--nextra-content-width)","children":["$","$L2",null,{"value":[{"value":"Rules","id":"rules","depth":2},{"value":"Validate","id":"validate","depth":2}],"children":[["$","$L3",null,{}],["$","$L4",null,{"metadata":{"title":"Timesheet","filePath":"src/content/timesheet.mdx"},"sourceCode":"$5","children":[["$","div",null,{"id":"nextra-skip-nav"}],["$","main",null,{"data-pagefind-body":true,"children":[["$","h1",null,{"className":"x:tracking-tight x:text-slate-900 x:dark:text-slate-100 x:font-bold x:mt-2 x:text-4xl","children":["The timesheet","$undefined"]}],"\n",["$","p",null,{"className":"x:not-first:mt-[1.25em] x:leading-7","children":["A timesheet is the ",["$","strong",null,{"children":"score"}]," the recorder performs: recording settings plus an\nordered ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"timeline"}]," of ",["$","$L6",null,{"href":"/effects","className":"x:focus-visible:nextra-focus x:text-primary-600 x:underline x:hover:no-underline x:decoration-from-font x:[text-underline-position:from-font]","children":"effects"}],". It is a ",["$","em",null,{"children":"sequence"}]," — each effect runs\nafter the previous one, separated by optional ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"delayBefore"}]," / ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"delayAfter"}],"."]}],"\n",["$","$L7",null,{"id":"ts-json","intent":"timesheet-json","children":["$","pre",null,{"className":"tk-code","children":"{\n\"version\": \"1.0\",\n\"url\": \"http://localhost:4311/?demo\",\n\"resolution\": { \"width\": 1280, \"height\": 720 },\n\"fps\": 30,\n\"timeline\": [\n  { \"action\": \"zoom-in\",   \"frameId\": \"hero-cta\", \"scale\": 1.18 },\n  { \"action\": \"highlight\", \"frameId\": \"hero\" },\n  { \"action\": \"cursor-move\", \"destFrameId\": \"hero-cta\" },\n  { \"action\": \"click\", \"frameId\": \"hero-cta\", \"soundProfile\": \"macbook-trackpad\" },\n  { \"action\": \"zoom-out\" }\n]\n}"}]}],"\n",["$","$L8",null,{"section":"timesheet","caption":"The recorder walks this sequence top to bottom."}],"\n","$L9","\n","$La","\n","$Lb","\n","$Lc","\n","$Ld","\n","$Le"]}]]}]]}]}],null,"$Lf"]}],"isPartial":false,"staleTime":300,"varyParams":null,"buildId":"zYaB9JnGaEWhozf8TwV7f"}
9:["$","$L10",null,{}]
a:["$","h2",null,{"id":"rules","className":"x:tracking-tight x:text-slate-900 x:dark:text-slate-100 x:font-semibold x:target:animate-[fade-in_1.5s] x:mt-10 x:border-b x:pb-1 x:text-3xl nextra-border","children":["Rules",["$","$L11",null,{"id":"rules"}]]}]
b:["$","ul",null,{"className":"x:[:is(ol,ul)_&]:my-[.75em] x:not-first:mt-[1.25em] x:list-disc x:ms-[1.5em]","children":["\n",["$","li",null,{"className":"x:my-[.5em]","children":[["$","code",null,{"className":"nextra-code","dir":"ltr","children":"timeline"}]," must have at least one effect."]}],"\n",["$","li",null,{"className":"x:my-[.5em]","children":[["$","code",null,{"className":"nextra-code","dir":"ltr","children":"frameId"}]," / ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"destFrameId"}]," must match a ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"<Frame id=…>"}]," mounted when the effect runs."]}],"\n",["$","li",null,{"className":"x:my-[.5em]","children":[["$","code",null,{"className":"nextra-code","dir":"ltr","children":"drag-and-drop"}]," and ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"cursor-move"}]," require a destination — enforced by the schema."]}],"\n",["$","li",null,{"className":"x:my-[.5em]","children":"Unknown actions and unknown fields are rejected."}],"\n"]}]
c:["$","h2",null,{"id":"validate","className":"x:tracking-tight x:text-slate-900 x:dark:text-slate-100 x:font-semibold x:target:animate-[fade-in_1.5s] x:mt-10 x:border-b x:pb-1 x:text-3xl nextra-border","children":["Validate",["$","$L11",null,{"id":"validate"}]]}]
d:["$","div",null,{"data-pagefind-ignore":"all","className":"nextra-code x:relative x:not-first:mt-[1.25em]","children":["$undefined",["$","pre",null,{"className":"x:group x:focus-visible:nextra-focus x:overflow-x-auto x:subpixel-antialiased x:text-[.9em] x:bg-white x:dark:bg-black x:py-4 x:ring-1 x:ring-inset x:ring-gray-300 x:dark:ring-neutral-700 x:contrast-more:ring-gray-900 x:contrast-more:dark:ring-gray-50 x:contrast-more:contrast-150 x:rounded-md not-prose","tabIndex":"0","children":[["$","div",null,{"className":"x:group-hover:opacity-100 x:group-focus:opacity-100 x:opacity-0 x:transition x:focus-within:opacity-100 x:flex x:gap-1 x:absolute x:right-4 x:top-2","children":[["$","$L12",null,{"children":["$","svg",null,{"viewBox":"0 0 24 24","fill":"currentColor","height":"1em","children":["$","path",null,{"d":"M4 19h6v-2H4v2zM20 5H4v2h16V5zm-3 6H4v2h13.25c1.1 0 2 .9 2 2s-.9 2-2 2H15v-2l-3 3l3 3v-2h2c2.21 0 4-1.79 4-4s-1.79-4-4-4z"}]}]}],false]}],["$","code",null,{"className":"nextra-code","dir":"ltr","children":[["$","span",null,{"children":[["$","span",null,{"style":{"--shiki-light":"#D73A49","--shiki-dark":"#F97583"},"children":"import"}],["$","span",null,{"style":{"--shiki-light":"#24292E","--shiki-dark":"#E1E4E8"},"children":" { parseTimesheet, safeParseTimesheet } "}],["$","span",null,{"style":{"--shiki-light":"#D73A49","--shiki-dark":"#F97583"},"children":"from"}],["$","span",null,{"style":{"--shiki-light":"#032F62","--shiki-dark":"#9ECBFF"},"children":" \"@telekinesis/schema\""}],["$","span",null,{"style":{"--shiki-light":"#24292E","--shiki-dark":"#E1E4E8"},"children":";"}]]}],"\n",["$","span",null,{"children":" "}],"\n",["$","span",null,{"children":[["$","span",null,{"style":{"--shiki-light":"#6F42C1","--shiki-dark":"#B392F0"},"children":"parseTimesheet"}],["$","span",null,{"style":{"--shiki-light":"#24292E","--shiki-dark":"#E1E4E8"},"children":"(json);                "}],["$","span",null,{"style":{"--shiki-light":"#6A737D","--shiki-dark":"#6A737D"},"children":"// throws ZodError on problems"}]]}],"\n",["$","span",null,{"children":[["$","span",null,{"style":{"--shiki-light":"#D73A49","--shiki-dark":"#F97583"},"children":"const"}],["$","span",null,{"style":{"--shiki-light":"#005CC5","--shiki-dark":"#79B8FF"},"children":" r"}],["$","span",null,{"style":{"--shiki-light":"#D73A49","--shiki-dark":"#F97583"},"children":" ="}],["$","span",null,{"style":{"--shiki-light":"#6F42C1","--shiki-dark":"#B392F0"},"children":" safeParseTimesheet"}],["$","span",null,{"style":{"--shiki-light":"#24292E","--shiki-dark":"#E1E4E8"},"children":"(json);  "}],["$","span",null,{"style":{"--shiki-light":"#6A737D","--shiki-dark":"#6A737D"},"children":"// { success, data | error }"}]]}]]}]]}]]}]
e:["$","p",null,{"className":"x:not-first:mt-[1.25em] x:leading-7","children":["The CLI and the ",["$","$L6",null,{"href":"/studio","className":"x:focus-visible:nextra-focus x:text-primary-600 x:underline x:hover:no-underline x:decoration-from-font x:[text-underline-position:from-font]","children":"Studio"}]," both validate before recording, and the schema\nalso powers ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"layoutTimesheet()"}]," — the helper that projects this sequence onto an\nabsolute time axis for the visual editor."]}]
f:["$","$L13",null,{"children":["$","$14",null,{"name":"Next.MetadataOutlet","children":"$@15"}]}]
15:null
