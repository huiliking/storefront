// https://nextjs.org/docs/basic-features/eslint#lint-staged

import path from "path";

const buildEslintCommand = (filenames) => {
	const files = filenames
		// Forward slashes: on Windows, lint-staged treats `\` as an escape and strips it
		// (`src\app\(root)\x.tsx` → `srcapp(root)x.tsx`), so ESLint finds no file.
		.map((filename) => path.relative(process.cwd(), filename).split(path.sep).join("/"))
		.map((filename) => `"${filename}"`)
		.join(" ");

	return `pnpm eslint --fix ${files}`;
};

const config = {
	"*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}": [buildEslintCommand],
	"*.*": "prettier --write --ignore-unknown",
};

export default config;
