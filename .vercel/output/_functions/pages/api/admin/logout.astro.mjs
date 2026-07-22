import { S as SESSION_COOKIE } from '../../../chunks/auth_toOKJSnr.mjs';
export { renderers } from '../../../renderers.mjs';

const prerender = false;
const POST = ({ cookies, redirect }) => {
  cookies.delete(SESSION_COOKIE, { path: "/" });
  return redirect("/admin/login");
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
