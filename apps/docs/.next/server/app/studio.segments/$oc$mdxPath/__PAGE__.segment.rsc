1:"$Sreact.fragment"
2:I[12157,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"TOCProvider"]
3:I[1674,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"Sidebar"]
4:I[51845,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"ClientWrapper"]
6:I[83302,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"Frame"]
7:I[83302,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"DemoGif"]
8:I[83302,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"Divider"]
e:I[92484,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"HeadingAnchor"]
f:I[30552,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"ToggleWordWrapButton"]
10:I[35073,["/_next/static/chunks/28h-e-h2k_8f2.js","/_next/static/chunks/3bbqr5max4563.js","/_next/static/chunks/03uwhtfxw-6bl.js","/_next/static/chunks/32gn39rr_5kez.js","/_next/static/chunks/3ss-ole4215_i.js"],"OutletBoundary"]
11:"$Sreact.suspense"
5:T6ee,---
title: Studio
---

# The Studio

The Studio is an interactive, CapCut-style editor for timesheets. It runs on a
rare local port (**57174**), embeds your app, shows which components are
Telekinetic, and lets you tune timing, transitions and effects with live
preview — then renders a GIF or MP4.

<Frame id="studio-shot" intent="studio-preview">
  <div className="tk-shot">
    <h3>🎬 A generative video editor</h3>
    <p>It doesn't guess at your UI. It collects your app's own <code>&lt;TelekineticFrame&gt;</code>s over a <code>postMessage</code> bridge and builds the editing surface from them: an X-ray of every frame, a timeline of your sequence, and a schema-driven inspector.</p>
  </div>
</Frame>

<DemoGif section="studio" caption="The editor is itself a Telekinetic page — of course it demos itself." />

<Divider />

## Launch it

```bash
# Edits the docs site by default
telekinesis studio

# Point it at any Telekinetic app
telekinesis studio --target http://localhost:3000 --port 57174
```

## How it works

1. **Bridge** — `<TelekinesisStage>` exposes the runtime over `postMessage`
   when the page is loaded in Studio mode (`?telekinesis-studio`). The Studio
   drives *any* app in an iframe, cross-origin.
2. **X-ray** — `listFrames()` + `getRect()` draw a badge over every Telekinetic
   component so you can see what's controllable.
3. **Timeline** — your sequential timesheet is projected onto an absolute time
   axis with `layoutTimesheet()`, rendered as draggable clips per lane.
4. **Preview** — ▶ Play performs the timesheet live in the embedded app; the
   playhead stays in sync. Click a clip to preview just that beat.
5. **Render** — export a validated `*.timesheet.json`, or render a GIF/MP4 via
   the recording sidecar.0:{"rsc":["$","$1","c",{"children":[["$","div",null,{"className":"x:mx-auto x:flex x:max-w-(--nextra-content-width)","children":["$","$L2",null,{"value":[{"value":"Launch it","id":"launch-it","depth":2},{"value":"How it works","id":"how-it-works","depth":2}],"children":[["$","$L3",null,{}],["$","$L4",null,{"metadata":{"title":"Studio","filePath":"src/content/studio.mdx"},"sourceCode":"$5","children":[["$","div",null,{"id":"nextra-skip-nav"}],["$","main",null,{"data-pagefind-body":true,"children":[["$","h1",null,{"className":"x:tracking-tight x:text-slate-900 x:dark:text-slate-100 x:font-bold x:mt-2 x:text-4xl","children":["The Studio","$undefined"]}],"\n",["$","p",null,{"className":"x:not-first:mt-[1.25em] x:leading-7","children":["The Studio is an interactive, CapCut-style editor for timesheets. It runs on a\nrare local port (",["$","strong",null,{"children":"57174"}],"), embeds your app, shows which components are\nTelekinetic, and lets you tune timing, transitions and effects with live\npreview — then renders a GIF or MP4."]}],"\n",["$","$L6",null,{"id":"studio-shot","intent":"studio-preview","children":["$","div",null,{"className":"tk-shot","children":[["$","h3",null,{"children":"🎬 A generative video editor"}],["$","p",null,{"children":["It doesn’t guess at your UI. It collects your app’s own ",["$","code",null,{"children":"<TelekineticFrame>"}],"s over a ",["$","code",null,{"children":"postMessage"}]," bridge and builds the editing surface from them: an X-ray of every frame, a timeline of your sequence, and a schema-driven inspector."]}]]}]}],"\n",["$","$L7",null,{"section":"studio","caption":"The editor is itself a Telekinetic page — of course it demos itself."}],"\n",["$","$L8",null,{}],"\n",["$","h2",null,{"id":"launch-it","className":"x:tracking-tight x:text-slate-900 x:dark:text-slate-100 x:font-semibold x:target:animate-[fade-in_1.5s] x:mt-10 x:border-b x:pb-1 x:text-3xl nextra-border","children":["Launch it","$L9"]}],"\n","$La","\n","$Lb","\n","$Lc"]}]]}]]}]}],null,"$Ld"]}],"isPartial":false,"staleTime":300,"varyParams":null,"buildId":"zYaB9JnGaEWhozf8TwV7f"}
9:["$","$Le",null,{"id":"launch-it"}]
a:["$","div",null,{"data-pagefind-ignore":"all","className":"nextra-code x:relative x:not-first:mt-[1.25em]","children":["$undefined",["$","pre",null,{"className":"x:group x:focus-visible:nextra-focus x:overflow-x-auto x:subpixel-antialiased x:text-[.9em] x:bg-white x:dark:bg-black x:py-4 x:ring-1 x:ring-inset x:ring-gray-300 x:dark:ring-neutral-700 x:contrast-more:ring-gray-900 x:contrast-more:dark:ring-gray-50 x:contrast-more:contrast-150 x:rounded-md not-prose","tabIndex":"0","children":[["$","div",null,{"className":"x:group-hover:opacity-100 x:group-focus:opacity-100 x:opacity-0 x:transition x:focus-within:opacity-100 x:flex x:gap-1 x:absolute x:right-4 x:top-2","children":[["$","$Lf",null,{"children":["$","svg",null,{"viewBox":"0 0 24 24","fill":"currentColor","height":"1em","children":["$","path",null,{"d":"M4 19h6v-2H4v2zM20 5H4v2h16V5zm-3 6H4v2h13.25c1.1 0 2 .9 2 2s-.9 2-2 2H15v-2l-3 3l3 3v-2h2c2.21 0 4-1.79 4-4s-1.79-4-4-4z"}]}]}],false]}],["$","code",null,{"className":"nextra-code","dir":"ltr","children":[["$","span",null,{"children":["$","span",null,{"style":{"--shiki-light":"#6A737D","--shiki-dark":"#6A737D"},"children":"# Edits the docs site by default"}]}],"\n",["$","span",null,{"children":[["$","span",null,{"style":{"--shiki-light":"#6F42C1","--shiki-dark":"#B392F0"},"children":"telekinesis"}],["$","span",null,{"style":{"--shiki-light":"#032F62","--shiki-dark":"#9ECBFF"},"children":" studio"}]]}],"\n",["$","span",null,{"children":" "}],"\n",["$","span",null,{"children":["$","span",null,{"style":{"--shiki-light":"#6A737D","--shiki-dark":"#6A737D"},"children":"# Point it at any Telekinetic app"}]}],"\n",["$","span",null,{"children":[["$","span",null,{"style":{"--shiki-light":"#6F42C1","--shiki-dark":"#B392F0"},"children":"telekinesis"}],["$","span",null,{"style":{"--shiki-light":"#032F62","--shiki-dark":"#9ECBFF"},"children":" studio"}],["$","span",null,{"style":{"--shiki-light":"#005CC5","--shiki-dark":"#79B8FF"},"children":" --target"}],["$","span",null,{"style":{"--shiki-light":"#032F62","--shiki-dark":"#9ECBFF"},"children":" http://localhost:3000"}],["$","span",null,{"style":{"--shiki-light":"#005CC5","--shiki-dark":"#79B8FF"},"children":" --port"}],["$","span",null,{"style":{"--shiki-light":"#005CC5","--shiki-dark":"#79B8FF"},"children":" 57174"}]]}]]}]]}]]}]
b:["$","h2",null,{"id":"how-it-works","className":"x:tracking-tight x:text-slate-900 x:dark:text-slate-100 x:font-semibold x:target:animate-[fade-in_1.5s] x:mt-10 x:border-b x:pb-1 x:text-3xl nextra-border","children":["How it works",["$","$Le",null,{"id":"how-it-works"}]]}]
c:["$","ol",null,{"className":"x:[:is(ol,ul)_&]:my-[.75em] x:not-first:mt-[1.25em] x:list-decimal x:ms-6","children":["\n",["$","li",null,{"className":"x:my-[.5em]","children":[["$","strong",null,{"children":"Bridge"}]," — ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"<TelekinesisStage>"}]," exposes the runtime over ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"postMessage"}],"\nwhen the page is loaded in Studio mode (",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"?telekinesis-studio"}],"). The Studio\ndrives ",["$","em",null,{"children":"any"}]," app in an iframe, cross-origin."]}],"\n",["$","li",null,{"className":"x:my-[.5em]","children":[["$","strong",null,{"children":"X-ray"}]," — ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"listFrames()"}]," + ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"getRect()"}]," draw a badge over every Telekinetic\ncomponent so you can see what’s controllable."]}],"\n",["$","li",null,{"className":"x:my-[.5em]","children":[["$","strong",null,{"children":"Timeline"}]," — your sequential timesheet is projected onto an absolute time\naxis with ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"layoutTimesheet()"}],", rendered as draggable clips per lane."]}],"\n",["$","li",null,{"className":"x:my-[.5em]","children":[["$","strong",null,{"children":"Preview"}]," — ▶ Play performs the timesheet live in the embedded app; the\nplayhead stays in sync. Click a clip to preview just that beat."]}],"\n",["$","li",null,{"className":"x:my-[.5em]","children":[["$","strong",null,{"children":"Render"}]," — export a validated ",["$","code",null,{"className":"nextra-code","dir":"ltr","children":"*.timesheet.json"}],", or render a GIF/MP4 via\nthe recording sidecar."]}],"\n"]}]
d:["$","$L10",null,{"children":["$","$11",null,{"name":"Next.MetadataOutlet","children":"$@12"}]}]
12:null
