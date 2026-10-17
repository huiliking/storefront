#!/usr/bin/env node
/**
 * Locale consistency guard (hard-fail gate).
 *
 * Every place that names a storefront language must agree with `LOCALE_DEFINITIONS`
 * (`src/config/locale.ts`). Nothing else enforces this: invalid env entries are dropped
 * silently, a wrong `graphqlLanguageCode` passes TypeScript (it is typed `string`), and a
 * missing translated-slug alias just falls back to the primary slug. See
 * `docs/adding-a-locale-or-market.md`.
 *
 * Errors (exit 1):
 *   1. `NEXT_PUBLIC_STOREFRONT_LOCALES`, `NEXT_PUBLIC_DEFAULT_LOCALE` and the locale side of
 *      `NEXT_PUBLIC_STOREFRONT_LOCALE_CHANNELS` only use defined locale slugs.
 *   2. Every `graphqlLanguageCode` is a real Saleor `LanguageCodeEnum` value
 *      (read from `schema.graphql` or generated `src/gql/graphql.ts`).
 *   3. Every defined locale has `messages/<slug>.json`.
 *   4. Each fragment in `src/graphql/LocaleSlugTranslations.graphql` has exactly one
 *      `slug<CODE>: translation(languageCode: <CODE>)` alias per distinct `graphqlLanguageCode`.
 * Info (no failure):
 *   - Defined locales not enabled by `NEXT_PUBLIC_STOREFRONT_LOCALES` — a per-shop subset is
 *     allowed by design, so shops can switch languages off without editing shared code.
 *
 * Run: pnpm run check:locales   (also runs before `next build` and in `pnpm run verify`)
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import nextEnv from "@next/env";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const rel = (...parts) => join(...parts).replace(/\\/g, "/");

// Same env resolution as Next.js itself (.env, .env.local, .env.production, process env).
nextEnv.loadEnvConfig(repoRoot);

const { LOCALE_DEFINITIONS } = await import(pathToFileURL(join(repoRoot, "src/config/locale.ts")).href);

const errors = [];
const info = [];
const definedSlugs = Object.keys(LOCALE_DEFINITIONS);
const isDefined = (slug) => Object.hasOwn(LOCALE_DEFINITIONS, slug);

// --- 1. Env lists only use defined slugs -------------------------------------------------
const csv = (raw) =>
	(raw ?? "")
		.split(",")
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);

const enabled = csv(process.env.NEXT_PUBLIC_STOREFRONT_LOCALES);
for (const slug of enabled) {
	if (!isDefined(slug)) {
		errors.push(
			`NEXT_PUBLIC_STOREFRONT_LOCALES contains "${slug}", which is not in LOCALE_DEFINITIONS ` +
				`(defined: ${definedSlugs.join(", ")}). It would be dropped silently.`,
		);
	}
}

const defaultLocale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE?.trim().toLowerCase();
if (defaultLocale && !isDefined(defaultLocale)) {
	errors.push(
		`NEXT_PUBLIC_DEFAULT_LOCALE="${defaultLocale}" is not in LOCALE_DEFINITIONS; it would fall back to "en".`,
	);
}

for (const pair of csv(process.env.NEXT_PUBLIC_STOREFRONT_LOCALE_CHANNELS)) {
	const [slug] = pair.split(":");
	if (slug && !isDefined(slug)) {
		errors.push(`NEXT_PUBLIC_STOREFRONT_LOCALE_CHANNELS pair "${pair}" uses undefined locale "${slug}".`);
	}
}

if (enabled.length > 0) {
	const disabled = definedSlugs.filter((slug) => !enabled.includes(slug));
	if (disabled.length > 0) {
		info.push(`Defined but not enabled in NEXT_PUBLIC_STOREFRONT_LOCALES: ${disabled.join(", ")}`);
	}
}

// --- 2. graphqlLanguageCode values exist in Saleor's LanguageCodeEnum -------------------
function readLanguageCodeEnum() {
	const schemaPath = join(repoRoot, "schema.graphql");
	if (existsSync(schemaPath)) {
		const block = readFileSync(schemaPath, "utf8").match(/enum LanguageCodeEnum\s*\{([\s\S]*?)\}/);
		if (block) {
			return {
				source: "schema.graphql",
				values: new Set(block[1].match(/^\s*([A-Z][A-Z0-9_]*)\s*$/gm)?.map((v) => v.trim()) ?? []),
			};
		}
	}
	const gqlPath = join(repoRoot, "src/gql/graphql.ts");
	if (existsSync(gqlPath)) {
		const block = readFileSync(gqlPath, "utf8").match(
			/export (?:enum|type) LanguageCodeEnum\s*=?\s*\{?([\s\S]*?)(?:\};|;\n\n)/,
		);
		if (block) {
			return {
				source: "src/gql/graphql.ts",
				values: new Set([...block[1].matchAll(/['"]([A-Z][A-Z0-9_]*)['"]/g)].map((m) => m[1])),
			};
		}
	}
	return null;
}

const languageEnum = readLanguageCodeEnum();
const codes = [...new Set(Object.values(LOCALE_DEFINITIONS).map((d) => d.graphqlLanguageCode))];

if (!languageEnum || languageEnum.values.size === 0) {
	info.push("LanguageCodeEnum not found (no schema.graphql or generated src/gql) — skipped check 2.");
} else {
	for (const [slug, def] of Object.entries(LOCALE_DEFINITIONS)) {
		if (!languageEnum.values.has(def.graphqlLanguageCode)) {
			const hint = def.graphqlLanguageCode.includes("-")
				? ` GraphQL enum values use underscores (e.g. "${def.graphqlLanguageCode.replace(/-/g, "_")}").`
				: "";
			errors.push(
				`LOCALE_DEFINITIONS["${slug}"].graphqlLanguageCode="${def.graphqlLanguageCode}" is not a ` +
					`Saleor LanguageCodeEnum value (${languageEnum.source}).${hint}`,
			);
		}
	}
}

// --- 3. UI message catalogs exist --------------------------------------------------------
for (const slug of definedSlugs) {
	if (!existsSync(join(repoRoot, "messages", `${slug}.json`))) {
		errors.push(`Missing ${rel("messages", `${slug}.json`)} for defined locale "${slug}".`);
	}
}

// --- 4. Translated-slug aliases match graphqlLanguageCode -------------------------------
const fragmentsPath = join(repoRoot, "src/graphql/LocaleSlugTranslations.graphql");
if (!existsSync(fragmentsPath)) {
	errors.push(`Missing ${rel("src/graphql/LocaleSlugTranslations.graphql")}.`);
} else {
	const source = readFileSync(fragmentsPath, "utf8");
	const fragments = [...source.matchAll(/fragment\s+(\w+)\s+on\s+\w+\s*\{([\s\S]*?)\n\}/g)];
	if (fragments.length === 0) {
		errors.push("No fragments found in LocaleSlugTranslations.graphql.");
	}
	for (const [, name, body] of fragments) {
		const aliases = [...body.matchAll(/slug(\w+)\s*:\s*translation\(\s*languageCode:\s*(\w+)\s*\)/g)];
		const aliasCodes = new Set();
		for (const [, aliasCode, argCode] of aliases) {
			if (aliasCode !== argCode) {
				errors.push(`${name}: alias slug${aliasCode} requests languageCode ${argCode} (must match).`);
			}
			aliasCodes.add(argCode);
		}
		const missing = codes.filter((c) => !aliasCodes.has(c));
		const extra = [...aliasCodes].filter((c) => !codes.includes(c));
		if (missing.length > 0) {
			errors.push(`${name}: missing slug alias for ${missing.map((c) => `slug${c}`).join(", ")}.`);
		}
		if (extra.length > 0) {
			errors.push(`${name}: alias for codes no locale uses: ${extra.map((c) => `slug${c}`).join(", ")}.`);
		}
	}
}

// --- Report -------------------------------------------------------------------------------
for (const line of info) {
	console.log(`ℹ check-locales: ${line}`);
}
if (errors.length > 0) {
	console.error(`\n✖ check-locales: ${errors.length} problem(s)\n`);
	for (const line of errors) {
		console.error(`  - ${line}`);
	}
	console.error("\nSee docs/adding-a-locale-or-market.md\n");
	process.exit(1);
}
console.log(
	`✔ check-locales: ${definedSlugs.length} locales consistent across env, LanguageCodeEnum, messages and slug fragments.`,
);
