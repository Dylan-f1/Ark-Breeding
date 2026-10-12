import type { Config } from "@react-router/dev/config";

export default {
  // Static build served by the API Worker; public pages (species, V1) will be pre-rendered.
  ssr: false,
} satisfies Config;
