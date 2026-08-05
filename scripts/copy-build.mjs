import { copyFile } from "node:fs/promises";

await copyFile(new URL("../build/main.js", import.meta.url), new URL("../main.js", import.meta.url));
console.log("Copied build/main.js to main.js");
