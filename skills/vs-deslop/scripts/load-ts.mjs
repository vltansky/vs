import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(new URL("./ts-hooks.mjs", import.meta.url));
