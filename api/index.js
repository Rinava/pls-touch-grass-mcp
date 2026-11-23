// Vercel's entry point: every path is rewritten here (see vercel.json) and the
// built app answers it. The server itself lives in src/hosted/.
import { appFromEnv } from "../dist/hosted/app.js";

export default appFromEnv();
