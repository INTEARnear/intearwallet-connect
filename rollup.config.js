const typescript = require("@rollup/plugin-typescript");
const replace = require("@rollup/plugin-replace");

const buildTarget = process.env.BUILD_TARGET || "normal";
const isNearconnect = buildTarget === "nearconnect";

module.exports = {
    input: "src/index.ts",
    output: {
        file: isNearconnect ? "build/nearconnect.js" : "build/index.js",
        format: "esm",
    },
    plugins: [
        replace({
            values: {
                __NEARCONNECT__: isNearconnect ? "true" : "false",
            },
            preventAssignment: true,
        }),
        typescript({
            tsconfig: "./tsconfig.json",
            declaration: true,
        }),
    ],
    treeshake: true,
};
