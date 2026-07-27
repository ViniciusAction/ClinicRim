import 'piccolore';
import { o as decodeKey } from './chunks/astro/server_BUPcWb2m.mjs';
import 'clsx';
import './chunks/astro-designed-error-pages_B60K0O8y.mjs';
import 'es-module-lexer';
import { N as NOOP_MIDDLEWARE_FN } from './chunks/noop-middleware_f6iSMi5p.mjs';

function sanitizeParams(params) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.normalize().replace(/#/g, "%23").replace(/\?/g, "%3F")];
      }
      return [key, value];
    })
  );
}
function getParameter(part, params) {
  if (part.spread) {
    return params[part.content.slice(3)] || "";
  }
  if (part.dynamic) {
    if (!params[part.content]) {
      throw new TypeError(`Missing parameter: ${part.content}`);
    }
    return params[part.content];
  }
  return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]");
}
function getSegment(segment, params) {
  const segmentPath = segment.map((part) => getParameter(part, params)).join("");
  return segmentPath ? "/" + segmentPath : "";
}
function getRouteGenerator(segments, addTrailingSlash) {
  return (params) => {
    const sanitizedParams = sanitizeParams(params);
    let trailing = "";
    if (addTrailingSlash === "always" && segments.length) {
      trailing = "/";
    }
    const path = segments.map((segment) => getSegment(segment, sanitizedParams)).join("") + trailing;
    return path || "/";
  };
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback);
    }),
    isIndex: rawRouteData.isIndex,
    origin: rawRouteData.origin
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  const componentMetadata = new Map(serializedManifest.componentMetadata);
  const inlinedScripts = new Map(serializedManifest.inlinedScripts);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  const serverIslandNameMap = new Map(serializedManifest.serverIslandNameMap);
  const key = decodeKey(serializedManifest.key);
  return {
    // in case user middleware exists, this no-op middleware will be reassigned (see plugin-ssr.ts)
    middleware() {
      return { onRequest: NOOP_MIDDLEWARE_FN };
    },
    ...serializedManifest,
    assets,
    componentMetadata,
    inlinedScripts,
    clientDirectives,
    routes,
    serverIslandNameMap,
    key
  };
}

const manifest = deserializeManifest({"hrefRoot":"file:///D:/Cursos/medico_blog_astro-teste/","cacheDir":"file:///D:/Cursos/medico_blog_astro-teste/node_modules/.astro/","outDir":"file:///D:/Cursos/medico_blog_astro-teste/dist/","srcDir":"file:///D:/Cursos/medico_blog_astro-teste/src/","publicDir":"file:///D:/Cursos/medico_blog_astro-teste/public/","buildClientDir":"file:///D:/Cursos/medico_blog_astro-teste/dist/client/","buildServerDir":"file:///D:/Cursos/medico_blog_astro-teste/dist/server/","adapterName":"@astrojs/vercel","routes":[{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"page","component":"_server-islands.astro","params":["name"],"segments":[[{"content":"_server-islands","dynamic":false,"spread":false}],[{"content":"name","dynamic":true,"spread":false}]],"pattern":"^\\/_server-islands\\/([^/]+?)\\/?$","prerender":false,"isIndex":false,"fallbackRoutes":[],"route":"/_server-islands/[name]","origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"404.html","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/index.D6IJc6QM.css"}],"routeData":{"route":"/404","isIndex":false,"type":"page","pattern":"^\\/404\\/?$","segments":[[{"content":"404","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/404.astro","pathname":"/404","prerender":true,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"blog/index.html","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/index.D6IJc6QM.css"}],"routeData":{"route":"/blog","isIndex":true,"type":"page","pattern":"^\\/blog\\/?$","segments":[[{"content":"blog","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/blog/index.astro","pathname":"/blog","prerender":true,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"rss.xml","links":[],"scripts":[],"styles":[],"routeData":{"route":"/rss.xml","isIndex":false,"type":"endpoint","pattern":"^\\/rss\\.xml\\/?$","segments":[[{"content":"rss.xml","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/rss.xml.ts","pathname":"/rss.xml","prerender":true,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"index.html","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/index.D6IJc6QM.css"}],"routeData":{"route":"/","isIndex":true,"type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","prerender":true,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_image","pattern":"^\\/_image\\/?$","segments":[[{"content":"_image","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/astro/dist/assets/endpoint/generic.js","pathname":"/_image","prerender":false,"fallbackRoutes":[],"origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/index.D6IJc6QM.css"}],"routeData":{"route":"/admin/login","isIndex":false,"type":"page","pattern":"^\\/admin\\/login\\/?$","segments":[[{"content":"admin","dynamic":false,"spread":false}],[{"content":"login","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/admin/login.astro","pathname":"/admin/login","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/index.D6IJc6QM.css"}],"routeData":{"route":"/admin/novo","isIndex":false,"type":"page","pattern":"^\\/admin\\/novo\\/?$","segments":[[{"content":"admin","dynamic":false,"spread":false}],[{"content":"novo","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/admin/novo.astro","pathname":"/admin/novo","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/index.D6IJc6QM.css"}],"routeData":{"route":"/admin","isIndex":true,"type":"page","pattern":"^\\/admin\\/?$","segments":[[{"content":"admin","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/admin/index.astro","pathname":"/admin","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/admin/logout","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/admin\\/logout\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"admin","dynamic":false,"spread":false}],[{"content":"logout","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/admin/logout.ts","pathname":"/api/admin/logout","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}}],"site":"https://www.clinicarim.com.br","base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["D:/Cursos/medico_blog_astro-teste/src/pages/admin/index.astro",{"propagation":"none","containsHead":true}],["D:/Cursos/medico_blog_astro-teste/src/pages/admin/login.astro",{"propagation":"none","containsHead":true}],["D:/Cursos/medico_blog_astro-teste/src/pages/admin/novo.astro",{"propagation":"none","containsHead":true}],["D:/Cursos/medico_blog_astro-teste/src/pages/blog/[slug].astro",{"propagation":"in-tree","containsHead":true}],["D:/Cursos/medico_blog_astro-teste/src/pages/404.astro",{"propagation":"none","containsHead":true}],["D:/Cursos/medico_blog_astro-teste/src/pages/blog/[page].astro",{"propagation":"in-tree","containsHead":true}],["D:/Cursos/medico_blog_astro-teste/src/pages/blog/especialidade/[specialty].astro",{"propagation":"in-tree","containsHead":true}],["D:/Cursos/medico_blog_astro-teste/src/pages/blog/index.astro",{"propagation":"in-tree","containsHead":true}],["D:/Cursos/medico_blog_astro-teste/src/pages/index.astro",{"propagation":"in-tree","containsHead":true}],["\u0000astro:content",{"propagation":"in-tree","containsHead":false}],["D:/Cursos/medico_blog_astro-teste/src/lib/blog.ts",{"propagation":"in-tree","containsHead":false}],["D:/Cursos/medico_blog_astro-teste/src/components/sections/BlogPreview.astro",{"propagation":"in-tree","containsHead":false}],["\u0000@astro-page:src/pages/index@_@astro",{"propagation":"in-tree","containsHead":false}],["\u0000@astrojs-ssr-virtual-entry",{"propagation":"in-tree","containsHead":false}],["\u0000@astro-page:src/pages/blog/[page]@_@astro",{"propagation":"in-tree","containsHead":false}],["\u0000@astro-page:src/pages/blog/[slug]@_@astro",{"propagation":"in-tree","containsHead":false}],["\u0000@astro-page:src/pages/blog/especialidade/[specialty]@_@astro",{"propagation":"in-tree","containsHead":false}],["\u0000@astro-page:src/pages/blog/index@_@astro",{"propagation":"in-tree","containsHead":false}],["D:/Cursos/medico_blog_astro-teste/src/pages/rss.xml.ts",{"propagation":"in-tree","containsHead":false}],["\u0000@astro-page:src/pages/rss.xml@_@ts",{"propagation":"in-tree","containsHead":false}]],"renderers":[],"clientDirectives":[["idle","(()=>{var l=(n,t)=>{let i=async()=>{await(await n())()},e=typeof t.value==\"object\"?t.value:void 0,s={timeout:e==null?void 0:e.timeout};\"requestIdleCallback\"in window?window.requestIdleCallback(i,s):setTimeout(i,s.timeout||200)};(self.Astro||(self.Astro={})).idle=l;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var n=(a,t)=>{let i=async()=>{await(await a())()};if(t.value){let e=matchMedia(t.value);e.matches?i():e.addEventListener(\"change\",i,{once:!0})}};(self.Astro||(self.Astro={})).media=n;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var a=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value==\"object\"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let l of e)if(l.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=a;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000@astro-page:node_modules/astro/dist/assets/endpoint/generic@_@js":"pages/_image.astro.mjs","\u0000@astro-page:src/pages/404@_@astro":"pages/404.astro.mjs","\u0000@astro-page:src/pages/admin/index@_@astro":"pages/admin.astro.mjs","\u0000@astro-page:src/pages/admin/login@_@astro":"pages/admin/login.astro.mjs","\u0000@astro-page:src/pages/admin/novo@_@astro":"pages/admin/novo.astro.mjs","\u0000@astro-page:src/pages/api/admin/logout@_@ts":"pages/api/admin/logout.astro.mjs","\u0000@astro-page:src/pages/blog/[page]@_@astro":"pages/blog/_page_.astro.mjs","\u0000@astro-page:src/pages/blog/[slug]@_@astro":"pages/blog/_slug_.astro.mjs","\u0000@astro-page:src/pages/blog/especialidade/[specialty]@_@astro":"pages/blog/especialidade/_specialty_.astro.mjs","\u0000@astro-page:src/pages/blog/index@_@astro":"pages/blog.astro.mjs","\u0000@astro-page:src/pages/index@_@astro":"pages/index.astro.mjs","\u0000@astro-page:src/pages/rss.xml@_@ts":"pages/rss.xml.astro.mjs","\u0000@astrojs-ssr-virtual-entry":"entry.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000astro-internal:middleware":"_astro-internal_middleware.mjs","\u0000virtual:astro:actions/noop-entrypoint":"noop-entrypoint.mjs","\u0000@astrojs-ssr-adapter":"_@astrojs-ssr-adapter.mjs","\u0000@astrojs-manifest":"manifest_BYXNEPwZ.mjs","D:/Cursos/medico_blog_astro-teste/node_modules/astro/dist/assets/services/sharp.js":"chunks/sharp_9T7KUHoX.mjs","D:\\Cursos\\medico_blog_astro-teste\\.astro\\content-assets.mjs":"chunks/content-assets_CTp0xuBP.mjs","D:\\Cursos\\medico_blog_astro-teste\\.astro\\content-modules.mjs":"chunks/content-modules_Dz-S_Wwv.mjs","\u0000astro:data-layer-content":"chunks/_astro_data-layer-content_CK5PAPY9.mjs","@/components/react/ContactForm.tsx":"_astro/ContactForm.Bkk7po6K.js","@/components/react/DoctorsCarousel.tsx":"_astro/DoctorsCarousel.CeoyPEZy.js","@/components/react/FaqAccordion.tsx":"_astro/FaqAccordion.DsC6nlfE.js","@/components/react/MapEmbed.tsx":"_astro/MapEmbed.Cp7m_1uW.js","@astrojs/react/client.js":"_astro/client.CoDUGm7a.js","astro:scripts/before-hydration.js":""},"inlinedScripts":[],"assets":["/_astro/capa-endocrinologia.BuNwwDWP.svg","/_astro/capa-nefrologia.BeBJD-oR.svg","/_astro/location.z57Vi-jz.jpg","/_astro/clinica-018.Dpz4WVaE.jpg","/_astro/clinica-059.BDaCvsOH.jpg","/_astro/clinica-062.myr101PK.jpg","/_astro/clinica-060.BGBE9G5A.jpg","/_astro/clinica-061.w-TAJdFk.jpg","/_astro/clinica-063.xSjOv-VO.jpg","/_astro/clinica-064.BuwDnN3c.jpg","/_astro/clinica-065.BXoNTEmx.jpg","/_astro/clinica-067.DTPq2gSt.jpg","/_astro/clinica-066.BLnua_TV.jpg","/_astro/clinica-069.BmPbyh8a.jpg","/_astro/clinica-068.BM6DFsRC.jpg","/_astro/clinica-071.vp22p2gv.jpg","/_astro/clinica-072.2hWEMgIK.jpg","/_astro/clinica-070.2wnRB3UT.jpg","/_astro/clinica-074.DvOSX2dM.jpg","/_astro/clinica-073.CIFl2Xjq.jpg","/_astro/clinica-075.smJb1izW.jpg","/_astro/clinica-077.BrdfPCkd.jpg","/_astro/clinica-078.D1EJig5u.jpg","/_astro/clinica-079.C62WPcG6.jpg","/_astro/clinica-076.DKbkct0w.jpg","/_astro/clinica-080.CJMAgAJu.jpg","/_astro/clinica-081.CllGWufB.jpg","/_astro/clinica-082.DsDf26el.jpg","/_astro/clinica-084.ZMzDWJJC.jpg","/_astro/clinica-091.74M0_Tc9.jpg","/_astro/clinica-094.BVhGnNry.jpg","/_astro/clinica-095.Kn-k2VIP.jpg","/_astro/clinica-100._0pX8bgN.jpg","/_astro/clinica-102.CuG7TotS.jpg","/_astro/clinica-103.BbPtEIAq.jpg","/_astro/clinica-104.CIkhBBbr.jpg","/_astro/clinica-110.3GmlKX-R.jpg","/_astro/clinica-111.BAYwzKIw.jpg","/_astro/clinica-112.CvqM1q39.jpg","/_astro/clinica-116.Dw7mfj45.jpg","/_astro/clinica-117.CY__52gP.jpg","/_astro/clinica-123.DMxW1a5D.jpg","/_astro/clinica-126.Wdyxpjco.jpg","/_astro/clinica-131.BqUgeFa4.jpg","/_astro/clinica-132.CwSbcAQR.jpg","/_astro/dr-alexandre.Cxsip1IF.jpg","/_astro/clinica-133.VETMF3_5.jpg","/_astro/dra-bruna.fc9O97l8.jpg","/_astro/dr-igor.DuvKbK0Q.jpg","/_astro/clinica-002.CW4uz7DU.jpg","/_astro/clinica-001.CKl-CFtY.jpg","/_astro/clinica-004.CzgpnJ85.jpg","/_astro/clinica-006.BC0pB2bx.jpg","/_astro/clinica-003.D0ZUdiDl.jpg","/_astro/clinica-005.o3M26pnl.jpg","/_astro/clinica-007.aOh0ifAu.jpg","/_astro/clinica-010.6p3hIEYc.jpg","/_astro/clinica-011.DIK2tR3S.jpg","/_astro/clinica-012.C6Cs6t-0.jpg","/_astro/clinica-013.CF5hshr5.jpg","/_astro/clinica-015.vonCH69Q.jpg","/_astro/clinica-017.cFIiCJnM.jpg","/_astro/clinica-019.CVEDCDih.jpg","/_astro/clinica-016.B0KRuXTa.jpg","/_astro/clinica-014.HncXYJwY.jpg","/_astro/clinica-021.CEifxN70.jpg","/_astro/clinica-022.KUz4u73b.jpg","/_astro/clinica-023.CwISM-D_.jpg","/_astro/clinica-027.8uRIbwzw.jpg","/_astro/clinica-020.BixpiDIe.jpg","/_astro/clinica-025.Bs-dG1Qv.jpg","/_astro/clinica-024.-CjJ5sGp.jpg","/_astro/clinica-028.yrdNcTJu.jpg","/_astro/clinica-026.M0q5khxU.jpg","/_astro/clinica-029.LRFyLTyr.jpg","/_astro/clinica-030.BFXSxnOY.jpg","/_astro/clinica-033.BiOUpn4s.jpg","/_astro/clinica-031.HNwtV_ma.jpg","/_astro/clinica-034.BfmEvJbY.jpg","/_astro/clinica-032.DIFkxo_4.jpg","/_astro/clinica-037.CM_rohII.jpg","/_astro/clinica-036.Bg4yOYEo.jpg","/_astro/clinica-039.DXn_Ev4U.jpg","/_astro/clinica-041.BkjRm57X.jpg","/_astro/clinica-040.Bsrn_23P.jpg","/_astro/clinica-043.xrfuCw3u.jpg","/_astro/clinica-045.D54CGPjz.jpg","/_astro/clinica-042.BXdpGknf.jpg","/_astro/clinica-044.CM1wpmty.jpg","/_astro/clinica-046.X8a1GhFK.jpg","/_astro/clinica-050.WQRt_Tsk.jpg","/_astro/clinica-048.CiAlLhkD.jpg","/_astro/clinica-049.B74XtWsa.jpg","/_astro/clinica-047.C_Aj4wXz.jpg","/_astro/clinica-051.ZeN3C7PZ.jpg","/_astro/clinica-052.knPYO9Fh.jpg","/_astro/clinica-053.3cBvdOOm.jpg","/_astro/clinica-057.CMzAijQw.jpg","/_astro/clinica-058.C5yUqjeo.jpg","/_astro/clinica-083.DtMvB94k.jpg","/_astro/clinica-088.CgOsIpqn.jpg","/_astro/clinica-085.BS41XZSw.jpg","/_astro/clinica-086.BF1QQyHE.jpg","/_astro/clinica-089.t-XVU-Qm.jpg","/_astro/clinica-092.CclFN2Eb.jpg","/_astro/clinica-090.CKz7IcKu.jpg","/_astro/clinica-093.BO_Uakfn.jpg","/_astro/clinica-087.B8YwMkLe.jpg","/_astro/clinica-096.CmjYECdh.jpg","/_astro/clinica-099.BuAwGEXP.jpg","/_astro/clinica-097.BeSOSRdR.jpg","/_astro/clinica-101.DT50Q7fG.jpg","/_astro/clinica-105.BbSE-6sq.jpg","/_astro/clinica-098.DhnOpRQt.jpg","/_astro/clinica-109.BSSeFTfx.jpg","/_astro/clinica-106.CIFXpg7F.jpg","/_astro/clinica-114.DYeCYYWM.jpg","/_astro/clinica-115.3mYPmxzK.jpg","/_astro/clinica-113.dOGvjYf5.jpg","/_astro/clinica-108.BUoRtg-A.jpg","/_astro/clinica-118.DGr20F35.jpg","/_astro/clinica-119.DeTLDe4P.jpg","/_astro/clinica-120.oBRyhwHG.jpg","/_astro/clinica-121.D-abJQKg.jpg","/_astro/clinica-122.v3OEl44l.jpg","/_astro/clinica-124.DK97G86q.jpg","/_astro/clinica-129.BWCWZwVj.jpg","/_astro/clinica-127.CPW-_euN.jpg","/_astro/clinica-130.CoFEDaWx.jpg","/_astro/clinica-125.DCeACFDd.jpg","/_astro/clinica-128.BWHmzriY.jpg","/_astro/clinica-008.5tf5_lDu.jpg","/_astro/clinica-009.s1JYwu10.jpg","/_astro/clinica-038.B6dl4njx.jpg","/_astro/clinica-054.DRYlPEqx.jpg","/_astro/clinica-056.D8Oz6H-B.jpg","/_astro/clinica-107.AJKSfYSW.jpg","/_astro/clinica-rim-mono-horizontal-trim.DQ7cxO1Y.png","/_astro/clinica-rim-horizontal.DM1gA5pi.jpg","/_astro/clinica-rim-mono-stacked-trim.CYdMPctZ.png","/_astro/clinica-055.Cyq-qu1A.jpg","/_astro/clinica-rim-classica.CtWXCMu3.png","/_astro/index.D6IJc6QM.css","/favicon.svg","/robots.txt","/_astro/client.CoDUGm7a.js","/_astro/ContactForm.Bkk7po6K.js","/_astro/DoctorsCarousel.CeoyPEZy.js","/_astro/FaqAccordion.DsC6nlfE.js","/_astro/index.Chrs2Z0F.js","/_astro/index.Ddwmt3P4.js","/_astro/index.DVJPHvh0.js","/_astro/jsx-runtime.D_zvdyIk.js","/_astro/MapEmbed.Cp7m_1uW.js","/404.html","/blog/index.html","/rss.xml","/index.html"],"buildFormat":"directory","checkOrigin":true,"allowedDomains":[],"actionBodySizeLimit":1048576,"serverIslandNameMap":[],"key":"dLQIUxe04/1ZLZkeye3gI1a/I54LKsOMmSSVfzpdm/4="});
if (manifest.sessionConfig) manifest.sessionConfig.driverModule = null;

export { manifest };
