// bb-plugin-sidebar — backend entry. Nothing here yet; the sidebar lives in app.tsx.
import type { BbPluginApi } from "@get-bb/plugin-sdk";

export default async function plugin(bb: BbPluginApi) {
  bb.log.info("loaded");
}
