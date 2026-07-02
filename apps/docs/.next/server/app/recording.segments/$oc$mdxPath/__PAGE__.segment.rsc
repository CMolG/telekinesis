1:"$Sreact.fragment"
2:I[12157,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"TOCProvider"]
3:I[1674,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"Sidebar"]
4:I[51845,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"ClientWrapper"]
6:I[92484,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"HeadingAnchor"]
e:I[30552,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"ToggleWordWrapButton"]
f:I[93529,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],""]
10:I[35073,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"OutletBoundary"]
11:"$Sreact.suspense"
5:T489,---
title: Recording
---

# Recording

`@telekinesis/engine` drives the page with Playwright and captures a **silent**
video plus a timestamped `audio-map.json`. `@telekinesis/render` (ffmpeg) then
either mixes audio into an MP4 or encodes a GIF.

## The pipeline

1. Launch Chromium with `recordVideo` at the timesheet resolution.
2. Navigate and wait for `window.__telekinesis.ready`.
3. Walk the timeline — visuals through the in-page runtime (awaited so the
   animation is captured), real I/O through Playwright locators.
4. Record `{ profile, asset, t }` for every sound-bearing action.
5. Close the context (flushing the `.webm`) and write `audio-map.json`.

## Audio — mixed after the fact

Headless CI has no sound card, so we never play audio while recording. The
renderer lays each cue at its exact millisecond offset with ffmpeg
`adelay` + `amix`:

```
[1:a]adelay=2400:all=1[a1]; [2:a]adelay=3120:all=1[a2]; … amix=inputs=N[aout]
```

Deterministic, reproducible, and CI-friendly — no virtual audio servers.

## GIFs skip audio

A GIF carries no sound, so [GIF export](/gif-export) plugs straight into the
silent `.webm` — no mixing step.0:{"rsc":["$","$1","c",{"children":[["$","div",null,{"className":"x:mx-auto x:flex x:max-w-(--nextra-content-width)","children":["$","$L2",null,{"value":[{"value":"The pipeline","id":"the-pipeline","depth":2},{"value":"Audio — mixed after the fact","id":"audio--mixed-after-the-fact","depth":2},{"value":"GIFs skip audio","id":"gifs-skip-audio","depth":2}],"children":[["$","$L3",null,{}],["$","$L4",null,{"metadata":{"title":"Recording","filePath":"src/content/recording.mdx"},"sourceCode":"$5","children":[["$","div",null,{"id":"nextra-skip-nav"}],["$","main",null,{"data-pagefind-body":true,"children":[["$","h1",null,{"className":"x:tracking-tight x:text-slate-900 x:dark:text-slate-100 x:font-bold x:mt-2 x:text-4xl","children":["Recording","$undefined"]}],"\n",["$","p",null,{"className":"x:not-first:mt-[1.25em] x:leading-7","children":[["$","code",null,{"className":"nextra-code","dir":"ltr","children":"@telekinesis/engine"}]," drives the page with Playwright and captures a ",["$","strong",null,{"children":"silent"}],"\nvideo plus a timestamped ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"audio-map.json"}],". ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"@telekinesis/render"}]," (ffmpeg) then\neither mixes audio into an MP4 or encodes a GIF."]}],"\n",["$","h2",null,{"id":"the-pipeline","className":"x:tracking-tight x:text-slate-900 x:dark:text-slate-100 x:font-semibold x:target:animate-[fade-in_1.5s] x:mt-10 x:border-b x:pb-1 x:text-3xl nextra-border","children":["The pipeline",["$","$L6",null,{"id":"the-pipeline"}]]}],"\n",["$","ol",null,{"className":"x:[:is(ol,ul)_&]:my-[.75em] x:not-first:mt-[1.25em] x:list-decimal x:ms-6","children":["\n",["$","li",null,{"className":"x:my-[.5em]","children":["Launch Chromium with ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"recordVideo"}]," at the timesheet resolution."]}],"\n",["$","li",null,{"className":"x:my-[.5em]","children":["Navigate and wait for ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"window.__telekinesis.ready"}],"."]}],"\n",["$","li",null,{"className":"x:my-[.5em]","children":"Walk the timeline — visuals through the in-page runtime (awaited so the\nanimation is captured), real I/O through Playwright locators."}],"\n",["$","li",null,{"className":"x:my-[.5em]","children":["Record ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"{ profile, asset, t }"}]," for every sound-bearing action."]}],"\n",["$","li",null,{"className":"x:my-[.5em]","children":["Close the context (flushing the ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":".webm"}],") and write ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"audio-map.json"}],"."]}],"\n"]}],"\n",["$","h2",null,{"id":"audio--mixed-after-the-fact","className":"x:tracking-tight x:text-slate-900 x:dark:text-slate-100 x:font-semibold x:target:animate-[fade-in_1.5s] x:mt-10 x:border-b x:pb-1 x:text-3xl nextra-border","children":["Audio — mixed after the fact","$L7"]}],"\n","$L8","\n","$L9","\n","$La","\n","$Lb","\n","$Lc"]}]]}]]}]}],null,"$Ld"]}],"isPartial":false,"staleTime":300,"varyParams":null,"buildId":"zYaB9JnGaEWhozf8TwV7f"}
7:["$","$L6",null,{"id":"audio--mixed-after-the-fact"}]
8:["$","p",null,{"className":"x:not-first:mt-[1.25em] x:leading-7","children":["Headless CI has no sound card, so we never play audio while recording. The\nrenderer lays each cue at its exact millisecond offset with ffmpeg\n",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"adelay"}]," + ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"amix"}],":"]}]
9:["$","div",null,{"data-pagefind-ignore":"all","className":"nextra-code x:relative x:not-first:mt-[1.25em]","children":["$undefined",["$","pre",null,{"className":"x:group x:focus-visible:nextra-focus x:overflow-x-auto x:subpixel-antialiased x:text-[.9em] x:bg-white x:dark:bg-black x:py-4 x:ring-1 x:ring-inset x:ring-gray-300 x:dark:ring-neutral-700 x:contrast-more:ring-gray-900 x:contrast-more:dark:ring-gray-50 x:contrast-more:contrast-150 x:rounded-md not-prose","tabIndex":"0","children":[["$","div",null,{"className":"x:group-hover:opacity-100 x:group-focus:opacity-100 x:opacity-0 x:transition x:focus-within:opacity-100 x:flex x:gap-1 x:absolute x:right-4 x:top-2","children":[["$","$Le",null,{"children":["$","svg",null,{"viewBox":"0 0 24 24","fill":"currentColor","height":"1em","children":["$","path",null,{"d":"M4 19h6v-2H4v2zM20 5H4v2h16V5zm-3 6H4v2h13.25c1.1 0 2 .9 2 2s-.9 2-2 2H15v-2l-3 3l3 3v-2h2c2.21 0 4-1.79 4-4s-1.79-4-4-4z"}]}]}],false]}],["$","code",null,{"className":"nextra-code","dir":"ltr","children":["$","span",null,{"children":["$","span",null,{"children":"[1:a]adelay=2400:all=1[a1]; [2:a]adelay=3120:all=1[a2]; … amix=inputs=N[aout]"}]}]}]]}]]}]
a:["$","p",null,{"className":"x:not-first:mt-[1.25em] x:leading-7","children":"Deterministic, reproducible, and CI-friendly — no virtual audio servers."}]
b:["$","h2",null,{"id":"gifs-skip-audio","className":"x:tracking-tight x:text-slate-900 x:dark:text-slate-100 x:font-semibold x:target:animate-[fade-in_1.5s] x:mt-10 x:border-b x:pb-1 x:text-3xl nextra-border","children":["GIFs skip audio",["$","$L6",null,{"id":"gifs-skip-audio"}]]}]
c:["$","p",null,{"className":"x:not-first:mt-[1.25em] x:leading-7","children":["A GIF carries no sound, so ",["$","$Lf",null,{"href":"/gif-export","className":"x:focus-visible:nextra-focus x:text-primary-600 x:underline x:hover:no-underline x:decoration-from-font x:[text-underline-position:from-font]","children":"GIF export"}]," plugs straight into the\nsilent ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":".webm"}]," — no mixing step."]}]
d:["$","$L10",null,{"children":["$","$11",null,{"name":"Next.MetadataOutlet","children":"$@12"}]}]
12:null
