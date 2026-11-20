import { recordRoutes } from "@/server/records";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = recordRoutes("companies");
export const GET = handlers.list;
export const POST = handlers.create;
