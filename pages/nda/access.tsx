// /nda/access?token=… : the private link from the approval email. it checks the
// token and that the request is still approved, sets a signed HttpOnly cookie
// for 90 days, and redirects to /nda (always /nda, so there's no open redirect).
import type { GetServerSideProps, PageConfig } from "next";
import { cookieFor } from "@/lib/nda/flow";
import { accessCookie, privateHeaders } from "@/lib/nda/http";
import { getRequest } from "@/lib/nda/store";
import { verifyToken } from "@/lib/nda/token";

export const config: PageConfig = { unstable_runtimeJS: false };

export const getServerSideProps: GetServerSideProps = async ({ res, query }) => {
  privateHeaders(res);
  const v = verifyToken(query.token, "access");
  if (!v.ok) return { redirect: { destination: `/nda?e=${v.reason}`, permanent: false } };
  const r = getRequest(v.payload.r);
  if (!r || r.status !== "approved") return { redirect: { destination: "/nda?e=revoked", permanent: false } };
  const c = cookieFor(r.id);
  res.setHeader("Set-Cookie", accessCookie(c.value, c.maxAge));
  return { redirect: { destination: "/nda", permanent: false } };
};

export default function Access() {
  return null;
}
